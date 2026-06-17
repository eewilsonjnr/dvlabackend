import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare function adminLogin(req: Request, res: Response): Promise<void>;
export declare function confirmMfa(req: Request, res: Response): Promise<void>;
export declare function setupMfa(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function verifyMfaSetup(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function disableMfa(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function getCurrentAdmin(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function changeAdminPassword(req: AuthenticatedRequest, res: Response): Promise<void>;
//# sourceMappingURL=authController.d.ts.map