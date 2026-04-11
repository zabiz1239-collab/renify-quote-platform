import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { readJsonFile, writeJsonFile } from "@/lib/onedrive";
import { renderTemplate, findTemplate } from "@/lib/templates";
import type { Job, Supplier, Estimator, EmailTemplate, AppSettings } from "@/types";
import { DEFAULT_ONEDRIVE_ROOT } from "@/types";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    jobCode,
    supplierIds,
    tradeCodes,
    templateType = "request",
  } = body as {
    jobCode: string;
    supplierIds: string[];
    tradeCodes: string[];
    templateType?: string;
  };

  if (!jobCode || !supplierIds?.length || !tradeCodes?.length) {
    return NextResponse.json(
      { error: "Missing required fields: jobCode, supplierIds, tradeCodes" },
      { status: 400 }
    );
  }

  const accessToken = session.accessToken;
  const rootPath = (
    await readJsonFile<AppSettings>(accessToken, `${DEFAULT_ONEDRIVE_ROOT}/settings.json`)
  )?.oneDriveRootPath || DEFAULT_ONEDRIVE_ROOT;

  // Load data
  const suppliers = (await readJsonFile<Supplier[]>(
    accessToken,
    `${rootPath}/suppliers.json`
  )) || [];

  const estimators = (await readJsonFile<Estimator[]>(
    accessToken,
    `${rootPath}/estimators.json`
  )) || [];

  const templates = (await readJsonFile<EmailTemplate[]>(
    accessToken,
    `${rootPath}/templates.json`
  )) || [];

  // Find the job
  const { listFolder } = await import("@/lib/onedrive");
  const items = await listFolder(accessToken, rootPath);
  const jobFolder = items.find(
    (item) => item.folder && item.name.startsWith(`${jobCode} `)
  );
  if (!jobFolder) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const job = await readJsonFile<Job>(
    accessToken,
    `${rootPath}/${jobFolder.name}/job-config.json`
  );
  if (!job) {
    return NextResponse.json({ error: "Job config not found" }, { status: 404 });
  }

  const estimator = estimators.find((e) => e.id === job.estimatorId) || estimators[0];
  if (!estimator) {
    return NextResponse.json(
      { error: "No estimator found for this job" },
      { status: 400 }
    );
  }

  // Find template
  const template = findTemplate(
    templates,
    tradeCodes,
    templateType as EmailTemplate["type"]
  );
  if (!template) {
    return NextResponse.json(
      { error: "No matching template found" },
      { status: 400 }
    );
  }

  const results: { supplier: string; success: boolean; error?: string }[] = [];

  for (const supplierId of supplierIds) {
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) {
      results.push({ supplier: supplierId, success: false, error: "Supplier not found" });
      continue;
    }

    const context = {
      supplier,
      job,
      estimator,
      tradeCodes,
    };

    const subject = renderTemplate(template.subject, context);
    const htmlBody = renderTemplate(template.body, context).replace(/\n/g, "<br>");

    try {
      await sendEmail({
        accessToken,
        to: [supplier.email],
        subject,
        htmlBody,
      });

      // Update quote status in the job
      for (const tradeCode of tradeCodes) {
        const tradeIndex = job.trades.findIndex((t) => t.code === tradeCode);
        if (tradeIndex === -1) continue;

        const existingQuote = job.trades[tradeIndex].quotes.find(
          (q) => q.supplierId === supplierId
        );
        if (existingQuote) {
          existingQuote.status = "requested";
          existingQuote.requestedDate = new Date().toISOString();
        } else {
          job.trades[tradeIndex].quotes.push({
            supplierId,
            supplierName: supplier.company,
            status: "requested",
            requestedDate: new Date().toISOString(),
            version: 1,
            followUpCount: 0,
          });
        }
      }

      results.push({ supplier: supplier.company, success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Send failed";
      results.push({ supplier: supplier.company, success: false, error: msg });
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Save updated job
  job.updatedAt = new Date().toISOString();
  await writeJsonFile(
    accessToken,
    `${rootPath}/${jobFolder.name}/job-config.json`,
    job
  );

  return NextResponse.json({ results });
}
