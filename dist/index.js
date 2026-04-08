"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const medicineRoutes_1 = __importDefault(require("./routes/medicineRoutes"));
const prescriptionRoutes_1 = __importDefault(require("./routes/prescriptionRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const slotRoutes_1 = __importDefault(require("./routes/slotRoutes"));
const orderRoutes_1 = __importDefault(require("./routes/orderRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/uploads', express_1.default.static('uploads'));
console.log('--- SkinShop Server Version: 1.0.1 (Debug Mode) ---');
console.log('--- Gemini Key Status:', process.env.GEMINI_API_KEY ? 'Present' : 'MISSING', '---');
app.use('/api/auth', authRoutes_1.default);
app.use('/api/medicines', medicineRoutes_1.default);
app.use('/api/prescriptions', prescriptionRoutes_1.default);
app.use('/api/slots', slotRoutes_1.default);
app.use('/api/orders', orderRoutes_1.default);
app.get('/', (req, res) => {
    res.send('SkinShop Backend API is running with PostgreSQL & Prisma...');
});
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
