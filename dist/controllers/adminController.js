"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsers = listUsers;
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.listRoles = listRoles;
exports.createRole = createRole;
exports.updateRole = updateRole;
exports.listConfig = listConfig;
exports.getConfig = getConfig;
exports.setConfig = setConfig;
exports.listAuditLogs = listAuditLogs;
exports.exportAuditLogs = exportAuditLogs;
exports.createAuditEntry = createAuditEntry;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = require("crypto");
const database_1 = __importDefault(require("../config/database"));
const PASSWORD_POLICY = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
// ─── Users ────────────────────────────────────────────────────────────────────
async function listUsers(req, res) {
    try {
        const users = await database_1.default.adminUser.findMany({
            include: { role: true }, orderBy: { createdAt: 'desc' },
        });
        res.json(users.map(({ password: _, ...u }) => u));
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to list users' });
    }
}
async function createUser(req, res) {
    try {
        const { email, password, firstName, lastName, dvlaRole, roleId } = req.body;
        if (!roleId) {
            res.status(400).json({ error: 'Permission role is required.' });
            return;
        }
        if (!PASSWORD_POLICY.test(password ?? '')) {
            res.status(400).json({ error: 'Password must be at least 8 characters with one uppercase letter and one number.' });
            return;
        }
        const hashed = await bcryptjs_1.default.hash(password, 10);
        const user = await database_1.default.adminUser.create({
            data: { email, password: hashed, firstName, lastName, dvlaRole: dvlaRole || 'Operator', roleId },
        });
        const { password: _, ...safeUser } = user;
        res.status(201).json(safeUser);
    }
    catch (err) {
        if (err.code === 'P2002') {
            res.status(409).json({ error: 'Email already exists' });
            return;
        }
        res.status(500).json({ error: 'Failed to create user' });
    }
}
async function updateUser(req, res) {
    try {
        const { dvlaRole, isActive, roleId } = req.body;
        await database_1.default.adminUser.update({ where: { id: String(req.params.id) }, data: { dvlaRole, isActive, roleId } });
        res.json({ message: 'User updated' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update user' });
    }
}
// ─── Roles ────────────────────────────────────────────────────────────────────
async function listRoles(req, res) {
    try {
        const roles = await database_1.default.role.findMany({
            include: { permissions: true },
            orderBy: { name: 'asc' },
        });
        res.json(roles);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to list roles' });
    }
}
async function createRole(req, res) {
    try {
        const { name, description, permissionNames } = req.body;
        const perms = await database_1.default.permission.findMany({ where: { name: { in: permissionNames ?? [] } } });
        const role = await database_1.default.role.create({
            data: {
                name, description,
                permissions: { connect: perms.map(p => ({ id: p.id })) },
            },
            include: { permissions: true },
        });
        res.status(201).json(role);
    }
    catch (err) {
        if (err.code === 'P2002') {
            res.status(409).json({ error: 'Role name already exists' });
            return;
        }
        res.status(500).json({ error: 'Failed to create role' });
    }
}
async function updateRole(req, res) {
    try {
        const id = String(req.params.id);
        const existing = await database_1.default.role.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: 'Role not found' });
            return;
        }
        if (existing.isSystem) {
            res.status(403).json({ error: 'System roles cannot be modified' });
            return;
        }
        const { description, permissionNames } = req.body;
        const perms = await database_1.default.permission.findMany({ where: { name: { in: permissionNames ?? [] } } });
        const role = await database_1.default.role.update({
            where: { id },
            data: {
                description,
                permissions: { set: perms.map(p => ({ id: p.id })) },
            },
            include: { permissions: true },
        });
        res.json(role);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update role' });
    }
}
// ─── Config ───────────────────────────────────────────────────────────────────
async function listConfig(req, res) {
    try {
        const configs = await database_1.default.systemConfig.findMany({ orderBy: { key: 'asc' } });
        res.json(configs);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to list config' });
    }
}
async function getConfig(req, res) {
    try {
        const key = String(req.params.key);
        const cfg = await database_1.default.systemConfig.findUnique({ where: { key } });
        res.json(cfg);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to get config' });
    }
}
async function setConfig(req, res) {
    try {
        const key = String(req.params.key);
        const { value, description } = req.body;
        const cfg = await database_1.default.systemConfig.upsert({
            where: { key },
            update: { value, description, updatedById: req.user?.id },
            create: { key, value, description, updatedById: req.user?.id },
        });
        res.json(cfg);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to set config' });
    }
}
// ─── Audit Logs ───────────────────────────────────────────────────────────────
async function listAuditLogs(req, res) {
    try {
        const { action, operatorId } = req.query;
        const logs = await database_1.default.auditLog.findMany({
            where: {
                ...(action ? { action: { contains: String(action), mode: 'insensitive' } } : {}),
                ...(operatorId ? { userId: String(operatorId) } : {}),
            },
            include: { user: { select: { firstName: true, lastName: true, email: true } } },
            orderBy: { createdAt: 'desc' },
            take: 500,
        });
        res.json(logs);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to list audit logs' });
    }
}
async function exportAuditLogs(req, res) {
    try {
        const { action, operatorId } = req.query;
        const logs = await database_1.default.auditLog.findMany({
            where: {
                ...(action ? { action: { contains: String(action), mode: 'insensitive' } } : {}),
                ...(operatorId ? { userId: String(operatorId) } : {}),
            },
            include: { user: { select: { firstName: true, lastName: true, email: true } } },
            orderBy: { createdAt: 'asc' },
        });
        const header = 'timestamp,operator,action,outcome,applicantRef,ipAddress,details\n';
        const rows = logs.map(l => [
            new Date(l.createdAt).toISOString(),
            l.operatorName ?? `${l.user?.firstName ?? ''} ${l.user?.lastName ?? ''}`.trim(),
            l.action,
            l.outcome,
            l.applicantRef ?? '',
            l.ipAddress ?? '',
            `"${(l.details ?? '').replace(/"/g, '""')}"`,
        ].join(',')).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="audit-log-${Date.now()}.csv"`);
        res.send(header + rows);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to export audit logs' });
    }
}
// ─── Audit Hash Helper (called when creating audit entries) ──────────────────
async function createAuditEntry(data) {
    try {
        const last = await database_1.default.auditLog.findFirst({ orderBy: { createdAt: 'desc' } });
        const prevHash = last?.hash ?? '0000000000000000000000000000000000000000000000000000000000000000';
        const payload = JSON.stringify({ ...data, createdAt: new Date().toISOString() });
        const hash = (0, crypto_1.createHash)('sha256').update(prevHash + payload).digest('hex');
        await database_1.default.auditLog.create({ data: { ...data, hash } });
    }
    catch {
        // Non-fatal — audit logging should never crash the main flow
    }
}
//# sourceMappingURL=adminController.js.map