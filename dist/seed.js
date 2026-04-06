"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./config/prisma"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const medicines = [
    {
        name: "Tretinoin 0.05% Cream",
        price: 450,
        stock: 100,
        category: "Retinoids",
        description: "Anti-aging and acne treatment.",
        requiresPrescription: true
    },
    {
        name: "Azelaic Acid 15% Gel",
        price: 320,
        stock: 50,
        category: "Acne",
        description: "Treatment for rosacea and acne.",
        requiresPrescription: true
    },
    {
        name: "Glycolic Acid 10% Lotion",
        price: 550,
        stock: 80,
        category: "Exfoliants",
        requiresPrescription: false
    },
    {
        name: "Clindamycin 1% Phosphate",
        price: 280,
        stock: 45,
        category: "Antibiotics",
        requiresPrescription: true
    }
];
const seedDB = async () => {
    try {
        await prisma_1.default.medicine.deleteMany({});
        await prisma_1.default.medicine.createMany({
            data: medicines
        });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const slotTimes = ["09:00 AM - 11:00 AM", "11:00 AM - 01:00 PM", "01:00 PM - 03:00 PM", "03:00 PM - 05:00 PM", "05:00 PM - 07:00 PM", "07:00 PM - 09:00 PM"];
        const slots = [];
        for (const time of slotTimes) {
            slots.push({ date: today, timeSlot: time, maxBookings: 5 });
            slots.push({ date: tomorrow, timeSlot: time, maxBookings: 5 });
        }
        await prisma_1.default.pickUpSlot.createMany({
            data: slots,
            skipDuplicates: true
        });
        console.log('Database Seeded Successfully (Medicines + Slots)!');
        process.exit();
    }
    catch (error) {
        console.error('Seed Error:', error);
        process.exit(1);
    }
};
seedDB();
