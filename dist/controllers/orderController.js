"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderStatus = exports.getOrderById = exports.getOrderSummary = exports.getOrders = exports.createOrder = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const client_1 = require("@prisma/client");
const razorpay_1 = __importDefault(require("razorpay"));
const razorpay = new razorpay_1.default({
    key_id: process.env.RAZORPAY_KEY_ID || 'dummy_id',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
});
const orderInclude = {
    user: true,
    items: {
        include: {
            medicine: true,
        },
    },
};
const validStatuses = new Set(Object.values(client_1.OrderStatus));
const buildOrderWhere = (query) => {
    const where = {};
    const status = typeof query.status === 'string' ? query.status : undefined;
    const fulfillmentMethod = typeof query.fulfillmentMethod === 'string' ? query.fulfillmentMethod : undefined;
    const paymentStatus = typeof query.paymentStatus === 'string' ? query.paymentStatus : undefined;
    const search = typeof query.search === 'string' ? query.search.trim() : undefined;
    const prescriptionOnly = query.prescriptionOnly === 'true';
    if (status && validStatuses.has(status)) {
        where.status = status;
    }
    if (fulfillmentMethod === 'DELIVERY' || fulfillmentMethod === 'PICKUP') {
        where.fulfillmentMethod = fulfillmentMethod;
    }
    if (paymentStatus === 'PENDING' || paymentStatus === 'SUCCESS' || paymentStatus === 'FAILED') {
        where.paymentStatus = paymentStatus;
    }
    if (prescriptionOnly) {
        where.prescriptionImage = {
            not: null,
        };
    }
    if (search) {
        where.OR = [
            { id: { contains: search, mode: 'insensitive' } },
            { couponCode: { contains: search, mode: 'insensitive' } },
            { shippingAddress: { contains: search, mode: 'insensitive' } },
            {
                user: {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } },
                        { phone: { contains: search, mode: 'insensitive' } },
                    ],
                },
            },
            {
                items: {
                    some: {
                        medicine: {
                            name: { contains: search, mode: 'insensitive' },
                        },
                    },
                },
            },
        ];
    }
    return where;
};
const serializeOrder = (order) => ({
    ...order,
    itemsCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    requiresPrescription: order.items.some((item) => item.medicine.requiresPrescription),
});
const buildSummary = async (where) => {
    const [counts, revenue, todayOrders, pendingPickup, deliveryOrders] = await Promise.all([
        prisma_1.default.order.groupBy({
            by: ['status'],
            where,
            _count: { _all: true },
        }),
        prisma_1.default.order.aggregate({
            where,
            _sum: {
                finalAmount: true,
            },
        }),
        prisma_1.default.order.count({
            where: {
                ...where,
                createdAt: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0)),
                },
            },
        }),
        prisma_1.default.order.count({
            where: {
                ...where,
                fulfillmentMethod: 'PICKUP',
                status: {
                    in: ['APPROVED', 'READY_FOR_PICKUP'],
                },
            },
        }),
        prisma_1.default.order.count({
            where: {
                ...where,
                fulfillmentMethod: 'DELIVERY',
            },
        }),
    ]);
    const byStatus = counts.reduce((acc, entry) => {
        acc[entry.status] = entry._count._all;
        return acc;
    }, {});
    return {
        totalOrders: counts.reduce((sum, entry) => sum + entry._count._all, 0),
        todayOrders,
        pendingReview: byStatus.PENDING_PHARMACIST_REVIEW || 0,
        processingOrders: (byStatus.APPROVED || 0) +
            (byStatus.DISPATCHED || 0) +
            (byStatus.READY_FOR_PICKUP || 0),
        completedOrders: (byStatus.DELIVERED || 0) + (byStatus.COMPLETED || 0),
        cancelledOrders: (byStatus.REJECTED || 0) + (byStatus.CANCELLED || 0),
        pendingPickup,
        deliveryOrders,
        revenue: revenue._sum.finalAmount || 0,
        byStatus,
    };
};
const createOrder = async (req, res) => {
    try {
        const { user: userData, items, totalAmount, address, prescriptionUrl } = req.body;
        const user = await prisma_1.default.user.upsert({
            where: { email: userData.email },
            update: { name: userData.name, phone: userData.phone },
            create: {
                name: userData.name,
                email: userData.email,
                phone: userData.phone,
                role: 'USER',
            },
        });
        const newOrder = await prisma_1.default.order.create({
            data: {
                userId: user.id,
                totalAmount,
                finalAmount: totalAmount,
                shippingAddress: address,
                prescriptionImage: prescriptionUrl,
                fulfillmentMethod: address.includes('PICKUP') ? 'PICKUP' : 'DELIVERY',
                pickupSlotTime: address.includes('PICKUP') ? address.replace('PICKUP: ', '') : null,
                status: 'PENDING_PHARMACIST_REVIEW',
                paymentStatus: 'PENDING',
                items: {
                    create: items.map((item) => ({
                        medicine: {
                            connect: { name: item.name },
                        },
                        quantity: item.quantity,
                        price: item.price,
                    })),
                },
            },
            include: orderInclude,
        });
        res.status(201).json(serializeOrder(newOrder));
    }
    catch (error) {
        console.error('[Order Controller] Create Order Error:', error);
        res.status(500).json({ message: 'Error creating order', error: error.message });
    }
};
exports.createOrder = createOrder;
const getOrders = async (req, res) => {
    try {
        const where = buildOrderWhere(req.query);
        const orders = await prisma_1.default.order.findMany({
            where,
            include: orderInclude,
            orderBy: { createdAt: 'desc' },
        });
        res.json(orders.map(serializeOrder));
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching orders', error: error.message });
    }
};
exports.getOrders = getOrders;
const getOrderSummary = async (req, res) => {
    try {
        const where = buildOrderWhere(req.query);
        const summary = await buildSummary(where);
        res.json(summary);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching order summary', error: error.message });
    }
};
exports.getOrderSummary = getOrderSummary;
const getOrderById = async (req, res) => {
    try {
        const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!orderId) {
            return res.status(400).json({ message: 'Order id is required' });
        }
        const order = await prisma_1.default.order.findUnique({
            where: { id: orderId },
            include: orderInclude,
        });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.json(serializeOrder(order));
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching order', error: error.message });
    }
};
exports.getOrderById = getOrderById;
const updateOrderStatus = async (req, res) => {
    try {
        const { status, pharmacistReviewComment, paymentStatus } = req.body;
        const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!orderId) {
            return res.status(400).json({ message: 'Order id is required' });
        }
        if (status && !validStatuses.has(status)) {
            return res.status(400).json({ message: 'Invalid order status' });
        }
        if (paymentStatus && !['PENDING', 'SUCCESS', 'FAILED'].includes(paymentStatus)) {
            return res.status(400).json({ message: 'Invalid payment status' });
        }
        const data = {};
        if (status) {
            data.status = status;
        }
        if (typeof pharmacistReviewComment === 'string') {
            data.pharmacistReviewComment = pharmacistReviewComment.trim() || null;
        }
        if (paymentStatus) {
            data.paymentStatus = paymentStatus;
        }
        const order = await prisma_1.default.order.update({
            where: { id: orderId },
            data,
            include: orderInclude,
        });
        res.json(serializeOrder(order));
    }
    catch (error) {
        res.status(500).json({ message: 'Error updating order status', error: error.message });
    }
};
exports.updateOrderStatus = updateOrderStatus;
