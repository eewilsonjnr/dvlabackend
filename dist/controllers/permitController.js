"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPermits = listPermits;
exports.getPermit = getPermit;
exports.createIDP = createIDP;
exports.createICMV = createICMV;
exports.updatePermitStatus = updatePermitStatus;
const database_1 = __importDefault(require("../config/database"));
const helpers_1 = require("../utils/helpers");
async function listPermits(req, res) {
    try {
        const { type, status, applicantId } = req.query;
        const permits = await database_1.default.permit.findMany({
            where: {
                ...(type ? { permitType: String(type) } : {}),
                ...(status ? { status: String(status) } : {}),
                ...(applicantId ? { applicantId: String(applicantId) } : {}),
            },
            include: { applicant: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(permits);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to list permits' });
    }
}
async function getPermit(req, res) {
    try {
        const permit = await database_1.default.permit.findUnique({
            where: { id: String(req.params.id) },
            include: {
                applicant: true,
                printJobs: { orderBy: { createdAt: 'desc' } },
                rfidEncodings: { orderBy: { createdAt: 'desc' } },
                qcResults: { orderBy: { createdAt: 'desc' } },
            },
        });
        if (!permit) {
            res.status(404).json({ error: 'Permit not found' });
            return;
        }
        res.json(permit);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to get permit' });
    }
}
async function createIDP(req, res) {
    try {
        const { applicantId, placeOfIssue, dateOfIssue, dateOfExpiry, classOfLicence, certificateOfCompetence } = req.body;
        const applicant = await database_1.default.applicant.findUnique({ where: { id: applicantId } });
        if (!applicant) {
            res.status(404).json({ error: 'Applicant not found' });
            return;
        }
        const mrz = (0, helpers_1.generateMRZ)(applicant.surname, applicant.otherNames, applicant.dateOfBirth || '', dateOfExpiry || '', applicant.licenceNumber || '');
        const permit = await database_1.default.permit.create({
            data: {
                permitType: 'IDP', applicantId, referenceNumber: (0, helpers_1.generateRef)('IDP'),
                operatorId: req.user?.id, placeOfIssue, dateOfIssue, dateOfExpiry,
                classOfLicence, certificateOfCompetence, mrzLine1: mrz.line1, mrzLine2: mrz.line2,
            },
        });
        await database_1.default.auditLog.create({
            data: {
                userId: req.user?.id, operatorName: `${req.user?.firstName} ${req.user?.lastName}`,
                applicantRef: applicant.licenceNumber, action: 'CREATE_IDP', outcome: 'success',
                details: `Created IDP permit ${permit.referenceNumber}`, ipAddress: req.ip,
            },
        });
        res.status(201).json(permit);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to create IDP' });
    }
}
async function createICMV(req, res) {
    try {
        const { applicantId, ...rest } = req.body;
        const applicant = await database_1.default.applicant.findUnique({ where: { id: applicantId } });
        if (!applicant) {
            res.status(404).json({ error: 'Applicant not found' });
            return;
        }
        const permit = await database_1.default.permit.create({
            data: { permitType: 'ICMV', applicantId, referenceNumber: (0, helpers_1.generateRef)('ICMV'), operatorId: req.user?.id, ...rest },
        });
        await database_1.default.auditLog.create({
            data: {
                userId: req.user?.id, operatorName: `${req.user?.firstName} ${req.user?.lastName}`,
                action: 'CREATE_ICMV', outcome: 'success',
                details: `Created ICMV permit ${permit.referenceNumber}`, ipAddress: req.ip,
            },
        });
        res.status(201).json(permit);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to create ICMV' });
    }
}
const VALID_TRANSITIONS = {
    draft: ['submitted'],
    submitted: ['approved', 'rejected'],
    approved: ['printed', 'rejected'],
    printed: ['issued', 'rejected'],
    issued: [],
    rejected: [],
};
async function updatePermitStatus(req, res) {
    try {
        const { status, rejectionReason } = req.body;
        const current = await database_1.default.permit.findUnique({ where: { id: String(req.params.id) } });
        if (!current) {
            res.status(404).json({ error: 'Permit not found' });
            return;
        }
        const allowed = VALID_TRANSITIONS[current.status] ?? [];
        if (!allowed.includes(status)) {
            res.status(422).json({ error: `Cannot transition permit from '${current.status}' to '${status}'` });
            return;
        }
        const permit = await database_1.default.permit.update({
            where: { id: String(req.params.id) },
            data: { status, ...(rejectionReason ? { rejectionReason } : {}) },
        });
        await database_1.default.auditLog.create({
            data: {
                userId: req.user?.id, operatorName: `${req.user?.firstName} ${req.user?.lastName}`,
                action: `STATUS_${status.toUpperCase()}`, outcome: 'success',
                details: `Permit ${permit.referenceNumber} → ${status}`, ipAddress: req.ip,
            },
        });
        res.json(permit);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update permit status' });
    }
}
//# sourceMappingURL=permitController.js.map