import { Router } from 'express';
import { listPrintJobs, submitPrintJob, updatePrintJobStatus, getPrintStats } from '../controllers/printController';
import { authenticateAdmin, requireAnyPermission } from '../middleware/auth';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticateAdmin);
router.get('/',           requireAnyPermission(PERMISSIONS.MANAGE_PRINT), listPrintJobs);
router.get('/stats',      requireAnyPermission(PERMISSIONS.MANAGE_PRINT), getPrintStats);
router.post('/',          requireAnyPermission(PERMISSIONS.MANAGE_PRINT), submitPrintJob);
router.put('/:id/status', requireAnyPermission(PERMISSIONS.MANAGE_PRINT), updatePrintJobStatus);
export default router;
