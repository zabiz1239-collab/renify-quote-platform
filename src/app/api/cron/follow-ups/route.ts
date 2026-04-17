import { NextRequest, NextResponse } from "next/server";
import { getSettings, getSuppliers, getEstimators, getTemplates, getJobs, saveJob } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { renderTemplate, findTemplate } from "@/lib/templates";
import type { EmailTemplate } from "@/types";

const CRON_SECRET = process.env.CRON_SECRET;

async function getServiceAccessToken(): Promise<string | null> {
  const refreshToken = process.env.CRON_REFRESH_TOKEN;
  if (!refreshToken) return null;

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const response = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          scope: "openid profile email offline_access User.Read Files.ReadWrite.All Mail.Send",
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) {
      console.error("[Cron] Token refresh failed:", data.error, data.error_description);
      return null;
    }
    return data.access_token;
  } catch (err) {
    console.error("[Cron] Token refresh error:", err);
    return null;
  }
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get access token via stored refresh token
  const accessToken = await getServiceAccessToken();
  if (!accessToken) {
    console.warn("[Cron] No CRON_REFRESH_TOKEN configured — skipping follow-ups");
    return NextResponse.json({
      message: "Skipped — no CRON_REFRESH_TOKEN configured. Set this env var to enable auto follow-ups.",
      timestamp: new Date().toISOString(),
    });
  }

  // Run the same logic as POST
  const settings = await getSettings();
  const followUpDays = settings?.followUpDays || { first: 7, second: 14 };

  const [suppliers, estimators, templates, jobs] = await Promise.all([
    getSuppliers(),
    getEstimators(),
    getTemplates(),
    getJobs(),
  ]);

  let followUpsSent = 0;
  const errors: string[] = [];

  for (const job of jobs) {
    if (job.status !== "active" && job.status !== "quoting") continue;

    const estimator = estimators.find((e) => e.id === job.estimatorId) || estimators[0];
    if (!estimator) continue;

    let jobUpdated = false;

    for (const trade of job.trades || []) {
      for (const quote of trade.quotes || []) {
        if (quote.status !== "requested" || !quote.requestedDate) continue;

        const daysElapsed = Math.floor(
          (Date.now() - new Date(quote.requestedDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        let templateType: string | null = null;

        if (quote.followUpCount === 0 && daysElapsed >= followUpDays.first) {
          templateType = "followup_1";
        } else if (quote.followUpCount === 1 && daysElapsed >= followUpDays.second) {
          templateType = "followup_2";
        }

        if (!templateType || quote.followUpCount >= 2) continue;

        const supplier = suppliers.find((s) => s.id === quote.supplierId);
        if (!supplier) continue;

        const template = findTemplate(
          templates,
          [trade.code],
          templateType as EmailTemplate["type"]
        );
        if (!template) continue;

        const context = { supplier, job, estimator, tradeCodes: [trade.code] };

        try {
          const subject = renderTemplate(template.subject, context);
          const htmlBody = renderTemplate(template.body, context).replace(/\n/g, "<br>");

          await sendEmail({ accessToken, to: [supplier.email], subject, htmlBody });

          quote.followUpCount++;
          quote.lastFollowUp = new Date().toISOString();
          jobUpdated = true;
          followUpsSent++;

          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Follow-up failed";
          errors.push(`${job.jobCode}/${trade.code}/${supplier.company}: ${msg}`);
        }
      }
    }

    if (jobUpdated) {
      job.updatedAt = new Date().toISOString();
      await saveJob(job);
    }
  }

  return NextResponse.json({ followUpsSent, errors, timestamp: new Date().toISOString() });
}

// This POST endpoint can be called manually with an access token for testing
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { accessToken } = body as { accessToken: string };

  if (!accessToken) {
    return NextResponse.json({ error: "Access token required" }, { status: 400 });
  }

  const settings = await getSettings();
  const followUpDays = settings?.followUpDays || { first: 7, second: 14 };

  const [suppliers, estimators, templates, jobs] = await Promise.all([
    getSuppliers(),
    getEstimators(),
    getTemplates(),
    getJobs(),
  ]);

  let followUpsSent = 0;
  const errors: string[] = [];

  for (const job of jobs) {
    if (job.status !== "active" && job.status !== "quoting") continue;

    const estimator = estimators.find((e) => e.id === job.estimatorId) || estimators[0];
    if (!estimator) continue;

    let jobUpdated = false;

    for (const trade of job.trades || []) {
      for (const quote of trade.quotes || []) {
        if (quote.status !== "requested" || !quote.requestedDate) continue;

        const daysElapsed = Math.floor(
          (Date.now() - new Date(quote.requestedDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        let templateType: string | null = null;

        if (quote.followUpCount === 0 && daysElapsed >= followUpDays.first) {
          templateType = "followup_1";
        } else if (quote.followUpCount === 1 && daysElapsed >= followUpDays.second) {
          templateType = "followup_2";
        }

        if (!templateType || quote.followUpCount >= 2) continue;

        const supplier = suppliers.find((s) => s.id === quote.supplierId);
        if (!supplier) continue;

        const template = findTemplate(
          templates,
          [trade.code],
          templateType as EmailTemplate["type"]
        );
        if (!template) continue;

        const context = {
          supplier,
          job,
          estimator,
          tradeCodes: [trade.code],
        };

        try {
          const subject = renderTemplate(template.subject, context);
          const htmlBody = renderTemplate(template.body, context).replace(/\n/g, "<br>");

          await sendEmail({
            accessToken,
            to: [supplier.email],
            subject,
            htmlBody,
          });

          quote.followUpCount++;
          quote.lastFollowUp = new Date().toISOString();
          jobUpdated = true;
          followUpsSent++;

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Follow-up failed";
          errors.push(`${job.jobCode}/${trade.code}/${supplier.company}: ${msg}`);
        }
      }
    }

    if (jobUpdated) {
      job.updatedAt = new Date().toISOString();
      await saveJob(job);
    }
  }

  return NextResponse.json({
    followUpsSent,
    errors,
    timestamp: new Date().toISOString(),
  });
}
