import { Response } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { resolveScope, permitOfficeWhere } from '../utils/scopeFilter';

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseDate(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

// ─── 1. Permit Summary Report ─────────────────────────────────────────────────
// Counts by status (and optionally type) within a date range.

export async function permitSummaryReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { from, to, type } = req.query;
    const scope = await resolveScope(req.user!);
    const pf    = permitOfficeWhere(scope);

    const dateFilter = {
      ...(parseDate(String(from || '')) ? { gte: parseDate(String(from)) } : {}),
      ...(parseDate(String(to   || '')) ? { lte: parseDate(String(to))   } : {}),
    };
    const base = {
      ...pf,
      ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
      ...(type && type !== 'all' ? { permitType: String(type) } : {}),
    };

    const [draft, submitted, approved, printed, issued, rejected, total] = await Promise.all([
      prisma.permit.count({ where: { ...base, status: 'draft'     } }),
      prisma.permit.count({ where: { ...base, status: 'submitted' } }),
      prisma.permit.count({ where: { ...base, status: 'approved'  } }),
      prisma.permit.count({ where: { ...base, status: 'printed'   } }),
      prisma.permit.count({ where: { ...base, status: 'issued'    } }),
      prisma.permit.count({ where: { ...base, status: 'rejected'  } }),
      prisma.permit.count({ where: base }),
    ]);

    res.json({ total, byStatus: { draft, submitted, approved, printed, issued, rejected } });
  } catch (err) { res.status(500).json({ error: 'Failed to generate permit summary report' }); }
}

// ─── 2. Production Throughput Report ─────────────────────────────────────────
// Daily issued permit counts grouped by date.

export async function productionThroughputReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { from, to, type } = req.query;
    const scope = await resolveScope(req.user!);
    const pf    = permitOfficeWhere(scope);

    const fromDate = parseDate(String(from || '')) ?? new Date(Date.now() - 30 * 86400000);
    const toDate   = parseDate(String(to   || '')) ?? new Date();

    const base = {
      ...pf,
      status: 'issued' as const,
      updatedAt: { gte: fromDate, lte: toDate },
      ...(type && type !== 'all' ? { permitType: String(type) } : {}),
    };

    const permits = await prisma.permit.findMany({
      where: base,
      select: { updatedAt: true, permitType: true },
      orderBy: { updatedAt: 'asc' },
    });

    // Group by YYYY-MM-DD
    const byDay: Record<string, { idp: number; icmv: number; total: number }> = {};
    for (const p of permits) {
      const day = p.updatedAt.toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { idp: 0, icmv: 0, total: 0 };
      byDay[day].total++;
      if (p.permitType === 'IDP')  byDay[day].idp++;
      if (p.permitType === 'ICMV') byDay[day].icmv++;
    }

    res.json({
      total: permits.length,
      rows: Object.entries(byDay).map(([date, counts]) => ({ date, ...counts })),
    });
  } catch (err) { res.status(500).json({ error: 'Failed to generate throughput report' }); }
}

// ─── 3. Expiring Permits Report ───────────────────────────────────────────────
// Permits expiring within a given window (default 90 days).

export async function expiringPermitsReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { days = '90', type } = req.query;
    const scope = await resolveScope(req.user!);
    const pf    = permitOfficeWhere(scope);

    const today  = new Date().toISOString().slice(0, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + parseInt(String(days), 10));
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const permits = await prisma.permit.findMany({
      where: {
        ...pf,
        status:      { in: ['issued', 'printed'] },
        dateOfExpiry: { gte: today, lte: cutoffStr },
        ...(type && type !== 'all' ? { permitType: String(type) } : {}),
      },
      include: {
        applicant:    { select: { surname: true, otherNames: true, licenceNumber: true } },
        issuingOffice: { select: { name: true, regionName: true } },
      },
      orderBy: { dateOfExpiry: 'asc' },
    });

    res.json({ total: permits.length, rows: permits });
  } catch (err) { res.status(500).json({ error: 'Failed to generate expiring permits report' }); }
}

// ─── 4. Office Performance Report ────────────────────────────────────────────
// Per-office breakdown: total permits created, issued, rejected.

