"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const orderController_1 = require("../controllers/orderController");
const router = express_1.default.Router();
// Public checkout route
router.post('/checkout', orderController_1.createOrder);
// Protected admin/pharmacist routes
router.get('/', orderController_1.getOrders);
router.patch('/:id/status', orderController_1.updateOrderStatus);
exports.default = router;
