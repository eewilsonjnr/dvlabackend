import prisma from '../config/database';
import { AdminUserPayload } from '../types';

export type ScopeLevel = 'national' | 'regional' | 'office';

export interface ScopeInfo {
  level: ScopeLevel;
  officeIds: string[] | null; // null = no filter (national)
  regionName: string | null;
  officeId: string | null;
}

// Resolve which office IDs a user can see based on their office type.
// HEAD_OFFICE   → national (no filter)
// REGIONAL_CENTRE → all offices in their region
// DISTRICT_OFFICE → own office only
// Unassigned    → national (treat same as HQ for backward compat)
export async function resolveScope(user: AdminUserPayload): Promise<ScopeInfo> {
  const officeType = user.office?.type;

  // HEAD_OFFICE administrators see everything; all others are office-scoped
  if (!user.officeId || !officeType) {
    return { level: 'national', officeIds: null, regionName: null, officeId: null };
  }

  if (officeType === 'HEAD_OFFICE') {
    if (user.role === 'ADMINISTRATOR') {
      return { level: 'national', officeIds: null, regionName: null, officeId: null };
    }
    // HEAD_OFFICE non-administrators see only head office data
    return { level: 'office', officeIds: [user.officeId], regionName: null, officeId: user.officeId };
  }

  if (officeType === 'REGIONAL_CENTRE') {
    const regionName = user.office?.regionName ?? null;
    if (!regionName) {
      // Regional centre with no region — fall back to own office
      return { level: 'office', officeIds: [user.officeId], regionName: null, officeId: user.officeId };
    }
    const offices = await prisma.dvlaOffice.findMany({
      where: { regionName, isActive: true },
      select: { id: true },
    });
    return {
      level: 'regional',
      officeIds: offices.map(o => o.id),
      regionName,
      officeId: user.officeId,
    };
  }

  // DISTRICT_OFFICE — own office only
  return { level: 'office', officeIds: [user.officeId], regionName: null, officeId: user.officeId };
}

// Build a Prisma `where` clause fragment that filters by officeId.
// Pass `field` as the key name (default 'officeId') for direct models,
// or use nestedField for relations like permit jobs (e.g. { permit: { officeId: ... } }).
export function permitOfficeWhere(scope: ScopeInfo, field = 'officeId'): Record<string, unknown> {
  if (scope.officeIds === null) return {}; // national — no filter
  if (scope.officeIds.length === 1) return { [field]: scope.officeIds[0] };
  return { [field]: { in: scope.officeIds } };
}

// For models that join through permit (printJob, rfidEncoding, qcResult)
export function nestedPermitOfficeWhere(scope: ScopeInfo): Record<string, unknown> {
  if (scope.officeIds === null) return {};
  if (scope.officeIds.length === 1) return { permit: { officeId: scope.officeIds[0] } };
  return { permit: { officeId: { in: scope.officeIds } } };
}
