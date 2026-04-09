"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const orderController_1 = require("../controllers/orderController");
const internalAuth_1 = require("../middlewares/internalAuth");
const router = express_1.default.Router();
router.post('/checkout', orderController_1.createOrder);
router.get('/my', internalAuth_1.requireInternalToken, orderController_1.getMyOrders);
router.get('/summary', orderController_1.getOrderSummary);
router.get('/:id', orderController_1.getOrderById);
router.get('/', orderController_1.getOrders);
router.patch('/:id/status', orderController_1.updateOrderStatus);
exports.default = router;
