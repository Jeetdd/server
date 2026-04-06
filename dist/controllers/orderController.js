"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderStatus = exports.getOrders = exports.createOrder = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const razorpay_1 = __importDefault(require("razorpay"));
const razorpay = new razorpay_1.default({
    key_id: process.env.RAZORPAY_KEY_ID || 'dummy_id',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
});
const createOrder = async (req, res) => {
    try {
        const { user: userData, items, totalAmount, address, prescriptionUrl } = req.body;
        // Find or create user
        const user = await prisma_1.default.user.upsert({
            where: { email: userData.email },
            update: { name: userData.name, phone: userData.phone },
            create: {
                name: userData.name,
                email: userData.email,
                phone: userData.phone,
                role: 'USER'
            }
        });
        // Create the order with nested items
        const newOrder = await prisma_1.default.order.create({
            data: {
                userId: user.id,
                totalAmount: totalAmount,
                finalAmount: totalAmount, // For now same as total
                shippingAddress: address,
                prescriptionImage: prescriptionUrl,
                fulfillmentMethod: address.includes('PICKUP') ? 'PICKUP' : 'DELIVERY',
                pickupSlotTime: address.includes('PICKUP') ? address.replace('PICKUP: ', '') : null,
                status: 'PENDING_PHARMACIST_REVIEW',
                paymentStatus: 'PENDING',
                items: {
                    create: items.map((item) => ({
                        // Try to find medicineId by name if not provided (fuzzy search might be better but name is unique in schema)
                        medicine: {
                            connect: { name: item.name }
                        },
                        quantity: item.quantity,
                        price: item.price
                    }))
                }
            },
            include: {
                items: true,
                user: true
            }
        });
        res.status(201).json(newOrder);
    }
    catch (error) {
        console.error('[Order Controller] Create Order Error:', error);
        res.status(500).json({ message: 'Error creating order', error: error.message });
    }
};
exports.createOrder = createOrder;
const getOrders = async (req, res) => {
    try {
        const orders = await prisma_1.default.order.findMany({
            include: {
                user: true,
                items: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(orders);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching orders', error: error.message });
    }
};
exports.getOrders = getOrders;
const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const order = await prisma_1.default.order.update({
            where: { id: req.params.id },
            data: { status },
            include: { user: true, items: true }
        });
        res.json(order);
    }
    catch (error) {
        res.status(500).json({ message: 'Error updating order status', error: error.message });
    }
};
exports.updateOrderStatus = updateOrderStatus;
