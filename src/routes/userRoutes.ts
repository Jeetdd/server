import express from 'express';
import { getUserByEmail, updateUserByEmail, getUsers, adjustPoints, getPointsTransactions } from '../controllers/userController';
import { requireInternalToken } from '../middlewares/internalAuth';

const router = express.Router();

router.get('/me', requireInternalToken, getUserByEmail);
router.patch('/me', requireInternalToken, updateUserByEmail);

// Admin routes
router.get('/', requireInternalToken, getUsers);
router.post('/points/adjust', requireInternalToken, adjustPoints);
router.get('/points/transactions/:userId?', requireInternalToken, getPointsTransactions);

export default router;
