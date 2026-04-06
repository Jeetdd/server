"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addMedicine = exports.fuzzySearchMedicines = exports.getMedicines = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const fuse_js_1 = __importDefault(require("fuse.js"));
const getMedicines = async (req, res) => {
    try {
        const medicines = await prisma_1.default.medicine.findMany();
        // Map stock to quantity for frontend compatibility
        const mappedMedicines = medicines.map(m => ({
            ...m,
            quantity: m.stock
        }));
        res.json(mappedMedicines);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching medicines', error });
    }
};
exports.getMedicines = getMedicines;
const fuzzySearchMedicines = async (medicinesToMatch) => {
    const catalogue = await prisma_1.default.medicine.findMany();
    const options = {
        keys: ['name'],
        threshold: 0.4, // Adjust for matching sensitivity
    };
    const fuse = new fuse_js_1.default(catalogue, options);
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
exports.fuzzySearchMedicines = fuzzySearchMedicines;
const addMedicine = async (req, res) => {
    try {
        const medicine = await prisma_1.default.medicine.create({
            data: {
                name: req.body.name,
                price: req.body.price,
                stock: req.body.quantity || req.body.stock || 0,
                category: req.body.category,
                description: req.body.description,
                requiresPrescription: req.body.requiresPrescription
            }
        });
        res.status(201).json(medicine);
    }
    catch (error) {
        res.status(400).json({ message: 'Error adding medicine', error });
    }
};
exports.addMedicine = addMedicine;
