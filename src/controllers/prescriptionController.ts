import { Request, Response } from 'express';
import { analyzePrescriptionImage } from '../utils/geminiVision';
import { fuzzySearchMedicines } from './medicineController';

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

    res.json({
      imageUrl: `/uploads/${req.file.filename}`,
      detectedMedicines: mergedResults,
    });

  } catch (error: any) {
    console.error('[Prescription] Error:', error);
    res.status(500).json({ 
      message: error.message || 'Error analyzing prescription', 
      error: error.toString() 
    });
  }
};
