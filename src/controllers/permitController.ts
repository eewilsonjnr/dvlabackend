import { Response } from 'express';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { generateRef, generateMRZ } from '../utils/helpers';
import { resolveScope, permitOfficeWhere } from '../utils/scopeFilter';

export async function listPermits(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { type, status, applicantId, officeId: queryOfficeId } = req.query;
    const scope = await resolveScope(req.user!);

    // HQ can further narrow by an explicit ?officeId= query param
    let officeFilter = permitOfficeWhere(scope);
    if (scope.level === 'national' && queryOfficeId) {
      officeFilter = { officeId: String(queryOfficeId) };
    }

    const permits = await prisma.permit.findMany({
      where: {
        ...officeFilter,
        ...(type        ? { permitType:   String(type) }         : {}),
        ...(status      ? { status:       String(status) }       : {}),
        ...(applicantId ? { applicantId:  String(applicantId) }  : {}),
      },
      include: {
        applicant: true,
        issuingOffice: { select: { id: true, name: true, type: true, regionName: true, town: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(permits);
  } catch (err) { res.status(500).json({ error: 'Failed to list permits' }); }
}

export async function getPermit(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = await resolveScope(req.user!);
    const permit = await prisma.permit.findUnique({
      where: { id: String(req.params.id) },
      include: {
        applicant: true,
        issuingOffice: { select: { id: true, name: true, type: true, regionName: true, town: true, placeOfIssueLabel: true } },
        printJobs:     { orderBy: { createdAt: 'desc' } },
        rfidEncodings: { orderBy: { createdAt: 'desc' } },
        qcResults:     { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!permit) { res.status(404).json({ error: 'Permit not found' }); return; }
    // Access check: national sees all; regional checks region; district checks own office
    if (scope.level !== 'national' && permit.officeId && !scope.officeIds!.includes(permit.officeId)) {
      res.status(403).json({ error: 'Access denied — permit belongs to a different office' });
      return;
    }
    res.json(permit);
  } catch (err) { res.status(500).json({ error: 'Failed to get permit' }); }
}

export async function createIDP(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { applicantId, dateOfIssue, dateOfExpiry, classOfLicence, certificateOfCompetence } = req.body;
    const applicant = await prisma.applicant.findUnique({ where: { id: applicantId } });
    if (!applicant) { res.status(404).json({ error: 'Applicant not found' }); return; }

    // placeOfIssue is always the issuing office's label — never taken from the request body
    const placeOfIssue = req.user?.office?.placeOfIssueLabel ?? req.user?.office?.name ?? 'DVLA Ghana';
    const mrz = generateMRZ(applicant.surname, applicant.otherNames, applicant.dateOfBirth || '', dateOfExpiry || '', applicant.licenceNumber || '');
    const permit = await prisma.permit.create({
      data: {
        permitType: 'IDP', applicantId, referenceNumber: generateRef('IDP'),
        operatorId: req.user?.id, officeId: req.user?.officeId ?? null,
        placeOfIssue, dateOfIssue, dateOfExpiry,
        classOfLicence, certificateOfCompetence, mrzLine1: mrz.line1, mrzLine2: mrz.line2,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id, operatorName: `${req.user?.firstName} ${req.user?.lastName}`,
        applicantRef: applicant.licenceNumber, action: 'CREATE_IDP', outcome: 'success',
        details: `Created IDP permit ${permit.referenceNumber}`, ipAddress: req.ip,
      },
    });
    res.status(201).json(permit);
  } catch (err) { res.status(500).json({ error: 'Failed to create IDP' }); }
}

export async function createICMV(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { applicantId, placeOfIssue: _ignored, ...rest } = req.body;
    const applicant = await prisma.applicant.findUnique({ where: { id: applicantId } });
    if (!applicant) { res.status(404).json({ error: 'Applicant not found' }); return; }

    // placeOfIssue is always the issuing office's label — never taken from the request body
    const placeOfIssue = req.user?.office?.placeOfIssueLabel ?? req.user?.office?.name ?? 'DVLA Ghana';
    const permit = await prisma.permit.create({
      data: { permitType: 'ICMV', applicantId, referenceNumber: generateRef('ICMV'), operatorId: req.user?.id, officeId: req.user?.officeId ?? null, placeOfIssue, ...rest },
    });
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id, operatorName: `${req.user?.firstName} ${req.user?.lastName}`,
        action: 'CREATE_ICMV', outcome: 'success',
        details: `Created ICMV permit ${permit.referenceNumber}`, ipAddress: req.ip,
      },
    });
    res.status(201).json(permit);
  } catch (err) { res.status(500).json({ error: 'Failed to create ICMV' }); }
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft:     ['submitted'],
  submitted: ['approved', 'rejected'],
  approved:  ['printed', 'rejected'],
  printed:   ['issued', 'rejected'],
  issued:    [],
  rejected:  [],
};

export async function previewPermit(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const permit = await prisma.permit.findUnique({
      where: { id: String(req.params.id) },
      include: { applicant: true },
    });
    if (!permit) { res.status(404).json({ error: 'Permit not found' }); return; }

    const { applicant } = permit;

    // Physical page: 8.8cm × 12.5cm  (1cm = 28.346pt)
    const CM = 28.346;
    const W  = 8.8  * CM;   // 249.4448pt exact
    const H  = 12.5 * CM;   // 354.325pt exact

    const doc = new PDFDocument({ size: [W, H], margin: 0, autoFirstPage: true, info: {
      Title: `${permit.permitType} – ${permit.referenceNumber}`,
      Author: 'DVLA Ghana',
    }});

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${permit.referenceNumber}.pdf"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    doc.pipe(res);

    // ════════════════════════════════════════════════════════════════════════
    // PAGE 1 — PARTICULARS CONCERNING THE DRIVER
    // The booklet already has the title, labels, dotted lines and numbers
    // pre-printed. We only print: the photo + data values on the dotted lines.
    // Background is transparent (white) so nothing obscures the pre-print.
    // ════════════════════════════════════════════════════════════════════════

    const PAD = Math.round(0.6 * CM);  // left margin for value text
    const VPAD = 3.3 * CM;             // value start X — just past the 3.2cm label area

    // ── Page border ───────────────────────────────────────────────────────────
    doc.rect(0.5, 0.5, W - 1, H - 1).strokeColor('#CCCCCC').lineWidth(0.5).stroke();

    // ── Photo ────────────────────────────────────────────────────────────────
    // Spec: 3.8cm × 4.0cm, 1.8cm from top, centred (2.5cm each side)
    const photoW = 3.8 * CM;
    const photoH = 4.7 * CM;
    const photoX = (W - photoW) / 2;   // exactly 2.5cm from both edges
    const photoY = 1.6 * CM;

    if (applicant.photoUrl) {
      const photoPath = applicant.photoUrl.startsWith('/uploads')
        ? path.join(__dirname, '..', '..', applicant.photoUrl)
        : null;
      if (photoPath && fs.existsSync(photoPath)) {
        try {
          doc.save();
          doc.rect(photoX, photoY, photoW, photoH).clip();
          doc.image(photoPath, photoX, photoY, { width: photoW, height: photoH, cover: [photoW, photoH] });
          doc.restore();
        } catch { /* no image */ }
      }
    }

    // ── Data values printed ON the pre-printed dotted lines ──────────────────
    // First dotted line is 0.5cm below the bottom of the photo box.
    // Each subsequent line is 0.5cm lower.
    const firstLineY = photoY + photoH + 0.4 * CM;
    const lineSpacing = 0.6 * CM;

    const values = [
      applicant.surname.toUpperCase(),
      applicant.otherNames.toUpperCase(),
      applicant.placeOfBirth ?? '',
      applicant.dateOfBirth ?? '',
      applicant.homeAddress ?? '',
      '', // Signature — hand-signed
    ];

    const valueWidth = W - VPAD - PAD;
    let currentY = firstLineY;
    values.forEach((value, i) => {
      if (i > 0) {
        const prevWrapped = values[i - 1].length > 20;
        currentY += prevWrapped ? 0.4 * CM : lineSpacing;
      }
      if (!value) { currentY += lineSpacing; return; }
      const needsWrap = value.length > 20;
      doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold')
        .text(value, VPAD, currentY, {
          width: valueWidth,
          lineBreak: needsWrap,
          ellipsis: !needsWrap,
          align: 'left',
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // PAGE 2 — ISSUE OF PERMIT
    // The booklet already has headers, labels and dotted lines pre-printed.
    // We only print the data values on top of each dotted line.
    // ════════════════════════════════════════════════════════════════════════
    doc.addPage({ size: [W, H], margin: 0 });
    doc.rect(0.5, 0.5, W - 1, H - 1).strokeColor('#CCCCCC').lineWidth(0.5).stroke();

    // ── Values only — on the pre-printed dotted lines ─────────────────────
    // Adjust these Y positions to match where each dotted line sits in the
    // physical booklet. Starting point and spacing to be calibrated on print.
    const p2FirstLineY = 5.4 * CM;
    const p2LineSpacing = 1.0 * CM;

    const issueValues: string[] = [
      permit.placeOfIssue ?? '',
      permit.dateOfIssue ?? '',
      permit.dateOfExpiry ?? '',
      permit.classOfLicence ?? '',
      (permit as any).certificateOfCompetence ?? '',
    ];

    let p2CurrentY = p2FirstLineY;
    issueValues.forEach((value, i) => {
      if (i > 0) {
        const prevWrapped = issueValues[i - 1].length > 20;
        p2CurrentY += prevWrapped ? 0.8 * CM : p2LineSpacing;
      }
      if (!value) { p2CurrentY += p2LineSpacing; return; }
      const needsWrap = value.length > 20;
      doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold')
        .text(value, VPAD, p2CurrentY, {
          width: valueWidth,
          lineBreak: needsWrap,
          ellipsis: !needsWrap,
          align: 'left',
        });
    });

    doc.end();
  } catch (err) {
    console.error('Preview generation error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate preview' });
  }
}

export async function updatePermitStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // /submit route hardcodes status; /status route reads it from body
    const status = req.body.status ?? 'submitted';
    const { rejectionReason } = req.body;
    const current = await prisma.permit.findUnique({ where: { id: String(req.params.id) } });
    if (!current) { res.status(404).json({ error: 'Permit not found' }); return; }

    const allowed = VALID_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(status)) {
      res.status(422).json({ error: `Cannot transition permit from '${current.status}' to '${status}'` });
      return;
    }

    const permit = await prisma.permit.update({
      where: { id: String(req.params.id) },
      data: { status, ...(rejectionReason ? { rejectionReason } : {}) },
    });
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id, operatorName: `${req.user?.firstName} ${req.user?.lastName}`,
        action: `STATUS_${status.toUpperCase()}`, outcome: 'success',
        details: `Permit ${permit.referenceNumber} → ${status}`, ipAddress: req.ip,
      },
    });
    res.json(permit);
  } catch (err) { res.status(500).json({ error: 'Failed to update permit status' }); }
}
