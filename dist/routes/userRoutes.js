"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userController_1 = require("../controllers/userController");
const internalAuth_1 = require("../middlewares/internalAuth");
const router = express_1.default.Router();
router.get('/me', internalAuth_1.requireInternalToken, userController_1.getUserByEmail);
router.patch('/me', internalAuth_1.requireInternalToken, userController_1.updateUserByEmail);
// Admin routes
router.get('/', internalAuth_1.requireInternalToken, userController_1.getUsers);
router.post('/points/adjust', internalAuth_1.requireInternalToken, userController_1.adjustPoints);
router.get('/points/transactions/:userId?', internalAuth_1.requireInternalToken, userController_1.getPointsTransactions);
exports.default = router;
