"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rfidController_1 = require("../controllers/rfidController");
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../constants/permissions");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateAdmin);
router.get('/', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.MANAGE_RFID), rfidController_1.listRfid);
router.put('/:id/status', (0, auth_1.requireAnyPermission)(permissions_1.PERMISSIONS.MANAGE_RFID), rfidController_1.updateRfidStatus);
exports.default = router;
//# sourceMappingURL=rfid.js.map