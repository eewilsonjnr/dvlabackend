import { Response } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { resolveScope, nestedPermitOfficeWhere } from '../utils/scopeFilter';

export async function listQcResults(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { result } = req.query;
    const scope = await resolveScope(req.user!);
    const officeFilter = nestedPermitOfficeWhere(scope);
    const rows = await prisma.qcResult.findMany({
      where: {
        ...(result ? { result: String(result) } : {}),
        ...officeFilter,
      },
      include: { permit: { include: { applicant: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed to list QC results' }); }
}

export async function submitQcResult(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const {
      permitId, printJobId, result, rejectionReason,
      opticalInspectionScore, photoQualityScore,
      mrzValidation, rfidValidation,
    } = req.body;

    // Guard against duplicate inspection of the same permit
    const existing = await prisma.qcResult.findFirst({
      where: { permitId, result: { not: 'pending' } },
    });
    if (existing) {
      res.status(409).json({ error: 'This permit has already been inspected.' });
      return;
    }

    // Update the pending QC record if it exists (created when print completed), else create fresh
    const pending = await prisma.qcResult.findFirst({ where: { permitId, result: 'pending' } });
    const qcData = {
      result, rejectionReason,
      opticalInspectionScore, photoQualityScore,
      mrzValidation: !!mrzValidation, rfidValidation: !!rfidValidation,
      inspectedById: req.user?.id, inspectedAt: new Date(),
    };
    const qc = pending
      ? await prisma.qcResult.update({ where: { id: pending.id }, data: qcData })
      : await prisma.qcResult.create({ data: { permitId, printJobId, ...qcData } });

    // Auto-advance permit status based on QC result (SRS §3.6 + state machine)
    // QC pass: printed → issued   |   QC fail: printed → rejected
    const permit = await prisma.permit.findUnique({ where: { id: permitId } });
    if (result === 'pass' && permit?.status === 'printed') {
      await prisma.permit.update({ where: { id: permitId }, data: { status: 'issued' } });
    } else if (result === 'fail') {
      await prisma.permit.update({
        where: { id: permitId },
        data: {
          status: 'rejected',
          rejectionReason: rejectionReason ?? 'Failed quality control inspection.',
        },
      });
    }

    res.status(201).json(qc);
  } catch (err) { res.status(500).json({ error: 'Failed to submit QC result' }); }
}