export async function officePerformanceReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { from, to } = req.query;
    const scope = await resolveScope(req.user!);

    const dateFilter = {
      ...(parseDate(String(from || '')) ? { gte: parseDate(String(from)) } : {}),
      ...(parseDate(String(to   || '')) ? { lte: parseDate(String(to))   } : {}),
    };
    const createdAt = Object.keys(dateFilter).length ? dateFilter : undefined;

    // Fetch offices visible to this user
    const officeWhere = scope.officeIds
      ? { id: { in: scope.officeIds }, isActive: true }
      : { isActive: true };

    const offices = await prisma.dvlaOffice.findMany({
      where: officeWhere,
      select: { id: true, name: true, type: true, regionName: true, town: true },
      orderBy: { name: 'asc' },
    });

    const rows = await Promise.all(offices.map(async office => {
      const base = { officeId: office.id, ...(createdAt ? { createdAt } : {}) };
      const [total, issued, rejected, pending] = await Promise.all([
        prisma.permit.count({ where: base }),
        prisma.permit.count({ where: { ...base, status: 'issued' } }),
        prisma.permit.count({ where: { ...base, status: 'rejected' } }),
        prisma.permit.count({ where: { ...base, status: 'submitted' } }),
      ]);
      return { office, total, issued, rejected, pending };
    }));

    res.json({ total: rows.reduce((s, r) => s + r.total, 0), rows });
  } catch (err) { res.status(500).json({ error: 'Failed to generate office performance report' }); }
}

// ─── 5. CSV Export (generic, driven by report type) ──────────────────────────

export async function exportReportCsv(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { report, from, to, type, days } = req.query;

    // Re-use the same query logic but shape it for CSV
    const scope = await resolveScope(req.user!);
    const pf    = permitOfficeWhere(scope);

    let csv = '';
    const filename = `dvla-report-${report}-${Date.now()}.csv`;

    if (report === 'summary') {
      const dateFilter = {
        ...(parseDate(String(from || '')) ? { gte: parseDate(String(from)) } : {}),
        ...(parseDate(String(to   || '')) ? { lte: parseDate(String(to))   } : {}),
      };
      const base = {
        ...pf,
        ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
        ...(type && type !== 'all' ? { permitType: String(type) } : {}),
      };
      const permits = await prisma.permit.findMany({
        where: base,
        select: { referenceNumber: true, permitType: true, status: true, createdAt: true, dateOfIssue: true, dateOfExpiry: true },
        orderBy: { createdAt: 'desc' },
      });
      csv = 'Reference,Type,Status,Created,Date of Issue,Date of Expiry\n' +
        permits.map(p => [
          p.referenceNumber, p.permitType, p.status,
          p.createdAt.toISOString().slice(0, 10),
          p.dateOfIssue ?? '', p.dateOfExpiry ?? '',
        ].join(',')).join('\n');

    } else if (report === 'expiring') {
      const windowDays = parseInt(String(days || '90'), 10);
      const today  = new Date().toISOString().slice(0, 10);
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + windowDays);
      const permits = await prisma.permit.findMany({
        where: {
          ...pf,
          status: { in: ['issued', 'printed'] },
          dateOfExpiry: { gte: today, lte: cutoff.toISOString().slice(0, 10) },
          ...(type && type !== 'all' ? { permitType: String(type) } : {}),
        },
        include: { applicant: { select: { surname: true, otherNames: true, licenceNumber: true } } },
        orderBy: { dateOfExpiry: 'asc' },
      });
      csv = 'Reference,Type,Applicant,Licence No,Expiry Date\n' +
        permits.map(p => [
          p.referenceNumber, p.permitType,
          `"${p.applicant.surname} ${p.applicant.otherNames}"`,
          p.applicant.licenceNumber ?? '',
          p.dateOfExpiry ?? '',
        ].join(',')).join('\n');

    } else if (report === 'office') {
      const dateFilter = {
        ...(parseDate(String(from || '')) ? { gte: parseDate(String(from)) } : {}),
        ...(parseDate(String(to   || '')) ? { lte: parseDate(String(to))   } : {}),
      };
      const createdAt = Object.keys(dateFilter).length ? dateFilter : undefined;
      const officeWhere = scope.officeIds ? { id: { in: scope.officeIds }, isActive: true } : { isActive: true };
      const offices = await prisma.dvlaOffice.findMany({ where: officeWhere, select: { id: true, name: true, regionName: true }, orderBy: { name: 'asc' } });
      const rows = await Promise.all(offices.map(async o => {
        const base = { officeId: o.id, ...(createdAt ? { createdAt } : {}) };
        const [total, issued, rejected, pending] = await Promise.all([
          prisma.permit.count({ where: base }),
          prisma.permit.count({ where: { ...base, status: 'issued' } }),
          prisma.permit.count({ where: { ...base, status: 'rejected' } }),
          prisma.permit.count({ where: { ...base, status: 'submitted' } }),
        ]);
        return [o.name, o.regionName ?? '', total, issued, rejected, pending];
      }));
      csv = 'Office,Region,Total,Issued,Rejected,Pending\n' + rows.map(r => r.join(',')).join('\n');

    } else {
      res.status(400).json({ error: 'Unknown report type' });
      return;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) { res.status(500).json({ error: 'Failed to export report' }); }
}
