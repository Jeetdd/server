import express from 'express';
import { analyzePrescription, deletePrescription, getMyPrescriptions, getPrescriptionById, updatePrescriptionLabel } from '../controllers/prescriptionController';
import { upload } from '../config/upload';
import { requireInternalToken } from '../middlewares/internalAuth';

const router = express.Router();

router.post('/analyze', upload.single('prescription'), analyzePrescription);
router.get('/my', requireInternalToken, getMyPrescriptions);
router.get('/:id', requireInternalToken, getPrescriptionById);
router.patch('/:id', requireInternalToken, updatePrescriptionLabel);
router.delete('/:id', requireInternalToken, deletePrescription);

export default router;
