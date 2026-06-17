"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboardController_1 = require("../controllers/dashboardController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateAdmin);
router.get('/stats', dashboardController_1.getDashboardStats);
router.get('/expiring-permits', dashboardController_1.getExpiringPermits);
router.get('/recent-activity', dashboardController_1.getRecentActivity);
router.get('/printer-status', dashboardController_1.getPrinterStatus);
exports.default = router;
//# sourceMappingURL=dashboard.js.map