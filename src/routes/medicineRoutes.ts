import express from 'express';
import { getMedicines, addMedicine } from '../controllers/medicineController';
import { authenticate, authorize } from '../middlewares/auth';

const router = express.Router();

router.get('/', getMedicines);
router.post('/', addMedicine);

export default router;
