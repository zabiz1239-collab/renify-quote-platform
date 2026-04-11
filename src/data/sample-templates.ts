import type { EmailTemplate } from "@/types";

export const SAMPLE_TEMPLATES: EmailTemplate[] = [
  // === RENOVATION ===
  {
    id: "reno-request",
    tradeCodes: [],
    name: "Renovation — Quote Request",
    subject: "Quote Request — {trade} — {job_code} — Renovation at {address}",
    body: `Dear {contact},

We are currently pricing a <strong>renovation project</strong> at <strong>{address}</strong> (Job Ref: {job_code}) and would like to invite <strong>{supplier}</strong> to provide a quotation for <strong>{trade}</strong>.

<strong>Project Details:</strong>
• Project Type: Renovation / Extension
• Location: {address}

Please note this is an existing dwelling — please allow for working around existing structures and finishes. Site access and any demolition/make-good requirements will be detailed in the attached plans and scope.

Plans, specifications and scope of works are attached for your review. If you require a site visit before quoting, please contact me to arrange access.

We would appreciate your quotation at your earliest convenience.

Kind regards,
{estimator_name}
{estimator_email}
{estimator_phone}

{signature}`,
    type: "request",
  },

  // === SINGLE STOREY NEW BUILD ===
  {
    id: "single-new-request",
    tradeCodes: [],
    name: "Single Storey New Build — Quote Request",
    subject: "Quote Request — {trade} — {job_code} — New Single Storey at {address}",
    body: `Dear {contact},

We are pricing a <strong>new single storey dwelling</strong> at <strong>{address}</strong> (Job Ref: {job_code}) and would like to invite <strong>{supplier}</strong> to submit a quotation for <strong>{trade}</strong>.

<strong>Project Details:</strong>
• Project Type: New Build — Single Storey
• Location: {address}

Plans, engineering and specifications are attached. Please ensure your quote covers all items as per the scope of works. If anything is unclear or you need additional information, don't hesitate to reach out.

We would appreciate your quotation within 7-10 business days if possible.

Kind regards,
{estimator_name}
{estimator_email}
{estimator_phone}

{signature}`,
    type: "request",
  },

  // === DOUBLE STOREY NEW BUILD ===
  {
    id: "double-new-request",
    tradeCodes: [],
    name: "Double Storey New Build — Quote Request",
    subject: "Quote Request — {trade} — {job_code} — New Double Storey at {address}",
    body: `Dear {contact},

We are pricing a <strong>new double storey dwelling</strong> at <strong>{address}</strong> (Job Ref: {job_code}) and would like <strong>{supplier}</strong> to provide a quotation for <strong>{trade}</strong>.

<strong>Project Details:</strong>
• Project Type: New Build — Double Storey
• Location: {address}

Please note this is a two-storey build — please allow for scaffolding access, upper level works and any height-related considerations in your pricing.

Full plans, engineering documentation and specifications are attached. Please price as per the scope of works. If you require clarification on any items, please contact me.

We would appreciate your quotation within 7-10 business days if possible.

Kind regards,
{estimator_name}
{estimator_email}
{estimator_phone}

{signature}`,
    type: "request",
  },

  // === EXCAVATION & DEMOLITION ===
  {
    id: "demo-excavation-request",
    tradeCodes: ["055"],
    name: "Excavation & Demolition — Quote Request",
    subject: "Quote Request — Excavation & Demolition — {job_code} — {address}",
    body: `Dear {contact},

We require a quotation from <strong>{supplier}</strong> for <strong>excavation and demolition works</strong> at <strong>{address}</strong> (Job Ref: {job_code}).

<strong>Scope — please price the following:</strong>
• Site demolition of existing structures (if applicable)
• Removal and disposal of all demolition waste
• Bulk excavation to engineer's levels
• Cut and fill as per engineering drawings
• Rock removal / hammering (if encountered — please provide as a provisional rate per m³)
• Soil removal and disposal off-site (please confirm tip rates)
• Site levelling and compaction to slab preparation standard
• Retention of any existing trees or structures as marked on plans

<strong>Please note:</strong>
• Provide a fixed price based on plans attached
• Separately itemise any provisional/contingency items
• Include your available start date

Plans, site survey and engineering drawings are attached for your review. A site inspection is recommended before pricing — please contact me to arrange.

We would appreciate your quotation within 5 business days if possible.

Kind regards,
{estimator_name}
{estimator_email}
{estimator_phone}

{signature}`,
    type: "request",
  },

  // === FOLLOW UPS ===
  {
    id: "followup-1-general",
    tradeCodes: [],
    name: "First Follow-Up (All Trades)",
    subject: "Follow Up — Quote Request — {trade} — {job_code}",
    body: `Dear {contact},

I'm following up on our recent quote request for <strong>{trade}</strong> for the project at <strong>{address}</strong> (Ref: {job_code}).

We sent the original request recently and haven't received a response yet. We'd love to include {supplier} in our pricing for this project.

Could you please let us know if you're able to provide a quotation, or if you need any additional information?

Kind regards,
{estimator_name}
{estimator_phone}

{signature}`,
    type: "followup_1",
  },
  {
    id: "followup-2-general",
    tradeCodes: [],
    name: "Final Follow-Up (All Trades)",
    subject: "Final Follow Up — {trade} — {job_code}",
    body: `Dear {contact},

This is a final follow-up regarding our quote request for <strong>{trade}</strong> at <strong>{address}</strong> (Ref: {job_code}).

If we don't hear back, we'll proceed with other suppliers for this trade. No hard feelings — if you'd like to be considered for future projects, just let us know.

Kind regards,
{estimator_name}

{signature}`,
    type: "followup_2",
  },
];
