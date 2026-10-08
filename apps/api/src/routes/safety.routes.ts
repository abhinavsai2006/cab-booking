import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { TriggerSosSchema } from '@cab-app/shared';
import { getSocketServer } from '../realtime/socket.js';

const router = Router();

// Trigger SOS
router.post(
  '/sos',
  authMiddleware,
  validateBody(TriggerSosSchema),
  async (req: Request, res: Response) => {
    const { rideId, lat, lng, address } = req.body;

    const sos = await prisma.sosAlert.create({
      data: {
        userId: req.user!.id,
        rideId,
        lat,
        lng,
        address,
        status: 'ACTIVE',
      },
      include: {
        user: { include: { emergencyContacts: true } },
        ride: true,
      },
    });

    const io = getSocketServer();
    if (io) {
      io.to('admin').emit('admin:sos', sos);
    }

    res.status(201).json({
      success: true,
      sos,
      message: 'Emergency SOS activated. Live coordinates sent to support and emergency contacts.',
    });
  }
);

// Public Tracking by Expiring / Secret Token
router.get('/public/track/:token', async (req: Request, res: Response) => {
  const ride = await prisma.ride.findUnique({
    where: { shareToken: req.params.token },
    include: {
      rider: { select: { name: true, photoUrl: true } },
      driver: {
        include: {
          user: { select: { name: true, photoUrl: true } },
          vehicle: true,
        },
      },
      locationPoints: {
        orderBy: { recordedAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!ride) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shared trip not found or expired' } });
    return;
  }

  res.json({ ride });
});

export default router;
