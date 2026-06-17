"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = void 0;
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
exports.authenticateAdmin = authenticateAdmin;
exports.requireAnyPermission = requireAnyPermission;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importDefault(require("../config/database"));
const permissions_1 = require("../constants/permissions");
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
function generateToken(payload, expiresIn = '7d') {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn });
}
function verifyToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch {
        return null;
    }
}
async function authenticateAdmin(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Access token required' });
            return;
        }
        const token = authHeader.split(' ')[1];
        const payload = verifyToken(token);
        if (!payload) {
            res.status(401).json({ error: 'Invalid or expired token' });
            return;
        }
        if (payload.mfaPending) {
            res.status(401).json({ error: 'MFA verification required' });
            return;
        }
        const admin = await database_1.default.adminUser.findUnique({
            where: { id: payload.id },
            include: { role: { include: { permissions: true } } },
        });
        if (!admin || !admin.isActive) {
            res.status(401).json({ error: 'User not found or inactive' });
            return;
        }
        req.user = {
            id: admin.id,
            email: admin.email,
            firstName: admin.firstName,
            lastName: admin.lastName,
            dvlaRole: admin.dvlaRole,
            role: admin.role.name,
            permissions: (0, permissions_1.toPermissionNames)(admin.role.permissions.map(p => p.name)),
        };
        next();
    }
    catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
}
function requireAnyPermission(...permissions) {
    return (req, res, next) => {
        const user = req.user;
        if (!user) {
            res.status(403).json({ error: 'Admin access required' });
            return;
        }
        if (user.role === 'ADMINISTRATOR') {
            next();
            return;
        }
        if (!(0, permissions_1.hasAnyPermission)(user.permissions, permissions)) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        next();
    };
}
exports.requirePermission = requireAnyPermission;
//# sourceMappingURL=auth.js.map