import prisma from './config/prisma';
import dotenv from 'dotenv';

dotenv.config();

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
    await prisma.medicine.deleteMany({});
    
    await prisma.medicine.createMany({
      data: medicines
    });
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const slotTimes = ["09:00 AM - 11:00 AM", "11:00 AM - 01:00 PM", "01:00 PM - 03:00 PM", "03:00 PM - 05:00 PM", "05:00 PM - 07:00 PM", "07:00 PM - 09:00 PM"];

    const slots = [];
    for (const time of slotTimes) {
      slots.push({ date: today, timeSlot: time, maxBookings: 5 });
      slots.push({ date: tomorrow, timeSlot: time, maxBookings: 5 });
    }

    await prisma.pickUpSlot.createMany({
      data: slots,
      skipDuplicates: true
    });
    
    console.log('Database Seeded Successfully (Medicines + Slots)!');
    process.exit();
  } catch (error) {
    console.error('Seed Error:', error);
    process.exit(1);
  }
};

seedDB();
