import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Medicine from '../models/Medicine';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const medicines = [
  {
    medicineId: "SKIN-001",
    name: "Tretinoin Cream",
    strength: "0.025%",
    quantity: 50,
    price: 450,
    description: "Retinoid for acne and anti-aging. Apply sparingly at night.",
    category: "Acne",
    requiresPrescription: true,
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=400"
  },
  {
    medicineId: "SKIN-002",
    name: "Tretinoin Cream",
    strength: "0.05%",
    quantity: 40,
    price: 520,
    description: "Stronger Retinoid for acne and anti-aging. Apply sparingly at night.",
    category: "Acne",
    requiresPrescription: true,
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=400"
  },
  {
    medicineId: "SKIN-003",
    name: "Azelaic Acid Gel",
    strength: "15%",
    quantity: 60,
    price: 380,
    description: "Helps with rosacea and hyperpigmentation.",
    category: "Hyperpigmentation",
    requiresPrescription: true,
    image: "https://images.unsplash.com/photo-1626716493137-b67fe9501e76?auto=format&fit=crop&w=400"
  },
  {
    medicineId: "SKIN-004",
    name: "Azelaic Acid Cream",
    strength: "20%",
    quantity: 30,
    price: 420,
    description: "Stronger Azelaic Acid for rosacea and hyperpigmentation.",
    category: "Hyperpigmentation",
    requiresPrescription: true,
    image: "https://images.unsplash.com/photo-1626716493137-b67fe9501e76?auto=format&fit=crop&w=400"
  },
  {
    medicineId: "SKIN-005",
    name: "Clindamycin Gel",
    strength: "1%",
    quantity: 100,
    price: 290,
    description: "Topical antibiotic for inflammatory acne.",
    category: "Acne",
    requiresPrescription: true,
    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400"
  },
  {
    medicineId: "SKIN-006",
    name: "Hydroquinone Cream",
    strength: "4%",
    quantity: 25,
    price: 650,
    description: "Strong skin lightening agent for melasma.",
    category: "Hyperpigmentation",
    requiresPrescription: true,
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=400"
  },
  {
    medicineId: "SKIN-007",
    name: "Benzoyl Peroxide Gel",
    strength: "2.5%",
    quantity: 80,
    price: 180,
    description: "OTC acne treatment that kills bacteria.",
    category: "Acne",
    requiresPrescription: false,
    image: "https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?auto=format&fit=crop&w=400"
  },
  {
    medicineId: "SKIN-008",
    name: "Ketoconazole Cream",
    strength: "2%",
    quantity: 45,
    price: 310,
    description: "Antifungal cream for skin infections.",
    category: "Antifungal",
    requiresPrescription: true,
    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400"
  }
];

const seedDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/skinshop';
    console.log('Connecting to MongoDB:', mongoUri);
    await mongoose.connect(mongoUri);
    
    // Clear existing medicines
    await Medicine.deleteMany({});
    console.log('Cleared existing medicines.');
    
    // Insert new medicines
    await Medicine.insertMany(medicines);
    console.log(`Successfully seeded ${medicines.length} medicines!`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDB();
