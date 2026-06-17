"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminLogin = adminLogin;
exports.confirmMfa = confirmMfa;
exports.setupMfa = setupMfa;
exports.verifyMfaSetup = verifyMfaSetup;
exports.disableMfa = disableMfa;
exports.getCurrentAdmin = getCurrentAdmin;
exports.changeAdminPassword = changeAdminPassword;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const qrcode_1 = __importDefault(require("qrcode"));
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../constants/permissions");
const PASSWORD_POLICY = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
// RFC 6238 TOTP — uses only Node's built-in crypto (no otplib runtime issues)
function base32Decode(encoded) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0, value = 0;
    const bytes = [];
    for (const char of encoded.replace(/=+$/, '').toUpperCase()) {
        const idx = alphabet.indexOf(char);
        if (idx < 0)
            continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return Buffer.from(bytes);
}
function totpGenerate(secret, window = 0) {
    const key = base32Decode(secret);
    const epoch = Math.floor(Date.now() / 1000);
    const step = Math.floor(epoch / 30) + window;
    const msg = Buffer.alloc(8);
    msg.writeBigUInt64BE(BigInt(step));
    const hmac = crypto_1.default.createHmac('sha1', key).update(msg).digest();
    const off = hmac[hmac.length - 1] & 0x0f;
    const code = (hmac.readUInt32BE(off) & 0x7fffffff) % 1000000;
    return code.toString().padStart(6, '0');
}
function totpCheck(token, secret) {
    return [-1, 0, 1].some(w => totpGenerate(secret, w) === token);
}
function totpGenerateSecret() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    return Array.from(crypto_1.default.randomBytes(20)).map(b => alphabet[b % 32]).join('');
}
function totpKeyUri(email, issuer, secret) {
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
function validatePassword(pw) {
    if (!PASSWORD_POLICY.test(pw))
        return 'Password must be at least 8 characters and include at least one uppercase letter and one number.';
    return null;
}
async function adminLogin(req, res) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'Email and password required' });
            return;
        }
        const admin = await database_1.default.adminUser.findUnique({
            where: { email },
            include: { role: { include: { permissions: true } } },
        });
        if (!admin || !admin.isActive) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const valid = await bcryptjs_1.default.compare(password, admin.password);
        if (!valid) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        // MFA check: if enabled, issue a 5-minute temp token
        if (admin.mfaEnabled) {
            const tempToken = (0, auth_1.generateToken)({ id: admin.id, mfaPending: true }, '5m');
            res.json({ mfaRequired: true, tempToken });
            return;
        }
        const permissions = (0, permissions_1.toPermissionNames)(admin.role.permissions.map(p => p.name));
        const payload = {
            id: admin.id, email: admin.email,
            firstName: admin.firstName, lastName: admin.lastName,
            dvlaRole: admin.dvlaRole, role: admin.role.name, permissions,
        };
        const token = (0, auth_1.generateToken)(payload);
        res.json({ token, user: payload });
    }
    catch (err) {
        console.error('adminLogin error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
}
async function confirmMfa(req, res) {
    try {
        const { tempToken, totpCode } = req.body;
        if (!tempToken || !totpCode) {
            res.status(400).json({ error: 'tempToken and totpCode required' });
            return;
        }
        const decoded = (0, auth_1.verifyToken)(tempToken);
        if (!decoded?.mfaPending) {
            res.status(401).json({ error: 'Invalid or expired token' });
            return;
        }
        const admin = await database_1.default.adminUser.findUnique({
            where: { id: decoded.id },
            include: { role: { include: { permissions: true } } },
        });
        if (!admin || !admin.isActive || !admin.mfaSecret) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const valid = totpCheck(String(totpCode), admin.mfaSecret);
        if (!valid) {
            res.status(401).json({ error: 'Invalid MFA code' });
            return;
        }
        const permissions = (0, permissions_1.toPermissionNames)(admin.role.permissions.map(p => p.name));
        const payload = {
            id: admin.id, email: admin.email,
            firstName: admin.firstName, lastName: admin.lastName,
            dvlaRole: admin.dvlaRole, role: admin.role.name, permissions,
        };
        const token = (0, auth_1.generateToken)(payload);
        res.json({ token, user: payload });
    }
    catch (err) {
        console.error('confirmMfa error:', err);
        res.status(500).json({ error: 'MFA confirmation failed' });
    }
}
async function setupMfa(req, res) {
    try {
        const secret = totpGenerateSecret();
        const otpAuthUrl = totpKeyUri(req.user.email, 'DVLA Ghana IDP', secret);
        const qrDataUrl = await qrcode_1.default.toDataURL(otpAuthUrl);
        // Store secret — not yet active until user verifies
        await database_1.default.adminUser.update({ where: { id: req.user.id }, data: { mfaSecret: secret } });
        res.json({ secret, qrDataUrl, otpAuthUrl });
    }
    catch (err) {
        console.error('setupMfa error:', err);
        res.status(500).json({ error: 'MFA setup failed' });
    }
}
async function verifyMfaSetup(req, res) {
    try {
        const { totpCode } = req.body;
        const admin = await database_1.default.adminUser.findUnique({ where: { id: req.user.id } });
        if (!admin?.mfaSecret) {
            res.status(400).json({ error: 'MFA setup not initiated' });
            return;
        }
        const valid = totpCheck(String(totpCode), admin.mfaSecret);
        if (!valid) {
            res.status(400).json({ error: 'Invalid TOTP code' });
            return;
        }
        await database_1.default.adminUser.update({ where: { id: admin.id }, data: { mfaEnabled: true } });
        res.json({ message: 'MFA enabled successfully' });
    }
    catch (err) {
        console.error('verifyMfaSetup error:', err);
        res.status(500).json({ error: 'MFA verification failed' });
    }
}
async function disableMfa(req, res) {
    try {
        const { password } = req.body;
        const admin = await database_1.default.adminUser.findUnique({ where: { id: req.user.id } });
        if (!admin) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const valid = await bcryptjs_1.default.compare(password, admin.password);
        if (!valid) {
            res.status(400).json({ error: 'Incorrect password' });
            return;
        }
        await database_1.default.adminUser.update({ where: { id: admin.id }, data: { mfaEnabled: false, mfaSecret: null } });
        res.json({ message: 'MFA disabled' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to disable MFA' });
    }
}
async function getCurrentAdmin(req, res) {
    try {
        const admin = await database_1.default.adminUser.findUnique({
            where: { id: req.user.id },
            select: { mfaEnabled: true },
        });
        res.json({ ...req.user, mfaEnabled: admin?.mfaEnabled ?? false });
    }
    catch {
        res.json(req.user);
    }
}
async function changeAdminPassword(req, res) {
    try {
        const { currentPassword, newPassword } = req.body;
        const policyErr = validatePassword(newPassword ?? '');
        if (policyErr) {
            res.status(400).json({ error: policyErr });
            return;
        }
        const admin = await database_1.default.adminUser.findUnique({ where: { id: req.user.id } });
        if (!admin) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const valid = await bcryptjs_1.default.compare(currentPassword, admin.password);
        if (!valid) {
            res.status(400).json({ error: 'Current password incorrect' });
            return;
        }
        const hashed = await bcryptjs_1.default.hash(newPassword, 10);
        await database_1.default.adminUser.update({ where: { id: admin.id }, data: { password: hashed } });
        res.json({ message: 'Password changed successfully' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to change password' });
    }
}
//# sourceMappingURL=authController.js.map