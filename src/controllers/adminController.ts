import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';

// AES-256-GCM helpers for audit log `details` field
// Key: 32-byte hex from AUDIT_ENCRYPTION_KEY env var; falls back to a deterministic dev key
const RAW_KEY = process.env.AUDIT_ENCRYPTION_KEY ?? 'dvla-audit-key-change-in-prod-!!';
const AUDIT_KEY = Buffer.from(RAW_KEY.padEnd(32, '!').slice(0, 32));

function encryptDetail(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', AUDIT_KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `aes256gcm:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decryptDetail(stored: string): string {
  if (!stored.startsWith('aes256gcm:')) return stored; // legacy plain-text rows
  const parts = stored.split(':');
  if (parts.length !== 4) return stored;
  const [, ivHex, tagHex, encHex] = parts;
  try {
    const decipher = createDecipheriv('aes-256-gcm', AUDIT_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return decipher.update(Buffer.from(encHex, 'hex')).toString('utf8') + decipher.final('utf8');
  } catch {
    return '[decryption error]';
  }
}

const PASSWORD_POLICY = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

// ─── Users ────────────────────────────────────────────────────────────────────

export async function listUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { resolveScope, permitOfficeWhere } = await import('../utils/scopeFilter');
    const scope = await resolveScope(req.user!);
    const officeFilter = permitOfficeWhere(scope, 'officeId');
    const users = await prisma.adminUser.findMany({
      where: officeFilter,
      include: {
        role: true,
        office: { select: { id: true, name: true, type: true, regionName: true, town: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users.map(({ password: _, ...u }) => u));
  } catch (err) { res.status(500).json({ error: 'Failed to list users' }); }
}

export async function createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { email, password, firstName, lastName, dvlaRole, roleId, officeId, notificationEmail } = req.body;
    if (!roleId) {
      res.status(400).json({ error: 'Permission role is required.' });
      return;
    }
    if (!PASSWORD_POLICY.test(password ?? '')) {
      res.status(400).json({ error: 'Password must be at least 8 characters with one uppercase letter and one number.' });
      return;
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.adminUser.create({
      data: {
        email, password: hashed, firstName, lastName,
        dvlaRole: dvlaRole || 'Operator', roleId,
        officeId: officeId ?? null,
        notificationEmail: notificationEmail || null,
      },
    });
    const { password: _, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (err: any) {
    if (err.code === 'P2002') { res.status(409).json({ error: 'Email already exists' }); return; }
    res.status(500).json({ error: 'Failed to create user' });
  }
}

export async function updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { dvlaRole, isActive, roleId, officeId } = req.body;
    await prisma.adminUser.update({
      where: { id: String(req.params.id) },
      data: { dvlaRole, isActive, roleId, ...(officeId !== undefined ? { officeId } : {}) },
    });
    res.json({ message: 'User updated' });
  } catch (err) { res.status(500).json({ error: 'Failed to update user' }); }
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export async function listRoles(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const roles = await prisma.role.findMany({
      include: { permissions: true },
      orderBy: { name: 'asc' },
    });
    res.json(roles);
  } catch (err) { res.status(500).json({ error: 'Failed to list roles' }); }
}

export async function createRole(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, description, permissionNames } = req.body;
    const perms = await prisma.permission.findMany({ where: { name: { in: permissionNames ?? [] } } });
    const role = await prisma.role.create({
      data: {
        name, description,
        permissions: { connect: perms.map(p => ({ id: p.id })) },
      },
      include: { permissions: true },
    });
    res.status(201).json(role);
  } catch (err: any) {
    if (err.code === 'P2002') { res.status(409).json({ error: 'Role name already exists' }); return; }
    res.status(500).json({ error: 'Failed to create role' });
  }
}

export async function updateRole(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Role not found' }); return; }
    if (existing.isSystem) { res.status(403).json({ error: 'System roles cannot be modified' }); return; }

    const { description, permissionNames } = req.body;
    const perms = await prisma.permission.findMany({ where: { name: { in: permissionNames ?? [] } } });
    const role = await prisma.role.update({
      where: { id },
      data: {
        description,
        permissions: { set: perms.map(p => ({ id: p.id })) },
      },
      include: { permissions: true },
    });
    res.json(role);
  } catch (err) { res.status(500).json({ error: 'Failed to update role' }); }
}

