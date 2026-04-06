"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSlot = exports.getAvailableSlots = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const getAvailableSlots = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const slots = await prisma_1.default.pickUpSlot.findMany({
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
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching slots', error: error.message });
    }
};
exports.getAvailableSlots = getAvailableSlots;
const createSlot = async (req, res) => {
    try {
        const { date, timeSlot, maxBookings } = req.body;
        const slot = await prisma_1.default.pickUpSlot.create({
            data: {
                date: new Date(date),
                timeSlot,
                maxBookings: maxBookings || 5
            }
        });
        res.status(201).json(slot);
    }
    catch (error) {
        res.status(400).json({ message: 'Error creating slot', error: error.message });
    }
};
exports.createSlot = createSlot;
