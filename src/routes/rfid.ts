import { Router } from 'express';
import { listRfid, updateRfidStatus } from '../controllers/rfidController';
import { authenticateAdmin, requireAnyPermission } from '../middleware/auth';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticateAdmin);
router.get('/',           requireAnyPermission(PERMISSIONS.MANAGE_RFID), listRfid);
router.put('/:id/status', requireAnyPermission(PERMISSIONS.MANAGE_RFID), updateRfidStatus);
export default router;
