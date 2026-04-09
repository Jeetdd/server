import express from 'express';
import { createOrder, getMyOrders, getOrderById, getOrders, getOrderSummary, updateOrderStatus } from '../controllers/orderController';
import { authenticate, authorize } from '../middlewares/auth';
import { requireInternalToken } from '../middlewares/internalAuth';

const router = express.Router();

router.post('/checkout', createOrder);
router.get('/my', requireInternalToken, getMyOrders);
router.get('/summary', getOrderSummary);
router.get('/:id', getOrderById);
router.get('/', getOrders);
router.patch('/:id/status', updateOrderStatus);

export default router;
