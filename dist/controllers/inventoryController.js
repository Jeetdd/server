"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adjustInventory = exports.getInventoryMovements = exports.getInventorySummary = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const client_1 = require("@prisma/client");
const asString = (value) => (typeof value === 'string' ? value : undefined);
const getInventorySummary = async (req, res) => {
    try {
        const lowStockThreshold = Number(asString(req.query.lowStockThreshold) ?? 10);
        const medicines = await prisma_1.default.medicine.findMany({
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
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching inventory summary', error: error.message });
    }
};
exports.getInventorySummary = getInventorySummary;
const getInventoryMovements = async (req, res) => {
    try {
        const medicineId = asString(req.query.medicineId);
        const type = asString(req.query.type);
        const limit = Math.min(200, Math.max(1, Number(asString(req.query.limit) ?? 50)));
        const movementType = type && Object.values(client_1.InventoryMovementType).includes(type) ? type : undefined;
        const movements = await prisma_1.default.inventoryMovement.findMany({
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
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching inventory movements', error: error.message });
    }
};
exports.getInventoryMovements = getInventoryMovements;
const adjustInventory = async (req, res) => {
    try {
        const { medicineId, delta, reason, actorEmail } = req.body;
        if (!medicineId) {
            return res.status(400).json({ message: 'medicineId is required' });
        }
        const parsedDelta = Number(delta);
        if (!Number.isFinite(parsedDelta) || parsedDelta === 0) {
            return res.status(400).json({ message: 'delta must be a non-zero number' });
        }
        const result = await prisma_1.default.$transaction(async (tx) => {
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
    }
    catch (error) {
        res.status(400).json({ message: error.message || 'Error adjusting inventory', error: error.message });
    }
};
exports.adjustInventory = adjustInventory;
