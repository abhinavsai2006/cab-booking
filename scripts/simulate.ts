import { io, Socket } from 'socket.io-client';
import { PrismaClient, RideStatus } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = process.env.API_URL || 'http://localhost:4000';

async function runSimulator() {
  console.log('🚗 Starting Autonomous Driver Simulator...');
  console.log(`📡 Connecting to API at ${API_URL}`);

  // Fetch online drivers
  const drivers = await prisma.driverProfile.findMany({
    where: { isOnline: true },
    include: { user: true, vehicle: true },
    take: 10,
  });

  if (drivers.length === 0) {
    console.error('No online drivers found in database. Run `pnpm seed` first.');
    process.exit(1);
  }

  console.log(`Found ${drivers.length} drivers to simulate.`);

  const sockets: Map<string, Socket> = new Map();

  for (const driver of drivers) {
    const socket = io(API_URL, {
      auth: {
        userId: driver.user.id,
        token: `demo_driver`,
      },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log(`[Simulator] Driver ${driver.user.name} connected (${socket.id})`);
      socket.emit('driver:online', {
        lat: driver.currentLat || 12.9716,
        lng: driver.currentLng || 77.5946,
      });
    });

    // Handle incoming offer
    socket.on('offer:new', async (offer: any) => {
      console.log(`\n🔔 [Offer Received] Driver ${driver.user.name} got ride offer for trip #${offer.rideId.slice(0, 8)}`);
      console.log(`   Pickup: ${offer.pickup.address} -> Dropoff: ${offer.dropoff.address}`);
      console.log(`   Estimated Fare: ₹${offer.estimatedFare} (${offer.distanceKm} km)`);

      // Auto-accept after 3-5 seconds
      const delay = Math.floor(3000 + Math.random() * 2000);
      console.log(`   ⏳ Driver will accept in ${(delay / 1000).toFixed(1)}s...`);

      setTimeout(() => {
        console.log(`   ✅ Driver ${driver.user.name} ACCEPTED offer #${offer.offerId.slice(0, 8)}`);
        socket.emit('offer:accept', { offerId: offer.offerId });

        // Simulate driving to pickup, arriving, starting with OTP, and completing
        simulateTripExecution(socket, driver, offer.rideId);
      }, delay);
    });

    sockets.set(driver.id, socket);
  }

  // Periodic location jitter to show alive moving cars on rider map
  setInterval(() => {
    for (const driver of drivers) {
      const socket = sockets.get(driver.id);
      if (socket && socket.connected) {
        const jitterLat = (Math.random() - 0.5) * 0.001;
        const jitterLng = (Math.random() - 0.5) * 0.001;
        const lat = (driver.currentLat || 12.9716) + jitterLat;
        const lng = (driver.currentLng || 77.5946) + jitterLng;
        socket.emit('driver:location', { lat, lng, heading: Math.floor(Math.random() * 360) });
      }
    }
  }, 4000);

  console.log('🚀 Simulator running. Leave this process open or test booking in Rider app.');
}

async function simulateTripExecution(socket: Socket, driver: any, rideId: string) {
  // Step 1: Drive to pickup (wait 5s)
  setTimeout(async () => {
    console.log(`[Trip #${rideId.slice(0, 8)}] Driver arrived at pickup!`);
    socket.emit('ride:arrived', { rideId });

    // Step 2: Fetch OTP from DB to auto-verify
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (ride && ride.otp) {
      setTimeout(() => {
        console.log(`[Trip #${rideId.slice(0, 8)}] Verifying OTP: ${ride.otp} and starting trip...`);
        socket.emit('ride:start', { rideId, otp: ride.otp });

        // Step 3: Complete trip after 8s of simulated driving
        setTimeout(() => {
          console.log(`[Trip #${rideId.slice(0, 8)}] Trip reached destination! Completing trip.`);
          socket.emit('ride:complete', { rideId });
        }, 8000);
      }, 3000);
    }
  }, 5000);
}

runSimulator().catch(console.error);
