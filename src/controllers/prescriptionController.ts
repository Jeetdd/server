import { Request, Response } from 'express';
import { analyzePrescriptionImage } from '../utils/geminiVision';
import { fuzzySearchMedicines } from './medicineController';
import prisma from '../config/prisma';
import { getInternalUserEmail } from '../middlewares/internalAuth';

export const analyzePrescription = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const imagePath = req.file.path;
    console.log('[Prescription] Uploaded file:', imagePath);

    // Use Gemini Vision to analyze the prescription image
    console.log('[Prescription] Sending to Gemini Vision for analysis...');
    const detectedMedicines = await analyzePrescriptionImage(imagePath);
    console.log('[Prescription] Gemini detected medicines:', detectedMedicines);

    if (detectedMedicines.length === 0) {
      return res.json({
        imageUrl: `/uploads/${req.file.filename}`,
        detectedMedicines: [],
        message: 'No medicines could be detected in this prescription. Please upload a clearer image.',
      });
    }

    // Fuzzy match detected medicines against our catalogue
    const medicineNames = detectedMedicines.map(m => m.name);
    const matchedResults = await fuzzySearchMedicines(medicineNames);

    const mergedResults = detectedMedicines.map((detected, index) => {
      const matchData = matchedResults[index] || { matched: false, matchedMedicine: null };
      return {
        name: detected.name,
        dosage: detected.dosage,
        frequency: detected.frequency,
        duration: detected.duration,
        quantity: detected.quantity,
        matchedMedicine: matchData.matchedMedicine,
        isAvailable: matchData.matched,
        price: matchData.matched && matchData.matchedMedicine ? (matchData.matchedMedicine as any).price : null,
        image: matchData.matched && matchData.matchedMedicine ? (matchData.matchedMedicine as any).image : null,
      };
    });

    console.log('[Prescription] Final merged results:', mergedResults);

    const imageUrl = `/uploads/${req.file.filename}`;

    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

    let prescriptionId: string | null = null;
    if (email) {
      try {
        const user = await prisma.user.upsert({
          where: { email },
          update: name ? { name } : {},
          create: {
            name: name || email.split('@')[0] || 'User',
            email,
            role: 'USER',
            isRegistered: true,
          },
        });

        const saved = await prisma.prescription.create({
          data: {
            userId: user.id,
            imageUrl,
            detectedMedicines: mergedResults as any,
          },
          select: { id: true },
        });

        prescriptionId = saved.id;
      } catch (saveError) {
        console.error('[Prescription] Save failed:', saveError);
      }
    }

    res.json({
      imageUrl,
      detectedMedicines: mergedResults,
      prescriptionId,
      saved: Boolean(prescriptionId),
    });

  } catch (error: any) {
    console.error('[Prescription] Error:', error);
    res.status(500).json({ 
      message: error.message || 'Error analyzing prescription', 
      error: error.toString() 
    });
  }
};

export const getMyPrescriptions = async (req: Request, res: Response) => {
  try {
    const email = getInternalUserEmail(req) || (typeof req.query.email === 'string' ? req.query.email.trim() : '');
    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      return res.json([]);
    }

    const prescriptions = await prisma.prescription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        label: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 50,
    });

    res.json(prescriptions);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching prescriptions', error: error.message });
  }
};

export const getPrescriptionById = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ message: 'id is required' });
    }

    const email = getInternalUserEmail(req);
    if (!email) {
      return res.status(400).json({ message: 'x-user-email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const prescription = await prisma.prescription.findUnique({
      where: { id },
      select: {
        id: true,
        label: true,
        imageUrl: true,
        detectedMedicines: true,
        createdAt: true,
        userId: true,
      },
    });

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    if (prescription.userId !== user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { userId, ...safe } = prescription as any;
    res.json(safe);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching prescription', error: error.message });
  }
};

export const updatePrescriptionLabel = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ message: 'id is required' });
    }

    const email = getInternalUserEmail(req);
    if (!email) {
      return res.status(400).json({ message: 'x-user-email is required' });
    }

    const label = typeof req.body.label === 'string' ? req.body.label.trim() : '';
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existing = await prisma.prescription.findUnique({ where: { id }, select: { userId: true } });
    if (!existing) {
      return res.status(404).json({ message: 'Prescription not found' });
    }
    if (existing.userId !== user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updated = await prisma.prescription.update({
      where: { id },
      data: { label: label || null },
      select: { id: true, label: true, imageUrl: true, updatedAt: true },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Error updating prescription', error: error.message });
  }
};

export const deletePrescription = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ message: 'id is required' });
    }

    const email = getInternalUserEmail(req);
    if (!email) {
      return res.status(400).json({ message: 'x-user-email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existing = await prisma.prescription.findUnique({ where: { id }, select: { userId: true } });
    if (!existing) {
      return res.status(404).json({ message: 'Prescription not found' });
    }
    if (existing.userId !== user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await prisma.prescription.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Error deleting prescription', error: error.message });
  }
};
