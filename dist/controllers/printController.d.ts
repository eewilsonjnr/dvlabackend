import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare function listPrintJobs(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function submitPrintJob(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function updatePrintJobStatus(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function getPrintStats(req: AuthenticatedRequest, res: Response): Promise<void>;
//# sourceMappingURL=printController.d.ts.map