import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { getSuppliers, getEstimators, getTemplates, getJob, saveJob, getSettings } from "@/lib/supabase";
import { renderTemplate, findTemplate, getGroupedTradeCodes, getTradeDisplayName } from "@/lib/templates";
import { listFolder, downloadFile } from "@/lib/onedrive";

const MAX_TOTAL_SIZE = 150 * 1024 * 1024; // 150MB

interface AttachmentFile {
  name: string;
  content: ArrayBuffer;
  size: number;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    jobCode,
    selections, // Array of { supplierId, tradeCodes[] }
    templateId, // Optional: override template selection
  } = body as {
    jobCode: string;
    selections: { supplierId: string; tradeCodes: string[] }[];
    templateId?: string;
  };

  if (!jobCode || !selections?.length) {
    return NextResponse.json(
      { error: "Missing required fields: jobCode, selections" },
      { status: 400 }
    );
  }

  const accessToken = session.accessToken;

  // Load all data from Supabase
  const [suppliers, estimators, templates, job, settings] = await Promise.all([
    getSuppliers(),
    getEstimators(),
    getTemplates(),
    getJob(jobCode),
    getSettings(),
  ]);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const estimator = estimators.find((e) => e.id === job.estimatorId) || estimators[0];
  if (!estimator) {
    return NextResponse.json({ error: "No estimator found" }, { status: 400 });
  }

  const rootPath = settings.oneDriveRootPath;
  const jobFolder = `${job.jobCode} - ${job.address}`;

  // Collect PDF attachments from all 5 category folders
  const categoryFolders = ["Plans", "Engineering", "Inclusions", "Colour Selection", "Other"];
  const attachmentFiles: AttachmentFile[] = [];

  for (const folder of categoryFolders) {
    try {
      const folderPath = `${rootPath}/${jobFolder}/${folder}`;
      const items = await listFolder(accessToken, folderPath);
      for (const item of items) {
        if (item.file && item.name.toLowerCase().endsWith(".pdf")) {
          const filePath = `${rootPath}/${jobFolder}/${folder}/${item.name}`;
          const content = await downloadFile(accessToken, filePath);
          attachmentFiles.push({
            name: item.name,
            content,
            size: content.byteLength,
          });
        }
      }
    } catch {
      // Folder doesn't exist or is empty — skip silently
    }
  }

  // Check 150MB total cap
  const totalSize = attachmentFiles.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > MAX_TOTAL_SIZE) {
    return NextResponse.json(
      { error: "Attachments exceed 150MB Graph API limit" },
      { status: 413 }
    );
  }

  const hasAttachments = attachmentFiles.length > 0;


  // Group selections by supplier — combine trade codes that share a supplier
  const supplierMap = new Map<string, string[]>();
  for (const sel of selections) {
    const existing = supplierMap.get(sel.supplierId) || [];
    for (const code of sel.tradeCodes) {
      const grouped = getGroupedTradeCodes(code);
      for (const gc of grouped) {
        if (!existing.includes(gc)) existing.push(gc);
      }
    }
    supplierMap.set(sel.supplierId, existing);
  }

  const results: { supplier: string; tradeCodes: string[]; success: boolean; error?: string }[] = [];

  for (const [supplierId, tradeCodes] of Array.from(supplierMap.entries())) {
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) {
      results.push({ supplier: supplierId, tradeCodes, success: false, error: "Supplier not found" });
      continue;
    }

    // Find template — use override if provided, otherwise auto-match
    const template = templateId
      ? templates.find((t) => t.id === templateId)
      : findTemplate(templates, tradeCodes, "request");
    if (!template) {
      results.push({ supplier: supplier.company, tradeCodes, success: false, error: "No template found" });
      continue;
    }

    const context = { supplier, job, estimator, tradeCodes };
    const tradeDisplay = getTradeDisplayName(tradeCodes);

    // Hardcoded subject format
    const subject = `Quote Request — ${tradeDisplay} — ${job.address}`;

    // Render body from template
    let htmlBody = renderTemplate(template.body, context).replace(/\n/g, "<br>");

    // If no attachments, append note
    if (!hasAttachments) {
      htmlBody += "<br><br><em>Note: Documents will follow separately.</em>";
    }

    try {
      // Send via SMTP with all attachments
      const emailAttachments = hasAttachments
        ? attachmentFiles.map((f) => ({
            name: f.name,
            contentType: "application/pdf",
            contentBytes: Buffer.from(f.content).toString("base64"),
          }))
        : [];

      await sendEmail({
        to: [supplier.email],
        subject,
        htmlBody,
        attachments: emailAttachments,
      });

      // Update quote status for each trade
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

      results.push({ supplier: supplier.company, tradeCodes, success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Send failed";
      results.push({ supplier: supplier.company, tradeCodes, success: false, error: msg });
    }

    // Rate limiting: 1 second delay between sends
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Save updated job
  job.updatedAt = new Date().toISOString();
  await saveJob(job);

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({ sent, failed, results });
}
