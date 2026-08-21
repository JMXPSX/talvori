-- ============================================================================
-- Phase 5 slice 5a — seeded global retailer directory (US launch market)
-- ============================================================================
-- Global, READ-ONLY reference data (no household scoping): the "Add retailer"
-- flow picks from this instead of free-typing names. "Add" copies the row's name
-- into the household's own retailers (existing createRetailer) and keeps
-- brand_key as the stable hook that licensed price connectors attach to later.
-- Seeded per launch market; public read; no per-household RLS.
-- ============================================================================

create table if not exists public.retailer_directory (
  id           uuid primary key default gen_random_uuid(),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  name         text not null,
  kind         text,           -- e.g. 'Supercenter · grocery', 'Warehouse · membership'
  brand_key    text not null,  -- stable hook for licensed price connectors
  created_at   timestamptz not null default now(),
  unique (country_code, brand_key)
);

-- Reference data is world-readable to any signed-in user; nobody writes it at
-- runtime (seeded here / by the service role).
alter table public.retailer_directory enable row level security;

drop policy if exists retailer_directory_select on public.retailer_directory;
create policy retailer_directory_select on public.retailer_directory
  for select using (true);

grant select on public.retailer_directory to authenticated;

-- ---------------------------------------------------------------------------
-- US launch seed (idempotent)
-- ---------------------------------------------------------------------------
insert into public.retailer_directory (country_code, name, kind, brand_key) values
  ('US', 'Walmart',        'Supercenter · grocery',   'walmart'),
  ('US', 'Target',         'General · grocery',       'target'),
  ('US', 'H-E-B',          'Supermarket · grocery',   'heb'),
  ('US', 'Kroger',         'Supermarket · grocery',   'kroger'),
  ('US', 'Costco',         'Warehouse · membership',  'costco'),
  ('US', 'Aldi',           'Discount · grocery',      'aldi'),
  ('US', 'Trader Joe''s',  'Specialty · grocery',     'trader-joes'),
  ('US', 'Safeway',        'Supermarket · grocery',   'safeway'),
  ('US', 'Publix',         'Supermarket · grocery',   'publix'),
  ('US', 'Sam''s Club',    'Warehouse · membership',  'sams-club'),
  ('US', 'Whole Foods',    'Specialty · grocery',     'whole-foods'),
  ('US', 'Meijer',         'Supercenter · grocery',   'meijer'),
  ('US', 'Wegmans',        'Supermarket · grocery',   'wegmans'),
  ('US', 'Walgreens',      'Pharmacy · convenience',  'walgreens'),
  ('US', 'CVS',            'Pharmacy · convenience',  'cvs'),
  ('US', 'Dollar General', 'Discount · variety',      'dollar-general')
on conflict (country_code, brand_key) do nothing;
