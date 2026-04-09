"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrescriptionById = exports.getMyPrescriptions = exports.analyzePrescription = void 0;
const geminiVision_1 = require("../utils/geminiVision");
const medicineController_1 = require("./medicineController");
const prisma_1 = __importDefault(require("../config/prisma"));
const analyzePrescription = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        const imagePath = req.file.path;
        console.log('[Prescription] Uploaded file:', imagePath);
        // Use Gemini Vision to analyze the prescription image
        console.log('[Prescription] Sending to Gemini Vision for analysis...');
        const detectedMedicines = await (0, geminiVision_1.analyzePrescriptionImage)(imagePath);
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
        const matchedResults = await (0, medicineController_1.fuzzySearchMedicines)(medicineNames);
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
                price: matchData.matched && matchData.matchedMedicine ? matchData.matchedMedicine.price : null,
                image: matchData.matched && matchData.matchedMedicine ? matchData.matchedMedicine.image : null,
            };
        });
        console.log('[Prescription] Final merged results:', mergedResults);
        const imageUrl = `/uploads/${req.file.filename}`;
        const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
        let prescriptionId = null;
        if (email) {
            try {
                const user = await prisma_1.default.user.upsert({
                    where: { email },
                    update: name ? { name } : {},
                    create: {
                        name: name || email.split('@')[0] || 'User',
                        email,
                        role: 'USER',
                        isRegistered: true,
                    },
                });
                const saved = await prisma_1.default.prescription.create({
                    data: {
                        userId: user.id,
                        imageUrl,
                        detectedMedicines: mergedResults,
                    },
                    select: { id: true },
                });
                prescriptionId = saved.id;
            }
            catch (saveError) {
                console.error('[Prescription] Save failed:', saveError);
            }
        }
        res.json({
            imageUrl,
            detectedMedicines: mergedResults,
            prescriptionId,
            saved: Boolean(prescriptionId),
        });
    }
    catch (error) {
        console.error('[Prescription] Error:', error);
        res.status(500).json({
            message: error.message || 'Error analyzing prescription',
            error: error.toString()
        });
    }
};
exports.analyzePrescription = analyzePrescription;
const getMyPrescriptions = async (req, res) => {
    try {
        const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
        if (!email) {
            return res.status(400).json({ message: 'email is required' });
        }
        const user = await prisma_1.default.user.findUnique({ where: { email }, select: { id: true } });
        if (!user) {
            return res.json([]);
        }
        const prescriptions = await prisma_1.default.prescription.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                imageUrl: true,
                createdAt: true,
                updatedAt: true,
            },
            take: 50,
        });
        res.json(prescriptions);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching prescriptions', error: error.message });
    }
};
exports.getMyPrescriptions = getMyPrescriptions;
const getPrescriptionById = async (req, res) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) {
            return res.status(400).json({ message: 'id is required' });
        }
        const prescription = await prisma_1.default.prescription.findUnique({
            where: { id },
            select: {
                id: true,
                imageUrl: true,
                detectedMedicines: true,
                createdAt: true,
            },
        });
        if (!prescription) {
            return res.status(404).json({ message: 'Prescription not found' });
        }
        res.json(prescription);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching prescription', error: error.message });
    }
};
exports.getPrescriptionById = getPrescriptionById;
