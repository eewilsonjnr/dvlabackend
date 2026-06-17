export declare const PERMISSIONS: {
    readonly VIEW_DASHBOARD: "VIEW_DASHBOARD";
    readonly VIEW_APPLICANTS: "VIEW_APPLICANTS";
    readonly CREATE_APPLICANT: "CREATE_APPLICANT";
    readonly UPDATE_APPLICANT: "UPDATE_APPLICANT";
    readonly DELETE_APPLICANT: "DELETE_APPLICANT";
    readonly VIEW_PERMITS: "VIEW_PERMITS";
    readonly CREATE_PERMIT: "CREATE_PERMIT";
    readonly APPROVE_PERMIT: "APPROVE_PERMIT";
    readonly MANAGE_PRINT: "MANAGE_PRINT";
    readonly MANAGE_RFID: "MANAGE_RFID";
    readonly MANAGE_QC: "MANAGE_QC";
    readonly VIEW_AUDIT_LOGS: "VIEW_AUDIT_LOGS";
    readonly EXPORT_AUDIT: "EXPORT_AUDIT";
    readonly MANAGE_USERS: "MANAGE_USERS";
    readonly MANAGE_SETTINGS: "MANAGE_SETTINGS";
    readonly UPLOAD_BIOMETRIC: "UPLOAD_BIOMETRIC";
};
export type PermissionName = typeof PERMISSIONS[keyof typeof PERMISSIONS];
export declare function hasAnyPermission(userPerms: PermissionName[], required: PermissionName[]): boolean;
export declare function toPermissionNames(names: string[]): PermissionName[];
//# sourceMappingURL=permissions.d.ts.map