import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from '../db/prisma.js';
import { redis } from '../services/redis.service.js';
import { dispatchService } from '../services/dispatch.service.js';
import { RideStateMachine } from '../services/ride-state-machine.js';
import { calculateFinalFareWithCap } from '@cab-app/shared';
import { RideStatus, Role } from '@prisma/client';

let ioInstance: SocketIOServer | null = null;

export function getSocketServer(): SocketIOServer | null {
  return ioInstance;
}

export function setupSocketIO(server: HttpServer): SocketIOServer {
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  ioInstance = io;

  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers['authorization'];
      const userId = (socket.handshake.auth?.userId || socket.handshake.query?.userId) as string;

      if (userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user) {
          (socket as any).user = user;
          return next();
        }
      }

      // Fallback in demo mode
      if (token && typeof token === 'string' && token.startsWith('demo_')) {
        const role = token.replace('demo_', '').toUpperCase() as Role;
        const user = await prisma.user.findFirst({ where: { role } });
        if (user) {
          (socket as any).user = user;
          return next();
        }
      }

      // Default demo user
      const defaultUser = await prisma.user.findFirst({ where: { role: 'RIDER' } });
      if (defaultUser) {
        (socket as any).user = defaultUser;
        return next();
      }

      return next();
    } catch {
      return next();
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    if (user) {
      socket.join(`user:${user.id}`);
      if (user.role === 'ADMIN') {
        socket.join('admin');
      }
    }

    // Join ride room
    socket.on('join:ride', ({ rideId }: { rideId: string }) => {
      if (rideId) {
        socket.join(`ride:${rideId}`);
      }
    });

    // Driver online
    socket.on('driver:online', async ({ lat, lng }: { lat: number; lng: number }) => {
      if (!user) return;
      const driver = await prisma.driverProfile.findUnique({
        where: { userId: user.id },
      });
      if (driver) {
        await prisma.driverProfile.update({
          where: { id: driver.id },
          data: { isOnline: true, currentLat: lat, currentLng: lng },
        });
        await redis.geoAdd('drivers:online', lng, lat, driver.id);
        io.emit('driver:status_changed', { driverId: driver.id, isOnline: true, lat, lng });
      }
    });

    // Driver offline
    socket.on('driver:offline', async () => {
      if (!user) return;
      const driver = await prisma.driverProfile.findUnique({
        where: { userId: user.id },
      });
      if (driver) {
        await prisma.driverProfile.update({
          where: { id: driver.id },
          data: { isOnline: false },
        });
        await redis.geoRemove('drivers:online', driver.id);
        io.emit('driver:status_changed', { driverId: driver.id, isOnline: false });
      }
    });

    // Driver location update
    socket.on(
      'driver:location',
      async ({
        lat,
        lng,
        heading = 0,
        rideId,
      }: {
        lat: number;
        lng: number;
        heading?: number;
        rideId?: string;
      }) => {
        if (!user) return;
        const driver = await prisma.driverProfile.findUnique({
          where: { userId: user.id },
        });
        if (driver) {
          // Update profile
          await prisma.driverProfile.update({
            where: { id: driver.id },
            data: { currentLat: lat, currentLng: lng, heading },
          });

          // Update Redis GEO
          if (driver.isOnline) {
            await redis.geoAdd('drivers:online', lng, lat, driver.id);
          }

          // If on a ride, broadcast to rider & record point
          if (rideId) {
            io.to(`ride:${rideId}`).emit('ride:driver_location', {
              rideId,
              driverId: driver.id,
              lat,
              lng,
              heading,
            });

            await prisma.rideLocationPoint.create({
              data: {
                rideId,
                driverId: driver.id,
                lat,
                lng,
                heading,
              },
            });
          }
        }
      }
    );

    // Offer response: accept
    socket.on('offer:accept', async ({ offerId }: { offerId: string }) => {
      if (!user) return;
      const driver = await prisma.driverProfile.findUnique({
        where: { userId: user.id },
      });
      if (driver) {
        try {
          await dispatchService.acceptOffer(offerId, driver.id);
        } catch (err: any) {
          socket.emit('error', { message: err.message });
        }
      }
    });

    // Offer response: decline
    socket.on('offer:decline', async ({ offerId }: { offerId: string }) => {
      if (!user) return;
      const driver = await prisma.driverProfile.findUnique({
        where: { userId: user.id },
      });
      if (driver) {
        await dispatchService.declineOffer(offerId, driver.id);
      }
    });

    // Ride arrived
    socket.on('ride:arrived', async ({ rideId }: { rideId: string }) => {
      try {
        const ride = await RideStateMachine.transition(rideId, RideStatus.DRIVER_ARRIVED);
        io.to(`ride:${rideId}`).emit('ride:updated', ride);
        io.to(`user:${ride.riderId}`).emit('ride:updated', ride);
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    // Ride start (OTP verification)
    socket.on('ride:start', async ({ rideId, otp }: { rideId: string; otp: string }) => {
      const ride = await prisma.ride.findUnique({ where: { id: rideId } });
      if (!ride) return;

      if (ride.otp !== otp) {
        socket.emit('error', { message: 'Incorrect OTP. Ask the rider for their 4-digit code.' });
        return;
      }

      try {
        const updated = await RideStateMachine.transition(rideId, RideStatus.IN_PROGRESS);
        io.to(`ride:${rideId}`).emit('ride:updated', updated);
        io.to(`user:${updated.riderId}`).emit('ride:updated', updated);
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    // Ride complete
    socket.on('ride:complete', async ({ rideId }: { rideId: string }) => {
      const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        include: { driver: true },
      });
      if (!ride) return;

      const finalFare = calculateFinalFareWithCap(
        ride.estimatedFare,
        ride.estimatedFare,
        false
      );

      try {
        const updated = await RideStateMachine.transition(rideId, RideStatus.COMPLETED, {
          finalFare,
        });

        // Credit driver earning (80% net, 20% platform commission)
        if (ride.driverId) {
          const commission = Math.round(finalFare * 0.2 * 100) / 100;
          const net = Math.round((finalFare - commission) * 100) / 100;

          await prisma.driverEarning.create({
            data: {
              rideId,
              driverId: ride.driverId,
              gross: finalFare,
              commission,
              net,
            },
          });

          await prisma.driverProfile.update({
            where: { id: ride.driverId },
            data: { completedTrips: { increment: 1 } },
          });
        }

        io.to(`ride:${rideId}`).emit('ride:updated', updated);
        io.to(`user:${updated.riderId}`).emit('ride:updated', updated);
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    // In-ride Chat
    socket.on(
      'chat:message',
      ({ rideId, message, senderRole }: { rideId: string; message: string; senderRole: string }) => {
        io.to(`ride:${rideId}`).emit('chat:message', {
          id: `msg-${Date.now()}`,
          rideId,
          senderId: user?.id,
          senderName: user?.name,
          senderRole,
          message,
          timestamp: new Date().toISOString(),
        });
      }
    );

    // SOS Trigger
    socket.on('sos:trigger', async ({ rideId, lat, lng }: { rideId?: string; lat: number; lng: number }) => {
      if (!user) return;

      const sos = await prisma.sosAlert.create({
        data: {
          userId: user.id,
          rideId,
          lat,
          lng,
          status: 'ACTIVE',
        },
        include: { user: true, ride: true },
      });

      // Alert Admin room immediately
      io.to('admin').emit('admin:sos', sos);
      socket.emit('sos:ack', { id: sos.id, status: 'ACTIVE', message: 'Emergency alert received. Help dispatched.' });
    });
  });

  return io;
}
