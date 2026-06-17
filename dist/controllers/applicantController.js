"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchApplicants = searchApplicants;
exports.getApplicant = getApplicant;
exports.createApplicant = createApplicant;
exports.updateApplicant = updateApplicant;
exports.uploadBiometric = uploadBiometric;
const database_1 = __importDefault(require("../config/database"));
async function searchApplicants(req, res) {
    try {
        const { q } = req.query;
        const query = String(q || '');
        const applicants = await database_1.default.applicant.findMany({
            where: {
                OR: [
                    { surname: { contains: query, mode: 'insensitive' } },
                    { otherNames: { contains: query, mode: 'insensitive' } },
                    { nationalId: { contains: query, mode: 'insensitive' } },
                    { licenceNumber: { contains: query, mode: 'insensitive' } },
                ],
            },
            take: 20,
            orderBy: { createdAt: 'desc' },
        });
        res.json(applicants);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to search applicants' });
    }
}
async function getApplicant(req, res) {
    try {
        const applicant = await database_1.default.applicant.findUnique({ where: { id: String(req.params.id) }, include: { permits: true } });
        if (!applicant) {
            res.status(404).json({ error: 'Applicant not found' });
            return;
        }
        res.json(applicant);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to get applicant' });
    }
}
async function createApplicant(req, res) {
    try {
        const applicant = await database_1.default.applicant.create({ data: req.body });
        await database_1.default.auditLog.create({
            data: {
                userId: req.user?.id, operatorName: `${req.user?.firstName} ${req.user?.lastName}`,
                action: 'CREATE_APPLICANT', outcome: 'success',
                details: `Created applicant: ${applicant.surname} ${applicant.otherNames}`,
                ipAddress: req.ip,
            },
        });
        res.status(201).json(applicant);
    }
    catch (err) {
        if (err.code === 'P2002') {
            res.status(409).json({ error: 'Applicant with that ID or licence number already exists' });
            return;
        }
        res.status(500).json({ error: 'Failed to create applicant' });
    }
}
async function updateApplicant(req, res) {
    try {
        const applicant = await database_1.default.applicant.update({ where: { id: String(req.params.id) }, data: req.body });
        res.json(applicant);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update applicant' });
    }
}
async function uploadBiometric(req, res) {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No image file provided' });
            return;
        }
        const photoUrl = `/uploads/biometrics/${req.file.filename}`;
        const applicant = await database_1.default.applicant.update({
            where: { id: String(req.params.id) },
            data: { photoUrl },
        });
        await database_1.default.auditLog.create({
            data: {
                userId: req.user?.id, operatorName: `${req.user?.firstName} ${req.user?.lastName}`,
                action: 'UPLOAD_BIOMETRIC', outcome: 'success',
                details: `Biometric photo uploaded for applicant ${applicant.surname} ${applicant.otherNames}`,
                ipAddress: req.ip,
            },
        });
        res.json({ photoUrl, applicant });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to upload biometric photo' });
    }
}
//# sourceMappingURL=applicantController.js.map