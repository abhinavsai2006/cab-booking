import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { PaymentType, PaymentStatus, WalletTxType } from '@prisma/client';

const router = Router();

// 1. Payment Methods
router.get('/payments/methods', authMiddleware, async (req: Request, res: Response) => {
  let methods = await prisma.paymentMethod.findMany({
    where: { userId: req.user!.id },
  });

  if (methods.length === 0) {
    // Seed standard default methods for user convenience
    await prisma.paymentMethod.createMany({
      data: [
        { userId: req.user!.id, type: PaymentType.WALLET, brand: 'CabWallet', last4: '8890', isDefault: true },
        { userId: req.user!.id, type: PaymentType.UPI, brand: 'UPI', last4: 'user@okhdfcbank' },
        { userId: req.user!.id, type: PaymentType.CARD, brand: 'Visa', last4: '4242' },
        { userId: req.user!.id, type: PaymentType.CASH, brand: 'Cash' },
      ],
    });
    methods = await prisma.paymentMethod.findMany({
      where: { userId: req.user!.id },
    });
  }

  res.json({ methods });
});

router.post('/payments/methods', authMiddleware, async (req: Request, res: Response) => {
  const { type, brand, last4 } = req.body;
  const method = await prisma.paymentMethod.create({
    data: {
      userId: req.user!.id,
      type: type || PaymentType.CARD,
      brand: brand || 'Visa',
      last4: last4 || '1234',
    },
  });
  res.status(201).json({ method });
});

router.delete('/payments/methods/:id', authMiddleware, async (req: Request, res: Response) => {
  await prisma.paymentMethod.deleteMany({
    where: { id: req.params.id, userId: req.user!.id },
  });
  res.json({ success: true });
});

// 2. Wallet Topup
router.post('/payments/wallet/topup', authMiddleware, async (req: Request, res: Response) => {
  const amount = parseFloat(req.body.amount);
  if (!amount || amount <= 0) {
    res.status(400).json({ error: { code: 'INVALID_AMOUNT', message: 'Amount must be positive' } });
    return;
  }

  const updatedUser = await prisma.user.update({
    where: { id: req.user!.id },
    data: { walletBalance: { increment: amount } },
  });

  const tx = await prisma.walletTransaction.create({
    data: {
      userId: req.user!.id,
      type: WalletTxType.TOPUP,
      amount,
      balanceAfter: updatedUser.walletBalance,
      description: `Wallet top-up via Card/UPI`,
    },
  });

  res.json({ balance: updatedUser.walletBalance, transaction: tx });
});

// 3. Pay for Ride
router.post('/rides/:id/pay', authMiddleware, async (req: Request, res: Response) => {
  const { paymentMethod = 'WALLET' } = req.body;
  const ride = await prisma.ride.findUnique({
    where: { id: req.params.id },
  });

  if (!ride) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ride not found' } });
    return;
  }

  const amount = ride.finalFare || ride.estimatedFare;

  if (paymentMethod === 'WALLET') {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || user.walletBalance < amount) {
      res.status(400).json({
        error: {
          code: 'INSUFFICIENT_FUNDS',
          message: 'Insufficient wallet balance. Please top up or choose another payment method.',
        },
      });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { walletBalance: { decrement: amount } },
    });

    await prisma.walletTransaction.create({
      data: {
        userId: user.id,
        type: WalletTxType.RIDE,
        amount: -amount,
        balanceAfter: user.walletBalance - amount,
        refId: ride.id,
        description: `Payment for ride #${ride.id.slice(0, 8)}`,
      },
    });
  }

  const payment = await prisma.payment.create({
    data: {
      rideId: ride.id,
      userId: req.user!.id,
      amount,
      method: paymentMethod as PaymentType,
      status: PaymentStatus.PAID,
    },
  });

  const updatedRide = await prisma.ride.update({
    where: { id: ride.id },
    data: {
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: paymentMethod as PaymentType,
    },
  });

  res.json({ success: true, payment, ride: updatedRide });
});

// 4. Stripe Webhook
router.post('/webhooks/stripe', async (_req: Request, res: Response) => {
  // Idempotent webhook handler
  res.json({ received: true });
});

export default router;
