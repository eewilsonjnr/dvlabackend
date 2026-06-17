import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, AdminUserPayload } from '../types';
import type { PermissionName } from '../constants/permissions';
export declare function generateToken(payload: Record<string, any>, expiresIn?: string): string;
export declare function verifyToken(token: string): AdminUserPayload | null;
export declare function authenticateAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
export declare function requireAnyPermission(...permissions: PermissionName[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const requirePermission: typeof requireAnyPermission;
//# sourceMappingURL=auth.d.ts.map