import { Request, Response } from 'express';
import prisma from '../config/prisma';
import Fuse from 'fuse.js';

export const getMedicines = async (req: Request, res: Response) => {
  try {
    const medicines = await prisma.medicine.findMany();
    // Map stock to quantity for frontend compatibility
    const mappedMedicines = medicines.map(m => ({
      ...m,
      quantity: m.stock
    }));
    res.json(mappedMedicines);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching medicines', error });
  }
};

export const fuzzySearchMedicines = async (medicinesToMatch: string[]) => {
  const catalogue = await prisma.medicine.findMany();
  
  const options = {
    keys: ['name'],
    threshold: 0.4, // Adjust for matching sensitivity
  };
  
  const fuse = new Fuse(catalogue, options);
  
  return medicinesToMatch.map(name => {
    const results = fuse.search(name);
    if (results.length > 0) {
      return { 
        matched: true, 
        originalName: name, 
        matchedMedicine: results[0].item 
      };
    }
    return { 
      matched: false, 
      originalName: name, 
      matchedMedicine: null 
    };
  });
};

export const addMedicine = async (req: Request, res: Response) => {
  try {
    const requestedStock = Number(req.body.quantity ?? req.body.stock ?? 0);
    const actorEmail = typeof req.body.actorEmail === 'string' ? req.body.actorEmail.trim() : null;

    const result = await prisma.$transaction(async (tx) => {
      const medicine = await tx.medicine.create({
        data: {
          name: req.body.name,
          price: req.body.price,
          stock: Number.isFinite(requestedStock) ? requestedStock : 0,
          category: req.body.category,
          description: req.body.description,
          requiresPrescription: req.body.requiresPrescription,
        },
      });

      if ((Number.isFinite(requestedStock) ? requestedStock : 0) > 0) {
        await tx.inventoryMovement.create({
          data: {
            medicineId: medicine.id,
            type: 'INITIAL_STOCK',
            delta: medicine.stock,
            beforeStock: 0,
            afterStock: medicine.stock,
            reason: 'Initial stock on create',
            actorEmail,
          },
        });
      }

      return medicine;
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: 'Error adding medicine', error });
  }
};
