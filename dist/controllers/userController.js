"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserByEmail = exports.getUserByEmail = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const internalAuth_1 = require("../middlewares/internalAuth");
const getUserByEmail = async (req, res) => {
    try {
        const email = (0, internalAuth_1.getInternalUserEmail)(req) || (typeof req.query.email === 'string' ? req.query.email.trim() : '');
        if (!email) {
            return res.status(400).json({ message: 'email is required' });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { email },
            select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
        });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching user', error: error.message });
    }
};
exports.getUserByEmail = getUserByEmail;
const updateUserByEmail = async (req, res) => {
    try {
        const email = (0, internalAuth_1.getInternalUserEmail)(req) || (typeof req.body.email === 'string' ? req.body.email.trim() : '');
        if (!email) {
            return res.status(400).json({ message: 'email is required' });
        }
        const name = typeof req.body.name === 'string' ? req.body.name.trim() : undefined;
        const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : undefined;
        // Use upsert so Google-only sessions can still update profile before any order/checkout creates the user row.
        const updated = await prisma_1.default.user.upsert({
            where: { email },
            update: {
                ...(typeof name === 'string' && name ? { name } : {}),
                ...(typeof phone === 'string' ? { phone: phone || null } : {}),
                isRegistered: true,
            },
            create: {
                name: name || email.split('@')[0] || 'User',
                email,
                phone: typeof phone === 'string' ? (phone || null) : null,
                role: 'USER',
                isRegistered: true,
            },
            select: { id: true, name: true, email: true, phone: true, role: true, updatedAt: true },
        });
        res.json(updated);
    }
    catch (error) {
        res.status(400).json({ message: error.message || 'Error updating user', error: error.message });
    }
};
exports.updateUserByEmail = updateUserByEmail;
