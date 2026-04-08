import { Router } from 'express';
import { adjustInventory, getInventoryMovements, getInventorySummary } from '../controllers/inventoryController';

const router = Router();

router.get('/summary', getInventorySummary);
router.get('/movements', getInventoryMovements);
router.post('/adjust', adjustInventory);

export default router;

