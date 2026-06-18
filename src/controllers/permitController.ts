import { Response } from 'express';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { generateRef, generateMRZ } from '../utils/helpers';
import { resolveScope, permitOfficeWhere } from '../utils/scopeFilter';
import { getObjectBuffer } from '../config/storage';

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
        ...(type ? { permitType: String(type) } : {}),
        ...(status ? { status: String(status) } : {}),
        ...(applicantId ? { applicantId: String(applicantId) } : {}),
      },
      include: {
        applicant: true,
        issuingOffice: {
          select: { id: true, name: true, type: true, regionName: true, town: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(permits);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list permits' });
  }
}

export async function getPermit(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = await resolveScope(req.user!);
    const permit = await prisma.permit.findUnique({
      where: { id: String(req.params.id) },
      include: {
        applicant: true,
        issuingOffice: {
          select: {
            id: true,
            name: true,
            type: true,
            regionName: true,
            town: true,
            placeOfIssueLabel: true,
          },
        },
        printJobs: { orderBy: { createdAt: 'desc' } },
        rfidEncodings: { orderBy: { createdAt: 'desc' } },
        qcResults: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!permit) {
      res.status(404).json({ error: 'Permit not found' });
      return;
    }
    // Access check: national sees all; regional checks region; district checks own office
    if (
      scope.level !== 'national' &&
      permit.officeId &&
      !scope.officeIds!.includes(permit.officeId)
    ) {
      res.status(403).json({ error: 'Access denied — permit belongs to a different office' });
      return;
    }
    res.json(permit);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get permit' });
  }
}

export async function createIDP(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { applicantId, dateOfIssue, dateOfExpiry, classOfLicence, certificateOfCompetence } =
      req.body;
    const applicant = await prisma.applicant.findUnique({ where: { id: applicantId } });
    if (!applicant) {
      res.status(404).json({ error: 'Applicant not found' });
      return;
    }

    // placeOfIssue is always the issuing office's label — never taken from the request body
    const placeOfIssue =
      req.user?.office?.placeOfIssueLabel ?? req.user?.office?.name ?? 'DVLA Ghana';
    const mrz = generateMRZ(
      applicant.surname,
      applicant.otherNames,
      applicant.dateOfBirth || '',
      dateOfExpiry || '',
      applicant.licenceNumber || '',
    );
    const permit = await prisma.permit.create({
      data: {
        permitType: 'IDP',
        applicantId,
        referenceNumber: generateRef('IDP'),
        operatorId: req.user?.id,
        officeId: req.user?.officeId ?? null,
        placeOfIssue,
        dateOfIssue,
        dateOfExpiry,
        classOfLicence,
        certificateOfCompetence,
        mrzLine1: mrz.line1,
        mrzLine2: mrz.line2,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        operatorName: `${req.user?.firstName} ${req.user?.lastName}`,
        applicantRef: applicant.licenceNumber,
        action: 'CREATE_IDP',
        outcome: 'success',
        details: `Created IDP permit ${permit.referenceNumber}`,
        ipAddress: req.ip,
      },
    });
    res.status(201).json(permit);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create IDP' });
  }
}

export async function createICMV(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { applicantId, placeOfIssue: _ignored, ...rest } = req.body;
    const applicant = await prisma.applicant.findUnique({ where: { id: applicantId } });
    if (!applicant) {
      res.status(404).json({ error: 'Applicant not found' });
      return;
    }

    // placeOfIssue is always the issuing office's label — never taken from the request body
    const placeOfIssue =
      req.user?.office?.placeOfIssueLabel ?? req.user?.office?.name ?? 'DVLA Ghana';
    const permit = await prisma.permit.create({
      data: {
        permitType: 'ICMV',
        applicantId,
        referenceNumber: generateRef('ICMV'),
        operatorId: req.user?.id,
        officeId: req.user?.officeId ?? null,
        placeOfIssue,
        ...rest,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        operatorName: `${req.user?.firstName} ${req.user?.lastName}`,
        action: 'CREATE_ICMV',
        outcome: 'success',
        details: `Created ICMV permit ${permit.referenceNumber}`,
        ipAddress: req.ip,
      },
    });
    res.status(201).json(permit);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create ICMV' });
  }
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected'],
  approved: ['printed', 'rejected'],
  printed: ['issued', 'rejected'],
  issued: [],
  rejected: [],
};

