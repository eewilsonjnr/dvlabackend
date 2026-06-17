import { Request } from 'express';
import type { PermissionName } from '../constants/permissions';

export interface OfficeSnapshot {
  id: string;
  name: string;
  type: string;
  regionName: string | null;
  town: string | null;
  placeOfIssueLabel: string | null;
}

export interface AdminUserPayload {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  dvlaRole: string;
  role: string;
  permissions: PermissionName[];
  officeId: string | null;
  office: OfficeSnapshot | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AdminUserPayload;
}
