import { Router } from 'express';
import {
  listOffices, getOffice, createOffice, updateOffice,
  deactivateOffice, listOfficesByRegion, getOfficeStats,
} from '../controllers/centreController';
import { authenticateAdmin, requireAnyPermission } from '../middleware/auth';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticateAdmin);

// Read endpoints — any authenticated user can query offices (needed for dropdowns/place-of-issue)
router.get('/',               listOffices);
router.get('/by-region',      listOfficesByRegion);
router.get('/:id',            getOffice);
router.get('/:id/stats',      getOfficeStats); // own-office always allowed; other offices require MANAGE_CENTRES (enforced in controller)

// Write endpoints — HQ admins only (MANAGE_CENTRES permission)
router.post('/',              requireAnyPermission(PERMISSIONS.MANAGE_CENTRES), createOffice);
router.put('/:id',            requireAnyPermission(PERMISSIONS.MANAGE_CENTRES), updateOffice);
router.delete('/:id',         requireAnyPermission(PERMISSIONS.MANAGE_CENTRES), deactivateOffice);

export default router;