export async function previewPermit(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const permit = await prisma.permit.findUnique({
      where: { id: String(req.params.id) },
      include: { applicant: true },
    });
    if (!permit) {
      res.status(404).json({ error: 'Permit not found' });
      return;
    }

    const { applicant } = permit;

    // Fetch the applicant photo from object storage up front (async) so the
    // synchronous PDF drawing below can embed it from a buffer.
    let photoBuffer: Buffer | null = null;
    if (applicant.photoUrl?.startsWith('/uploads/')) {
      const key = applicant.photoUrl.replace(/^\/uploads\//, '');
      photoBuffer = await getObjectBuffer(key).catch(() => null);
      // Fallback to local filesystem if object storage returns nothing
      if (!photoBuffer) {
        const localPath = path.join(__dirname, '..', '..', applicant.photoUrl);
        if (fs.existsSync(localPath)) photoBuffer = fs.readFileSync(localPath);
      }
    }

    // Physical page dimensions (1cm = 28.346pt)
    // IDP: booklet opened flat → single spread 17.6cm × 12.5cm (two 8.8cm halves)
    // ICMV: single page 8.8cm × 12.5cm
    const CM = 28.346;
    const PW = 8.8 * CM; // single page width
    const H = 12.5 * CM; // page height
    const W = permit.permitType === 'IDP' ? PW * 2 : PW; // spread for IDP

    const doc = new PDFDocument({
      size: [W, H],
      margin: 0,
      autoFirstPage: true,
      info: {
        Title: `${permit.permitType} – ${permit.referenceNumber}`,
        Author: 'DVLA Ghana',
      },
    });

    // Collect PDF into buffer then send — avoids streaming issues
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const PAD = 0.55 * CM;
      const VPAD = 3.4 * CM;

      // For IDP spread: left half starts at x=0, right half starts at x=PW
      const drawBorder = (offsetX = 0) =>
        doc
          .rect(offsetX + 0.5, 0.5, PW - 1, H - 1)
          .strokeColor('#CCCCCC')
          .lineWidth(0.5)
          .stroke();

      const writeValue = (value: string, x: number, y: number, maxWidth: number, fontSize = 8) => {
        if (!value) return;
        doc
          .fillColor('#000000')
          .fontSize(fontSize)
          .font('Helvetica-Bold')
          .text(value, x, y, { width: maxWidth, lineBreak: false, ellipsis: true, align: 'left' });
      };

      const drawPhoto = (photoX: number, photoY: number, photoW: number, photoH: number) => {
        if (photoBuffer) {
          try {
            doc.save();
            doc.rect(photoX, photoY, photoW, photoH).clip();
            doc.image(photoBuffer, photoX, photoY, {
              width: photoW,
              height: photoH,
              cover: [photoW, photoH],
            });
            doc.restore();
            return;
          } catch {
            /* fall through to placeholder */
          }
        }

        // Placeholder when no photo is available
        doc.rect(photoX, photoY, photoW, photoH).fillAndStroke('#E8E8E8', '#AAAAAA');
        doc
          .fillColor('#999999')
          .fontSize(7)
          .font('Helvetica')
          .text('PHOTO', photoX, photoY + photoH / 2 - 4, {
            width: photoW,
            align: 'center',
            lineBreak: false,
          });
      };

      if (permit.permitType === 'ICMV') {
        // ══════════════════════════════════════════════════════════════════════
        // ICMV — single page, Geneva Convention template, 18 fields
        //
        // Fixed three-column layout — label | value | number — so nothing
        // ever wraps or overflows regardless of content length.
        //   GRP  0      → 1.3cm  : group labels (Owner/Engine/Body)
        //   LBL  1.3cm  → 5.2cm  : field label (ellipsis if too long)
        //   VAL  5.2cm  → 7.9cm  : bold value  (ellipsis if too long)
        //   NUM  7.9cm  → 8.35cm : field number right-aligned
        // 18 rows distributed evenly from 0.9cm to 12.2cm → ~0.63cm each.
        // ══════════════════════════════════════════════════════════════════════
        drawBorder();

        doc
          .fillColor('#333333')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text('1', 0, 0.25 * CM, { width: W, align: 'center' });
        doc
          .fillColor('#333333')
          .fontSize(8)
          .font('Helvetica-Oblique')
          .text('English', 0, 0.25 * CM, { width: W - PAD, align: 'right' });

        const iGRP_X = PAD;
        const iLBL_X = 1.3 * CM;
        const iVAL_X = 5.2 * CM;
        const iNUM_X = 7.9 * CM;
        const iLBL_W = iVAL_X - iLBL_X - 0.1 * CM;
        const iVAL_W = iNUM_X - iVAL_X - 0.05 * CM;
        const iNUM_W = W - PAD - iNUM_X;
        const iROW_START = 0.9 * CM;
        const iROW_H = (11.2 * CM) / 18;
        const iFONT = 6.5;
        const iRowY = (i: number) => iROW_START + i * iROW_H;

        // Group bracket labels
        doc
          .fillColor('#444444')
          .fontSize(iFONT - 0.5)
          .font('Helvetica')
          .text('Owner', iGRP_X, iRowY(0) + 1)
          .text('or', iGRP_X, iRowY(0) + 9)
          .text('Holder', iGRP_X, iRowY(0) + 17)
          .text('Engine', iGRP_X, iRowY(7) + iROW_H)
          .text('Body', iGRP_X, iRowY(12) + iROW_H * 0.5);

        const icmvRows: [string, string, string][] = [
          ['Surname', (permit.ownerSurname ?? '').toUpperCase(), '1'],
          ['Other names', (permit.ownerOtherNames ?? '').toUpperCase(), '2'],
          ['Home address', permit.ownerHomeAddress ?? '', '3'],
          ['Class of vehicle', permit.classOfVehicle ?? '', '4'],
          ['Name of maker of chassis', permit.makerOfChassis ?? '', '5'],
          ['Type of chassis', permit.typeOfChassis ?? '', '6'],
          ["Serial Number of type or maker's number of chassis", permit.serialNumber ?? '', '7'],
          ['Number of cylinders', permit.numberOfCylinders ?? '', '8'],
          ['Engine number', permit.engineNumber ?? '', '9'],
          ['Stroke', permit.stroke ?? '', '10'],
          ['Bore', permit.bore ?? '', '11'],
          ['Horse-power', permit.horsePower ?? '', '12'],
          ['Shape', permit.bodyShape ?? '', '13'],
          ['Colour', permit.bodyColour ?? '', '14'],
          ['Number of seats', permit.numberOfSeats ?? '', '15'],
          ['Weight of car unladen (in kilos)', permit.weightUnladen ?? '', '16'],
          [
            'Weight of car fully laden (in kilos) if exceeding 3,500 kilos',
            permit.weightLaden ?? '',
            '17',
          ],
          ['Identification mark on the plate', permit.identificationMark ?? '', '18'],
        ];

        icmvRows.forEach(([label, value, num], i) => {
          const y = iRowY(i);
          const dotY = y + iROW_H - 2;

          doc
            .fillColor('#333333')
            .fontSize(iFONT)
            .font('Helvetica')
            .text(label, iLBL_X, y, { width: iLBL_W, lineBreak: false, ellipsis: true });

          doc
            .moveTo(iLBL_X, dotY)
            .lineTo(W - PAD, dotY)
            .dash(1, { space: 2.5 })
            .strokeColor('#BBBBBB')
            .lineWidth(0.25)
            .stroke()
            .undash();

          if (value) {
            doc
              .fillColor('#000000')
              .fontSize(iFONT)
              .font('Helvetica-Bold')
              .text(value, iVAL_X, y, { width: iVAL_W, lineBreak: false, ellipsis: true });
          }

          doc
            .fillColor('#666666')
            .fontSize(iFONT - 0.5)
            .font('Helvetica')
            .text(num, iNUM_X, y, { width: iNUM_W, align: 'right', lineBreak: false });
        });

        // ICMV is a single-page document
      } else {
        // ══════════════════════════════════════════════════════════════════════
        // IDP — single spread 17.6cm × 12.5cm
        // Left half  (x: 0   → PW): Page 1 — Particulars Concerning the Driver
        // Right half (x: PW  → 2×PW): Page 2 — Issue of Permit
        // ══════════════════════════════════════════════════════════════════════

        // ── Left half: Page 1 ─────────────────────────────────────────────
        drawBorder(0);

        const photoW = 3.8 * CM;
        const photoH = 4.7 * CM;
        const photoX = (PW - photoW) / 2; // centred within left half
        const photoY = 1.6 * CM;
        drawPhoto(photoX, photoY, photoW, photoH);

        const firstLineY = photoY + photoH + 0.4 * CM;
        const lineSpacing = 0.6 * CM;
        const valueWidth = PW - VPAD - PAD;

        const values = [
          applicant.surname.toUpperCase(),
          applicant.otherNames.toUpperCase(),
          applicant.placeOfBirth ?? '',
          applicant.dateOfBirth ?? '',
          applicant.homeAddress ?? '',
          '', // Signature — hand-signed
        ];

        let currentY = firstLineY;
        values.forEach((value, i) => {
          if (i > 0) {
            const prevWrapped = (values[i - 1] ?? '').length > 20;
            currentY += prevWrapped ? 0.4 * CM : lineSpacing;
          }
          if (!value) {
            currentY += lineSpacing;
            return;
          }
          writeValue(value, VPAD, currentY, valueWidth);
        });

        // ── Right half: Page 2 ────────────────────────────────────────────
        const OX = PW; // x offset for right half
        drawBorder(OX);

        const p2FirstLineY = 5.4 * CM;
        const p2LineSpacing = 1.0 * CM;
        const p2ValueWidth = PW - VPAD - PAD;

        const issueValues: string[] = [
          permit.placeOfIssue ?? '',
          permit.dateOfIssue ?? '',
          permit.dateOfExpiry ?? '',
          permit.classOfLicence ?? '',
          permit.certificateOfCompetence ?? '',
        ];

        let p2CurrentY = p2FirstLineY;
        issueValues.forEach((value, i) => {
          if (i > 0) {
            const prevWrapped = (issueValues[i - 1] ?? '').length > 20;
            p2CurrentY += prevWrapped ? 0.8 * CM : p2LineSpacing;
          }
          if (!value) {
            p2CurrentY += p2LineSpacing;
            return;
          }
          writeValue(value, OX + VPAD, p2CurrentY, p2ValueWidth);
        });
      }

      doc.end();
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${permit.referenceNumber}.pdf"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
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
    if (!current) {
      res.status(404).json({ error: 'Permit not found' });
      return;
    }

    const allowed = VALID_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(status)) {
      res
        .status(422)
        .json({ error: `Cannot transition permit from '${current.status}' to '${status}'` });
      return;
    }

    const permit = await prisma.permit.update({
      where: { id: String(req.params.id) },
      data: { status, ...(rejectionReason ? { rejectionReason } : {}) },
    });
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        operatorName: `${req.user?.firstName} ${req.user?.lastName}`,
        action: `STATUS_${status.toUpperCase()}`,
        outcome: 'success',
        details: `Permit ${permit.referenceNumber} → ${status}`,
        ipAddress: req.ip,
      },
    });
    res.json(permit);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update permit status' });
  }
}
