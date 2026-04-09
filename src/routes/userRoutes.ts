import express from 'express';
import { getUserByEmail, updateUserByEmail } from '../controllers/userController';

const router = express.Router();

router.get('/me', getUserByEmail);
router.patch('/me', updateUserByEmail);

export default router;

