import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { SavedPlaceSchema, EmergencyContactSchema } from '@cab-app/shared';
import { Role } from '@prisma/client';

const router = Router();

// Current User Profile
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: {
      driverProfile: {
        include: { vehicle: true },
      },
      emergencyContacts: true,
      savedPlaces: true,
      paymentMethods: true,
    },
  });

  if (!user) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  res.json({ user });
});

// Update Profile
router.patch('/me', authMiddleware, async (req: Request, res: Response) => {
  const { name, phone, language, photoUrl } = req.body;

  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      name: name ?? undefined,
      phone: phone ?? undefined,
      language: language ?? undefined,
      photoUrl: photoUrl ?? undefined,
    },
  });

  res.json({ user: updated });
});

// Saved Places
router.get('/me/saved-places', authMiddleware, async (req: Request, res: Response) => {
  const places = await prisma.savedPlace.findMany({
    where: { userId: req.user!.id },
  });
  res.json({ places });
});

router.post(
  '/me/saved-places',
  authMiddleware,
  validateBody(SavedPlaceSchema),
  async (req: Request, res: Response) => {
    const place = await prisma.savedPlace.create({
      data: {
        userId: req.user!.id,
        label: req.body.label,
        address: req.body.address,
        lat: req.body.lat,
        lng: req.body.lng,
      },
    });
    res.status(201).json({ place });
  }
);

router.delete('/me/saved-places/:id', authMiddleware, async (req: Request, res: Response) => {
  await prisma.savedPlace.deleteMany({
    where: { id: req.params.id, userId: req.user!.id },
  });
  res.json({ success: true });
});

// Emergency Contacts
router.get('/me/emergency-contacts', authMiddleware, async (req: Request, res: Response) => {
  const contacts = await prisma.emergencyContact.findMany({
    where: { userId: req.user!.id },
  });
  res.json({ contacts });
});

router.post(
  '/me/emergency-contacts',
  authMiddleware,
  validateBody(EmergencyContactSchema),
  async (req: Request, res: Response) => {
    const contact = await prisma.emergencyContact.create({
      data: {
        userId: req.user!.id,
        name: req.body.name,
        phone: req.body.phone,
      },
    });
    res.status(201).json({ contact });
  }
);

router.delete('/me/emergency-contacts/:id', authMiddleware, async (req: Request, res: Response) => {
  await prisma.emergencyContact.deleteMany({
    where: { id: req.params.id, userId: req.user!.id },
  });
  res.json({ success: true });
});

// Demo Role Switcher
router.post('/auth/demo-switch', async (req: Request, res: Response) => {
  const targetRole = (req.body.role as Role) || Role.RIDER;

  let user = await prisma.user.findFirst({
    where: { role: targetRole },
    include: { driverProfile: { include: { vehicle: true } } },
    orderBy: { createdAt: 'asc' },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkId: `demo_${targetRole.toLowerCase()}_${Date.now()}`,
        name: `Demo ${targetRole}`,
        email: `${targetRole.toLowerCase()}@cabapp.local`,
        role: targetRole,
        walletBalance: 1000.0,
      },
      include: { driverProfile: { include: { vehicle: true } } },
    });
  }

  res.json({ user, token: `demo_${targetRole.toLowerCase()}` });
});

// Clerk Webhook Sync
router.post('/webhooks/clerk', async (req: Request, res: Response) => {
  const evt = req.body;
  const eventType = evt?.type;
  const data = evt?.data;

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const clerkId = data.id;
    const email = data.email_addresses?.[0]?.email_address || `${clerkId}@user.clerk`;
    const name = `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Rider';
    const photoUrl = data.image_url;
    const role = (data.public_metadata?.role as Role) || Role.RIDER;

    await prisma.user.upsert({
      where: { clerkId },
      update: { name, email, photoUrl, role },
      create: { clerkId, email, name, photoUrl, role },
    });
  }

  res.json({ received: true });
});

export default router;
