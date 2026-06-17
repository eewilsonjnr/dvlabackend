import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, AdminUserPayload } from '../types';
import prisma from '../config/database';
import type { PermissionName } from '../constants/permissions';
import { hasAnyPermission, toPermissionNames } from '../constants/permissions';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

export function generateToken(payload: Record<string, any>, expiresIn: string = '7d'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): AdminUserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AdminUserPayload;
  } catch {
    return null;
  }
}

export async function authenticateAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) { res.status(401).json({ error: 'Invalid or expired token' }); return; }
    if ((payload as any).mfaPending) { res.status(401).json({ error: 'MFA verification required' }); return; }

    // Enforce session inactivity timeout using `session_timeout_minutes` SystemConfig key
    const iat = (payload as any).iat as number | undefined;
    if (iat) {
      const timeoutCfg = await prisma.systemConfig.findUnique({ where: { key: 'session_timeout_minutes' } });
      const timeoutMinutes = parseInt(timeoutCfg?.value ?? '15', 10);
      const ageSeconds = Math.floor(Date.now() / 1000) - iat;
      if (ageSeconds > timeoutMinutes * 60) {
        res.status(401).json({ error: 'Session expired due to inactivity. Please log in again.' });
        return;
      }
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: payload.id },
      include: {
        role: { include: { permissions: true } },
        office: { select: { id: true, name: true, type: true, regionName: true, town: true, placeOfIssueLabel: true } },
      },
    });

    if (!admin || !admin.isActive) { res.status(401).json({ error: 'User not found or inactive' }); return; }

    req.user = {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      dvlaRole: admin.dvlaRole,
      role: admin.role.name,
      permissions: toPermissionNames(admin.role.permissions.map(p => p.name)),
      officeId: admin.officeId ?? null,
      office: admin.office ?? null,
    };
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

export function requireAnyPermission(...permissions: PermissionName[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) { res.status(403).json({ error: 'Admin access required' }); return; }
    if (user.role === 'ADMINISTRATOR') { next(); return; }
    if (!hasAnyPermission(user.permissions, permissions)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export const requirePermission = requireAnyPermission;
