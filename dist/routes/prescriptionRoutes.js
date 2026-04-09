"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prescriptionController_1 = require("../controllers/prescriptionController");
const upload_1 = require("../config/upload");
const router = express_1.default.Router();
router.post('/analyze', upload_1.upload.single('prescription'), prescriptionController_1.analyzePrescription);
router.get('/my', prescriptionController_1.getMyPrescriptions);
router.get('/:id', prescriptionController_1.getPrescriptionById);
exports.default = router;
