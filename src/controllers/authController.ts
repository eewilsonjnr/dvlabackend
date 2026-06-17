import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import qrcode from 'qrcode';
import prisma from '../config/database';
import { generateToken, verifyToken } from '../middleware/auth';
import { toPermissionNames } from '../constants/permissions';
import { AuthenticatedRequest } from '../types';
import { sendOtpEmail } from '../services/emailService';

const PASSWORD_POLICY = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

// RFC 6238 TOTP — uses only Node's built-in crypto (no otplib runtime issues)
function base32Decode(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (const char of encoded.replace(/=+$/, '').toUpperCase()) {
    const idx = alphabet.indexOf(char);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(bytes);
}

function totpGenerate(secret: string, window = 0): string {
  const key   = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const step  = Math.floor(epoch / 30) + window;
  const msg   = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const hmac  = crypto.createHmac('sha1', key).update(msg).digest();
  const off   = hmac[hmac.length - 1] & 0x0f;
  const code  = (hmac.readUInt32BE(off) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, '0');
}

function totpCheck(token: string, secret: string): boolean {
  return [-1, 0, 1].some(w => totpGenerate(secret, w) === token);
}

function totpGenerateSecret(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  return Array.from(crypto.randomBytes(20)).map(b => alphabet[b % 32]).join('');
}

function totpKeyUri(email: string, issuer: string, secret: string): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

function validatePassword(pw: string): string | null {
  if (!PASSWORD_POLICY.test(pw))
    return 'Password must be at least 8 characters and include at least one uppercase letter and one number.';
  return null;
}

export async function adminLogin(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ error: 'Email and password required' }); return; }

    const admin = await prisma.adminUser.findUnique({
      where: { email },
      include: {
        role: { include: { permissions: true } },
        office: { select: { id: true, name: true, type: true, regionName: true, town: true, placeOfIssueLabel: true } },
      },
    });

    if (!admin || !admin.isActive) { res.status(401).json({ error: 'Invalid credentials' }); return; }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) { res.status(401).json({ error: 'Invalid credentials' }); return; }

    // If TOTP MFA is enabled, require the authenticator code
    if (admin.mfaEnabled) {
      const tempToken = generateToken({ id: admin.id, mfaPending: true, mfaMethod: 'totp' }, '5m');
      res.json({ mfaRequired: true, mfaMethod: 'totp', tempToken });
      return;
    }

    // No TOTP set up — send an email OTP as the second factor for all roles
    const rawCode = String(Math.floor(100000 + Math.random() * 900000));
    const hashedCode = crypto.createHash('sha256').update(rawCode).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { emailOtpCode: hashedCode, emailOtpExpiresAt: expiresAt },
    });

    const otpDestination = admin.notificationEmail ?? admin.email;
    try {
      await sendOtpEmail(otpDestination, admin.firstName, rawCode);
    } catch (mailErr) {
      console.error('Failed to send OTP email:', mailErr);
    }

    const tempToken = generateToken({ id: admin.id, mfaPending: true, mfaMethod: 'email' }, '15m');
    res.json({
      mfaRequired: true,
      mfaMethod: 'email',
      tempToken,
      ...(process.env.NODE_ENV !== 'production' ? { otpSentTo: otpDestination } : {}),
    });
  } catch (err) {
    console.error('adminLogin error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
}

export async function confirmMfa(req: Request, res: Response): Promise<void> {
  try {
    const { tempToken, totpCode } = req.body;
    if (!tempToken || !totpCode) { res.status(400).json({ error: 'tempToken and totpCode required' }); return; }

    const decoded = verifyToken(tempToken) as any;
    if (!decoded?.mfaPending) { res.status(401).json({ error: 'Invalid or expired token' }); return; }

    const admin = await prisma.adminUser.findUnique({
      where: { id: decoded.id },
      include: {
        role: { include: { permissions: true } },
        office: { select: { id: true, name: true, type: true, regionName: true, town: true, placeOfIssueLabel: true } },
      },
    });
    if (!admin || !admin.isActive) { res.status(401).json({ error: 'Invalid credentials' }); return; }

    const method: string = decoded.mfaMethod ?? 'totp';

    if (method === 'totp') {
      // Verify against the user's TOTP authenticator app secret
      if (!admin.mfaSecret) { res.status(401).json({ error: 'TOTP not configured' }); return; }
      if (!totpCheck(String(totpCode), admin.mfaSecret)) {
        res.status(401).json({ error: 'Invalid authenticator code' }); return;
      }
    } else {
      // Verify against the emailed OTP
      if (!admin.emailOtpCode || !admin.emailOtpExpiresAt) {
        res.status(401).json({ error: 'No email OTP was issued — please log in again' }); return;
      }
      if (new Date() > admin.emailOtpExpiresAt) {
        res.status(401).json({ error: 'Email code has expired — please log in again' }); return;
      }
      const inputHash = crypto.createHash('sha256').update(String(totpCode)).digest('hex');
      if (inputHash !== admin.emailOtpCode) {
        res.status(401).json({ error: 'Invalid email code' }); return;
      }
      // Invalidate the code after successful use
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { emailOtpCode: null, emailOtpExpiresAt: null },
      });
    }

    const permissions = toPermissionNames(admin.role.permissions.map(p => p.name));
    const payload = {
      id: admin.id, email: admin.email,
      firstName: admin.firstName, lastName: admin.lastName,
      dvlaRole: admin.dvlaRole, role: admin.role.name, permissions,
      officeId: admin.officeId ?? null,
      office: admin.office ?? null,
    };
    const token = generateToken(payload);
    res.json({ token, user: payload });
  } catch (err) {
    console.error('confirmMfa error:', err);
    res.status(500).json({ error: 'MFA confirmation failed' });
  }
}

