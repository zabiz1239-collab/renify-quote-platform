import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { getSuppliers, getTemplates, getJob, getEstimators } from "@/lib/supabase";
import { renderTemplate, findTemplate, getTradeDisplayName } from "@/lib/templates";

export async function GET() {
  const steps: string[] = [];

  try {
    // 1. Load data
    const [suppliers, templates, job, estimators] = await Promise.all([
      getSuppliers(),
      getTemplates(),
      getJob("LOT112"),
      getEstimators(),
    ]);

    steps.push("Data loaded: " + suppliers.length + " suppliers, " + templates.length + " templates");

    if (!job) return NextResponse.json({ error: "Job LOT112 not found", steps });

    // 2. Find test supplier
    const supplier = suppliers.find((s) => s.email.toLowerCase() === "zabi@renify.com.au" && s.trades.includes("025"));
    if (!supplier) {
      // Show what we do have
      const tempFenceSuppliers = suppliers.filter((s) => s.trades.includes("025"));
      return NextResponse.json({
        error: "No supplier with email zabi@renify.com.au and trade 025 found",
        tempFenceSupplierCount: tempFenceSuppliers.length,
        tempFenceSuppliers: tempFenceSuppliers.map((s) => ({ company: s.company, email: s.email, id: s.id })),
        steps,
      });
    }
    steps.push("Supplier: " + supplier.company + " (" + supplier.id + ")");

    // 3. Find estimator
    const estimator = estimators.find((e) => e.id === job.estimatorId) || estimators[0];
    if (!estimator) return NextResponse.json({ error: "No estimator", steps });
    steps.push("Estimator: " + estimator.name);

    // 4. Find template
    const template = findTemplate(templates, ["025"], "request");
    if (!template) return NextResponse.json({ error: "No template found for trade 025", steps });
    steps.push("Template: " + template.name);

    // 5. Render
    const context = { supplier, job, estimator, tradeCodes: ["025"] };
    const tradeDisplay = getTradeDisplayName(["025"]);
    const subject = "Quote Request — " + tradeDisplay + " — " + job.address;
    const htmlBody = renderTemplate(template.body, context).replace(/\n/g, "<br>");
    steps.push("Rendered subject: " + subject);
    steps.push("Body length: " + htmlBody.length);

    // 6. Send
    await sendEmail({
      to: [supplier.email],
      subject,
      htmlBody,
    });

    steps.push("EMAIL SENT SUCCESSFULLY");
    return NextResponse.json({ success: true, steps });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown";
    const code = (err as { code?: string }).code;
    steps.push("FAILED: " + msg + (code ? " (code: " + code + ")" : ""));
    return NextResponse.json({ success: false, error: msg, code, steps });
  }
}
