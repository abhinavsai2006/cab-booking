import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  FareEstimateQuerySchema,
  CreateRideSchema,
  CancelRideSchema,
  ChangeDestinationSchema,
  RateRideSchema,
  TipRideSchema,
  getMapProvider,
  calculateFare,
  isNightHours,
  VEHICLE_TYPES,
  VEHICLE_DETAILS,
  VehicleEstimate,
  VehicleType,
} from '@cab-app/shared';
import { dispatchService } from '../services/dispatch.service.js';
import { RideStateMachine } from '../services/ride-state-machine.js';
import { surgeService } from '../services/surge.service.js';
import { RideStatus } from '@prisma/client';
import crypto from 'crypto';

const router = Router();
const mapProvider = getMapProvider();

// 1. Fare Estimate for All Vehicle Types
router.post(
  '/rides/estimate',
  validateBody(FareEstimateQuerySchema),
  async (req: Request, res: Response) => {
    const { pickup, dropoff, stops = [], promoCode } = req.body;
    const waypoints = [pickup, ...stops, dropoff];
    const route = await mapProvider.getRoute(waypoints);

    const surgeMultiplier = await surgeService.computeSurgeForLocation(pickup.lat, pickup.lng);
    const night = isNightHours();

    // Check promo if supplied
    let promoDiscountPercent = 0;
    let promoFlatDiscount = 0;
    let maxPromoDiscount = 100;
    if (promoCode) {
      const promo = await prisma.promoCode.findUnique({
        where: { code: promoCode.toUpperCase(), active: true },
      });
      if (promo) {
        if (promo.type === 'PERCENT') promoDiscountPercent = promo.value;
        else promoFlatDiscount = promo.value;
        maxPromoDiscount = promo.maxDiscount;
      }
    }

    // Fetch fare configs for city
    const fareConfigs = await prisma.fareConfig.findMany({
      where: { city: 'Bangalore' },
    });

    const configMap = new Map(fareConfigs.map((f) => [f.vehicleType, f]));

    const estimates: VehicleEstimate[] = VEHICLE_TYPES.map((vType: VehicleType) => {
      const cfg = configMap.get(vType) || {
        baseFare: 40 * VEHICLE_DETAILS[vType].baseMultiplier,
        perKm: 12 * VEHICLE_DETAILS[vType].baseMultiplier,
        perMinute: 2,
        minFare: 60 * VEHICLE_DETAILS[vType].baseMultiplier,
        bookingFee: 15,
        taxPercent: 5,
        waitingPerMin: 2,
      };

      const breakdown = calculateFare({
        baseFare: cfg.baseFare,
        perKm: cfg.perKm,
        perMinute: cfg.perMinute,
        minFare: cfg.minFare,
        bookingFee: cfg.bookingFee,
        taxPercent: cfg.taxPercent,
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
        surgeMultiplier,
        isNightTime: night,
        stopsCount: stops.length,
        promoDiscountPercent,
        promoFlatDiscount,
        maxPromoDiscount,
      });

      // Simple heuristic for ETA
      const etaMinutes = Math.max(2, Math.round(route.durationMin * 0.2) + 2);

      return {
        vehicleType: vType,
        name: VEHICLE_DETAILS[vType].name,
        description: VEHICLE_DETAILS[vType].description,
        capacity: VEHICLE_DETAILS[vType].capacity,
        estimatedFare: breakdown.finalFare,
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
        etaMinutes,
        surgeMultiplier,
        breakdown,
        availableDriversCount: 3,
      };
    });

    res.json({ route, estimates, surgeMultiplier });
  }
);

