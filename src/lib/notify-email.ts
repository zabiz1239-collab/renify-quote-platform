import { sendEmail } from "./email";
import type { Job, Estimator } from "@/types";

// Send notification when a quote is received (server-only)
export async function notifyQuoteReceived(
  _accessToken: string,
  estimator: Estimator,
  jobCode: string,
  tradeName: string,
  supplierName: string,
  priceExGST?: number
): Promise<void> {
  const priceStr = priceExGST ? ` — $${priceExGST.toLocaleString()} ex GST` : "";

  await sendEmail({
    to: [estimator.email],
    subject: `Quote received — ${tradeName} — ${jobCode}`,
    htmlBody: `<p>A quote has been received for <strong>${tradeName}</strong> on job <strong>${jobCode}</strong>.</p>
<p><strong>Supplier:</strong> ${supplierName}${priceStr}</p>
<p>Log in to the Renify Quote Platform to review.</p>`,
  });
}

// Send milestone notification when all trades for a job are quoted (server-only)
export async function notifyMilestone(
  _accessToken: string,
  adminEmail: string,
  job: Job
): Promise<void> {
  if (!adminEmail) return;

  await sendEmail({
    to: [adminEmail],
    subject: `${job.jobCode} is fully quoted and ready for tender compilation`,
    htmlBody: `<p>All trades for <strong>${job.jobCode} — ${job.address}</strong> now have at least one received quote.</p>
<p>The job is ready for tender compilation.</p>
<p>Log in to the Renify Quote Platform to review all quotes.</p>`,
  });
}
