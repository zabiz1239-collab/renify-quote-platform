import { NextRequest, NextResponse } from "next/server";
import { readJsonFile, writeJsonFile, listFolder } from "@/lib/onedrive";
import { sendEmail } from "@/lib/email";
import { renderTemplate, findTemplate } from "@/lib/templates";
import type { Job, Supplier, Estimator, EmailTemplate, AppSettings } from "@/types";
import { DEFAULT_ONEDRIVE_ROOT } from "@/types";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Note: Cron jobs don't have a user session, so they need a service token.
  // For now, this returns the structure but requires an access token to be
  // configured separately (e.g., via a stored refresh token for a service account).
  // In production, you'd store a long-lived refresh token and use it here.

  return NextResponse.json({
    message: "Follow-up cron endpoint ready. Requires service account token for production use.",
    timestamp: new Date().toISOString(),
  });
}

// This POST endpoint can be called manually with an access token for testing
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { accessToken } = body as { accessToken: string };

  if (!accessToken) {
    return NextResponse.json({ error: "Access token required" }, { status: 400 });
  }

  const settings = await readJsonFile<AppSettings>(accessToken, `${DEFAULT_ONEDRIVE_ROOT}/settings.json`);
  const rootPath = settings?.oneDriveRootPath || DEFAULT_ONEDRIVE_ROOT;
  const followUpDays = settings?.followUpDays || { first: 7, second: 14 };

  const [suppliers, estimators, templates] = await Promise.all([
    readJsonFile<Supplier[]>(accessToken, `${rootPath}/suppliers.json`),
    readJsonFile<Estimator[]>(accessToken, `${rootPath}/estimators.json`),
    readJsonFile<EmailTemplate[]>(accessToken, `${rootPath}/templates.json`),
  ]);

  const items = await listFolder(accessToken, rootPath);
  const jobFolders = items.filter(
    (item) => item.folder && !item.name.endsWith(".json")
  );

  let followUpsSent = 0;
  const errors: string[] = [];

  for (const folder of jobFolders) {
    const job = await readJsonFile<Job>(
      accessToken,
      `${rootPath}/${folder.name}/job-config.json`
    );
    if (!job || job.status !== "active" && job.status !== "quoting") continue;

    const estimator = (estimators || []).find((e) => e.id === job.estimatorId) || (estimators || [])[0];
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

        const supplier = (suppliers || []).find((s) => s.id === quote.supplierId);
        if (!supplier) continue;

        const template = findTemplate(
          templates || [],
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
      await writeJsonFile(
        accessToken,
        `${rootPath}/${folder.name}/job-config.json`,
        job
      );
    }
  }

  return NextResponse.json({
    followUpsSent,
    errors,
    timestamp: new Date().toISOString(),
  });
}
