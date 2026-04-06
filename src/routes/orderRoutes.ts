import express from 'express';
import { createOrder, getOrders, updateOrderStatus } from '../controllers/orderController';
import { authenticate, authorize } from '../middlewares/auth';

const router = express.Router();

// Public checkout route
router.post('/checkout', createOrder);

// Protected admin/pharmacist routes
router.get('/', getOrders);
router.patch('/:id/status', updateOrderStatus);

export default router;
