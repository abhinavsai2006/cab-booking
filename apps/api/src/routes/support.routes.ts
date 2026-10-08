import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { CreateSupportTicketSchema, TicketMessageSchema } from '@cab-app/shared';

const router = Router();

// List Tickets for User
router.get('/tickets', authMiddleware, async (req: Request, res: Response) => {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId: req.user!.id },
    include: { messages: true, ride: true },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ tickets });
});

// Create Ticket
router.post(
  '/tickets',
  authMiddleware,
  validateBody(CreateSupportTicketSchema),
  async (req: Request, res: Response) => {
    const { category, subject, message, rideId } = req.body;

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: req.user!.id,
        category,
        subject,
        rideId,
        messages: {
          create: {
            senderId: req.user!.id,
            senderRole: req.user!.role,
            message,
          },
        },
      },
      include: { messages: true },
    });

    res.status(201).json({ ticket });
  }
);

// Get Ticket details
router.get('/tickets/:id', authMiddleware, async (req: Request, res: Response) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.id },
    include: { messages: true, ride: true },
  });

  if (!ticket) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found' } });
    return;
  }

  res.json({ ticket });
});

// Add Message to Ticket
router.post(
  '/tickets/:id/messages',
  authMiddleware,
  validateBody(TicketMessageSchema),
  async (req: Request, res: Response) => {
    const { message } = req.body;

    const msg = await prisma.ticketMessage.create({
      data: {
        ticketId: req.params.id,
        senderId: req.user!.id,
        senderRole: req.user!.role,
        message,
      },
    });

    await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: { updatedAt: new Date() },
    });

    res.status(201).json({ message: msg });
  }
);

export default router;
