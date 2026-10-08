import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { DriverOnboardingSchema, UpdateLocationSchema } from '@cab-app/shared';
import { redis } from '../services/redis.service.js';

const router = Router();

// 1. Driver Onboarding
router.post(
  '/driver/onboarding',
  authMiddleware,
  validateBody(DriverOnboardingSchema),
  async (req: Request, res: Response) => {
    const { licenseNo, licenseUrl, rcUrl, insuranceUrl, aadhaarOrIdUrl, vehicle } = req.body;

    // Check if profile exists
    let profile = await prisma.driverProfile.findUnique({
      where: { userId: req.user!.id },
    });

    if (!profile) {
      profile = await prisma.driverProfile.create({
        data: {
          userId: req.user!.id,
          licenseNo,
          licenseUrl,
          rcUrl,
          insuranceUrl,
          aadhaarOrIdUrl,
          kycStatus: process.env.DEMO_MODE === 'true' ? 'APPROVED' : 'PENDING',
          isOnline: false,
        },
      });
    } else {
      profile = await prisma.driverProfile.update({
        where: { id: profile.id },
        data: {
          licenseNo,
          licenseUrl,
          rcUrl,
          insuranceUrl,
          aadhaarOrIdUrl,
        },
      });
    }

    // Upsert vehicle
    await prisma.vehicle.upsert({
      where: { driverId: profile.id },
      update: {
        type: vehicle.type,
        make: vehicle.make,
        model: vehicle.model,
        color: vehicle.color,
        plateNo: vehicle.plateNo,
        year: vehicle.year,
        seats: vehicle.seats,
      },
      create: {
        driverId: profile.id,
        type: vehicle.type,
        make: vehicle.make,
        model: vehicle.model,
        color: vehicle.color,
        plateNo: vehicle.plateNo,
        year: vehicle.year,
        seats: vehicle.seats,
      },
    });

    // Update user role to DRIVER
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { role: 'DRIVER' },
    });

    const fullProfile = await prisma.driverProfile.findUnique({
      where: { id: profile.id },
      include: { vehicle: true },
    });

    res.status(201).json({ profile: fullProfile });
  }
);

// 2. Driver Status
router.get('/driver/status', authMiddleware, async (req: Request, res: Response) => {
  let profile = await prisma.driverProfile.findUnique({
    where: { userId: req.user!.id },
    include: { vehicle: true },
  });

  if (!profile && req.user!.role === 'DRIVER') {
    // Auto-create approved profile in demo mode for convenience
    profile = await prisma.driverProfile.create({
      data: {
        userId: req.user!.id,
        licenseNo: 'DL-DEMO-9988',
        kycStatus: 'APPROVED',
        isOnline: false,
        currentLat: 12.9716,
        currentLng: 77.5946,
        ratingAvg: 4.9,
        ratingCount: 38,
        vehicle: {
          create: {
            type: 'SEDAN',
            make: 'Toyota',
            model: 'Etios',
            color: 'Silver',
            plateNo: 'KA 01 AB 1234',
            year: 2022,
            seats: 4,
          },
        },
      },
      include: { vehicle: true },
    });
  }

  res.json({ profile });
});

// 3. Go Online
router.post(
  '/driver/online',
  authMiddleware,
  validateBody(UpdateLocationSchema),
  async (req: Request, res: Response) => {
    const { lat, lng, heading } = req.body;

    let profile = await prisma.driverProfile.findUnique({
      where: { userId: req.user!.id },
    });

    if (!profile) {
      profile = await prisma.driverProfile.create({
        data: {
          userId: req.user!.id,
          licenseNo: 'DL-DEMO-9988',
          kycStatus: 'APPROVED',
          isOnline: true,
          currentLat: lat,
          currentLng: lng,
          heading,
          vehicle: {
            create: {
              type: 'SEDAN',
              make: 'Toyota',
              model: 'Etios',
              color: 'Silver',
              plateNo: 'KA 01 AB 1234',
              year: 2022,
              seats: 4,
            },
          },
        },
      });
    } else {
      profile = await prisma.driverProfile.update({
        where: { id: profile.id },
        data: { isOnline: true, currentLat: lat, currentLng: lng, heading },
      });
    }

    await redis.geoAdd('drivers:online', lng, lat, profile.id);

    res.json({ profile, isOnline: true });
  }
);

// 4. Go Offline
router.post('/driver/offline', authMiddleware, async (req: Request, res: Response) => {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId: req.user!.id },
  });

  if (profile) {
    await prisma.driverProfile.update({
      where: { id: profile.id },
      data: { isOnline: false },
    });
    await redis.geoRemove('drivers:online', profile.id);
  }

  res.json({ profile, isOnline: false });
});

// 5. Driver Earnings
router.get('/driver/earnings', authMiddleware, async (req: Request, res: Response) => {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId: req.user!.id },
  });

  if (!profile) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Driver profile not found' } });
    return;
  }

  const earnings = await prisma.driverEarning.findMany({
    where: { driverId: profile.id },
    include: { ride: true },
    orderBy: { createdAt: 'desc' },
  });

  const totalGross = earnings.reduce((sum, e) => sum + e.gross, 0);
  const totalCommission = earnings.reduce((sum, e) => sum + e.commission, 0);
  const totalTips = earnings.reduce((sum, e) => sum + e.tip, 0);
  const totalNet = earnings.reduce((sum, e) => sum + e.net, 0);

  res.json({
    summary: {
      totalGross: Math.round(totalGross * 100) / 100,
      totalCommission: Math.round(totalCommission * 100) / 100,
      totalTips: Math.round(totalTips * 100) / 100,
      totalNet: Math.round(totalNet * 100) / 100,
      completedTrips: profile.completedTrips,
      ratingAvg: profile.ratingAvg,
      acceptanceRate: profile.acceptanceRate,
    },
    earnings,
  });
});

// 6. Driver Rides
router.get('/driver/rides', authMiddleware, async (req: Request, res: Response) => {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId: req.user!.id },
  });

  if (!profile) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Driver profile not found' } });
    return;
  }

  const rides = await prisma.ride.findMany({
    where: { driverId: profile.id },
    include: { rider: true, ratings: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ rides });
});

// 7. Driver Payouts
router.get('/driver/payouts', authMiddleware, async (req: Request, res: Response) => {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId: req.user!.id },
  });

  if (!profile) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Driver profile not found' } });
    return;
  }

  const payouts = await prisma.payout.findMany({
    where: { driverId: profile.id },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ payouts });
});

// 8. Stripe Connect Onboarding
router.post('/driver/payouts/connect', authMiddleware, async (_req: Request, res: Response) => {
  // Demo mode returns direct mock connect onboarding URL
  res.json({
    url: 'https://connect.stripe.com/express/oauth/demo',
    connected: true,
  });
});

export default router;
