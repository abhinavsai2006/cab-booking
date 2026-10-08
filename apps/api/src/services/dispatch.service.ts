import { prisma } from '../db/prisma.js';
import { redis } from './redis.service.js';
import { RideStateMachine } from './ride-state-machine.js';
import { DISPATCH_CONFIG, haversineDistanceKm } from '@cab-app/shared';
import { RideStatus, OfferStatus, VehicleType } from '@prisma/client';
import { getSocketServer } from '../realtime/socket.js';

interface RankedDriver {
  driverId: string;
  score: number;
  distanceKm: number;
  etaMin: number;
}

export class DispatchService {
  private activeDispatchTimers: Map<string, NodeJS.Timeout> = new Map();

  async startDispatch(rideId: string): Promise<void> {
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
    });

    if (!ride || ride.status !== RideStatus.REQUESTED) {
      return;
    }

    // Transition to SEARCHING
    const searchingRide = await RideStateMachine.transition(rideId, RideStatus.SEARCHING);
    this.broadcastRideUpdate(searchingRide);

    await this.dispatchNextCandidate(rideId, 1);
  }

  async dispatchNextCandidate(rideId: string, attempt: number): Promise<void> {
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: { offers: true },
    });

    if (!ride || ride.status !== RideStatus.SEARCHING) {
      this.clearDispatchTimer(rideId);
      return;
    }

    if (attempt > DISPATCH_CONFIG.MAX_OFFER_ATTEMPTS) {
      await this.markNoDriversFound(rideId);
      return;
    }

    // 1. Find candidates from DB / Redis
    const candidate = await this.findBestDriverCandidate(
      ride.vehicleType,
      ride.pickupLat,
      ride.pickupLng,
      ride.offers.map((o) => o.driverId)
    );

    if (!candidate) {
      // If none found in initial radius, try expanding radius or fallback after 1 retry
      if (attempt < 3) {
        const timeout = setTimeout(() => {
          this.dispatchNextCandidate(rideId, attempt + 1);
        }, 4000);
        this.activeDispatchTimers.set(rideId, timeout);
        return;
      }

      await this.markNoDriversFound(rideId);
      return;
    }

    // 2. Create RideOffer
    const offer = await prisma.rideOffer.create({
      data: {
        rideId,
        driverId: candidate.driverId,
        distanceToPickupKm: candidate.distanceKm,
        status: OfferStatus.SENT,
      },
    });

    // 3. Emit offer:new to driver's room
    const io = getSocketServer();
    if (io) {
      const driver = await prisma.driverProfile.findUnique({
        where: { id: candidate.driverId },
        include: { user: true },
      });

      if (driver) {
        io.to(`user:${driver.userId}`).emit('offer:new', {
          offerId: offer.id,
          rideId: ride.id,
          pickup: { address: ride.pickupAddress, lat: ride.pickupLat, lng: ride.pickupLng },
          dropoff: { address: ride.dropoffAddress, lat: ride.dropoffLat, lng: ride.dropoffLng },
          stops: (ride.stops as any) || [],
          distanceKm: ride.distanceKm,
          durationMin: ride.durationMin,
          estimatedFare: ride.estimatedFare,
          distanceToPickupKm: candidate.distanceKm,
          timeoutSeconds: DISPATCH_CONFIG.OFFER_TIMEOUT_SECONDS,
        });
      }
    }

    // 4. Set 15-second timeout for this offer
    this.clearDispatchTimer(rideId);
    const timeout = setTimeout(async () => {
      await this.handleOfferTimeout(offer.id, rideId, attempt);
    }, DISPATCH_CONFIG.OFFER_TIMEOUT_SECONDS * 1000);

    this.activeDispatchTimers.set(rideId, timeout);
  }

  async acceptOffer(offerId: string, driverId: string): Promise<any> {
    return await prisma.$transaction(async (tx) => {
      const offer = await tx.rideOffer.findUnique({
        where: { id: offerId },
        include: { ride: true },
      });

      if (!offer) {
        throw new Error('Offer not found');
      }

      if (offer.driverId !== driverId) {
        throw new Error('Unauthorized offer response');
      }

      if (offer.status !== OfferStatus.SENT) {
        throw new Error('Offer has already expired or been processed');
      }

      if (offer.ride.status !== RideStatus.SEARCHING) {
        throw new Error('Ride is no longer searching for drivers');
      }

      // Mark offer accepted
      await tx.rideOffer.update({
        where: { id: offerId },
        data: { status: OfferStatus.ACCEPTED, respondedAt: new Date() },
      });

      // Clear timer
      this.clearDispatchTimer(offer.rideId);

      // Transition ride to DRIVER_ASSIGNED
      const updatedRide = await RideStateMachine.transition(
        offer.rideId,
        RideStatus.DRIVER_ASSIGNED,
        { driverId }
      );

      this.broadcastRideUpdate(updatedRide);

      return updatedRide;
    });
  }

  async declineOffer(offerId: string, driverId: string): Promise<void> {
    const offer = await prisma.rideOffer.findUnique({
      where: { id: offerId },
      include: { ride: true },
    });

    if (!offer || offer.driverId !== driverId || offer.status !== OfferStatus.SENT) {
      return;
    }

    await prisma.rideOffer.update({
      where: { id: offerId },
      data: { status: OfferStatus.DECLINED, respondedAt: new Date() },
    });

    this.clearDispatchTimer(offer.rideId);

    // Proceed to next candidate
    const previousOffersCount = await prisma.rideOffer.count({
      where: { rideId: offer.rideId },
    });

    await this.dispatchNextCandidate(offer.rideId, previousOffersCount + 1);
  }

  private async handleOfferTimeout(
    offerId: string,
    rideId: string,
    attempt: number
  ): Promise<void> {
    const offer = await prisma.rideOffer.findUnique({
      where: { id: offerId },
    });

    if (offer && offer.status === OfferStatus.SENT) {
      await prisma.rideOffer.update({
        where: { id: offerId },
        data: { status: OfferStatus.EXPIRED, respondedAt: new Date() },
      });

      const io = getSocketServer();
      if (io) {
        const driver = await prisma.driverProfile.findUnique({
          where: { id: offer.driverId },
        });
        if (driver) {
          io.to(`user:${driver.userId}`).emit('offer:expired', { offerId });
        }
      }

      await this.dispatchNextCandidate(rideId, attempt + 1);
    }
  }

  private async findBestDriverCandidate(
    vehicleType: VehicleType,
    pickupLat: number,
    pickupLng: number,
    excludedDriverIds: string[]
  ): Promise<RankedDriver | null> {
    // Look up online, approved drivers in DB matching vehicle type
    const onlineDrivers = await prisma.driverProfile.findMany({
      where: {
        isOnline: true,
        kycStatus: 'APPROVED',
        vehicle: { type: vehicleType },
        id: { notIn: excludedDriverIds },
      },
      include: { vehicle: true },
    });

    if (onlineDrivers.length === 0) return null;

    const ranked: RankedDriver[] = [];

    for (const d of onlineDrivers) {
      const lat = d.currentLat ?? pickupLat;
      const lng = d.currentLng ?? pickupLng;
      const distanceKm = haversineDistanceKm(pickupLat, pickupLng, lat, lng);

      if (distanceKm <= DISPATCH_CONFIG.MAX_SEARCH_RADIUS_KM) {
        const etaMin = Math.max(1, Math.round((distanceKm / 30) * 60));
        // Ranking score = 0.6 * (inverse ETA) + 0.2 * (rating/5) + 0.2 * (acceptanceRate/100)
        const etaScore = 1 / (etaMin + 1);
        const ratingScore = d.ratingAvg / 5;
        const acceptScore = d.acceptanceRate / 100;
        const score = 0.6 * etaScore + 0.2 * ratingScore + 0.2 * acceptScore;

        ranked.push({
          driverId: d.id,
          score,
          distanceKm,
          etaMin,
        });
      }
    }

    if (ranked.length === 0) {
      // If outside max radius, pick nearest available driver for demo resilience
      const fallback = onlineDrivers[0];
      const dist = haversineDistanceKm(
        pickupLat,
        pickupLng,
        fallback.currentLat ?? pickupLat,
        fallback.currentLng ?? pickupLng
      );
      return {
        driverId: fallback.id,
        score: 1.0,
        distanceKm: Math.max(0.5, dist),
        etaMin: 3,
      };
    }

    // Sort descending by score
    ranked.sort((a, b) => b.score - a.score);
    return ranked[0];
  }

  private async markNoDriversFound(rideId: string): Promise<void> {
    try {
      const updatedRide = await RideStateMachine.transition(
        rideId,
        RideStatus.NO_DRIVERS_FOUND
      );
      this.broadcastRideUpdate(updatedRide);

      const io = getSocketServer();
      if (io) {
        io.to(`ride:${rideId}`).emit('ride:no_drivers', { rideId });
      }
    } catch {
      // already transitioned
    }
  }

  private clearDispatchTimer(rideId: string): void {
    const timer = this.activeDispatchTimers.get(rideId);
    if (timer) {
      clearTimeout(timer);
      this.activeDispatchTimers.delete(rideId);
    }
  }

  private broadcastRideUpdate(ride: any): void {
    const io = getSocketServer();
    if (!io) return;

    io.to(`ride:${ride.id}`).emit('ride:updated', ride);
    io.to(`user:${ride.riderId}`).emit('ride:updated', ride);
    if (ride.driver?.userId) {
      io.to(`user:${ride.driver.userId}`).emit('ride:updated', ride);
    }
    io.to('admin').emit('admin:ride_feed', { action: 'UPDATE', ride });
  }
}

export const dispatchService = new DispatchService();
