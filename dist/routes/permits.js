"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const permitController_1 = require("../controllers/permitController");
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../constants/permissions");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateAdmin);
router.get('/', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.VIEW_PERMITS), permitController_1.listPermits);
router.get('/:id', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.VIEW_PERMITS), permitController_1.getPermit);
router.post('/idp', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.CREATE_PERMIT), permitController_1.createIDP);
router.post('/icmv', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.CREATE_PERMIT), permitController_1.createICMV);
router.put('/:id/submit', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.CREATE_PERMIT), permitController_1.updatePermitStatus);
router.put('/:id/status', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.APPROVE_PERMIT), permitController_1.updatePermitStatus);
exports.default = router;
//# sourceMappingURL=permits.js.map