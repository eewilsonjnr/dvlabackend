"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPrintJobs = listPrintJobs;
exports.submitPrintJob = submitPrintJob;
exports.updatePrintJobStatus = updatePrintJobStatus;
exports.getPrintStats = getPrintStats;
const database_1 = __importDefault(require("../config/database"));
async function listPrintJobs(req, res) {
    try {
        const { status } = req.query;
        const jobs = await database_1.default.printJob.findMany({
            where: status ? { status: String(status) } : {},
            include: { permit: { include: { applicant: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(jobs);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to list print jobs' });
    }
}
async function submitPrintJob(req, res) {
    try {
        const { permitId, isReprint } = req.body;
        const permit = await database_1.default.permit.findUnique({ where: { id: permitId } });
        if (!permit) {
            res.status(404).json({ error: 'Permit not found' });
            return;
        }
        const job = await database_1.default.printJob.create({
            data: { permitId, operatorId: req.user.id, status: 'queued', isReprint: !!isReprint },
        });
        await database_1.default.auditLog.create({
            data: {
                userId: req.user?.id, operatorName: `${req.user?.firstName} ${req.user?.lastName}`,
                action: 'SUBMIT_PRINT_JOB', outcome: 'success',
                details: `Print job ${job.id} queued for permit ${permit.referenceNumber}`, ipAddress: req.ip,
            },
        });
        res.status(201).json(job);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to submit print job' });
    }
}
async function updatePrintJobStatus(req, res) {
    try {
        const { status, errorMessage, bookletNumber } = req.body;
        const extra = {};
        if (status === 'printing')
            extra.startedAt = new Date();
        if (status === 'complete')
            extra.completedAt = new Date();
        if (errorMessage)
            extra.errorMessage = errorMessage;
        const job = await database_1.default.printJob.update({ where: { id: String(req.params.id) }, data: { status, ...extra } });
        // When printing starts, assign the physical booklet number to the permit
        if (status === 'printing' && bookletNumber) {
            await database_1.default.permit.update({ where: { id: job.permitId }, data: { bookletNumber } });
        }
        // When printing completes, auto-create pending RFID and QC records
        if (status === 'complete') {
            await Promise.all([
                database_1.default.rfidEncoding.upsert({
                    where: { printJobId: job.id },
                    create: { permitId: job.permitId, printJobId: job.id, status: 'pending' },
                    update: {},
                }),
                database_1.default.qcResult.upsert({
                    where: { printJobId: job.id },
                    create: { permitId: job.permitId, printJobId: job.id, result: 'pending' },
                    update: {},
                }),
            ]);
        }
        res.json(job);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update print job' });
    }
}
async function getPrintStats(req, res) {
    try {
        const [queued, printing, complete, error] = await Promise.all([
            database_1.default.printJob.count({ where: { status: 'queued' } }),
            database_1.default.printJob.count({ where: { status: 'printing' } }),
            database_1.default.printJob.count({ where: { status: 'complete' } }),
            database_1.default.printJob.count({ where: { status: 'error' } }),
        ]);
        res.json({ queued, printing, complete, error });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to get print stats' });
    }
}
//# sourceMappingURL=printController.js.map