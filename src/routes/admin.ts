import { Router } from 'express';
import {
  listUsers, createUser, updateUser,
  listRoles, createRole, updateRole,
  listConfig, getConfig, setConfig,
  listAuditLogs, exportAuditLogs,
} from '../controllers/adminController';
import { authenticateAdmin, requireAnyPermission } from '../middleware/auth';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticateAdmin);

// Users
router.get('/users',              requireAnyPermission(PERMISSIONS.MANAGE_USERS),    listUsers);
router.post('/users',             requireAnyPermission(PERMISSIONS.MANAGE_USERS),    createUser);
router.put('/users/:id',          requireAnyPermission(PERMISSIONS.MANAGE_USERS),    updateUser);

// Roles — read is open to all authenticated users (needed for create-user dropdown)
router.get('/roles',              listRoles);
router.post('/roles',             requireAnyPermission(PERMISSIONS.MANAGE_USERS),    createRole);
router.put('/roles/:id',          requireAnyPermission(PERMISSIONS.MANAGE_USERS),    updateRole);

// Config — read open to all authenticated users; write requires MANAGE_SETTINGS
router.get('/config',             listConfig);
router.get('/config/:key',        getConfig);
router.put('/config/:key',        requireAnyPermission(PERMISSIONS.MANAGE_SETTINGS), setConfig);

// Audit Logs
router.get('/audit-logs',         requireAnyPermission(PERMISSIONS.VIEW_AUDIT_LOGS), listAuditLogs);
router.get('/audit-logs/export',  requireAnyPermission(PERMISSIONS.EXPORT_AUDIT),    exportAuditLogs);

export default router;
