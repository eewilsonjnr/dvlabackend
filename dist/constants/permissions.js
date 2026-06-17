"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSIONS = void 0;
exports.hasAnyPermission = hasAnyPermission;
exports.toPermissionNames = toPermissionNames;
exports.PERMISSIONS = {
    VIEW_DASHBOARD: 'VIEW_DASHBOARD',
    VIEW_APPLICANTS: 'VIEW_APPLICANTS',
    CREATE_APPLICANT: 'CREATE_APPLICANT',
    UPDATE_APPLICANT: 'UPDATE_APPLICANT',
    DELETE_APPLICANT: 'DELETE_APPLICANT',
    VIEW_PERMITS: 'VIEW_PERMITS',
    CREATE_PERMIT: 'CREATE_PERMIT',
    APPROVE_PERMIT: 'APPROVE_PERMIT',
    MANAGE_PRINT: 'MANAGE_PRINT',
    MANAGE_RFID: 'MANAGE_RFID',
    MANAGE_QC: 'MANAGE_QC',
    VIEW_AUDIT_LOGS: 'VIEW_AUDIT_LOGS',
    EXPORT_AUDIT: 'EXPORT_AUDIT',
    MANAGE_USERS: 'MANAGE_USERS',
    MANAGE_SETTINGS: 'MANAGE_SETTINGS',
    UPLOAD_BIOMETRIC: 'UPLOAD_BIOMETRIC',
};
function hasAnyPermission(userPerms, required) {
    return required.some(p => userPerms.includes(p));
}
function toPermissionNames(names) {
    return names.filter(n => Object.values(exports.PERMISSIONS).includes(n));
}
//# sourceMappingURL=permissions.js.map