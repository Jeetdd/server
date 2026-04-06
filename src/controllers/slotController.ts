import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const getAvailableSlots = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const slots = await prisma.pickUpSlot.findMany({
      where: {
        date: {
          gte: today
        },
        isActive: true
      },
      orderBy: [
        { date: 'asc' },
        { timeSlot: 'asc' }
      ]
    });

    res.json(slots);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching slots', error: error.message });
  }
};

export const createSlot = async (req: Request, res: Response) => {
  try {
    const { date, timeSlot, maxBookings } = req.body;
    const slot = await prisma.pickUpSlot.create({
      data: {
        date: new Date(date),
        timeSlot,
        maxBookings: maxBookings || 5
      }
    });
    res.status(201).json(slot);
  } catch (error: any) {
    res.status(400).json({ message: 'Error creating slot', error: error.message });
  }
};
