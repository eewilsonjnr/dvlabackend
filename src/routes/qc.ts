import { Router } from 'express';
import { listQcResults, submitQcResult } from '../controllers/qcController';
import { authenticateAdmin, requireAnyPermission } from '../middleware/auth';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticateAdmin);
router.get('/',  requireAnyPermission(PERMISSIONS.MANAGE_QC), listQcResults);
router.post('/', requireAnyPermission(PERMISSIONS.MANAGE_QC), submitQcResult);
export default router;
