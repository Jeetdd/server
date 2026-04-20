"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderStatus = exports.getOrderById = exports.getOrderSummary = exports.getMyOrders = exports.getOrders = exports.createOrder = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const client_1 = require("@prisma/client");
const razorpay_1 = __importDefault(require("razorpay"));
const internalAuth_1 = require("../middlewares/internalAuth");
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
const resolveMedicineForCheckout = async (item) => {
    if (item.medicineId) {
        const byId = await prisma_1.default.medicine.findUnique({ where: { id: item.medicineId } });
        if (byId) {
            return byId;
        }
    }
    const byName = await prisma_1.default.medicine.findUnique({ where: { name: item.name } });
    if (byName) {
        return byName;
    }
    return null;
};
const createOrder = async (req, res) => {
    try {
        const { user: userData, items, totalAmount, address, prescriptionUrl, redeemPoints } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Add at least one medicine before placing the order.' });
        }
        const newOrder = await prisma_1.default.$transaction(async (tx) => {
            // 1. Find or create user
            const user = await tx.user.upsert({
                where: { email: userData.email },
                update: { name: userData.name, phone: userData.phone },
                create: {
                    name: userData.name,
                    email: userData.email,
                    phone: userData.phone,
                    role: 'USER',
                },
            });
            // 2. Handle Loyalty Points Redemption
            let finalAmount = totalAmount;
            let pointsRedeemed = 0;
            let pointsDiscount = 0;
            if (redeemPoints && user.loyaltyPoints > 0) {
                // 100 points = 1 Rs
                const maxRedeemablePoints = Math.floor(totalAmount * 100);
                pointsRedeemed = Math.min(user.loyaltyPoints, maxRedeemablePoints);
                pointsDiscount = pointsRedeemed / 100;
                finalAmount = totalAmount - pointsDiscount;
                await tx.user.update({
                    where: { id: user.id },
                    data: { loyaltyPoints: { decrement: pointsRedeemed } }
                });
                await tx.pointsTransaction.create({
                    data: {
                        userId: user.id,
                        amount: -pointsRedeemed,
                        type: 'REDEEMED',
                        reason: `Redeemed on order creation`,
                    }
                });
            }
            // 3. Resolve Items and Validate Stock
            const resolvedItems = await Promise.all(items.map(async (item) => {
                const medicine = await (async () => {
                    if (item.medicineId) {
                        const byId = await tx.medicine.findUnique({ where: { id: item.medicineId } });
                        if (byId)
                            return byId;
                    }
                    return tx.medicine.findUnique({ where: { name: item.name } });
                })();
                if (!medicine) {
                    throw new Error(`Medicine not found in catalogue: ${item.name}`);
                }
                if (medicine.stock - item.quantity < 0) {
                    throw new Error(`Insufficient stock for ${medicine.name}. Available: ${medicine.stock}.`);
                }
                return {
                    medicineId: medicine.id,
                    quantity: item.quantity,
                    price: item.price,
                };
            }));
            // 4. Create Order
            const order = await tx.order.create({
                data: {
                    userId: user.id,
                    totalAmount,
                    finalAmount, // Using the amount after points redemption
                    shippingAddress: address,
                    prescriptionImage: prescriptionUrl,
                    fulfillmentMethod: address.includes('PICKUP') ? 'PICKUP' : 'DELIVERY',
                    pickupSlotTime: address.includes('PICKUP') ? address.replace('PICKUP: ', '') : null,
                    status: 'PENDING_PHARMACIST_REVIEW',
                    paymentStatus: 'PENDING',
                    inventoryApplied: false,
                    items: {
                        create: resolvedItems.map((item) => ({
                            medicine: { connect: { id: item.medicineId } },
                            quantity: item.quantity,
                            price: item.price,
                        })),
                    },
                },
                include: orderInclude,
            });
            return order;
        });
        res.status(201).json(serializeOrder(newOrder));
    }
    catch (error) {
        console.error('[Order Controller] Create Order Error:', error);
        res.status(500).json({ message: error.message || 'Error creating order', error: error.message });
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
const getMyOrders = async (req, res) => {
    try {
        const email = (0, internalAuth_1.getInternalUserEmail)(req) || (typeof req.query.email === 'string' ? req.query.email.trim() : '');
        if (!email) {
            return res.status(400).json({ message: 'email is required' });
        }
        const orders = await prisma_1.default.order.findMany({
            where: { user: { email } },
            include: orderInclude,
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        res.json(orders.map(serializeOrder));
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching user orders', error: error.message });
    }
};
exports.getMyOrders = getMyOrders;
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
        const updated = await prisma_1.default.$transaction(async (tx) => {
            const existing = await tx.order.findUnique({
                where: { id: orderId },
                include: orderInclude,
            });
            if (!existing) {
                throw new Error('Order not found');
            }
            const nextStatus = status ? status : existing.status;
            const wasApplied = existing.inventoryApplied;
            // Apply or revert inventory when status changes.
            // Deduct on APPROVED, restore on CANCELLED/REJECTED.
            if (nextStatus === 'APPROVED' && !wasApplied) {
                const adjustments = await Promise.all(existing.items.map(async (item) => {
                    const beforeStock = item.medicine.stock;
                    const afterStock = beforeStock - item.quantity;
                    if (afterStock < 0) {
                        throw new Error(`Insufficient stock for ${item.medicine.name}. Available: ${beforeStock}.`);
                    }
                    await tx.medicine.update({ where: { id: item.medicineId }, data: { stock: afterStock } });
                    return { medicineId: item.medicineId, beforeStock, afterStock, quantity: item.quantity };
                }));
                await tx.inventoryMovement.createMany({
                    data: adjustments.map((a) => ({
                        medicineId: a.medicineId,
                        type: 'SALE',
                        delta: -a.quantity,
                        beforeStock: a.beforeStock,
                        afterStock: a.afterStock,
                        reason: 'Order approved',
                        orderId: existing.id,
                        actorEmail: existing.user.email,
                    })),
                });
                data.inventoryApplied = true;
            }
            if ((nextStatus === 'CANCELLED' || nextStatus === 'REJECTED') && wasApplied) {
                const adjustments = await Promise.all(existing.items.map(async (item) => {
                    const beforeStock = item.medicine.stock;
                    const afterStock = beforeStock + item.quantity;
                    await tx.medicine.update({ where: { id: item.medicineId }, data: { stock: afterStock } });
                    return { medicineId: item.medicineId, beforeStock, afterStock, quantity: item.quantity };
                }));
                await tx.inventoryMovement.createMany({
                    data: adjustments.map((a) => ({
                        medicineId: a.medicineId,
                        type: 'CANCELLED_ORDER',
                        delta: a.quantity,
                        beforeStock: a.beforeStock,
                        afterStock: a.afterStock,
                        reason: 'Order cancelled/rejected',
                        orderId: existing.id,
                        actorEmail: existing.user.email,
                    })),
                });
                data.inventoryApplied = false;
            }
            // Award Loyalty Points on payment success
            if (paymentStatus === 'SUCCESS' && existing.paymentStatus !== 'SUCCESS') {
                const pointsEarned = Math.floor(existing.finalAmount / 100);
                if (pointsEarned > 0) {
                    await tx.user.update({
                        where: { id: existing.userId },
                        data: { loyaltyPoints: { increment: pointsEarned } },
                    });
                    await tx.pointsTransaction.create({
                        data: {
                            userId: existing.userId,
                            amount: pointsEarned,
                            type: 'EARNED',
                            reason: `Earned from order #${orderId.slice(-8)}`,
                        },
                    });
                }
                // Handle Referral Reward (First order only)
                const referral = await tx.referral.findUnique({
                    where: { referredUserId: existing.userId },
                    include: { referrer: true }
                });
                if (referral && referral.status === 'PENDING') {
                    await tx.referral.update({
                        where: { id: referral.id },
                        data: { status: 'SUCCESSFUL', rewardPoints: 50 } // Fixed bonus for now
                    });
                    await tx.user.update({
                        where: { id: referral.referrerId },
                        data: { loyaltyPoints: { increment: 50 } }
                    });
                    await tx.pointsTransaction.create({
                        data: {
                            userId: referral.referrerId,
                            amount: 50,
                            type: 'EARNED',
                            reason: `Referral bonus for ${existing.user.name}`,
                        }
                    });
                }
            }
            const order = await tx.order.update({
                where: { id: orderId },
                data,
                include: orderInclude,
            });
            return order;
        });
        res.json(serializeOrder(updated));
    }
    catch (error) {
        res.status(500).json({ message: 'Error updating order status', error: error.message });
    }
};
exports.updateOrderStatus = updateOrderStatus;
