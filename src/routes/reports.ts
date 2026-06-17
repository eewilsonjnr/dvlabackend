import { Router } from 'express';
import {
  permitSummaryReport,
  productionThroughputReport,
  expiringPermitsReport,
  officePerformanceReport,
  exportReportCsv,
} from '../controllers/reportsController';
import { authenticateAdmin, requireAnyPermission } from '../middleware/auth';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticateAdmin);
router.use(requireAnyPermission(PERMISSIONS.VIEW_PERMITS));

router.get('/summary',    permitSummaryReport);
router.get('/throughput', productionThroughputReport);
router.get('/expiring',   expiringPermitsReport);
router.get('/office',     officePerformanceReport);
router.get('/export',     exportReportCsv);

export default router;