export async function setupMfa(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const secret = totpGenerateSecret();
    const otpAuthUrl = totpKeyUri(req.user!.email, 'DVLA Ghana IDP', secret);
    const qrDataUrl = await qrcode.toDataURL(otpAuthUrl);

    // Store secret — not yet active until user verifies
    await prisma.adminUser.update({ where: { id: req.user!.id }, data: { mfaSecret: secret } });
    res.json({ secret, qrDataUrl, otpAuthUrl });
  } catch (err) {
    console.error('setupMfa error:', err);
    res.status(500).json({ error: 'MFA setup failed' });
  }
}

export async function verifyMfaSetup(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { totpCode } = req.body;
    const admin = await prisma.adminUser.findUnique({ where: { id: req.user!.id } });
    if (!admin?.mfaSecret) { res.status(400).json({ error: 'MFA setup not initiated' }); return; }

    const valid = totpCheck(String(totpCode), admin.mfaSecret);
    if (!valid) { res.status(400).json({ error: 'Invalid TOTP code' }); return; }

    await prisma.adminUser.update({ where: { id: admin.id }, data: { mfaEnabled: true } });
    res.json({ message: 'MFA enabled successfully' });
  } catch (err) {
    console.error('verifyMfaSetup error:', err);
    res.status(500).json({ error: 'MFA verification failed' });
  }
}

export async function disableMfa(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { password } = req.body;
    const admin = await prisma.adminUser.findUnique({ where: { id: req.user!.id } });
    if (!admin) { res.status(404).json({ error: 'User not found' }); return; }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) { res.status(400).json({ error: 'Incorrect password' }); return; }

    await prisma.adminUser.update({ where: { id: admin.id }, data: { mfaEnabled: false, mfaSecret: null } });
    res.json({ message: 'MFA disabled' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disable MFA' });
  }
}

export async function getCurrentAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const admin = await prisma.adminUser.findUnique({
      where: { id: req.user!.id },
      select: {
        mfaEnabled: true,
        office: { select: { id: true, name: true, type: true, regionName: true, town: true, placeOfIssueLabel: true } },
      },
    });
    res.json({ ...req.user, mfaEnabled: admin?.mfaEnabled ?? false, office: admin?.office ?? null });
  } catch {
    res.json(req.user);
  }
}

export async function changeAdminPassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body;
    const policyErr = validatePassword(newPassword ?? '');
    if (policyErr) { res.status(400).json({ error: policyErr }); return; }

    const admin = await prisma.adminUser.findUnique({ where: { id: req.user!.id } });
    if (!admin) { res.status(404).json({ error: 'User not found' }); return; }

    const valid = await bcrypt.compare(currentPassword, admin.password);
    if (!valid) { res.status(400).json({ error: 'Current password incorrect' }); return; }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.adminUser.update({ where: { id: admin.id }, data: { password: hashed } });
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password' });
  }
}
