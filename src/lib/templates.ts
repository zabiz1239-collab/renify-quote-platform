import type { EmailTemplate, Job, Supplier, Estimator } from "@/types";
import { TRADES, TRADE_GROUPS } from "@/data/trades";

// All available placeholders
export const PLACEHOLDERS = [
  { key: "{supplier}", description: "Supplier company name" },
  { key: "{contact}", description: "Supplier contact person" },
  { key: "{job_name}", description: "Job code and address" },
  { key: "{job_code}", description: "Job code" },
  { key: "{address}", description: "Job address" },
  { key: "{trade}", description: "Trade name(s)" },
  { key: "{estimator_name}", description: "Estimator name" },
  { key: "{estimator_email}", description: "Estimator email" },
  { key: "{estimator_phone}", description: "Estimator phone" },
  { key: "{signature}", description: "Estimator signature block" },
];

interface TemplateContext {
  supplier: Supplier;
  job: Job;
  estimator: Estimator;
  tradeCodes: string[];
}

// Get the display name for a set of trade codes
export function getTradeDisplayName(tradeCodes: string[]): string {
  if (tradeCodes.length === 0) return "";
  if (tradeCodes.length === 1) {
    const trade = TRADES.find((t) => t.code === tradeCodes[0]);
    return trade?.name || tradeCodes[0];
  }
  // Multiple trades — show grouped name
  const names = tradeCodes.map((code) => {
    const trade = TRADES.find((t) => t.code === code);
    return trade?.name || code;
  });
  return names.join(" + ");
}

// Get trade codes that belong to the same group
export function getGroupedTradeCodes(tradeCode: string): string[] {
  const trade = TRADES.find((t) => t.code === tradeCode) as { code: string; name: string; quotable: boolean; group?: string } | undefined;
  if (!trade?.group) return [tradeCode];
  return TRADE_GROUPS[trade.group] || [tradeCode];
}

// Replace all placeholders in a string with actual values
export function renderTemplate(
  template: string,
  context: TemplateContext
): string {
  const tradeDisplay = getTradeDisplayName(context.tradeCodes);

  return template
    .replace(/\{supplier\}/g, context.supplier.company)
    .replace(/\{contact\}/g, context.supplier.contact)
    .replace(/\{job_name\}/g, `${context.job.jobCode} - ${context.job.address}`)
    .replace(/\{job_code\}/g, context.job.jobCode)
    .replace(/\{address\}/g, context.job.address)
    .replace(/\{trade\}/g, tradeDisplay)
    .replace(/\{estimator_name\}/g, context.estimator.name)
    .replace(/\{estimator_email\}/g, context.estimator.email)
    .replace(/\{estimator_phone\}/g, context.estimator.phone)
    .replace(/\{signature\}/g, context.estimator.signature);
}

// Generate sample context for live preview
export function getSampleContext(): TemplateContext {
  return {
    supplier: {
      id: "sample",
      company: "EcoConcrete Pty Ltd",
      contact: "John Smith",
      email: "john@ecoconcrete.com.au",
      phone: "0412 345 678",
      trades: ["110", "115"],
      regions: ["Western"],
      status: "verified",
      rating: 4,
      notes: "",
    },
    job: {
      jobCode: "BIR40",
      address: "40 Birmingham St Spotswood",
      client: { name: "Jane Doe" },
      region: "Western",
      buildType: "New Build",
      storeys: "Double",
      estimatorId: "sample",
      status: "active",
      documents: [],
      trades: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    estimator: {
      id: "sample",
      name: "Tom Builder",
      email: "tom@renify.com.au",
      phone: "0400 111 222",
      signature: "Tom Builder\nRenify Building & Construction\n0400 111 222",
      microsoftAccount: "tom@renify.com.au",
    },
    tradeCodes: ["110", "115"],
  };
}

// Default templates for common types
export function getDefaultTemplates(): EmailTemplate[] {
  return [
    {
      id: "default-request",
      tradeCodes: [],
      name: "Default Quote Request",
      subject: "Quote Request — {trade} — {job_code} {address}",
      body: `Dear {contact},

We are seeking a quotation for <strong>{trade}</strong> for the following project:

<strong>Job:</strong> {job_code} — {address}
<strong>Build Type:</strong> New Build

Please find the plans and specifications attached. We would appreciate your quotation at your earliest convenience.

If you have any questions, please don't hesitate to contact me.

Kind regards,
{estimator_name}
{estimator_email}
{estimator_phone}

{signature}`,
      type: "request",
    },
    {
      id: "default-followup1",
      tradeCodes: [],
      name: "First Follow-Up",
      subject: "Follow Up — Quote Request — {trade} — {job_code}",
      body: `Dear {contact},

I'm following up on our quote request for <strong>{trade}</strong> for {job_code} — {address}.

We sent the original request recently and haven't received a response yet. We'd love to include {supplier} in our pricing for this project.

Could you please let us know if you're able to provide a quotation?

Kind regards,
{estimator_name}
{estimator_phone}

{signature}`,
      type: "followup_1",
    },
    {
      id: "default-followup2",
      tradeCodes: [],
      name: "Second Follow-Up",
      subject: "Final Follow Up — {trade} — {job_code}",
      body: `Dear {contact},

This is a final follow-up regarding our quote request for <strong>{trade}</strong> for {job_code} — {address}.

If we don't hear back from you, we'll proceed with other suppliers. If you'd like to be considered for future projects, please let us know.

Kind regards,
{estimator_name}

{signature}`,
      type: "followup_2",
    },
  ];
}

// Find the best matching template for a set of trade codes
export function findTemplate(
  templates: EmailTemplate[],
  tradeCodes: string[],
  type: EmailTemplate["type"]
): EmailTemplate | undefined {
  // First try to find a template that matches the exact trade codes
  const exactMatch = templates.find(
    (t) =>
      t.type === type &&
      t.tradeCodes.length === tradeCodes.length &&
      tradeCodes.every((code) => t.tradeCodes.includes(code))
  );
  if (exactMatch) return exactMatch;

  // Then try to find one that matches any of the trade codes
  const partialMatch = templates.find(
    (t) =>
      t.type === type &&
      t.tradeCodes.length > 0 &&
      tradeCodes.some((code) => t.tradeCodes.includes(code))
  );
  if (partialMatch) return partialMatch;

  // Fall back to default (empty tradeCodes = applies to all)
  return templates.find(
    (t) => t.type === type && t.tradeCodes.length === 0
  );
}
