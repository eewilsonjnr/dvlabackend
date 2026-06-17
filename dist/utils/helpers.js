"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRef = generateRef;
exports.generateMRZ = generateMRZ;
exports.generateContractNumber = generateContractNumber;
function generateRef(type) {
    const year = new Date().getFullYear();
    const rand = Math.floor(Math.random() * 900000) + 100000;
    return `GH-${type}-${year}-${rand}`;
}
function generateMRZ(surname, otherNames, dateOfBirth, dateOfExpiry, licenceNumber) {
    const pad = (s, n) => s.toUpperCase().replace(/[^A-Z0-9]/g, '<').padEnd(n, '<').slice(0, n);
    const line1 = `P<GHA${pad(surname, 39)}`.padEnd(44, '<').slice(0, 44);
    const dob = dateOfBirth.replace(/-/g, '').slice(2, 8) || '000000';
    const exp = dateOfExpiry.replace(/-/g, '').slice(2, 8) || '000000';
    const line2 = `${pad(licenceNumber, 9)}0GHA${dob}0M${exp}0`.padEnd(44, '<').slice(0, 44);
    return { line1, line2 };
}
function generateContractNumber(prefix = 'DVLA') {
    const ts = Date.now().toString().slice(-8);
    return `${prefix}-${ts}`;
}
//# sourceMappingURL=helpers.js.map