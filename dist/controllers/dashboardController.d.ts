import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare function getDashboardStats(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function getExpiringPermits(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function getRecentActivity(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function getPrinterStatus(req: AuthenticatedRequest, res: Response): Promise<void>;
//# sourceMappingURL=dashboardController.d.ts.map