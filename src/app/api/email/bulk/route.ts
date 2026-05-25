import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { getEstimators, getTemplates, getJob, saveJob, getSuppliers } from "@/lib/supabase";
import { renderTemplate, findTemplate, getGroupedTradeCodes, getTradeDisplayName } from "@/lib/templates";
import { getJobDocumentKey, getSelectedDocumentsForSupplier } from "@/lib/attachments";
import {
  downloadAttachmentFiles,
  filesToEmailAttachments,
  getAttachmentFilesSize,
  MAX_SMTP_SIZE,
} from "@/lib/email-attachments";

interface AttachmentSelection {
  supplierId: string;
  documentKeys: string[];
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
    attachmentSelections,
  } = body as {
    jobCode: string;
    selections: { supplierId: string; tradeCodes: string[] }[];
    templateId?: string;
    attachmentSelections?: AttachmentSelection[];
  };

  if (!jobCode || !selections?.length) {
    return NextResponse.json(
      { error: "Missing required fields: jobCode, selections" },
      { status: 400 }
    );
  }

  const [suppliers, estimators, templates, job] = await Promise.all([
    getSuppliers(),
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

  const attachmentOverrides = new Map(
    Array.isArray(attachmentSelections)
      ? attachmentSelections.map((item) => [item.supplierId, item.documentKeys])
      : []
  );

  const supplierGroups: { supplierId: string; tradeCodes: string[] }[] = [];
  for (const sel of selections) {
    const existing = supplierGroups.find((g) => g.supplierId === sel.supplierId);
    const codes: string[] = [];
    for (const code of sel.tradeCodes) {
      const grouped = getGroupedTradeCodes(code);
      for (const groupedCode of grouped) {
        if (!codes.includes(groupedCode)) codes.push(groupedCode);
      }
    }
    if (existing) {
      for (const code of codes) {
        if (!existing.tradeCodes.includes(code)) existing.tradeCodes.push(code);
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

    const contactName = (supplier.contact || "").trim() || (supplier.company || "").trim() || "team";
    const safeSupplier = { ...supplier, contact: contactName };

    const context = { supplier: safeSupplier, job, estimator, tradeCodes };
    const tradeDisplay = getTradeDisplayName(tradeCodes);
    const subject = `Quote Request - ${tradeDisplay} - ${job.address}`;
    const htmlBody = renderTemplate(template.body, context).replace(/\n/g, "<br>");

    const selectedDocumentKeys = attachmentOverrides.get(supplierId);
    const selectedDocuments = getSelectedDocumentsForSupplier(
      job.documents || [],
      supplier,
      tradeCodes,
      selectedDocumentKeys
    );
    const selectedDocumentSet = new Set(selectedDocuments);
    const attachmentKeysToPersist =
      selectedDocumentKeys ??
      (job.documents || [])
        .map((doc, index) => selectedDocumentSet.has(doc) ? getJobDocumentKey(doc, index) : "")
        .filter(Boolean);
    let attachmentFiles = await downloadAttachmentFiles(session.accessToken, job, selectedDocuments);

    const totalSize = getAttachmentFilesSize(attachmentFiles);
    if (totalSize > MAX_SMTP_SIZE) {
      console.log(JSON.stringify({
        evt: "attachment_size_warning",
        jobCode,
        supplierId,
        totalBytes: totalSize,
        files: attachmentFiles.map((file) => file.name),
        msg: "Exceeds 20MB SMTP limit - sending without attachments",
      }));
      attachmentFiles = [];
    }

    const emailAttachments = filesToEmailAttachments(attachmentFiles);

    try {
      await sendEmail({
        to: [supplier.email],
        cc: supplier.cc ? [supplier.cc] : undefined,
        subject,
        htmlBody,
        attachments: emailAttachments,
      });

      console.log(JSON.stringify({
        evt: "quote_email_sent",
        jobCode,
        supplierId,
        supplierEmail: supplier.email,
        trade: tradeDisplay,
        subject,
        bodyPreview: htmlBody.replace(/<[^>]+>/g, "").slice(0, 120),
        attachments: emailAttachments.map((attachment) => ({
          name: attachment.name,
          bytes: Buffer.from(attachment.contentBytes, "base64").length,
        })),
        totalBytes: emailAttachments.reduce(
          (sum, attachment) => sum + Buffer.from(attachment.contentBytes, "base64").length,
          0
        ),
      }));

      for (const tradeCode of tradeCodes) {
        const tradeIndex = job.trades.findIndex((trade) => trade.code === tradeCode);
        if (tradeIndex === -1) continue;

        const existingQuote = job.trades[tradeIndex].quotes.find(
          (quote) => quote.supplierId === supplierId
        );
        if (existingQuote) {
          existingQuote.status = "requested";
          existingQuote.requestedDate = new Date().toISOString();
          existingQuote.attachmentKeys = attachmentKeysToPersist;
        } else {
          job.trades[tradeIndex].quotes.push({
            supplierId,
            supplierName: supplier.company,
            status: "requested",
            requestedDate: new Date().toISOString(),
            version: 1,
            followUpCount: 0,
            attachmentKeys: attachmentKeysToPersist,
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

  const sent = results.filter((result) => result.success).length;
  const failed = results.filter((result) => !result.success).length;

  return NextResponse.json({ sent, failed, results });
}
