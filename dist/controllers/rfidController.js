"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRfid = listRfid;
exports.updateRfidStatus = updateRfidStatus;
const database_1 = __importDefault(require("../config/database"));
async function listRfid(req, res) {
    try {
        const { status } = req.query;
        const rows = await database_1.default.rfidEncoding.findMany({
            where: status ? { status: String(status) } : {},
            include: { permit: { include: { applicant: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(rows);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to list RFID encodings' });
    }
}
async function updateRfidStatus(req, res) {
    try {
        const { status, chipSerialNumber, verificationResult } = req.body;
        const row = await database_1.default.rfidEncoding.update({
            where: { id: String(req.params.id) },
            data: { status, chipSerialNumber, verificationResult, ...(status === 'encoded' ? { encodedAt: new Date() } : {}) },
        });
        res.json(row);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update RFID status' });
    }
}
//# sourceMappingURL=rfidController.js.map