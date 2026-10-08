import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { Role } from '@prisma/client';

const router = Router();

// Middleware: Admin role guard
router.use(authMiddleware);
router.use(requireRole(Role.ADMIN));

// 1. Dashboard KPIs & Live Feed
router.get('/admin/stats', async (_req: Request, res: Response) => {
  const [
    totalUsers,
    totalDrivers,
    onlineDrivers,
    activeRides,
    completedRides,
    cancelledRides,
    totalRevenue,
    pendingKycCount,
    activeSosCount,
    openTicketsCount,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'RIDER' } }),
    prisma.driverProfile.count(),
    prisma.driverProfile.count({ where: { isOnline: true } }),
    prisma.ride.count({ where: { status: { in: ['REQUESTED', 'SEARCHING', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVED', 'IN_PROGRESS'] } } }),
    prisma.ride.count({ where: { status: 'COMPLETED' } }),
    prisma.ride.count({ where: { status: { in: ['CANCELLED_BY_RIDER', 'CANCELLED_BY_DRIVER'] } } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'PAID' } }),
    prisma.driverProfile.count({ where: { kycStatus: 'PENDING' } }),
    prisma.sosAlert.count({ where: { status: 'ACTIVE' } }),
    prisma.supportTicket.count({ where: { status: 'OPEN' } }),
  ]);

  const totalTrips = completedRides + cancelledRides;
  const completionRate = totalTrips > 0 ? Math.round((completedRides / totalTrips) * 100) : 100;
  const cancellationRate = totalTrips > 0 ? Math.round((cancelledRides / totalTrips) * 100) : 0;

  res.json({
    kpis: {
      totalUsers,
      totalDrivers,
      onlineDrivers,
      activeRides,
      completedRides,
      completionRate,
      cancellationRate,
      todayRevenue: totalRevenue._sum.amount || 0,
      pendingKycCount,
      activeSosCount,
      openTicketsCount,
    },
  });
});

// 2. Users Management
router.get('/admin/users', async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    include: { driverProfile: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ users });
});

router.patch('/admin/users/:id', async (req: Request, res: Response) => {
  const { status, walletBalance } = req.body;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      status: status ?? undefined,
      walletBalance: walletBalance !== undefined ? parseFloat(walletBalance) : undefined,
    },
  });
  res.json({ user });
});

// 3. Drivers & KYC Queue
router.get('/admin/drivers', async (_req: Request, res: Response) => {
  const drivers = await prisma.driverProfile.findMany({
    include: { user: true, vehicle: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ drivers });
});

router.post('/admin/drivers/:id/kyc', async (req: Request, res: Response) => {
  const { action } = req.body; // APPROVE or REJECT
  const kycStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

  const driver = await prisma.driverProfile.update({
    where: { id: req.params.id },
    data: { kycStatus },
    include: { user: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: req.user!.id,
      action: `KYC_${action}`,
      entity: 'DriverProfile',
      entityId: driver.id,
      diff: { kycStatus },
    },
  });

  res.json({ driver });
});

// 4. Fare Configs
router.get('/admin/fares', async (_req: Request, res: Response) => {
  const fares = await prisma.fareConfig.findMany({
    orderBy: { vehicleType: 'asc' },
  });
  res.json({ fares });
});

router.post('/admin/fares', async (req: Request, res: Response) => {
  const data = req.body;
  const fare = await prisma.fareConfig.upsert({
    where: {
      city_vehicleType: { city: data.city || 'Bangalore', vehicleType: data.vehicleType },
    },
    update: data,
    create: data,
  });
  res.json({ fare });
});

// 5. Surge Zones
router.get('/admin/surge-zones', async (_req: Request, res: Response) => {
  const zones = await prisma.surgeZone.findMany({
    orderBy: { createdAt: 'desc' },
  });
  res.json({ zones });
});

router.post('/admin/surge-zones', async (req: Request, res: Response) => {
  const { name, city = 'Bangalore', polygon, multiplier, active = true } = req.body;
  const zone = await prisma.surgeZone.create({
    data: { name, city, polygon, multiplier: parseFloat(multiplier), active, source: 'MANUAL' },
  });
  res.status(201).json({ zone });
});

// 6. Promos
router.get('/admin/promos', async (_req: Request, res: Response) => {
  const promos = await prisma.promoCode.findMany({
    include: { _count: { select: { redemptions: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ promos });
});

router.post('/admin/promos', async (req: Request, res: Response) => {
  const data = req.body;
  const promo = await prisma.promoCode.create({
    data: {
      code: data.code.toUpperCase(),
      type: data.type,
      value: parseFloat(data.value),
      maxDiscount: parseFloat(data.maxDiscount || 100),
      minFare: parseFloat(data.minFare || 50),
      validFrom: new Date(data.validFrom || Date.now()),
      validTo: new Date(data.validTo || Date.now() + 30 * 24 * 3600 * 1000),
      active: true,
    },
  });
  res.status(201).json({ promo });
});

// 7. Rides Feed
router.get('/admin/rides', async (_req: Request, res: Response) => {
  const rides = await prisma.ride.findMany({
    include: {
      rider: true,
      driver: { include: { user: true, vehicle: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ rides });
});

router.post('/admin/rides/:id/refund', async (req: Request, res: Response) => {
  const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
  if (!ride) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ride not found' } });
    return;
  }

  const amount = ride.finalFare || ride.estimatedFare;

  // Credit back to rider wallet
  await prisma.user.update({
    where: { id: ride.riderId },
    data: { walletBalance: { increment: amount } },
  });

  await prisma.payment.updateMany({
    where: { rideId: ride.id },
    data: { status: 'REFUNDED', refundedAmount: amount },
  });

  res.json({ success: true, refundedAmount: amount });
});

// 8. Support Tickets
router.get('/admin/tickets', async (_req: Request, res: Response) => {
  const tickets = await prisma.supportTicket.findMany({
    include: { user: true, messages: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ tickets });
});

router.patch('/admin/tickets/:id', async (req: Request, res: Response) => {
  const { status } = req.body;
  const ticket = await prisma.supportTicket.update({
    where: { id: req.params.id },
    data: { status },
  });
  res.json({ ticket });
});

// 9. SOS Alerts
router.get('/admin/sos', async (_req: Request, res: Response) => {
  const alerts = await prisma.sosAlert.findMany({
    include: { user: true, ride: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ alerts });
});

router.patch('/admin/sos/:id', async (req: Request, res: Response) => {
  const { status } = req.body;
  const alert = await prisma.sosAlert.update({
    where: { id: req.params.id },
    data: { status },
  });
  res.json({ alert });
});

// 10. Audit Logs
router.get('/admin/audit', async (_req: Request, res: Response) => {
  const logs = await prisma.auditLog.findMany({
    include: { actor: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ logs });
});

// 11. CSV Export
router.get('/admin/export/:entity.csv', async (req: Request, res: Response) => {
  const { entity } = req.params;

  if (entity === 'rides') {
    const rides = await prisma.ride.findMany({ take: 500, orderBy: { createdAt: 'desc' } });
    let csv = 'id,riderId,vehicleType,status,distanceKm,estimatedFare,finalFare,paymentMethod,createdAt\n';
    rides.forEach((r) => {
      csv += `"${r.id}","${r.riderId}","${r.vehicleType}","${r.status}",${r.distanceKm},${r.estimatedFare},${r.finalFare || ''},"${r.paymentMethod}","${r.createdAt.toISOString()}"\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="rides_export.csv"');
    res.send(csv);
    return;
  }

  res.status(400).send('Export entity not supported');
});

export default router;
