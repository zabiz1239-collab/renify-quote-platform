import { getGraphClient } from "./onedrive";

interface EmailAttachment {
  name: string;
  contentType: string;
  contentBytes: string; // Base64 encoded
}

interface SendEmailParams {
  accessToken: string;
  to: string[];
  subject: string;
  htmlBody: string;
  attachments?: EmailAttachment[];
}

// Send an email via Microsoft Graph API from the authenticated user's account
export async function sendEmail({
  accessToken,
  to,
  subject,
  htmlBody,
  attachments = [],
}: SendEmailParams): Promise<void> {
  const client = getGraphClient(accessToken);

  const message = {
    message: {
      subject,
      body: {
        contentType: "HTML",
        content: htmlBody,
      },
      toRecipients: to.map((email) => ({
        emailAddress: { address: email },
      })),
      attachments: attachments.map((att) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: att.name,
        contentType: att.contentType,
        contentBytes: att.contentBytes,
      })),
    },
    saveToSentItems: true,
  };

  await client.api("/me/sendMail").post(message);
}

// Send email with rate limiting (1 second delay between sends)
export async function sendEmailBatch(
  accessToken: string,
  emails: Omit<SendEmailParams, "accessToken">[]
): Promise<{ sent: number; failed: { index: number; error: string }[] }> {
  const results = { sent: 0, failed: [] as { index: number; error: string }[] };

  for (let i = 0; i < emails.length; i++) {
    try {
      await sendEmail({ accessToken, ...emails[i] });
      results.sent++;
    } catch (error: unknown) {
      const graphError = error as { statusCode?: number; headers?: Record<string, string>; message?: string };

      // Handle throttling
      if (graphError.statusCode === 429) {
        const retryAfter = parseInt(graphError.headers?.["Retry-After"] || "10", 10);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        // Retry once after backoff
        try {
          await sendEmail({ accessToken, ...emails[i] });
          results.sent++;
          continue;
        } catch (retryError: unknown) {
          const retryMsg = retryError instanceof Error ? retryError.message : "Retry failed";
          results.failed.push({ index: i, error: retryMsg });
          continue;
        }
      }

      results.failed.push({
        index: i,
        error: graphError.message || "Unknown error",
      });
    }

    // Rate limiting: 1 second delay between sends
    if (i < emails.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}
