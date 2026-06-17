import { Response } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { PERMISSIONS } from '../constants/permissions';

// Return full hierarchy: HQ → Regionals (with children) → Districts
// ?flat=true   — returns all offices as a flat array (for admin assignment dropdowns, includes HQ)
// ?flat=true&forDropdown=true — flat list excluding HEAD_OFFICE (for place-of-issue dropdowns)
export async function listOffices(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { type, flat, forDropdown } = req.query;
    const where: Record<string, unknown> = {};
    if (type) where.type = String(type);
    if (forDropdown === 'true') where.type = { not: 'HEAD_OFFICE' };

    const offices = await prisma.dvlaOffice.findMany({
      where,
      include: {
        parentOffice: { select: { id: true, name: true, type: true } },
        childOffices: {
          orderBy: { name: 'asc' },
          include: { childOffices: { orderBy: { name: 'asc' } } },
        },
        _count: { select: { adminUsers: true, permits: true } },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    if (flat === 'true') {
      res.json(offices);
      return;
    }

    // Return tree: HQ at root, regionals nested, districts nested under regional
    const hq = offices.filter(o => o.type === 'HEAD_OFFICE');
    res.json(hq.length === 1 ? hq[0] : offices);
  } catch (err) { res.status(500).json({ error: 'Failed to list offices' }); }
}

export async function getOffice(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const office = await prisma.dvlaOffice.findUnique({
      where: { id: String(req.params.id) },
      include: {
        parentOffice: true,
        childOffices: { include: { childOffices: true } },
        _count: { select: { adminUsers: true, permits: true } },
      },
    });
    if (!office) { res.status(404).json({ error: 'Office not found' }); return; }
    res.json(office);
  } catch (err) { res.status(500).json({ error: 'Failed to get office' }); }
}

export async function createOffice(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, type, regionName, town, address, phone, placeOfIssueLabel, printerName, parentOfficeId } = req.body;
    if (!name || !type) { res.status(400).json({ error: 'name and type are required' }); return; }

    // Only HQ can exist — prevent duplicate head offices
    if (type === 'HEAD_OFFICE') {
      const existing = await prisma.dvlaOffice.findFirst({ where: { type: 'HEAD_OFFICE' } });
      if (existing) { res.status(409).json({ error: 'Head office already exists' }); return; }
    }

    const office = await prisma.dvlaOffice.create({
      data: { name, type, regionName, town, address, phone, placeOfIssueLabel, printerName, parentOfficeId },
    });
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id, operatorName: `${req.user?.firstName} ${req.user?.lastName}`,
        action: 'CREATE_OFFICE', outcome: 'success',
        details: `Created DVLA office: ${office.name} (${office.type})`,
        ipAddress: req.ip,
      },
    });
    res.status(201).json(office);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create office' });
  }
}

export async function updateOffice(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const { name, regionName, town, address, phone, placeOfIssueLabel, printerName, parentOfficeId, isActive } = req.body;

    const office = await prisma.dvlaOffice.update({
      where: { id },
      data: { name, regionName, town, address, phone, placeOfIssueLabel, printerName, parentOfficeId, isActive },
    });
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id, operatorName: `${req.user?.firstName} ${req.user?.lastName}`,
        action: 'UPDATE_OFFICE', outcome: 'success',
        details: `Updated DVLA office: ${office.name}`,
        ipAddress: req.ip,
      },
    });
    res.json(office);
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Office not found' }); return; }
    res.status(500).json({ error: 'Failed to update office' });
  }
}

// Soft-delete (deactivate) — never hard-delete due to permit audit trail
export async function deactivateOffice(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const existing = await prisma.dvlaOffice.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Office not found' }); return; }
    if (existing.type === 'HEAD_OFFICE') { res.status(403).json({ error: 'Cannot deactivate head office' }); return; }

    await prisma.dvlaOffice.update({ where: { id }, data: { isActive: false } });
    res.json({ message: 'Office deactivated' });
  } catch (err) { res.status(500).json({ error: 'Failed to deactivate office' }); }
}

// Get offices scoped to a user's region (for place-of-issue dropdowns)
// Excludes HEAD_OFFICE — it is not a valid place of issue for permits
export async function listOfficesByRegion(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { regionName } = req.query;
    const offices = await prisma.dvlaOffice.findMany({
      where: {
        isActive: true,
        type: { not: 'HEAD_OFFICE' },
        ...(regionName ? { regionName: String(regionName) } : {}),
      },
      select: { id: true, name: true, type: true, regionName: true, town: true, placeOfIssueLabel: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    res.json(offices);
  } catch (err) { res.status(500).json({ error: 'Failed to list offices by region' }); }
}

// Stats per office — any authenticated user may view their own office; MANAGE_CENTRES required for others
export async function getOfficeStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const officeId = String(req.params.id);
    const user = req.user!;
    const isHQ = user.role === 'ADMINISTRATOR' || !user.officeId;
    const isOwnOffice = user.officeId === officeId;

    if (!isHQ && !isOwnOffice && !user.permissions.includes(PERMISSIONS.MANAGE_CENTRES)) {
      res.status(403).json({ error: 'Access denied — MANAGE_CENTRES permission required to view other offices' });
      return;
    }

    const office = await prisma.dvlaOffice.findUnique({ where: { id: officeId } });
    if (!office) { res.status(404).json({ error: 'Office not found' }); return; }

    const [totalPermits, pending, approved, issued, operators] = await Promise.all([
      prisma.permit.count({ where: { officeId } }),
      prisma.permit.count({ where: { officeId, status: 'submitted' } }),
      prisma.permit.count({ where: { officeId, status: 'approved' } }),
      prisma.permit.count({ where: { officeId, status: 'issued' } }),
      prisma.adminUser.count({ where: { officeId, isActive: true } }),
    ]);

    res.json({ office, stats: { totalPermits, pending, approved, issued, operators } });
  } catch (err) { res.status(500).json({ error: 'Failed to get office stats' }); }
}
