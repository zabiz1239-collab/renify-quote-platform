import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Job, Supplier, Estimator, EmailTemplate, AppSettings } from "@/types";

// Lazy client construction so `next build` "Collecting page data" can import
// route modules without requiring runtime env vars to be present at build time.
// Eagerly calling createClient() at module load broke Vercel preview builds
// (`Error: supabaseUrl is required` during page-data collection).
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  _client = createClient(url, key);
  return _client;
}

// Proxy preserves the `supabase.from(...)` / `supabase.auth.*` call surface
// used across the codebase — every property access constructs the client
// on demand the first time it is touched.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

// ── Settings ──────────────────────────────────────────────────────

export async function getSettings(): Promise<AppSettings> {
  const { data } = await supabase.from("qp_settings").select("*").limit(1).single();
  if (!data) {
    return {
      oneDriveRootPath: "Desktop/Renify Business/Renify Jobs/Jobs",
      regions: ["Western", "Northern", "South East", "Eastern", "Geelong", "Ballarat"],
      followUpDays: { first: 7, second: 14 },
      quoteExpiryWarningDays: [30, 60, 90],
      defaultMarkupPercent: 15,
      adminEmail: "",
    };
  }
  return {
    oneDriveRootPath: data.onedrive_root,
    regions: data.regions,
    followUpDays: { first: data.followup_days_1, second: data.followup_days_2 },
    quoteExpiryWarningDays: data.expiry_warning_days,
    defaultMarkupPercent: Number(data.default_markup),
    tradeMarkupPercents: data.trade_markup_percents || {},
    customTrades: data.custom_trades || [],
    adminEmail: data.admin_email,
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const { data: existing } = await supabase.from("qp_settings").select("id").limit(1).single();
  const row = {
    onedrive_root: settings.oneDriveRootPath,
    regions: settings.regions,
    followup_days_1: settings.followUpDays.first,
    followup_days_2: settings.followUpDays.second,
    expiry_warning_days: settings.quoteExpiryWarningDays,
    default_markup: settings.defaultMarkupPercent,
    trade_markup_percents: settings.tradeMarkupPercents || {},
    custom_trades: settings.customTrades || [],
    admin_email: settings.adminEmail,
    updated_at: new Date().toISOString(),
  };
  if (existing) {
    const { error } = await supabase.from("qp_settings").update(row).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("qp_settings").insert(row);
    if (error) throw error;
  }
}

// ── Estimators ────────────────────────────────────────────────────

export async function getEstimators(): Promise<Estimator[]> {
  const { data, error } = await supabase.from("qp_estimators").select("*").order("created_at");
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    signature: r.signature,
    microsoftAccount: r.microsoft_account,
  }));
}

export async function saveEstimator(est: Estimator): Promise<void> {
  const row = {
    id: est.id,
    name: est.name,
    email: est.email,
    phone: est.phone,
    signature: est.signature,
    microsoft_account: est.microsoftAccount,
  };
  const { error } = await supabase.from("qp_estimators").upsert(row);
  if (error) throw error;
}

export async function deleteEstimator(id: string): Promise<void> {
  const { error } = await supabase.from("qp_estimators").delete().eq("id", id);
  if (error) throw error;
}

// ── Suppliers ─────────────────────────────────────────────────────