// ─── Config ───────────────────────────────────────────────────────────────────

export async function listConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const configs = await prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
    res.json(configs);
  } catch (err) { res.status(500).json({ error: 'Failed to list config' }); }
}

export async function getConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const key = String(req.params.key);
    const cfg = await prisma.systemConfig.findUnique({ where: { key } });
    res.json(cfg);
  } catch (err) { res.status(500).json({ error: 'Failed to get config' }); }
}

export async function setConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const key = String(req.params.key);
    const { value, description } = req.body;
    const cfg = await prisma.systemConfig.upsert({
      where: { key },
      update: { value, description, updatedById: req.user?.id },
      create: { key, value, description, updatedById: req.user?.id },
    });
    res.json(cfg);
  } catch (err) { res.status(500).json({ error: 'Failed to set config' }); }
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export async function listAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { action, operatorId } = req.query;
    const { resolveScope } = await import('../utils/scopeFilter');
    const scope = await resolveScope(req.user!);
    const officeFilter = scope.officeIds
      ? { user: { officeId: { in: scope.officeIds } } }
      : {};
    const logs = await prisma.auditLog.findMany({
      where: {
        ...officeFilter,
        ...(action     ? { action: { contains: String(action), mode: 'insensitive' } } : {}),
        ...(operatorId ? { userId: String(operatorId) } : {}),
      },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    res.json(logs.map(l => ({ ...l, details: l.details ? decryptDetail(l.details) : null })));
  } catch (err) { res.status(500).json({ error: 'Failed to list audit logs' }); }
}

export async function exportAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { action, operatorId } = req.query;
    const { resolveScope } = await import('../utils/scopeFilter');
    const scope = await resolveScope(req.user!);
    const officeFilter = scope.officeIds
      ? { user: { officeId: { in: scope.officeIds } } }
      : {};
    const logs = await prisma.auditLog.findMany({
      where: {
        ...officeFilter,
        ...(action     ? { action: { contains: String(action), mode: 'insensitive' } } : {}),
        ...(operatorId ? { userId: String(operatorId) } : {}),
      },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const header = 'timestamp,operator,action,outcome,applicantRef,ipAddress,details\n';
    const rows = logs.map(l => {
      const details = l.details ? decryptDetail(l.details) : '';
      return [
        new Date(l.createdAt).toISOString(),
        l.operatorName ?? `${l.user?.firstName ?? ''} ${l.user?.lastName ?? ''}`.trim(),
        l.action,
        l.outcome,
        l.applicantRef ?? '',
        l.ipAddress ?? '',
        `"${details.replace(/"/g, '""')}"`,
      ].join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${Date.now()}.csv"`);
    res.send(header + rows);
  } catch (err) { res.status(500).json({ error: 'Failed to export audit logs' }); }
}

// ─── Audit Hash Helper (called when creating audit entries) ──────────────────

export async function createAuditEntry(data: {
  userId?: string;
  operatorName?: string;
  applicantRef?: string;
  action: string;
  outcome?: string;
  details?: string;
  ipAddress?: string;
}): Promise<void> {
  try {
    const encryptedDetails = data.details ? encryptDetail(data.details) : undefined;
    const dataToStore = { ...data, ...(encryptedDetails ? { details: encryptedDetails } : {}) };
    const last = await prisma.auditLog.findFirst({ orderBy: { createdAt: 'desc' } });
    const prevHash = last?.hash ?? '0000000000000000000000000000000000000000000000000000000000000000';
    const payload = JSON.stringify({ ...dataToStore, createdAt: new Date().toISOString() });
    const hash = createHash('sha256').update(prevHash + payload).digest('hex');
    await prisma.auditLog.create({ data: { ...dataToStore, hash } });
  } catch {
    // Non-fatal — audit logging should never crash the main flow
  }
}
