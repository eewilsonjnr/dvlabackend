import { Response } from 'express';
import https from 'https';
import http from 'http';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { putObject } from '../config/storage';

function storeBiometric(file: Express.Multer.File): Promise<string> {
  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const key = `biometrics/${uuidv4()}${ext}`;
  return putObject(key, file.buffer, file.mimetype).then(() => `/uploads/${key}`);
}

export async function searchApplicants(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { q } = req.query;
    const query = String(q || '');
    const applicants = await prisma.applicant.findMany({
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
  } catch (err) {
    res.status(500).json({ error: 'Failed to search applicants' });
  }
}

export async function getApplicant(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const applicant = await prisma.applicant.findUnique({
      where: { id: String(req.params.id) },
      include: { permits: true },
    });
    if (!applicant) {
      res.status(404).json({ error: 'Applicant not found' });
      return;
    }
    res.json(applicant);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get applicant' });
  }
}

export async function createApplicant(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const applicant = await prisma.applicant.create({ data: req.body });
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        operatorName: `${req.user?.firstName} ${req.user?.lastName}`,
        action: 'CREATE_APPLICANT',
        outcome: 'success',
        details: `Created applicant: ${applicant.surname} ${applicant.otherNames}`,
        ipAddress: req.ip,
      },
    });
    res.status(201).json(applicant);
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Applicant with that ID or licence number already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to create applicant' });
  }
}

export async function updateApplicant(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const applicant = await prisma.applicant.update({
      where: { id: String(req.params.id) },
      data: req.body,
    });
    res.json(applicant);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update applicant' });
  }
}

// Proxy lookup to DVLA Central DB. Uses the `dvla_db_api_endpoint` SystemConfig key.
// If the endpoint is blank, returns { source: 'not_configured' } so the frontend can fall back to its stub.
export async function dvlaLookup(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { invoice } = req.query;
    if (!invoice) {
      res.status(400).json({ error: 'invoice query param required' });
      return;
    }

    const config = await prisma.systemConfig.findUnique({ where: { key: 'dvla_db_api_endpoint' } });
    const endpoint = config?.value?.trim();

    if (!endpoint) {
      res.json({ source: 'not_configured' });
      return;
    }

    // Call real DVLA API: GET {endpoint}/lookup?invoice={invoice}
    const result = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const url = `${endpoint}/lookup?invoice=${encodeURIComponent(String(invoice))}`;
      const mod = url.startsWith('https') ? https : http;
      let body = '';
      const request = mod.get(
        url,
        { headers: { Accept: 'application/json' }, timeout: 5000 },
        (r) => {
          r.on('data', (chunk: Buffer) => {
            body += chunk.toString();
          });
          r.on('end', () => resolve({ status: r.statusCode ?? 500, body }));
        },
      );
      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('DVLA API timeout'));
      });
    });

    if (result.status !== 200) {
      res.status(result.status).json({ error: 'DVLA API returned an error', source: 'dvla_api' });
      return;
    }

    res.json({ source: 'dvla_api', data: JSON.parse(result.body) });
  } catch (err: any) {
    res.status(502).json({ error: err.message ?? 'DVLA lookup failed', source: 'dvla_api' });
  }
}

export async function uploadBiometric(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided' });
      return;
    }
    const photoUrl = await storeBiometric(req.file);
    const applicant = await prisma.applicant.update({
      where: { id: String(req.params.id) },
      data: { photoUrl },
    });
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        operatorName: `${req.user?.firstName} ${req.user?.lastName}`,
        action: 'UPLOAD_BIOMETRIC',
        outcome: 'success',
        details: `Biometric photo uploaded for applicant ${applicant.surname} ${applicant.otherNames}`,
        ipAddress: req.ip,
      },
    });
    res.json({ photoUrl, applicant });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload biometric photo' });
  }
}

export async function uploadSignature(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No signature file provided' });
      return;
    }
    const signatureUrl = await storeBiometric(req.file);
    const applicant = await prisma.applicant.update({
      where: { id: String(req.params.id) },
      data: { signatureUrl },
    });
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        operatorName: `${req.user?.firstName} ${req.user?.lastName}`,
        action: 'UPLOAD_SIGNATURE',
        outcome: 'success',
        details: `Signature uploaded for applicant ${applicant.surname} ${applicant.otherNames}`,
        ipAddress: req.ip,
      },
    });
    res.json({ signatureUrl, applicant });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload signature' });
  }
}