// 2. Create Ride (Book Now or Scheduled)
router.post(
  '/rides',
  authMiddleware,
  validateBody(CreateRideSchema),
  async (req: Request, res: Response) => {
    const { vehicleType, pickup, dropoff, stops = [], paymentMethod, promoCode, scheduledAt } = req.body;
    const waypoints = [pickup, ...stops, dropoff];
    const route = await mapProvider.getRoute(waypoints);

    const surgeMultiplier = await surgeService.computeSurgeForLocation(pickup.lat, pickup.lng);
    const night = isNightHours();

    const cfg = await prisma.fareConfig.findUnique({
      where: { city_vehicleType: { city: 'Bangalore', vehicleType } },
    });

    const baseFare = cfg?.baseFare ?? 50;
    const perKm = cfg?.perKm ?? 14;
    const perMinute = cfg?.perMinute ?? 2;
    const minFare = cfg?.minFare ?? 70;
    const bookingFee = cfg?.bookingFee ?? 15;
    const taxPercent = cfg?.taxPercent ?? 5;

    const breakdown = calculateFare({
      baseFare,
      perKm,
      perMinute,
      minFare,
      bookingFee,
      taxPercent,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      surgeMultiplier,
      isNightTime: night,
      stopsCount: stops.length,
    });

    // 4-digit start OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const shareToken = crypto.randomBytes(16).toString('hex');

    const ride = await prisma.ride.create({
      data: {
        riderId: req.user!.id,
        vehicleType,
        status: scheduledAt ? RideStatus.SCHEDULED : RideStatus.REQUESTED,
        pickupAddress: pickup.address,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffAddress: dropoff.address,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        stops: stops.length > 0 ? stops : undefined,
        routePolyline: route.polyline,
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
        estimatedFare: breakdown.finalFare,
        fareBreakdown: breakdown as any,
        surgeMultiplier,
        paymentMethod,
        otp,
        shareToken,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      },
      include: {
        rider: true,
      },
    });

    if (!scheduledAt) {
      // Trigger dispatch engine immediately
      setTimeout(() => {
        dispatchService.startDispatch(ride.id).catch(console.error);
      }, 100);
    }

    res.status(201).json({ ride });
  }
);

// 3. Get Active Ride for User
router.get('/rides/active', authMiddleware, async (req: Request, res: Response) => {
  const activeStatuses: RideStatus[] = [
    RideStatus.REQUESTED,
    RideStatus.SEARCHING,
    RideStatus.DRIVER_ASSIGNED,
    RideStatus.DRIVER_ARRIVED,
    RideStatus.IN_PROGRESS,
  ];

  const ride = await prisma.ride.findFirst({
    where: {
      OR: [
        { riderId: req.user!.id, status: { in: activeStatuses } },
        { driver: { userId: req.user!.id }, status: { in: activeStatuses } },
      ],
    },
    include: {
      rider: true,
      driver: { include: { user: true, vehicle: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ ride: ride || null });
});

// 4. Get Ride Details
router.get('/rides/:id', authMiddleware, async (req: Request, res: Response) => {
  const ride = await prisma.ride.findUnique({
    where: { id: req.params.id },
    include: {
      rider: true,
      driver: { include: { user: true, vehicle: true } },
      locationPoints: { orderBy: { recordedAt: 'asc' }, take: 100 },
      ratings: true,
    },
  });

  if (!ride) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ride not found' } });
    return;
  }

  res.json({ ride });
});

// 5. Cancel Ride
router.post(
  '/rides/:id/cancel',
  authMiddleware,
  validateBody(CancelRideSchema),
  async (req: Request, res: Response) => {
    const { reason } = req.body;
    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });

    if (!ride) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ride not found' } });
      return;
    }

    const isRider = ride.riderId === req.user!.id;
    const cancelStatus = isRider ? RideStatus.CANCELLED_BY_RIDER : RideStatus.CANCELLED_BY_DRIVER;

    // Cancellation fee logic: free within 2 minutes of assignment
    let cancellationFee = 0;
    if (ride.acceptedAt) {
      const minutesSinceAccept = (Date.now() - new Date(ride.acceptedAt).getTime()) / (1000 * 60);
      if (minutesSinceAccept > 2) {
        cancellationFee = 50.0;
      }
    }

    const updated = await RideStateMachine.transition(ride.id, cancelStatus, {
      cancelledBy: req.user!.role,
      cancelReason: reason,
      cancellationFee,
    });

    res.json({ ride: updated });
  }
);

// 6. Change Destination on Trip
router.post(
  '/rides/:id/change-destination',
  authMiddleware,
  validateBody(ChangeDestinationSchema),
  async (req: Request, res: Response) => {
    const { newDropoff } = req.body;
    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });

    if (!ride || ride.riderId !== req.user!.id) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ride not found' } });
      return;
    }

    const route = await mapProvider.getRoute([
      { lat: ride.pickupLat, lng: ride.pickupLng },
      { lat: newDropoff.lat, lng: newDropoff.lng },
    ]);

    const updated = await prisma.ride.update({
      where: { id: ride.id },
      data: {
        dropoffAddress: newDropoff.address,
        dropoffLat: newDropoff.lat,
        dropoffLng: newDropoff.lng,
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
        routePolyline: route.polyline,
      },
    });

    res.json({ ride: updated });
  }
);

