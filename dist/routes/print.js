"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const printController_1 = require("../controllers/printController");
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../constants/permissions");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateAdmin);
router.get('/', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.MANAGE_PRINT), printController_1.listPrintJobs);
router.get('/stats', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.MANAGE_PRINT), printController_1.getPrintStats);
router.post('/', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.MANAGE_PRINT), printController_1.submitPrintJob);
router.put('/:id/status', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.MANAGE_PRINT), printController_1.updatePrintJobStatus);
exports.default = router;
//# sourceMappingURL=print.js.map