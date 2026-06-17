"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listQcResults = listQcResults;
exports.submitQcResult = submitQcResult;
const database_1 = __importDefault(require("../config/database"));
async function listQcResults(req, res) {
    try {
        const { result } = req.query;
        const rows = await database_1.default.qcResult.findMany({
            where: result ? { result: String(result) } : {},
            include: { permit: { include: { applicant: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(rows);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to list QC results' });
    }
}
async function submitQcResult(req, res) {
    try {
        const { permitId, printJobId, result, rejectionReason, opticalInspectionScore, photoQualityScore, mrzValidation, rfidValidation, } = req.body;
        // Guard against duplicate inspection of the same permit
        const existing = await database_1.default.qcResult.findFirst({
            where: { permitId, result: { not: 'pending' } },
        });
        if (existing) {
            res.status(409).json({ error: 'This permit has already been inspected.' });
            return;
        }
        // Update the pending QC record if it exists (created when print completed), else create fresh
        const pending = await database_1.default.qcResult.findFirst({ where: { permitId, result: 'pending' } });
        const qcData = {
            result, rejectionReason,
            opticalInspectionScore, photoQualityScore,
            mrzValidation: !!mrzValidation, rfidValidation: !!rfidValidation,
            inspectedById: req.user?.id, inspectedAt: new Date(),
        };
        const qc = pending
            ? await database_1.default.qcResult.update({ where: { id: pending.id }, data: qcData })
            : await database_1.default.qcResult.create({ data: { permitId, printJobId, ...qcData } });
        // Auto-advance permit status based on QC result
        if (result === 'pass') {
            await database_1.default.permit.update({ where: { id: permitId }, data: { status: 'issued' } });
        }
        else if (result === 'fail') {
            await database_1.default.permit.update({
                where: { id: permitId },
                data: {
                    status: 'rejected',
                    rejectionReason: rejectionReason ?? 'Failed quality control inspection.',
                },
            });
        }
        res.status(201).json(qc);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to submit QC result' });
    }
}
//# sourceMappingURL=qcController.js.map