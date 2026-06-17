"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/admin/login', authController_1.adminLogin);
router.post('/admin/mfa/confirm', authController_1.confirmMfa);
router.get('/admin/me', auth_1.authenticateAdmin, authController_1.getCurrentAdmin);
router.put('/admin/me/password', auth_1.authenticateAdmin, authController_1.changeAdminPassword);
router.post('/admin/mfa/setup', auth_1.authenticateAdmin, authController_1.setupMfa);
router.post('/admin/mfa/verify', auth_1.authenticateAdmin, authController_1.verifyMfaSetup);
router.delete('/admin/mfa', auth_1.authenticateAdmin, authController_1.disableMfa);
exports.default = router;
//# sourceMappingURL=auth.js.map