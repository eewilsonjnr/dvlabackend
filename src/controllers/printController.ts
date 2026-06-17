import { Response } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { resolveScope, nestedPermitOfficeWhere } from '../utils/scopeFilter';

export async function listPrintJobs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { status } = req.query;
    const scope = await resolveScope(req.user!);
    const officeFilter = nestedPermitOfficeWhere(scope);
    const jobs = await prisma.printJob.findMany({
      where: {
        ...(status ? { status: String(status) } : {}),
        ...officeFilter,
      },
      include: { permit: { include: { applicant: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(jobs);
  } catch (err) { res.status(500).json({ error: 'Failed to list print jobs' }); }
}

export async function submitPrintJob(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { permitId, isReprint } = req.body;
    const permit = await prisma.permit.findUnique({ where: { id: permitId } });
    if (!permit) { res.status(404).json({ error: 'Permit not found' }); return; }

    const job = await prisma.printJob.create({
      data: { permitId, operatorId: req.user!.id, status: 'queued', isReprint: !!isReprint },
    });
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id, operatorName: `${req.user?.firstName} ${req.user?.lastName}`,
        action: 'SUBMIT_PRINT_JOB', outcome: 'success',
        details: `Print job ${job.id} queued for permit ${permit.referenceNumber}`, ipAddress: req.ip,
      },
    });
    res.status(201).json(job);
  } catch (err) { res.status(500).json({ error: 'Failed to submit print job' }); }
}

export async function updatePrintJobStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { status, errorMessage, bookletNumber } = req.body;
    const extra: Record<string, unknown> = {};
    if (status === 'printing')  extra.startedAt   = new Date();
    if (status === 'complete')  extra.completedAt  = new Date();
    if (errorMessage)           extra.errorMessage  = errorMessage;
    const job = await prisma.printJob.update({ where: { id: String(req.params.id) }, data: { status, ...extra } });

    // When printing starts, assign the physical booklet number to the permit
    if (status === 'printing' && bookletNumber) {
      await prisma.permit.update({ where: { id: job.permitId }, data: { bookletNumber } });
    }

    // When printing completes: advance permit to 'printed', auto-create RFID + QC records
    if (status === 'complete') {
      await Promise.all([
        prisma.permit.update({ where: { id: job.permitId }, data: { status: 'printed' } }),
        // Always create fresh records per print cycle (preserves history on reprints)
        prisma.rfidEncoding.upsert({
          where: { printJobId: job.id },
          create: { permitId: job.permitId, printJobId: job.id, status: 'pending' },
          update: {},
        }),
        prisma.qcResult.upsert({
          where: { printJobId: job.id },
          create: { permitId: job.permitId, printJobId: job.id, result: 'pending' },
          update: {},
        }),
      ]);
    }

    res.json(job);
  } catch (err) { res.status(500).json({ error: 'Failed to update print job' }); }
}

export async function getPrintStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = await resolveScope(req.user!);
    const npf = nestedPermitOfficeWhere(scope);
    const [queued, printing, complete, error] = await Promise.all([
      prisma.printJob.count({ where: { ...npf, status: 'queued' } }),
      prisma.printJob.count({ where: { ...npf, status: 'printing' } }),
      prisma.printJob.count({ where: { ...npf, status: 'complete' } }),
      prisma.printJob.count({ where: { ...npf, status: 'error' } }),
    ]);
    res.json({ queued, printing, complete, error });
  } catch (err) { res.status(500).json({ error: 'Failed to get print stats' }); }
}
