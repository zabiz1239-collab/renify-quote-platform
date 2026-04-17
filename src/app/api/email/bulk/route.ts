import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { getSuppliers, getEstimators, getTemplates, getJob, saveJob, getSettings } from "@/lib/supabase";
import { renderTemplate, findTemplate, getGroupedTradeCodes, getTradeDisplayName } from "@/lib/templates";
import { listFolder, downloadFile, getGraphClient } from "@/lib/onedrive";

const MAX_INLINE_SIZE = 3 * 1024 * 1024; // 3MB
const MAX_TOTAL_SIZE = 150 * 1024 * 1024; // 150MB
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks for upload sessions

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
  } = body as {
    jobCode: string;
    selections: { supplierId: string; tradeCodes: string[] }[];
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
  const hasLargeFiles = attachmentFiles.some((f) => f.size > MAX_INLINE_SIZE);

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

    // Find best template for body content
    const template = findTemplate(templates, tradeCodes, "request");
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
      if (!hasAttachments || (!hasLargeFiles && hasAttachments)) {
        // All files <= 3MB: use inline attachments via sendEmail
        const inlineAttachments = hasAttachments
          ? attachmentFiles.map((f) => ({
              name: f.name,
              contentType: "application/pdf",
              contentBytes: Buffer.from(f.content).toString("base64"),
            }))
          : [];

        await sendEmail({
          accessToken,
          to: [supplier.email],
          subject,
          htmlBody,
          attachments: inlineAttachments,
        });
      } else {
        // Has large files: use draft message + upload session flow
        await sendWithLargeAttachments(
          accessToken,
          supplier.email,
          subject,
          htmlBody,
          attachmentFiles
        );
      }

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

// Send email with large attachments using Graph API draft + upload session flow
async function sendWithLargeAttachments(
  accessToken: string,
  to: string,
  subject: string,
  htmlBody: string,
  files: AttachmentFile[]
): Promise<void> {
  const client = getGraphClient(accessToken);
  let draftId: string | null = null;

  try {
    // 1. Create draft message
    const draft = await client.api("/me/messages").post({
      subject,
      body: { contentType: "HTML", content: htmlBody },
      toRecipients: [{ emailAddress: { address: to } }],
    });
    draftId = draft.id;

    // 2. Upload each file
    for (const file of files) {
      if (file.size <= MAX_INLINE_SIZE) {
        // Small file: add as regular attachment
        await client
          .api(`/me/messages/${draftId}/attachments`)
          .post({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: file.name,
            contentType: "application/pdf",
            contentBytes: Buffer.from(file.content).toString("base64"),
          });
      } else {
        // Large file: use upload session
        const session = await client
          .api(`/me/messages/${draftId}/attachments/createUploadSession`)
          .post({
            AttachmentItem: {
              attachmentType: "file",
              name: file.name,
              size: file.size,
              contentType: "application/pdf",
            },
          });

        const uploadUrl = session.uploadUrl;
        const bytes = new Uint8Array(file.content);

        for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
          const end = Math.min(offset + CHUNK_SIZE, bytes.length);
          const chunk = bytes.slice(offset, end);

          await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": "application/octet-stream",
              "Content-Length": chunk.length.toString(),
              "Content-Range": `bytes ${offset}-${end - 1}/${bytes.length}`,
            },
            body: chunk,
          });
        }
      }
    }

    // 3. Send the draft
    await client.api(`/me/messages/${draftId}/send`).post({});
  } catch (err) {
    // Clean up draft on failure to avoid orphans
    if (draftId) {
      try {
        await client.api(`/me/messages/${draftId}`).delete();
      } catch {
        // Ignore cleanup failure
      }
    }
    throw err;
  }
}
