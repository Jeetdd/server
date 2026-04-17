import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { getInternalUserEmail } from '../middlewares/internalAuth';

export const getUserByEmail = async (req: Request, res: Response) => {
  try {
    const email = getInternalUserEmail(req) || (typeof req.query.email === 'string' ? req.query.email.trim() : '');
    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }

    // Lazy-create user if they don't exist yet (especially for Google OAuth users)
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: email.split('@')[0] || 'User',
        role: 'USER',
        referralCode: `SKIN-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
      },
      select: { 
        id: true, 
        name: true, 
        email: true, 
        phone: true, 
        role: true, 
        createdAt: true,
        referralCode: true,
        loyaltyPoints: true
      },
    });

    res.json(user);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching user', error: error.message });
  }
};

export const updateUserByEmail = async (req: Request, res: Response) => {
  try {
    const email = getInternalUserEmail(req) || (typeof req.body.email === 'string' ? req.body.email.trim() : '');
    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }

    const name = typeof req.body.name === 'string' ? req.body.name.trim() : undefined;
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : undefined;

    const updated = await prisma.user.upsert({
      where: { email },
      update: {
        ...(typeof name === 'string' && name ? { name } : {}),
        ...(typeof phone === 'string' ? { phone: phone || null } : {}),
      },
      create: {
        name: name || email.split('@')[0] || 'User',
        email,
        phone: typeof phone === 'string' ? (phone || null) : null,
        role: 'USER',
        referralCode: `SKIN-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
      },
      select: { 
        id: true, 
        name: true, 
        email: true, 
        phone: true, 
        role: true, 
        updatedAt: true,
        referralCode: true,
        loyaltyPoints: true
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Error updating user', error: error.message });
  }
};

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        loyaltyPoints: true,
        referralCode: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

export const getPointsTransactions = async (req: Request, res: Response) => {
  try {
    const userId = typeof req.params.userId === 'string' ? req.params.userId : undefined;
    const transactions = await prisma.pointsTransaction.findMany({
      where: userId ? { userId } : {},
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } }
    });
    res.json(transactions);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching transactions', error: error.message });
  }
};

export const adjustPoints = async (req: Request, res: Response) => {
  try {
    const { userId, amount, reason } = req.body;
    if (!userId || typeof amount !== 'number') {
      return res.status(400).json({ message: 'userId and amount are required' });
    }

    const type = amount >= 0 ? 'EARNED' : 'REDEEMED';

    const [user, transaction] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { loyaltyPoints: { increment: amount } }
      }),
      prisma.pointsTransaction.create({
        data: {
          userId,
          amount,
          type,
          reason: reason || 'Admin adjustment'
        }
      })
    ]);

    res.json({ loyaltyPoints: user.loyaltyPoints, transaction });
  } catch (error: any) {
    res.status(500).json({ message: 'Error adjusting points', error: error.message });
  }
};
