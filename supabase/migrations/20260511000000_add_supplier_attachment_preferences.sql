alter table public.qp_suppliers
add column if not exists attachment_preferences jsonb not null default '{}'::jsonb;

comment on column public.qp_suppliers.attachment_preferences is
  'Per-supplier default job-document attachment categories keyed by trade/cost-centre code.';
