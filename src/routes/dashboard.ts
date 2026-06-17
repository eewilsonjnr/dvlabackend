import { Router } from 'express';
import { getDashboardStats, getExpiringPermits, getRecentActivity, getPrinterStatus } from '../controllers/dashboardController';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();
router.use(authenticateAdmin);
router.get('/stats',            getDashboardStats);
router.get('/expiring-permits', getExpiringPermits);
router.get('/recent-activity',  getRecentActivity);
router.get('/printer-status',   getPrinterStatus);
export default router;
