import { Router } from 'express';
import {
  adminLogin, confirmMfa,
  setupMfa, verifyMfaSetup, disableMfa,
  getCurrentAdmin, changeAdminPassword,
} from '../controllers/authController';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();
router.post('/admin/login',           adminLogin);
router.post('/admin/mfa/confirm',     confirmMfa);
router.get('/admin/me',               authenticateAdmin, getCurrentAdmin);
router.put('/admin/me/password',      authenticateAdmin, changeAdminPassword);
router.post('/admin/mfa/setup',       authenticateAdmin, setupMfa);
router.post('/admin/mfa/verify',      authenticateAdmin, verifyMfaSetup);
router.delete('/admin/mfa',           authenticateAdmin, disableMfa);
export default router;
