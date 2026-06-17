import { Response } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { resolveScope, nestedPermitOfficeWhere } from '../utils/scopeFilter';

export async function listRfid(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { status } = req.query;
    const scope = await resolveScope(req.user!);
    const officeFilter = nestedPermitOfficeWhere(scope);
    const rows = await prisma.rfidEncoding.findMany({
      where: {
        ...(status ? { status: String(status) } : {}),
        ...officeFilter,
      },
      include: { permit: { include: { applicant: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed to list RFID encodings' }); }
}

export async function updateRfidStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { status, chipSerialNumber, verificationResult } = req.body;
    const row = await prisma.rfidEncoding.update({
      where: { id: String(req.params.id) },
      data: { status, chipSerialNumber, verificationResult, ...(status === 'encoded' ? { encodedAt: new Date() } : {}) },
    });
    res.json(row);
  } catch (err) { res.status(500).json({ error: 'Failed to update RFID status' }); }
}
