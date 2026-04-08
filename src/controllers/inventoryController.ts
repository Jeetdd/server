import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { InventoryMovementType } from '@prisma/client';

const asString = (value: unknown) => (typeof value === 'string' ? value : undefined);

export const getInventorySummary = async (req: Request, res: Response) => {
  try {
    const lowStockThreshold = Number(asString(req.query.lowStockThreshold) ?? 10);

    const medicines = await prisma.medicine.findMany({
      select: { id: true, stock: true, price: true },
    });

    const totalSkus = medicines.length;
    const outOfStockSkus = medicines.filter((m) => m.stock <= 0).length;
    const lowStockSkus = medicines.filter((m) => m.stock > 0 && m.stock <= lowStockThreshold).length;
    const totalUnits = medicines.reduce((sum, m) => sum + m.stock, 0);
    const totalStockValue = medicines.reduce((sum, m) => sum + m.stock * m.price, 0);

    res.json({
      totalSkus,
      outOfStockSkus,
      lowStockSkus,
      lowStockThreshold,
      totalUnits,
      totalStockValue,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching inventory summary', error: error.message });
  }
};

export const getInventoryMovements = async (req: Request, res: Response) => {
  try {
    const medicineId = asString(req.query.medicineId);
    const type = asString(req.query.type);
    const limit = Math.min(200, Math.max(1, Number(asString(req.query.limit) ?? 50)));
    const movementType = type && Object.values(InventoryMovementType).includes(type as InventoryMovementType) ? (type as InventoryMovementType) : undefined;

    const movements = await prisma.inventoryMovement.findMany({
      where: {
        medicineId: medicineId || undefined,
        type: movementType,
      },
      include: {
        medicine: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json(movements);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching inventory movements', error: error.message });
  }
};

export const adjustInventory = async (req: Request, res: Response) => {
  try {
    const { medicineId, delta, reason, actorEmail } = req.body as {
      medicineId: string;
      delta: number;
      reason?: string;
      actorEmail?: string;
    };

    if (!medicineId) {
      return res.status(400).json({ message: 'medicineId is required' });
    }

    const parsedDelta = Number(delta);
    if (!Number.isFinite(parsedDelta) || parsedDelta === 0) {
      return res.status(400).json({ message: 'delta must be a non-zero number' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const medicine = await tx.medicine.findUnique({ where: { id: medicineId } });
      if (!medicine) {
        throw new Error('Medicine not found');
      }

      const beforeStock = medicine.stock;
      const afterStock = beforeStock + parsedDelta;
      if (afterStock < 0) {
        throw new Error(`Insufficient stock. Current stock is ${beforeStock}.`);
      }

      const updated = await tx.medicine.update({
        where: { id: medicineId },
        data: { stock: afterStock },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          medicineId,
          type: parsedDelta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
          delta: parsedDelta,
          beforeStock,
          afterStock,
          reason: reason?.trim() || null,
          actorEmail: actorEmail?.trim() || null,
        },
      });

      return { updated, movement };
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Error adjusting inventory', error: error.message });
  }
};
