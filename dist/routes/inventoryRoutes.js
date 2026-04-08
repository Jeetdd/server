"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventoryController_1 = require("../controllers/inventoryController");
const router = (0, express_1.Router)();
router.get('/summary', inventoryController_1.getInventorySummary);
router.get('/movements', inventoryController_1.getInventoryMovements);
router.post('/adjust', inventoryController_1.adjustInventory);
exports.default = router;
