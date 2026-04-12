import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { getSuppliers, getEstimators, getTemplates, getJob, saveJob } from "@/lib/supabase";
import { renderTemplate, findTemplate, getGroupedTradeCodes } from "@/lib/templates";



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

  // Group selections by supplier — combine trade codes that share a supplier
  // This ensures a supplier tagged with 110+115 gets ONE email covering both
  const supplierMap = new Map<string, string[]>();
  for (const sel of selections) {
    const existing = supplierMap.get(sel.supplierId) || [];
    // Expand each trade code to its group
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

    // Find best template for this set of trades
    const template = findTemplate(templates, tradeCodes, "request");
    if (!template) {
      results.push({ supplier: supplier.company, tradeCodes, success: false, error: "No template found" });
      continue;
    }

    const context = { supplier, job, estimator, tradeCodes };
    const subject = renderTemplate(template.subject, context);
    const htmlBody = renderTemplate(template.body, context).replace(/\n/g, "<br>");

    try {
      await sendEmail({
        accessToken,
        to: [supplier.email],
        subject,
        htmlBody,
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
