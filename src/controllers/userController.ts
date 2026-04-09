import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const getUserByEmail = async (req: Request, res: Response) => {
  try {
    const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching user', error: error.message });
  }
};

export const updateUserByEmail = async (req: Request, res: Response) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }

    const name = typeof req.body.name === 'string' ? req.body.name.trim() : undefined;
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : undefined;

    // Use upsert so Google-only sessions can still update profile before any order/checkout creates the user row.
    const updated = await prisma.user.upsert({
      where: { email },
      update: {
        ...(typeof name === 'string' && name ? { name } : {}),
        ...(typeof phone === 'string' ? { phone: phone || null } : {}),
        isRegistered: true,
      },
      create: {
        name: name || email.split('@')[0] || 'User',
        email,
        phone: typeof phone === 'string' ? (phone || null) : null,
        role: 'USER',
        isRegistered: true,
      },
      select: { id: true, name: true, email: true, phone: true, role: true, updatedAt: true },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Error updating user', error: error.message });
  }
};
