"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardStats = getDashboardStats;
exports.getExpiringPermits = getExpiringPermits;
exports.getRecentActivity = getRecentActivity;
exports.getPrinterStatus = getPrinterStatus;
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const database_1 = __importDefault(require("../config/database"));
async function getDashboardStats(req, res) {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const cutoff30 = new Date();
        cutoff30.setDate(cutoff30.getDate() + 30);
        const [issuedToday, pending, rejected, totalThisMonth, totalApplicants, expiringIn30Days, printQueued, printPrinting, printComplete, printError,] = await Promise.all([
            database_1.default.permit.count({ where: { status: 'issued', updatedAt: { gte: today } } }),
            database_1.default.permit.count({ where: { status: 'submitted' } }),
            database_1.default.permit.count({ where: { status: 'rejected' } }),
            database_1.default.permit.count({ where: { createdAt: { gte: monthStart } } }),
            database_1.default.applicant.count(),
            database_1.default.permit.count({
                where: {
                    permitType: 'IDP',
                    dateOfExpiry: { lte: cutoff30.toISOString().slice(0, 10) },
                    status: { not: 'rejected' },
                },
            }),
            database_1.default.printJob.count({ where: { status: 'queued' } }),
            database_1.default.printJob.count({ where: { status: 'printing' } }),
            database_1.default.printJob.count({ where: { status: 'complete' } }),
            database_1.default.printJob.count({ where: { status: 'error' } }),
        ]);
        res.json({
            issuedToday, pending, rejected, totalThisMonth,
            totalApplicants, expiringIn30Days,
            printStats: { queued: printQueued, printing: printPrinting, complete: printComplete, error: printError },
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
}
async function getExpiringPermits(req, res) {
    try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + 30);
        const permits = await database_1.default.permit.findMany({
            where: {
                permitType: 'IDP',
                dateOfExpiry: {
                    gte: new Date().toISOString().slice(0, 10),
                    lte: cutoff.toISOString().slice(0, 10),
                },
                status: { notIn: ['rejected', 'draft'] },
            },
            include: { applicant: true },
            orderBy: { dateOfExpiry: 'asc' },
            take: 50,
        });
        res.json(permits);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to get expiring permits' });
    }
}
async function getRecentActivity(req, res) {
    try {
        const logs = await database_1.default.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
        res.json(logs);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to get recent activity' });
    }
}
async function getPrinterStatus(req, res) {
    try {
        const config = await database_1.default.systemConfig.findUnique({ where: { key: 'printer_api_endpoint' } });
        const printerName = (await database_1.default.systemConfig.findUnique({ where: { key: 'printer_name' } }))?.value ?? 'DVLA-PRN-001 (P4000)';
        const endpoint = config?.value?.trim();
        if (!endpoint) {
            res.json({ configured: false, printerName });
            return;
        }
        // Probe the endpoint with a 2-second timeout
        const online = await new Promise(resolve => {
            const mod = endpoint.startsWith('https') ? https_1.default : http_1.default;
            const req = mod.get(endpoint, { timeout: 2000 }, () => resolve(true));
            req.on('error', () => resolve(false));
            req.on('timeout', () => { req.destroy(); resolve(false); });
        });
        res.json({ configured: true, online, printerName });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to get printer status' });
    }
}
//# sourceMappingURL=dashboardController.js.map