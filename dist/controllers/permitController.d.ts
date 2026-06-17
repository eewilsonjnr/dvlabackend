import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare function listPermits(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function getPermit(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function createIDP(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function createICMV(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function updatePermitStatus(req: AuthenticatedRequest, res: Response): Promise<void>;
//# sourceMappingURL=permitController.d.ts.map