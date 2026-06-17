"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const applicantController_1 = require("../controllers/applicantController");
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../constants/permissions");
const upload_1 = require("../middleware/upload");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateAdmin);
router.get('/', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.VIEW_APPLICANTS), applicantController_1.searchApplicants);
router.get('/:id', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.VIEW_APPLICANTS), applicantController_1.getApplicant);
router.post('/', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.CREATE_APPLICANT), applicantController_1.createApplicant);
router.put('/:id', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.UPDATE_APPLICANT), applicantController_1.updateApplicant);
router.post('/:id/biometric', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.UPLOAD_BIOMETRIC), upload_1.biometricUpload.single('photo'), applicantController_1.uploadBiometric);
exports.default = router;
//# sourceMappingURL=applicants.js.map