import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare function searchApplicants(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function getApplicant(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function createApplicant(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function updateApplicant(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function uploadBiometric(req: AuthenticatedRequest, res: Response): Promise<void>;
//# sourceMappingURL=applicantController.d.ts.map