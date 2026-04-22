import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { getEstimators, getTemplates, getJob, saveJob } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { renderTemplate, findTemplate, getGroupedTradeCodes, getTradeDisplayName } from "@/lib/templates";
import type { Supplier } from "@/types";

const MAX_SMTP_SIZE = 20 * 1024 * 1024; // 20MB

interface DownloadedFile {
  name: string;
  content: Buffer;
  size: number;
}

// Fetch ALL suppliers with pagination
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
    cc: (r.cc as string) || undefined,
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

  // Load all data
  const [suppliers, estimators, templates, job] = await Promise.all([
    fetchAllSuppliers(),
    getEstimators(),
    getTemplates(),
    getJob(jobCode),
  ]);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const estimator = estimators.find((e) => e.id === job.estimatorId) || estimators[0];
  if (!estimator) {
    return NextResponse.json({ error: "No estimator found" }, { status: 400 });
  }

  // Download attachments from Supabase Storage
  const attachmentFiles: DownloadedFile[] = [];
  for (const doc of job.documents || []) {
    if (doc.type !== "upload") continue;

    // Use storagePath if available, otherwise construct from jobCode/category/fileName
    const storagePath = doc.storagePath || `${jobCode}/${doc.category}/${doc.fileName || doc.name}`;

    try {
      const { data, error } = await supabase.storage
        .from("project-documents")
        .download(storagePath);

      if (error) {
        console.error(`[Email] Storage download failed for ${storagePath}:`, error.message);
        continue;
      }

      const arrayBuffer = await data.arrayBuffer();
      const buf = Buffer.from(arrayBuffer);
      attachmentFiles.push({ name: doc.name, content: buf, size: buf.length });
    } catch (err) {
      console.error(`[Email] Failed to download ${storagePath}:`, err);
    }
  }

  // 20MB SMTP size guard
  const totalSize = attachmentFiles.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > MAX_SMTP_SIZE) {
    console.log(JSON.stringify({
      evt: "attachment_size_warning",
      jobCode,
      totalBytes: totalSize,
      files: attachmentFiles.map((f) => f.name),
      msg: "Exceeds 20MB SMTP limit — sending without attachments",
    }));
    attachmentFiles.length = 0; // clear
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

    const template = templateId && templateId !== "auto"
      ? templates.find((t) => t.id === templateId)
      : findTemplate(templates, tradeCodes, "request");
    if (!template) {
      results.push({ supplier: supplier.company, tradeCodes, success: false, error: "No template found" });
      continue;
    }

    // Contact name fallback
    const contactName = (supplier.contact || "").trim() || (supplier.company || "").trim() || "team";
    const safeSupplier = { ...supplier, contact: contactName };

    const context = { supplier: safeSupplier, job, estimator, tradeCodes };
    const tradeDisplay = getTradeDisplayName(tradeCodes);
    const subject = `Quote Request — ${tradeDisplay} — ${job.address}`;
    const htmlBody = renderTemplate(template.body, context).replace(/\n/g, "<br>");

    // Build nodemailer attachments
    const emailAttachments = attachmentFiles.map((f) => ({
      name: f.name,
      contentType: "application/pdf",
      contentBytes: f.content.toString("base64"),
    }));

    try {
      await sendEmail({
        to: [supplier.email],
        cc: supplier.cc ? [supplier.cc] : undefined,
        subject,
        htmlBody,
        attachments: emailAttachments,
      });

      // Structured log
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

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  job.updatedAt = new Date().toISOString();
  await saveJob(job);

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({ sent, failed, results });
}
