import nodemailer from 'nodemailer';


function createTransport() {
  const port = parseInt(process.env.SMTP_PORT ?? '465', 10);
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendOtpEmail(recipientEmail: string, name: string, code: string): Promise<void> {
  const to = recipientEmail;

  const transporter = createTransport();

  await transporter.sendMail({
    from:    process.env.SMTP_FROM ?? '"DVLA Ghana IDP" <noreply@dvla.gov.gh>',
    to,
    subject: 'Your DVLA Login Verification Code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <div style="background:#0a1f44;padding:20px 24px;border-radius:6px 6px 0 0">
          <p style="color:#FCD116;font-size:11px;font-weight:700;letter-spacing:2px;margin:0">REPUBLIC OF GHANA</p>
          <p style="color:#fff;font-size:18px;font-weight:900;margin:4px 0 0">DVLA Ghana — IDP/ICMV System</p>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 6px 6px;padding:28px 24px">
          <p style="color:#374151;margin:0 0 16px">Hello <strong>${name}</strong>,</p>
          <p style="color:#374151;margin:0 0 24px">
            Your one-time verification code for DVLA portal login is:
          </p>
          <div style="background:#f3f4f6;border:2px dashed #d1d5db;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px">
            <span style="font-size:36px;font-weight:900;letter-spacing:12px;color:#0a1f44;font-family:monospace">${code}</span>
          </div>
          <p style="color:#6b7280;font-size:13px;margin:0 0 8px">
            This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
          </p>
          <p style="color:#6b7280;font-size:13px;margin:0">
            If you did not attempt to log in, please contact your system administrator immediately.
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
          <p style="color:#9ca3af;font-size:11px;margin:0">
            Driver and Vehicle Licensing Authority, Ghana &bull; Authorised personnel only
          </p>
        </div>
      </div>
    `,
  });
}
