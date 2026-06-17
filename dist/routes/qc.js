"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const qcController_1 = require("../controllers/qcController");
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../constants/permissions");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateAdmin);
router.get('/', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.MANAGE_QC), qcController_1.listQcResults);
router.post('/', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.MANAGE_QC), qcController_1.submitQcResult);
exports.default = router;
//# sourceMappingURL=qc.js.map