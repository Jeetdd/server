import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { OrderStatus, Prisma } from '@prisma/client';
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
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
} satisfies Prisma.OrderInclude;

const validStatuses = new Set<string>(Object.values(OrderStatus));

type CheckoutItem = {
  medicineId?: string;
  name: string;
  quantity: number;
  price: number;
};

const buildOrderWhere = (query: Request['query']): Prisma.OrderWhereInput => {
  const where: Prisma.OrderWhereInput = {};
  const status = typeof query.status === 'string' ? query.status : undefined;
  const fulfillmentMethod = typeof query.fulfillmentMethod === 'string' ? query.fulfillmentMethod : undefined;
  const paymentStatus = typeof query.paymentStatus === 'string' ? query.paymentStatus : undefined;
  const search = typeof query.search === 'string' ? query.search.trim() : undefined;
  const prescriptionOnly = query.prescriptionOnly === 'true';

  if (status && validStatuses.has(status)) {
    where.status = status as OrderStatus;
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

const serializeOrder = (order: Prisma.OrderGetPayload<{ include: typeof orderInclude }>) => ({
  ...order,
  itemsCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
  requiresPrescription: order.items.some((item) => item.medicine.requiresPrescription),
});

const buildSummary = async (where: Prisma.OrderWhereInput) => {
  const [counts, revenue, todayOrders, pendingPickup, deliveryOrders] = await Promise.all([
    prisma.order.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where,
      _sum: {
        finalAmount: true,
      },
    }),
    prisma.order.count({
      where: {
        ...where,
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    prisma.order.count({
      where: {
        ...where,
        fulfillmentMethod: 'PICKUP',
        status: {
          in: ['APPROVED', 'READY_FOR_PICKUP'],
        },
      },
    }),
    prisma.order.count({
      where: {
        ...where,
        fulfillmentMethod: 'DELIVERY',
      },
    }),
  ]);

  const byStatus = counts.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.status] = entry._count._all;
    return acc;
  }, {});

  return {
    totalOrders: counts.reduce((sum, entry) => sum + entry._count._all, 0),
    todayOrders,
    pendingReview: byStatus.PENDING_PHARMACIST_REVIEW || 0,
    processingOrders:
      (byStatus.APPROVED || 0) +
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

const resolveMedicineForCheckout = async (item: CheckoutItem) => {
  if (item.medicineId) {
    const byId = await prisma.medicine.findUnique({ where: { id: item.medicineId } });
    if (byId) {
      return byId;
    }
  }

  const byName = await prisma.medicine.findUnique({ where: { name: item.name } });
  if (byName) {
    return byName;
  }

  return null;
};

export const createOrder = async (req: Request, res: Response) => {
  try {
    const { user: userData, items, totalAmount, address, prescriptionUrl } = req.body as {
      user: { name: string; email: string; phone?: string };
      items: CheckoutItem[];
      totalAmount: number;
      address: string;
      prescriptionUrl?: string | null;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Add at least one medicine before placing the order.' });
    }

    const newOrder = await prisma.$transaction(async (tx) => {
      const resolvedItems = await Promise.all(
        items.map(async (item) => {
          const medicine = await (async () => {
            if (item.medicineId) {
              const byId = await tx.medicine.findUnique({ where: { id: item.medicineId } });
              if (byId) return byId;
            }
            return tx.medicine.findUnique({ where: { name: item.name } });
          })();

          if (!medicine) {
            throw new Error(`Medicine not found in catalogue: ${item.name}`);
          }

          return {
            medicine,
            quantity: item.quantity,
            price: item.price,
          };
        }),
      );

      // Validate + decrement stock (atomic with order create).
      const decrements = await Promise.all(
        resolvedItems.map(async (item) => {
          const beforeStock = item.medicine.stock;
          const afterStock = beforeStock - item.quantity;
          if (afterStock < 0) {
            throw new Error(`Insufficient stock for ${item.medicine.name}. Available: ${beforeStock}.`);
          }

          await tx.medicine.update({
            where: { id: item.medicine.id },
            data: { stock: afterStock },
          });

          return { medicineId: item.medicine.id, name: item.medicine.name, beforeStock, afterStock, quantity: item.quantity, price: item.price };
        }),
      );

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

      const order = await tx.order.create({
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
            create: decrements.map((item) => ({
              medicine: { connect: { id: item.medicineId } },
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
        include: orderInclude,
      });

      await tx.inventoryMovement.createMany({
        data: decrements.map((item) => ({
          medicineId: item.medicineId,
          type: 'SALE',
          delta: -item.quantity,
          beforeStock: item.beforeStock,
          afterStock: item.afterStock,
          reason: 'Checkout',
          orderId: order.id,
          actorEmail: userData.email,
        })),
      });

      return order;
    });

    res.status(201).json(serializeOrder(newOrder));
  } catch (error: any) {
    console.error('[Order Controller] Create Order Error:', error);
    res.status(500).json({ message: error.message || 'Error creating order', error: error.message });
  }
};

export const getOrders = async (req: Request, res: Response) => {
  try {
    const where = buildOrderWhere(req.query);
    const orders = await prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });

    res.json(orders.map(serializeOrder));
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
};

export const getMyOrders = async (req: Request, res: Response) => {
  try {
    const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }

    const orders = await prisma.order.findMany({
      where: { user: { email } },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(orders.map(serializeOrder));
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching user orders', error: error.message });
  }
};

export const getOrderSummary = async (req: Request, res: Response) => {
  try {
    const where = buildOrderWhere(req.query);
    const summary = await buildSummary(where);
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching order summary', error: error.message });
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  try {
    const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!orderId) {
      return res.status(400).json({ message: 'Order id is required' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(serializeOrder(order));
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching order', error: error.message });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
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

    const data: Prisma.OrderUpdateInput = {};

    if (status) {
      data.status = status;
    }

    if (typeof pharmacistReviewComment === 'string') {
      data.pharmacistReviewComment = pharmacistReviewComment.trim() || null;
    }

    if (paymentStatus) {
      data.paymentStatus = paymentStatus;
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data,
      include: orderInclude,
    });

    res.json(serializeOrder(order));
  } catch (error: any) {
    res.status(500).json({ message: 'Error updating order status', error: error.message });
  }
};
