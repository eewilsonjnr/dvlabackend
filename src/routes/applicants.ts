import { Router } from 'express';
import { searchApplicants, getApplicant, createApplicant, updateApplicant, uploadBiometric, uploadSignature, dvlaLookup } from '../controllers/applicantController';
import { authenticateAdmin, requireAnyPermission } from '../middleware/auth';
import { PERMISSIONS } from '../constants/permissions';
import { biometricUpload } from '../middleware/upload';

const router = Router();
router.use(authenticateAdmin);
router.get('/dvla-lookup',       requireAnyPermission(PERMISSIONS.VIEW_APPLICANTS),   dvlaLookup);
router.get('/',                  requireAnyPermission(PERMISSIONS.VIEW_APPLICANTS),   searchApplicants);
router.get('/:id',               requireAnyPermission(PERMISSIONS.VIEW_APPLICANTS),   getApplicant);
router.post('/',                 requireAnyPermission(PERMISSIONS.CREATE_APPLICANT),  createApplicant);
router.put('/:id',               requireAnyPermission(PERMISSIONS.UPDATE_APPLICANT),  updateApplicant);
router.post('/:id/biometric',    requireAnyPermission(PERMISSIONS.UPLOAD_BIOMETRIC),  biometricUpload.single('photo'),     uploadBiometric);
router.post('/:id/signature',    requireAnyPermission(PERMISSIONS.UPLOAD_BIOMETRIC),  biometricUpload.single('signature'), uploadSignature);
export default router;
