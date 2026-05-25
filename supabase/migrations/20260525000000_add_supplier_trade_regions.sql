alter table public.qp_suppliers
add column if not exists trade_regions jsonb not null default '{}'::jsonb;

update public.qp_suppliers
set trade_regions = coalesce(attachment_preferences -> '__trade_regions', '{}'::jsonb)
where trade_regions = '{}'::jsonb
  and attachment_preferences ? '__trade_regions';

comment on column public.qp_suppliers.trade_regions is
  'Per-supplier service areas keyed by trade/cost-centre code. Falls back to supplier regions when a trade is not configured.';
