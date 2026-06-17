import { Router } from 'express';
import { listPermits, getPermit, createIDP, createICMV, updatePermitStatus, previewPermit } from '../controllers/permitController';
import { authenticateAdmin, requireAnyPermission } from '../middleware/auth';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticateAdmin);
router.get('/',              requireAnyPermission(PERMISSIONS.VIEW_PERMITS),   listPermits);
router.get('/:id',           requireAnyPermission(PERMISSIONS.VIEW_PERMITS),   getPermit);
router.get('/:id/preview',   requireAnyPermission(PERMISSIONS.VIEW_PERMITS),   previewPermit);
router.post('/idp',          requireAnyPermission(PERMISSIONS.CREATE_PERMIT),  createIDP);
router.post('/icmv',         requireAnyPermission(PERMISSIONS.CREATE_PERMIT),  createICMV);
router.put('/:id/submit',    requireAnyPermission(PERMISSIONS.CREATE_PERMIT),  updatePermitStatus);
router.put('/:id/status',    requireAnyPermission(PERMISSIONS.APPROVE_PERMIT), updatePermitStatus);
export default router;
