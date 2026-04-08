import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import medicineRoutes from './routes/medicineRoutes';
import prescriptionRoutes from './routes/prescriptionRoutes';
import authRoutes from './routes/authRoutes';
import slotRoutes from './routes/slotRoutes';
import orderRoutes from './routes/orderRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

console.log('--- SkinShop Server Version: 1.0.1 (Debug Mode) ---');
console.log('--- Gemini Key Status:', process.env.GEMINI_API_KEY ? 'Present' : 'MISSING', '---');

app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/orders', orderRoutes);

app.get('/', (req: Request, res: Response) => {
  res.send('SkinShop Backend API is running with PostgreSQL & Prisma...');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
