import { Request } from 'express';
import type { PermissionName } from '../constants/permissions';
export interface AdminUserPayload {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    dvlaRole: string;
    role: string;
    permissions: PermissionName[];
}
export interface AuthenticatedRequest extends Request {
    user?: AdminUserPayload;
}
//# sourceMappingURL=index.d.ts.map