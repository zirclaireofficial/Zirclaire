-- =====================================================================
-- Zirclaire — 16_services.sql
-- "My Services": a provider publishes a fixed-price service offered at up to
-- three tiers (the provider names and describes each tier themselves). A buyer
-- picks a tier and orders it.
--
-- The key design decision (agreed): an order does NOT get its own money engine.
-- Buying a tier creates a PROJECT that is pre-awarded to the provider and
-- pre-funded with the tier price, then runs through the exact same
-- escrow -> deliver -> review -> payout loop as a commissioned project. It
-- simply skips the submitted/live/bidding/award steps. So there is nothing new
-- on the money side — 20% commission, the escrow ledger, start_work,
-- submit_deliverable, accept_work, clear_project are all reused as-is.
--
-- What's new here is only the LISTING (services + service_tiers) and the one
-- atomic order function that creates the pre-awarded project.
--
-- Approval: like royalties/KYC, an admin approves a listing before it's public.
--
-- Run AFTER 05_escrow.sql and 10_functions.sql (needs projects + escrow +
-- the state-machine functions the order flows into).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Listing lifecycle. Mirrors the royalty/KYC pattern.
-- ---------------------------------------------------------------------
create type service_status as enum (
  'pending',    -- submitted, awaiting admin approval (provider-only visible)
  'approved',   -- public in the services store
  'rejected',   -- admin declined it
  'removed'     -- taken down after being public
);

-- ---------------------------------------------------------------------
-- Services — one row per published service listing.
-- ---------------------------------------------------------------------
create table services (
  id             uuid primary key default gen_random_uuid(),
  provider_id    uuid not null references profiles(id) on delete cascade,
  subcategory_id int references subcategories(id),

  title          text not null,
  description    text,
  cover_image    text,                     -- Cloudinary public id (optional)

  status         service_status not null default 'pending',
  reviewed_by    uuid references profiles(id),
  reviewed_at    timestamptz,
  reject_reason  text,

  order_count    int not null default 0,   -- denormalised, kept by the order fn

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_services_provider on services(provider_id);
create index idx_services_status   on services(status);
create index idx_services_subcat   on services(subcategory_id);
create index idx_services_created  on services(created_at desc);

create trigger trg_services_updated_at
  before update on services
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Tiers — up to three per service. position 1..3 + unique(service,position)
-- caps it at three. The provider names each tier and writes what's included,
-- so "what a tier means" is their call, not ours.
-- ---------------------------------------------------------------------
create table service_tiers (
  id               uuid primary key default gen_random_uuid(),
  service_id       uuid not null references services(id) on delete cascade,
  position         smallint not null check (position between 1 and 3),

  name             text not null,           -- e.g. 'Basic', 'Standard', 'Premium'
  price_usd        numeric(12,2) not null check (price_usd > 0),
  description      text,                     -- what the buyer gets at this tier
  delivery_minutes int check (delivery_minutes is null or delivery_minutes > 0),

  created_at       timestamptz not null default now(),
  unique (service_id, position)
);

create index idx_service_tiers_service on service_tiers(service_id);

-- ---------------------------------------------------------------------
-- Link a project back to the service order it came from. NULL for ordinary
-- commissioned (bidding) projects; set for service orders. This is the only
-- change to the projects table — the money/state machinery is untouched.
-- ---------------------------------------------------------------------
alter table projects
  add column service_id      uuid references services(id),
  add column service_tier_id uuid references service_tiers(id);

create index idx_projects_service on projects(service_id);

-- ---------------------------------------------------------------------
-- Public store view — approved services only, safe columns. Tiers are
-- fetched alongside in the app layer (a service has 1–3 of them). A removed
-- listing drops out automatically, same pattern as feed_posts / royalty_store.
-- ---------------------------------------------------------------------
create view service_store with (security_invoker = on) as
  select id, provider_id, subcategory_id, title, description, cover_image, order_count, created_at
  from services
  where status = 'approved';

-- ---------------------------------------------------------------------
-- Security: deny-by-default RLS. Policies + the order function are in
-- 17_rls_services.sql.
-- ---------------------------------------------------------------------
alter table services      enable row level security;
alter table service_tiers enable row level security;
