import { sendEmail } from "./email";
import type { Job, Estimator } from "@/types";

// Send notification when a quote is received
export async function notifyQuoteReceived(
  accessToken: string,
  estimator: Estimator,
  jobCode: string,
  tradeName: string,
  supplierName: string,
  priceExGST?: number
): Promise<void> {
  const priceStr = priceExGST ? ` — $${priceExGST.toLocaleString()} ex GST` : "";

  await sendEmail({
    accessToken,
    to: [estimator.email],
    subject: `Quote received — ${tradeName} — ${jobCode}`,
    htmlBody: `<p>A quote has been received for <strong>${tradeName}</strong> on job <strong>${jobCode}</strong>.</p>
<p><strong>Supplier:</strong> ${supplierName}${priceStr}</p>
<p>Log in to the Renify Quote Platform to review.</p>`,
  });
}

// Send milestone notification when all trades for a job are quoted
export async function notifyMilestone(
  accessToken: string,
  adminEmail: string,
  job: Job
): Promise<void> {
  if (!adminEmail) return;

  await sendEmail({
    accessToken,
    to: [adminEmail],
    subject: `${job.jobCode} is fully quoted and ready for tender compilation`,
    htmlBody: `<p>All trades for <strong>${job.jobCode} — ${job.address}</strong> now have at least one received quote.</p>
<p>The job is ready for tender compilation.</p>
<p>Log in to the Renify Quote Platform to review all quotes.</p>`,
  });
}

// Check if all quotable trades have at least one received/accepted quote
export function isJobFullyQuoted(job: Job): boolean {
  if (!job.trades || job.trades.length === 0) return false;
  return job.trades.every((trade) =>
    trade.quotes?.some(
      (q) => q.status === "received" || q.status === "accepted"
    )
  );
}

// Get quotes that are expiring within the given number of days
export function getExpiringQuotes(
  job: Job,
  warningDays: number[]
): { tradeCode: string; tradeName: string; supplierName: string; expiryDate: string; daysUntilExpiry: number; severity: "warning" | "danger" | "expired" }[] {
  const results: { tradeCode: string; tradeName: string; supplierName: string; expiryDate: string; daysUntilExpiry: number; severity: "warning" | "danger" | "expired" }[] = [];
  const now = Date.now();
  const sortedWarnings = [...warningDays].sort((a, b) => a - b);

  for (const trade of job.trades || []) {
    for (const quote of trade.quotes || []) {
      if (!quote.quoteExpiry) continue;
      if (quote.status !== "received" && quote.status !== "accepted") continue;

      const expiryTime = new Date(quote.quoteExpiry).getTime();
      const daysUntilExpiry = Math.floor((expiryTime - now) / (1000 * 60 * 60 * 24));

      let severity: "warning" | "danger" | "expired" = "warning";
      if (daysUntilExpiry < 0) {
        severity = "expired";
      } else if (daysUntilExpiry <= (sortedWarnings[0] || 30)) {
        severity = "danger";
      }

      // Only include if within the highest warning threshold or expired
      if (daysUntilExpiry <= (sortedWarnings[sortedWarnings.length - 1] || 90)) {
        results.push({
          tradeCode: trade.code,
          tradeName: trade.name,
          supplierName: quote.supplierName,
          expiryDate: quote.quoteExpiry,
          daysUntilExpiry,
          severity,
        });
      }
    }
  }

  return results.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}
