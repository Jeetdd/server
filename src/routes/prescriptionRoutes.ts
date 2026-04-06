import express from 'express';
import { analyzePrescription } from '../controllers/prescriptionController';
import { upload } from '../config/upload';

const router = express.Router();

router.post('/analyze', upload.single('prescription'), analyzePrescription);

export default router;
