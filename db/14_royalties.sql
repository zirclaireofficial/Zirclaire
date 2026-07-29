-- =====================================================================
-- Zirclaire — 14_royalties.sql
-- The royalty store: providers publish finished works (novels, research,
-- journals); buyers pay once and get permanent download access.
--
-- How this differs from projects, and why it's a separate domain:
--   * Provider-initiated, not requester-initiated. No bidding, no award.
--   * INSTANT one-time sale — there is NO escrow hold and NO deliver/review
--     loop. The money splits at the moment of purchase: 15% platform, 85%
--     creator. (Projects hold funds in escrow for the whole lifecycle; a
--     royalty sale is settled immediately, so it needs its own ledger.)
--   * The work already exists. The file is uploaded at publish time and
--     stored PRIVATE (Cloudinary access_mode=authenticated), reachable only
--     via a server-signed URL — the same mechanism as KYC documents.
--
-- Approval: like KYC, an admin approves an item before it is public. Until
-- then only its creator (and admins) can see it.
--
-- Run AFTER 03_identity.sql (needs profiles). Independent of projects.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------

-- The three kinds of work the client named. Kept as an enum so the store
-- can filter/browse by type and nothing outside this set can be published.
create type royalty_work_type as enum (
  'novel',
  'research',
  'journal'
);

-- Publication lifecycle. Mirrors the post/KYC pattern: created hidden,
-- made public on approval, hideable again by an admin (or the future sweeper).
create type royalty_item_status as enum (
  'pending',    -- submitted, awaiting admin approval (creator-only visible)
  'approved',   -- public in the store
  'rejected',   -- admin declined it
  'removed'     -- taken down after being public
);

-- Money events on a royalty sale. Separate from ledger_entry_type because
-- royalties have no 'fund' or 'refund' — a sale settles in one shot.
create type royalty_entry_type as enum (
  'sale',        -- buyer pays (+)
  'commission',  -- platform's 15% cut (-)
  'payout'       -- creator's 85% (-)
);

-- ---------------------------------------------------------------------
-- Items — one row per published work.
-- ---------------------------------------------------------------------
create table royalty_items (
  id           uuid primary key default gen_random_uuid(),
  creator_id   uuid not null references profiles(id) on delete cascade,

  work_type    royalty_work_type not null,
  title        text not null,
  description  text,

  price_usd    numeric(12,2) not null check (price_usd > 0),

  -- Cloudinary references. file_url is the private downloadable asset;
  -- cover_image is a public thumbnail for the store listing.
  file_url     text not null,
  file_type    text,                     -- 'pdf', 'epub', ...
  cover_image  text,

  status       royalty_item_status not null default 'pending',
  reviewed_by  uuid references profiles(id),
  reviewed_at  timestamptz,
  reject_reason text,

  -- Denormalised counters (kept accurate by the purchase function/trigger).
  purchase_count int not null default 0,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_royalty_items_creator on royalty_items(creator_id);
create index idx_royalty_items_status  on royalty_items(status);
create index idx_royalty_items_type    on royalty_items(work_type);
create index idx_royalty_items_created on royalty_items(created_at desc);

create trigger trg_royalty_items_updated_at
  before update on royalty_items
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Purchases — one row per buyer per item. The unique constraint enforces
-- "buy once": a second purchase of the same item by the same buyer is
-- rejected at the database level (they already have permanent access).
-- ---------------------------------------------------------------------
create table royalty_purchases (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references royalty_items(id) on delete restrict,
  buyer_id      uuid not null references profiles(id) on delete restrict,

  -- Price snapshot at purchase time (the item's price may change later).
  amount_usd    numeric(12,2) not null check (amount_usd > 0),
  commission_usd numeric(12,2) not null,   -- platform 15%
  payout_usd    numeric(12,2) not null,    -- creator 85%

  reference     text,                      -- simulated gateway reference
  purchased_at  timestamptz not null default now(),

  unique (item_id, buyer_id)
);

create index idx_royalty_purchases_item  on royalty_purchases(item_id);
create index idx_royalty_purchases_buyer on royalty_purchases(buyer_id);

-- ---------------------------------------------------------------------
-- Ledger — append-only money trail for royalty sales, mirroring the escrow
-- ledger's discipline. Each purchase writes three rows (sale, commission,
-- payout) that sum to zero, so the platform's and creators' balances are
-- always reconstructable and never edited in place.
-- ---------------------------------------------------------------------
create table royalty_ledger (
  id          uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references royalty_purchases(id) on delete restrict,
  item_id     uuid not null references royalty_items(id) on delete restrict,
  entry_type  royalty_entry_type not null,
  amount_usd  numeric(12,2) not null,
  created_at  timestamptz not null default now(),

  constraint chk_royalty_ledger_sign check (
    (entry_type = 'sale' and amount_usd > 0)
    or (entry_type in ('commission', 'payout') and amount_usd < 0)
  )
);

create index idx_royalty_ledger_purchase on royalty_ledger(purchase_id);
create index idx_royalty_ledger_item     on royalty_ledger(item_id);

-- Append-only guard: corrections are compensating entries, never edits.
create trigger trg_royalty_ledger_no_update
  before update on royalty_ledger
  for each row execute function forbid_ledger_mutation();

create trigger trg_royalty_ledger_no_delete
  before delete on royalty_ledger
  for each row execute function forbid_ledger_mutation();

-- ---------------------------------------------------------------------
-- Public store view. THE single place that decides what's publicly
-- browsable: approved items only. An item taken down (status 'removed')
-- drops out automatically — same pattern as feed_posts.
-- security_invoker so row-level security still applies through the view.
-- ---------------------------------------------------------------------
create view royalty_store with (security_invoker = on) as
  select
    id, creator_id, work_type, title, description,
    price_usd, cover_image, file_type, purchase_count, created_at
  from royalty_items
  where status = 'approved';

-- Note: the view deliberately omits file_url. The downloadable asset is
-- never exposed by a browse query — access to it goes through a server
-- route that first checks the caller has purchased the item.

-- ---------------------------------------------------------------------
-- Security: deny-by-default RLS. Policies live in 15_rls_royalties.sql.
-- ---------------------------------------------------------------------
alter table royalty_items     enable row level security;
alter table royalty_purchases enable row level security;
alter table royalty_ledger    enable row level security;