// 7. Ride History
router.get('/rides', authMiddleware, async (req: Request, res: Response) => {
  const isDriver = req.user!.role === 'DRIVER';
  const rides = await prisma.ride.findMany({
    where: isDriver ? { driver: { userId: req.user!.id } } : { riderId: req.user!.id },
    include: {
      rider: true,
      driver: { include: { user: true, vehicle: true } },
      ratings: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json({ rides });
});

// 8. Rate Driver
router.post(
  '/rides/:id/rate',
  authMiddleware,
  validateBody(RateRideSchema),
  async (req: Request, res: Response) => {
    const { stars, tags = [], comment } = req.body;
    const ride = await prisma.ride.findUnique({
      where: { id: req.params.id },
      include: { driver: true },
    });

    if (!ride || !ride.driver) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ride or driver not found' } });
      return;
    }

    const rating = await prisma.rating.create({
      data: {
        rideId: ride.id,
        fromUserId: req.user!.id,
        toUserId: ride.driver.userId,
        stars,
        tags: tags as any,
        comment,
      },
    });

    // Recompute driver ratingAvg
    const allRatings = await prisma.rating.findMany({
      where: { toUserId: ride.driver.userId },
    });
    const avg = allRatings.reduce((sum, r) => sum + r.stars, 0) / allRatings.length;

    await prisma.driverProfile.update({
      where: { id: ride.driver.id },
      data: {
        ratingAvg: Math.round(avg * 10) / 10,
        ratingCount: allRatings.length,
      },
    });

    res.status(201).json({ rating });
  }
);

// 9. Tip Driver
router.post(
  '/rides/:id/tip',
  authMiddleware,
  validateBody(TipRideSchema),
  async (req: Request, res: Response) => {
    const { amount } = req.body;
    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });

    if (!ride || !ride.driverId) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ride or driver not found' } });
      return;
    }

    await prisma.driverEarning.updateMany({
      where: { rideId: ride.id, driverId: ride.driverId },
      data: { tip: { increment: amount }, net: { increment: amount } },
    });

    res.json({ success: true, tipAmount: amount });
  }
);

// 10. Public Tracking Link
router.post('/rides/:id/share', authMiddleware, async (req: Request, res: Response) => {
  const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
  if (!ride) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ride not found' } });
    return;
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/track/${ride.shareToken}`;
  res.json({ token: ride.shareToken, shareUrl });
});

// 11. HTML / Printable Receipt
router.get('/rides/:id/receipt', async (req: Request, res: Response) => {
  const ride = await prisma.ride.findUnique({
    where: { id: req.params.id },
    include: {
      rider: true,
      driver: { include: { user: true, vehicle: true } },
    },
  });

  if (!ride) {
    res.status(404).send('Ride not found');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Ride Receipt #${ride.id.slice(0, 8)}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #18181b; }
        .receipt-card { max-width: 500px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 16px; padding: 32px; }
        .header { text-align: center; border-bottom: 2px dashed #e4e4e7; padding-bottom: 24px; margin-bottom: 24px; }
        .title { font-size: 24px; font-weight: 800; }
        .fare { font-size: 36px; font-weight: 800; margin: 12px 0; color: #10b981; }
        .row { display: flex; justify-content: space-between; margin: 10px 0; }
        .label { color: #71717a; }
        .val { font-weight: 600; }
        .footer { text-align: center; margin-top: 32px; font-size: 12px; color: #a1a1aa; }
      </style>
    </head>
    <body>
      <div class="receipt-card">
        <div class="header">
          <div class="title">Cab Booking Receipt</div>
          <div class="fare">₹${ride.finalFare || ride.estimatedFare}</div>
          <div>${new Date(ride.createdAt).toLocaleDateString()} ${new Date(ride.createdAt).toLocaleTimeString()}</div>
        </div>
        <div class="row"><span class="label">Trip ID:</span><span class="val">${ride.id.slice(0, 8)}</span></div>
        <div class="row"><span class="label">Vehicle:</span><span class="val">${ride.vehicleType}</span></div>
        <div class="row"><span class="label">Rider:</span><span class="val">${ride.rider.name}</span></div>
        <div class="row"><span class="label">Driver:</span><span class="val">${ride.driver?.user.name || 'Assigned Driver'}</span></div>
        <div class="row"><span class="label">Pickup:</span><span class="val">${ride.pickupAddress}</span></div>
        <div class="row"><span class="label">Dropoff:</span><span class="val">${ride.dropoffAddress}</span></div>
        <div class="row"><span class="label">Distance:</span><span class="val">${ride.distanceKm} km</span></div>
        <div class="row"><span class="label">Duration:</span><span class="val">${ride.durationMin} mins</span></div>
        <div class="row"><span class="label">Payment Method:</span><span class="val">${ride.paymentMethod}</span></div>
        <div class="footer">Thank you for riding with us!</div>
      </div>
      <script>window.print();</script>
    </body>
    </html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

export default router;
