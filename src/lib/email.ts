import nodemailer from "nodemailer";
import { existsSync, readFileSync } from "fs";
import path from "path";

interface EmailAttachment {
  name: string;
  contentType: string;
  contentBytes: string; // Base64 encoded
}

interface SendEmailParams {
  accessToken?: string; // kept for API compatibility but no longer used
  to: string[];
  cc?: string[];
  subject: string;
  htmlBody: string;
  attachments?: EmailAttachment[];
}

const DEFAULT_RENIFY_CC_EMAIL = "zabi@renify.com.au";
const LOGO_CID = "renify-logo";

// SMTP transporter using Hostinger
function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.hostinger.com",
    port: parseInt(process.env.SMTP_PORT || "465", 10),
    secure: true, // SSL
    auth: {
      user: process.env.SMTP_USER || "est@renify.com.au",
      pass: process.env.SMTP_PASS || "",
    },
  });
}

function getAuditCcEmail(): string {
  return (process.env.RENIFY_AUDIT_CC_EMAIL || DEFAULT_RENIFY_CC_EMAIL).trim();
}

function dedupeRecipients(recipients: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const recipient of recipients) {
    const email = recipient.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(email);
  }

  return result;
}

function getCcRecipients(to: string[], cc: string[] = []): string[] {
  const toSet = new Set(to.map((recipient) => recipient.trim().toLowerCase()).filter(Boolean));
  return dedupeRecipients([...cc, getAuditCcEmail()]).filter(
    (recipient) => !toSet.has(recipient.toLowerCase())
  );
}

function getLogoBuffer(): Buffer | null {
  const logoPath = path.join(process.cwd(), "public", "renify_logo.png");
  if (!existsSync(logoPath)) return null;
  return readFileSync(logoPath);
}

function renderBrandedEmail(htmlBody: string, includeLogo: boolean): string {
  const brandMark = includeLogo
    ? `<img src="cid:${LOGO_CID}" alt="Renify" width="128" style="display:block;width:128px;max-width:128px;height:auto;" />`
    : `<div style="font-size:22px;font-weight:700;letter-spacing:4px;color:#222;">RENIFY</div>`;

  return `
    <div style="margin:0;padding:0;background:#f6f7f7;font-family:Arial,Helvetica,sans-serif;color:#222;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;">
        <div style="padding:24px 28px 18px;border-bottom:4px solid #2D5E3A;">
          ${brandMark}
        </div>
        <div style="padding:26px 28px 30px;font-size:15px;line-height:1.55;">
          ${htmlBody}
        </div>
      </div>
    </div>
  `;
}

// Send an email via SMTP from est@renify.com.au
export async function sendEmail({
  to,
  cc,
  subject,
  htmlBody,
  attachments = [],
}: SendEmailParams): Promise<void> {
  const transporter = getTransporter();
  const ccRecipients = getCcRecipients(to, cc);
  const logoBuffer = getLogoBuffer();

  await transporter.sendMail({
    from: `"Renify Estimating" <${process.env.SMTP_USER || "est@renify.com.au"}>`,
    to: dedupeRecipients(to).join(", "),
    ...(ccRecipients.length > 0 ? { cc: ccRecipients.join(", ") } : {}),
    subject,
    html: renderBrandedEmail(htmlBody, Boolean(logoBuffer)),
    attachments: [
      ...(logoBuffer
        ? [{
            filename: "renify_logo.png",
            content: logoBuffer,
            contentType: "image/png",
            cid: LOGO_CID,
          }]
        : []),
      ...attachments.map((att) => ({
        filename: att.name,
        content: Buffer.from(att.contentBytes, "base64"),
        contentType: att.contentType,
      })),
    ],
  });
}

// Send email with rate limiting (1 second delay between sends)
export async function sendEmailBatch(
  accessToken: string,
  emails: Omit<SendEmailParams, "accessToken">[]
): Promise<{ sent: number; failed: { index: number; error: string }[] }> {
  const results = { sent: 0, failed: [] as { index: number; error: string }[] };

  for (let i = 0; i < emails.length; i++) {
    try {
      await sendEmail(emails[i]);
      results.sent++;
    } catch {
      // Retry once on transient errors
      try {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await sendEmail(emails[i]);
        results.sent++;
        continue;
      } catch (retryError: unknown) {
        const retryMsg = retryError instanceof Error ? retryError.message : "Retry failed";
        results.failed.push({ index: i, error: retryMsg });
        continue;
      }
    }

    // Rate limiting: 1 second delay between sends
    if (i < emails.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}