export async function getSuppliers(): Promise<Supplier[]> {
  // Paginate to get ALL suppliers — Supabase caps at 1000 per request
  // Supabase server caps at 1000 rows regardless of .range() — must paginate in 1000-row chunks
  const PAGE_SIZE = 1000;
  const allRows: Record<string, unknown>[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("qp_suppliers")
      .select("*")
      .order("company")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data || [];
    allRows.push(...rows);
    hasMore = rows.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  return allRows.map((r) => ({
    id: r.id as string,
    company: r.company as string,
    contact: r.contact as string,
    email: r.email as string,
    phone: r.phone as string,
    abn: (r.abn as string) || undefined,
    website: (r.website as string) || undefined,
    cc: (r.cc as string) || undefined,
    trades: r.trades as string[],
    regions: r.regions as string[],
    status: r.status as Supplier["status"],
    rating: r.rating as number,
    notes: r.notes as string,
    lastContacted: (r.last_contacted as string) || undefined,
  }));
}

export async function saveSupplier(sup: Supplier): Promise<void> {
  const row = {
    id: sup.id,
    company: sup.company,
    contact: sup.contact,
    email: sup.email,
    phone: sup.phone,
    abn: sup.abn || null,
    website: sup.website || null,
    cc: sup.cc || null,
    trades: sup.trades,
    regions: sup.regions,
    status: sup.status,
    rating: sup.rating,
    notes: sup.notes,
    last_contacted: sup.lastContacted || null,
  };
  const { error } = await supabase.from("qp_suppliers").upsert(row);
  if (error) throw error;
}

export async function saveSuppliersBulk(suppliers: Supplier[]): Promise<void> {
  const rows = suppliers.map((sup) => ({
    id: sup.id,
    company: sup.company,
    contact: sup.contact,
    email: sup.email,
    phone: sup.phone,
    abn: sup.abn || null,
    website: sup.website || null,
    cc: sup.cc || null,
    trades: sup.trades,
    regions: sup.regions,
    status: sup.status,
    rating: sup.rating,
    notes: sup.notes,
    last_contacted: sup.lastContacted || null,
  }));
  const { error } = await supabase.from("qp_suppliers").upsert(rows);
  if (error) throw error;
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase.from("qp_suppliers").delete().eq("id", id);
  if (error) throw error;
}

// ── Email Templates ───────────────────────────────────────────────

export async function getTemplates(): Promise<EmailTemplate[]> {
  const { data, error } = await supabase.from("qp_email_templates").select("*").order("created_at");
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    tradeCodes: r.trade_codes,
    name: r.name,
    subject: r.subject,
    body: r.body,
    type: r.type as EmailTemplate["type"],
  }));
}

export async function saveTemplate(tmpl: EmailTemplate): Promise<void> {
  const row = {
    id: tmpl.id,
    trade_codes: tmpl.tradeCodes,
    name: tmpl.name,
    subject: tmpl.subject,
    body: tmpl.body,
    type: tmpl.type,
  };
  const { error } = await supabase.from("qp_email_templates").upsert(row);
  if (error) throw error;
}

export async function saveTemplatesBulk(templates: EmailTemplate[]): Promise<void> {
  const rows = templates.map((tmpl) => ({
    id: tmpl.id,
    trade_codes: tmpl.tradeCodes,
    name: tmpl.name,
    subject: tmpl.subject,
    body: tmpl.body,
    type: tmpl.type,
  }));
  const { error } = await supabase.from("qp_email_templates").upsert(rows);
  if (error) throw error;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("qp_email_templates").delete().eq("id", id);
  if (error) throw error;
}

// ── Jobs ──────────────────────────────────────────────────────────

function jobRowToJob(r: Record<string, unknown>): Job {
  return {
    jobCode: r.job_code as string,
    address: r.address as string,
    region: r.region as string,
    buildType: r.build_type as Job["buildType"],
    storeys: r.storeys as Job["storeys"],
    estimatorId: (r.estimator_id as string) || "",
    targetDate: (r.target_date as string) || undefined,
    status: r.status as Job["status"],
    budgetEstimate: r.budget_estimate ? Number(r.budget_estimate) : undefined,
    documents: (r.documents as Job["documents"]) || [],
    trades: (r.trades as Job["trades"]) || [],
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export async function getJobs(): Promise<Job[]> {
  const { data, error } = await supabase.from("qp_jobs").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(jobRowToJob);
}

export async function getJob(jobCode: string): Promise<Job | null> {
  const { data, error } = await supabase.from("qp_jobs").select("*").eq("job_code", jobCode).single();
  if (error || !data) return null;
  return jobRowToJob(data);
}

export async function saveJob(job: Job): Promise<void> {
  const row = {
    job_code: job.jobCode,
    address: job.address,
    region: job.region,
    build_type: job.buildType,
    storeys: job.storeys,
    estimator_id: job.estimatorId || null,
    target_date: job.targetDate || null,
    status: job.status,
    budget_estimate: job.budgetEstimate || null,
    documents: job.documents,
    trades: job.trades,
    onedrive_folder: `${job.jobCode} - ${job.address}`,
    updated_at: new Date().toISOString(),
  };

  // Check if job exists
  const { data: existing } = await supabase.from("qp_jobs").select("id").eq("job_code", job.jobCode).single();
  if (existing) {
    const { error } = await supabase.from("qp_jobs").update(row).eq("job_code", job.jobCode);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("qp_jobs").insert({ ...row, created_at: job.createdAt });
    if (error) throw error;
  }
}

export async function updateJobTrades(jobCode: string, trades: Job["trades"]): Promise<void> {
  const { error } = await supabase
    .from("qp_jobs")
    .update({ trades, updated_at: new Date().toISOString() })
    .eq("job_code", jobCode);
  if (error) throw error;
}
