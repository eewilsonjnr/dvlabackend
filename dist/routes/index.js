"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("./auth"));
const applicants_1 = __importDefault(require("./applicants"));
const permits_1 = __importDefault(require("./permits"));
const print_1 = __importDefault(require("./print"));
const rfid_1 = __importDefault(require("./rfid"));
const qc_1 = __importDefault(require("./qc"));
const dashboard_1 = __importDefault(require("./dashboard"));
const admin_1 = __importDefault(require("./admin"));
const router = (0, express_1.Router)();
router.use('/auth', auth_1.default);
router.use('/applicants', applicants_1.default);
router.use('/permits', permits_1.default);
router.use('/print-jobs', print_1.default);
router.use('/rfid', rfid_1.default);
router.use('/qc', qc_1.default);
router.use('/dashboard', dashboard_1.default);
router.use('/admin', admin_1.default);
router.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
exports.default = router;
//# sourceMappingURL=index.js.map