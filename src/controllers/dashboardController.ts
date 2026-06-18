import { Response } from 'express';
import https from 'https';
import http from 'http';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { resolveScope, permitOfficeWhere, nestedPermitOfficeWhere } from '../utils/scopeFilter';

export async function getDashboardStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() + 30);

    const scope = await resolveScope(req.user!);
    const pf = permitOfficeWhere(scope); // permit-level office filter
    const npf = nestedPermitOfficeWhere(scope); // nested permit filter for print/rfid/qc

    const [
      issuedToday,
      pending,
      rejected,
      totalThisMonth,
      totalApplicants,
      expiringIn30Days,
      printQueued,
      printPrinting,
      printComplete,
      printError,
    ] = await Promise.all([
      prisma.permit.count({ where: { ...pf, status: 'issued', updatedAt: { gte: today } } }),
      prisma.permit.count({ where: { ...pf, status: 'submitted' } }),
      prisma.permit.count({ where: { ...pf, status: 'rejected' } }),
      prisma.permit.count({ where: { ...pf, createdAt: { gte: monthStart } } }),
      prisma.applicant.count(),
      prisma.permit.count({
        where: {
          ...pf,
          permitType: 'IDP',
          dateOfExpiry: { lte: cutoff30.toISOString().slice(0, 10) },
          status: { not: 'rejected' },
        },
      }),
      prisma.printJob.count({ where: { ...npf, status: 'queued' } }),
      prisma.printJob.count({ where: { ...npf, status: 'printing' } }),
      prisma.printJob.count({ where: { ...npf, status: 'complete' } }),
      prisma.printJob.count({ where: { ...npf, status: 'error' } }),
    ]);

    res.json({
      issuedToday,
      pending,
      rejected,
      totalThisMonth,
      totalApplicants,
      expiringIn30Days,
      printStats: {
        queued: printQueued,
        printing: printPrinting,
        complete: printComplete,
        error: printError,
      },
      scope:
        scope.level === 'national'
          ? 'national'
          : scope.level === 'regional'
            ? { regionName: scope.regionName }
            : { officeId: scope.officeId },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
}

export async function getExpiringPermits(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 30);
    const scope = await resolveScope(req.user!);
    const pf = permitOfficeWhere(scope);
    const permits = await prisma.permit.findMany({
      where: {
        ...pf,
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
  } catch (err) {
    res.status(500).json({ error: 'Failed to get expiring permits' });
  }
}

export async function getRecentActivity(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = await resolveScope(req.user!);
    // Scope audit logs to the user's office(s) via userId join
    const officeIds = scope.officeIds;
    const logs = await prisma.auditLog.findMany({
      where: officeIds ? { user: { officeId: { in: officeIds } } } : {},
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get recent activity' });
  }
}

export async function getPrinterStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const [endpointCfg, nameCfg] = await Promise.all([
      prisma.systemConfig.findUnique({ where: { key: 'printer_api_endpoint' } }),
      prisma.systemConfig.findUnique({ where: { key: 'printer_name' } }),
    ]);
    const printerName = nameCfg?.value?.trim() || 'Surys P400';
    const endpoint = endpointCfg?.value?.trim();

    if (!endpoint) {
      res.json({ configured: false, printerName });
      return;
    }

    // Probe the cprintlib-style status endpoint (GET {endpoint}/status) with 2s timeout
    type PrinterData = {
      online: boolean;
      ink?: { C: number; M: number; Y: number; K: number };
      serial?: string;
    };
    const result = await new Promise<PrinterData>((resolve) => {
      const statusUrl = `${endpoint}/status`;
      const mod = statusUrl.startsWith('https') ? https : http;
      let body = '';
      const r = mod.get(statusUrl, { timeout: 2000 }, (resp) => {
        resp.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });
        resp.on('end', () => {
          try {
            const json = JSON.parse(body);
            resolve({ online: true, ink: json.ink, serial: json.serial });
          } catch {
            resolve({ online: true }); // endpoint responded but non-JSON — treat as online
          }
        });
      });
      r.on('error', () => resolve({ online: false }));
      r.on('timeout', () => {
        r.destroy();
        resolve({ online: false });
      });
    });

    res.json({
      configured: true,
      online: result.online,
      printerName,
      ink: result.ink ?? null,
      serial: result.serial ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get printer status' });
  }
}
