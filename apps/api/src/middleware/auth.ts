import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const headerUserId = req.headers['x-user-id'] as string | undefined;
  const headerUserRole = req.headers['x-user-role'] as string | undefined;

  // 1. Direct header user override (ideal for fast demo testing & Postman / Playwright tests)
  if (headerUserId) {
    const user = await prisma.user.findUnique({ where: { id: headerUserId } });
    if (user) {
      req.user = {
        id: user.id,
        clerkId: user.clerkId,
        email: user.email,
        name: user.name,
        role: user.role,
      };
      return next();
    }
  }

  // 2. Token / Bearer parsing
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    // Demo role tokens (e.g. "demo_rider", "demo_driver", "demo_admin")
    if (token.startsWith('demo_')) {
      const requestedRole = token.replace('demo_', '').toUpperCase() as Role;
      const user = await prisma.user.findFirst({
        where: { role: requestedRole },
        orderBy: { createdAt: 'asc' },
      });
      if (user) {
        req.user = {
          id: user.id,
          clerkId: user.clerkId,
          email: user.email,
          name: user.name,
          role: user.role,
        };
        return next();
      }
    }

    // Lookup user by clerkId or user id in token
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id: token }, { clerkId: token }],
      },
    });

    if (user) {
      req.user = {
        id: user.id,
        clerkId: user.clerkId,
        email: user.email,
        name: user.name,
        role: user.role,
      };
      return next();
    }
  }

  // 3. Demo fallback if DEMO_MODE is true: find or create default rider
  if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production') {
    const targetRole = (headerUserRole?.toUpperCase() as Role) || Role.RIDER;
    let user = await prisma.user.findFirst({
      where: { role: targetRole },
      orderBy: { createdAt: 'asc' },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          clerkId: `demo_${targetRole.toLowerCase()}_clerk_id`,
          name: `Demo ${targetRole.charAt(0) + targetRole.slice(1).toLowerCase()}`,
          email: `${targetRole.toLowerCase()}@cabapp.local`,
          role: targetRole,
          walletBalance: 1000.0,
        },
      });
    }

    req.user = {
      id: user.id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    return next();
  }

  res.status(401).json({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication token missing or invalid',
    },
  });
}
