import { Request, Response } from 'express';
import prisma from '../config/prisma';
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
});

export const createOrder = async (req: Request, res: Response) => {
  try {
    const { user: userData, items, totalAmount, address, prescriptionUrl } = req.body;

    // Find or create user
    const user = await prisma.user.upsert({
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
    const newOrder = await prisma.order.create({
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
          create: items.map((item: any) => ({
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
  } catch (error: any) {
    console.error('[Order Controller] Create Order Error:', error);
    res.status(500).json({ message: 'Error creating order', error: error.message });
  }
};

export const getOrders = async (req: Request, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        user: true,
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!orderId) {
      return res.status(400).json({ message: 'Order id is required' });
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: { user: true, items: true }
    });
    
    res.json(order);
  } catch (error: any) {
    res.status(500).json({ message: 'Error updating order status', error: error.message });
  }
};
