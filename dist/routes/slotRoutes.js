"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const slotController_1 = require("../controllers/slotController");
const router = express_1.default.Router();
router.get('/', slotController_1.getAvailableSlots);
router.post('/', slotController_1.createSlot); // Keeping public or can add ADIMIN protection
exports.default = router;
