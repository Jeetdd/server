import express from 'express';
import { analyzePrescription, getMyPrescriptions, getPrescriptionById } from '../controllers/prescriptionController';
import { upload } from '../config/upload';

const router = express.Router();

router.post('/analyze', upload.single('prescription'), analyzePrescription);
router.get('/my', getMyPrescriptions);
router.get('/:id', getPrescriptionById);

export default router;
