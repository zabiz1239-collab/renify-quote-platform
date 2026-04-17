import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSettings, getSuppliers, getEstimators, getTemplates, getJobs, saveJob } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { renderTemplate, findTemplate } from "@/lib/templates";
import type { EmailTemplate } from "@/types";

// GET: Preview which follow-ups would be sent (no auth required beyond session)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getSettings();
  const followUpDays = settings?.followUpDays || { first: 7, second: 14 };
  const [suppliers, jobs] = await Promise.all([getSuppliers(), getJobs()]);

  const pending: { jobCode: string; tradeName: string; supplierName: string; daysAgo: number; followUpType: string }[] = [];

  for (const job of jobs) {
    if (job.status !== "active" && job.status !== "quoting") continue;
    for (const trade of job.trades || []) {
      for (const quote of trade.quotes || []) {
        if (quote.status !== "requested" || !quote.requestedDate) continue;

        const daysElapsed = Math.floor(
          (Date.now() - new Date(quote.requestedDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        let followUpType: string | null = null;
        if (quote.followUpCount === 0 && daysElapsed >= followUpDays.first) {
          followUpType = "1st follow-up";
        } else if (quote.followUpCount === 1 && daysElapsed >= followUpDays.second) {
          followUpType = "2nd follow-up";
        }

        if (!followUpType || quote.followUpCount >= 2) continue;

        const supplier = suppliers.find((s) => s.id === quote.supplierId);
        pending.push({
          jobCode: job.jobCode,
          tradeName: trade.name,
          supplierName: supplier?.company || quote.supplierName,
          daysAgo: daysElapsed,
          followUpType,
        });
      }
    }
  }

  return NextResponse.json({
    count: pending.length,
    followUpDays,
    pending,
  });
}

// POST: Actually send the follow-ups using the signed-in user's token
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = session.accessToken;
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
  const sent: { jobCode: string; tradeName: string; supplierName: string; type: string }[] = [];

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
          sent.push({
            jobCode: job.jobCode,
            tradeName: trade.name,
            supplierName: supplier.company,
            type: templateType === "followup_1" ? "1st follow-up" : "2nd follow-up",
          });

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

  return NextResponse.json({ followUpsSent, sent, errors, timestamp: new Date().toISOString() });
}
