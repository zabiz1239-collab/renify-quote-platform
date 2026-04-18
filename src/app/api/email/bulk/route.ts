import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { getEstimators, getTemplates, getJob, saveJob, getSettings } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { renderTemplate, findTemplate, getGroupedTradeCodes, getTradeDisplayName } from "@/lib/templates";
import { listFolder, downloadFile } from "@/lib/onedrive";
import type { Supplier } from "@/types";

const MAX_SMTP_SIZE = 20 * 1024 * 1024; // 20MB Hostinger SMTP limit

interface AttachmentFile {
  name: string;
  content: ArrayBuffer;
  size: number;
}

// Fetch ALL suppliers with proper pagination — bypasses PostgREST 1000-row cap
async function fetchAllSuppliers(): Promise<Supplier[]> {
  const PAGE = 1000;
  const all: Record<string, unknown>[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("qp_suppliers")
      .select("*")
      .order("company")
      .range(from, from + PAGE - 1);

    if (error) throw error;
    const rows = data || [];
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }

  return all.map((r) => ({
    id: r.id as string,
    company: r.company as string,
    contact: r.contact as string,
    email: r.email as string,
    phone: r.phone as string,
    abn: (r.abn as string) || undefined,
    trades: r.trades as string[],
    regions: r.regions as string[],
    status: r.status as Supplier["status"],
    rating: r.rating as number,
    notes: r.notes as string,
    lastContacted: (r.last_contacted as string) || undefined,
  }));
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    jobCode,
    selections,
    templateId,
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

  // Load all data
  const [suppliers, estimators, templates, job, settings] = await Promise.all([
    fetchAllSuppliers(),
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

  // Collect PDF attachments from OneDrive (best-effort — token may be expired)
  const rootPath = settings.oneDriveRootPath;
  const jobFolder = `${job.jobCode} - ${job.address}`;
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
          attachmentFiles.push({ name: item.name, content, size: content.byteLength });
        }
      }
    } catch {
      // Folder missing or token expired — continue without attachments
    }
  }

  // 20MB SMTP size guard
  const totalAttachmentSize = attachmentFiles.reduce((sum, f) => sum + f.size, 0);
  const useAttachments = totalAttachmentSize <= MAX_SMTP_SIZE;

  if (!useAttachments && attachmentFiles.length > 0) {
    console.log(JSON.stringify({
      evt: "attachment_size_warning",
      jobCode,
      totalBytes: totalAttachmentSize,
      fileCount: attachmentFiles.length,
      msg: "Attachments exceed 20MB SMTP limit — sending without attachments",
    }));
  }

  // Group selections by supplier
  const supplierGroups: { supplierId: string; tradeCodes: string[] }[] = [];
  for (const sel of selections) {
    const existing = supplierGroups.find((g) => g.supplierId === sel.supplierId);
    const codes: string[] = [];
    for (const code of sel.tradeCodes) {
      const grouped = getGroupedTradeCodes(code);
      for (const gc of grouped) {
        if (!codes.includes(gc)) codes.push(gc);
      }
    }
    if (existing) {
      for (const c of codes) {
        if (!existing.tradeCodes.includes(c)) existing.tradeCodes.push(c);
      }
    } else {
      supplierGroups.push({ supplierId: sel.supplierId, tradeCodes: codes });
    }
  }

  const results: { supplier: string; tradeCodes: string[]; success: boolean; error?: string }[] = [];

  for (const { supplierId, tradeCodes } of supplierGroups) {
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) {
      const err = `Supplier not found (id: ${supplierId}, loaded: ${suppliers.length})`;
      console.error(`[Email] ${err}`);
      results.push({ supplier: supplierId, tradeCodes, success: false, error: err });
      continue;
    }

    // Find template
    const template = templateId && templateId !== "auto"
      ? templates.find((t) => t.id === templateId)
      : findTemplate(templates, tradeCodes, "request");
    if (!template) {
      results.push({ supplier: supplier.company, tradeCodes, success: false, error: "No template found" });
      continue;
    }

    // Contact name fallback — never send "Hi ,"
    const contactName = (supplier.contact || "").trim() || (supplier.company || "").trim() || "team";
    const safeSupplier = { ...supplier, contact: contactName };

    const context = { supplier: safeSupplier, job, estimator, tradeCodes };
    const tradeDisplay = getTradeDisplayName(tradeCodes);
    const subject = `Quote Request — ${tradeDisplay} — ${job.address}`;
    let htmlBody = renderTemplate(template.body, context).replace(/\n/g, "<br>");

    // Build attachments for SMTP
    const emailAttachments = useAttachments && attachmentFiles.length > 0
      ? attachmentFiles.map((f) => ({
          name: f.name,
          contentType: "application/pdf",
          contentBytes: Buffer.from(f.content).toString("base64"),
        }))
      : [];

    if (!useAttachments && attachmentFiles.length > 0) {
      htmlBody += "<br><br><em>Note: Attachments were too large to include in this email. Plans and specifications will follow separately.</em>";
    } else if (attachmentFiles.length === 0) {
      htmlBody += "<br><br><em>Note: Documents will follow separately.</em>";
    }

    try {
      await sendEmail({
        to: [supplier.email],
        subject,
        htmlBody,
        attachments: emailAttachments,
      });

      // Structured log for observability
      console.log(JSON.stringify({
        evt: "quote_email_sent",
        jobCode,
        supplierId,
        supplierEmail: supplier.email,
        trade: tradeDisplay,
        subject,
        bodyPreview: htmlBody.replace(/<[^>]+>/g, "").slice(0, 120),
        attachments: emailAttachments.map((a) => ({ name: a.name, bytes: Buffer.from(a.contentBytes, "base64").length })),
        totalBytes: emailAttachments.reduce((s, a) => s + Buffer.from(a.contentBytes, "base64").length, 0),
      }));

      // Update quote status
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
      const code = (err as { code?: string }).code;
      console.error(JSON.stringify({
        evt: "quote_email_failed",
        jobCode,
        supplierId,
        supplierEmail: supplier.email,
        trade: tradeDisplay,
        error: msg,
        code,
      }));
      results.push({ supplier: supplier.company, tradeCodes, success: false, error: msg });
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Save updated job
  job.updatedAt = new Date().toISOString();
  await saveJob(job);

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({ sent, failed, results });
}
