import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare function listUsers(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function createUser(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function updateUser(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function listRoles(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function createRole(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function updateRole(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function listConfig(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function getConfig(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function setConfig(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function listAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function exportAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function createAuditEntry(data: {
    userId?: string;
    operatorName?: string;
    applicantRef?: string;
    action: string;
    outcome?: string;
    details?: string;
    ipAddress?: string;
}): Promise<void>;
//# sourceMappingURL=adminController.d.ts.map