import { prisma } from '../db/prisma.js';

export class SurgeService {
  async computeSurgeForLocation(lat: number, lng: number): Promise<number> {
    // Check if within any active surge zone
    const zones = await prisma.surgeZone.findMany({
      where: { active: true },
    });

    for (const zone of zones) {
      if (zone.multiplier > 1.0) {
        return zone.multiplier;
      }
    }

    // Dynamic demand vs supply calculation
    const openRequestsCount = await prisma.ride.count({
      where: {
        status: { in: ['REQUESTED', 'SEARCHING'] },
      },
    });

    const onlineDriversCount = await prisma.driverProfile.count({
      where: { isOnline: true },
    });

    if (onlineDriversCount === 0 && openRequestsCount > 0) {
      return 1.8;
    }

    if (openRequestsCount > onlineDriversCount * 1.5) {
      const ratio = openRequestsCount / Math.max(1, onlineDriversCount);
      const calculated = Math.min(3.0, 1.0 + (ratio - 1) * 0.4);
      return Math.round(calculated * 10) / 10;
    }

    return 1.0;
  }

  async runSurgeCron(): Promise<void> {
    const zones = await prisma.surgeZone.findMany({
      where: { active: true, source: 'AUTO' },
    });

    const openRequestsCount = await prisma.ride.count({
      where: { status: { in: ['REQUESTED', 'SEARCHING'] } },
    });
    const onlineDriversCount = await prisma.driverProfile.count({
      where: { isOnline: true },
    });

    let newMultiplier = 1.0;
    if (onlineDriversCount > 0 && openRequestsCount > onlineDriversCount) {
      const ratio = openRequestsCount / onlineDriversCount;
      newMultiplier = Math.min(3.0, Math.max(1.0, Math.round((1.0 + (ratio - 1) * 0.5) * 10) / 10));
    }

    for (const zone of zones) {
      await prisma.surgeZone.update({
        where: { id: zone.id },
        data: { multiplier: newMultiplier },
      });
    }
  }
}

export const surgeService = new SurgeService();
