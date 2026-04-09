"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prescriptionController_1 = require("../controllers/prescriptionController");
const upload_1 = require("../config/upload");
const internalAuth_1 = require("../middlewares/internalAuth");
const router = express_1.default.Router();
router.post('/analyze', upload_1.upload.single('prescription'), prescriptionController_1.analyzePrescription);
router.get('/my', internalAuth_1.requireInternalToken, prescriptionController_1.getMyPrescriptions);
router.get('/:id', internalAuth_1.requireInternalToken, prescriptionController_1.getPrescriptionById);
router.patch('/:id', internalAuth_1.requireInternalToken, prescriptionController_1.updatePrescriptionLabel);
router.delete('/:id', internalAuth_1.requireInternalToken, prescriptionController_1.deletePrescription);
exports.default = router;
