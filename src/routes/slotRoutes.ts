import express from 'express';
import { getAvailableSlots, createSlot } from '../controllers/slotController';
import { authenticate, authorize } from '../middlewares/auth';

const router = express.Router();

router.get('/', getAvailableSlots);
router.post('/', createSlot); // Keeping public or can add ADIMIN protection

export default router;
