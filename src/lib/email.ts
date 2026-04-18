import nodemailer from "nodemailer";

interface EmailAttachment {
  name: string;
  contentType: string;
  contentBytes: string; // Base64 encoded
}

interface SendEmailParams {
  accessToken?: string; // kept for API compatibility but no longer used
  to: string[];
  subject: string;
  htmlBody: string;
  attachments?: EmailAttachment[];
}

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

// Send an email via SMTP from est@renify.com.au
export async function sendEmail({
  to,
  subject,
  htmlBody,
  attachments = [],
}: SendEmailParams): Promise<void> {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: `"Renify Estimating" <${process.env.SMTP_USER || "est@renify.com.au"}>`,
    to: to.join(", "),
    subject,
    html: htmlBody,
    attachments: attachments.map((att) => ({
      filename: att.name,
      content: Buffer.from(att.contentBytes, "base64"),
      contentType: att.contentType,
    })),
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
