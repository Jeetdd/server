import express from 'express';
import { getUserByEmail, updateUserByEmail } from '../controllers/userController';
import { requireInternalToken } from '../middlewares/internalAuth';

const router = express.Router();

router.get('/me', requireInternalToken, getUserByEmail);
router.patch('/me', requireInternalToken, updateUserByEmail);

export default router;
