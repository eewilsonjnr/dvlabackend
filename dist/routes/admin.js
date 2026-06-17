"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController_1 = require("../controllers/adminController");
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../constants/permissions");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateAdmin);
// Users
router.get('/users', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.MANAGE_USERS), adminController_1.listUsers);
router.post('/users', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.MANAGE_USERS), adminController_1.createUser);
router.put('/users/:id', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.MANAGE_USERS), adminController_1.updateUser);
// Roles
router.get('/roles', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.MANAGE_USERS), adminController_1.listRoles);
router.post('/roles', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.MANAGE_USERS), adminController_1.createRole);
router.put('/roles/:id', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.MANAGE_USERS), adminController_1.updateRole);
// Config
router.get('/config', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.MANAGE_SETTINGS), adminController_1.listConfig);
router.get('/config/:key', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.MANAGE_SETTINGS), adminController_1.getConfig);
router.put('/config/:key', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.MANAGE_SETTINGS), adminController_1.setConfig);
// Audit Logs
router.get('/audit-logs', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.VIEW_AUDIT_LOGS), adminController_1.listAuditLogs);
router.get('/audit-logs/export', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.EXPORT_AUDIT), adminController_1.exportAuditLogs);
exports.default = router;
//# sourceMappingURL=admin.js.map