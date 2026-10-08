import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { ValidatePromoSchema } from '@cab-app/shared';

const router = Router();

// Validate Promo Code
router.post(
  '/promos/validate',
  authMiddleware,
  validateBody(ValidatePromoSchema),
  async (req: Request, res: Response) => {
    const { code, vehicleType, estimatedFare } = req.body;

    const promo = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!promo || !promo.active) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Invalid or expired promo code' } });
      return;
    }

    if (new Date() < promo.validFrom || new Date() > promo.validTo) {
      res.status(400).json({ error: { code: 'EXPIRED', message: 'Promo code is expired' } });
      return;
    }

    if (estimatedFare < promo.minFare) {
      res.status(400).json({
        error: { code: 'MIN_FARE_NOT_MET', message: `Minimum trip fare of ₹${promo.minFare} required` },
      });
      return;
    }

    // Calculate discount
    let discount = 0;
    if (promo.type === 'PERCENT') {
      discount = (estimatedFare * promo.value) / 100;
    } else {
      discount = promo.value;
    }

    discount = Math.min(discount, promo.maxDiscount);

    res.json({
      valid: true,
      promo: {
        code: promo.code,
        type: promo.type,
        value: promo.value,
        discount: Math.round(discount * 100) / 100,
        finalFare: Math.max(0, Math.round((estimatedFare - discount) * 100) / 100),
      },
    });
  }
);

// List Available Promos
router.get('/promos/available', authMiddleware, async (_req: Request, res: Response) => {
  const promos = await prisma.promoCode.findMany({
    where: { active: true, validTo: { gte: new Date() } },
    take: 10,
  });

  res.json({ promos });
});

export default router;
