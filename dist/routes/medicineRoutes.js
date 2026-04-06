"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const medicineController_1 = require("../controllers/medicineController");
const router = express_1.default.Router();
router.get('/', medicineController_1.getMedicines);
router.post('/', medicineController_1.addMedicine);
exports.default = router;
