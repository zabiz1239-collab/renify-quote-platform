import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { getEstimators, getTemplates, getJob, saveJob, getSuppliers } from "@/lib/supabase";
import { findTemplate, getDefaultTemplates, getTradeDisplayName, renderTemplate } from "@/lib/templates";
import type { EmailTemplate } from "@/types";

const RESPONSE_DATE_PROMPT = `

Could you please reply with the date you expect to send the quote through, even if the final price is not ready yet?`;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { jobCode, supplierId, tradeCode } = body as {
    jobCode?: string;
    supplierId?: string;
    tradeCode?: string;
  };

  if (!jobCode || !supplierId || !tradeCode) {
    return NextResponse.json(
      { error: "Missing required fields: jobCode, supplierId, tradeCode" },
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

  const supplier = suppliers.find((item) => item.id === supplierId);
  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }
  if (!supplier.email?.trim()) {
    return NextResponse.json({ error: "Supplier has no email address saved" }, { status: 400 });
  }

  const trade = job.trades.find((item) => item.code === tradeCode);
  if (!trade) {
    return NextResponse.json({ error: "Trade not found on job" }, { status: 404 });
  }

  const quote = (trade.quotes || []).find((item) => item.supplierId === supplierId);
  if (!quote) {
    return NextResponse.json({ error: "Quote request not found for supplier" }, { status: 404 });
  }

  const estimator = estimators.find((item) => item.id === job.estimatorId) || estimators[0];
  if (!estimator) {
    return NextResponse.json({ error: "No estimator found for this job" }, { status: 400 });
  }

  const nextFollowUpCount = (quote.followUpCount || 0) + 1;
  const templateType: EmailTemplate["type"] =
    nextFollowUpCount === 1 ? "followup_1" : "followup_2";
  const template =
    findTemplate(templates, [tradeCode], templateType) ||
    findTemplate(getDefaultTemplates(), [tradeCode], templateType);
  if (!template) {
    return NextResponse.json({ error: "No matching follow-up template found" }, { status: 400 });
  }

  const contactName = (supplier.contact || "").trim() || (supplier.company || "").trim() || "team";
  const safeSupplier = { ...supplier, contact: contactName };
  const context = { supplier: safeSupplier, job, estimator, tradeCodes: [tradeCode] };
  const subject = renderTemplate(template.subject, context);
  const htmlBody = renderTemplate(`${template.body}${RESPONSE_DATE_PROMPT}`, context).replace(/\n/g, "<br>");

  try {
    await sendEmail({
      to: [supplier.email],
      cc: supplier.cc ? [supplier.cc] : undefined,
      subject,
      htmlBody,
    });

    quote.followUpCount = nextFollowUpCount;
    quote.lastFollowUp = new Date().toISOString();
    job.updatedAt = new Date().toISOString();
    await saveJob(job);

    return NextResponse.json({
      success: true,
      supplier: supplier.company,
      tradeCode,
      tradeName: getTradeDisplayName([tradeCode]),
      followUpCount: quote.followUpCount,
      lastFollowUp: quote.lastFollowUp,
      templateType,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Follow-up send failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
