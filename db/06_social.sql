-- =====================================================================
-- Zirclaire — 06_social.sql
-- The main-page social feed: posts, media, comments, engagement, and
-- reactive moderation (reports). Run AFTER 05_escrow.sql.
--
-- Moderation model: posts go live IMMEDIATELY (status 'active'). There
-- is no pre-approval. The posts/comments tables are intentionally
-- UNAWARE of moderation — they carry no moderation fields.
--   * reactive  — users file `reports`; an admin reviews (built here).
--   * automated — a FUTURE, fully external "sweeper" (fail-open async)
--                 reads new posts, calls an AI screening API, records its
--                 findings in its OWN separate table, and — to take a post
--                 down — simply flips the post's status to 'removed', the
--                 same lever a human admin uses. Nothing here changes when
--                 that is added; feed visibility stays centralised in the
--                 `feed_posts` view + the RLS SELECT policy.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Posts — top-level entries authored by Service Providers.
-- Engagement counts are denormalised and kept accurate by triggers.
-- ---------------------------------------------------------------------
create table posts (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references profiles(id) on delete cascade,
  body           text,
  status         post_status not null default 'active',

  -- Denormalised engagement counters (maintained by triggers below).
  favorite_count int not null default 0,
  comment_count  int not null default 0,
  share_count    int not null default 0,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_posts_author  on posts(author_id);
create index idx_posts_status  on posts(status);
create index idx_posts_created on posts(created_at desc);

create trigger trg_posts_updated_at
  before update on posts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Post media — up to 3 images/videos per post (Cloudinary references).
-- unique(post_id, position) + position 1..3 caps a post at 3 items.
-- ---------------------------------------------------------------------
create table post_media (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  media_url  text not null,
  media_type text,                       -- 'image' | 'video'
  position   smallint not null default 1 check (position between 1 and 3),
  created_at timestamptz not null default now(),
  unique (post_id, position)
);

create index idx_post_media_post on post_media(post_id);

-- ---------------------------------------------------------------------
-- Comments — by SRs or SPs. Optional threading via parent_comment_id.
-- Like posts, comments carry no moderation fields (see header note).
-- ---------------------------------------------------------------------
create table comments (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid not null references posts(id) on delete cascade,
  author_id         uuid not null references profiles(id) on delete cascade,
  parent_comment_id uuid references comments(id) on delete cascade,
  body              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_comments_post   on comments(post_id);
create index idx_comments_author on comments(author_id);
create index idx_comments_parent on comments(parent_comment_id);

create trigger trg_comments_updated_at
  before update on comments
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Comment media — media attached within a comment (SRs can attach media).
-- ---------------------------------------------------------------------
create table comment_media (
  id         uuid primary key default gen_random_uuid(),
  comment_id uuid not null references comments(id) on delete cascade,
  media_url  text not null,
  media_type text,
  position   smallint not null default 1,
  created_at timestamptz not null default now()
);

create index idx_comment_media_comment on comment_media(comment_id);

-- ---------------------------------------------------------------------
-- Engagement: favorites (one per user per post) and shares (a log).
-- ---------------------------------------------------------------------
create table post_favorites (
  post_id    uuid not null references posts(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table post_shares (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  user_id    uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_post_shares_post on post_shares(post_id);

-- ---------------------------------------------------------------------
-- Reports — reactive moderation. A user flags a post or comment; an
-- admin resolves it. Exactly one target must be set (enforced by check).
-- ---------------------------------------------------------------------
create table reports (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'comment')),
  post_id     uuid references posts(id) on delete cascade,
  comment_id  uuid references comments(id) on delete cascade,
  reporter_id uuid not null references profiles(id) on delete cascade,
  reason      text,
  status      report_status not null default 'open',
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),

  constraint chk_report_target check (
    (target_type = 'post'    and post_id    is not null and comment_id is null) or
    (target_type = 'comment' and comment_id is not null and post_id    is null)
  )
);

create index idx_reports_status  on reports(status);
create index idx_reports_post    on reports(post_id);
create index idx_reports_comment on reports(comment_id);

-- ---------------------------------------------------------------------
-- Engagement counter maintenance (keeps posts.*_count accurate).
-- SECURITY DEFINER so the counter UPDATE on posts is not blocked by RLS
-- (posts have no client UPDATE policy) — this is system bookkeeping.
-- ---------------------------------------------------------------------
create or replace function bump_favorite_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update posts set favorite_count = favorite_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update posts set favorite_count = greatest(favorite_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end; $$;

create trigger trg_favorite_count
  after insert or delete on post_favorites
  for each row execute function bump_favorite_count();

create or replace function bump_comment_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end; $$;

create trigger trg_comment_count
  after insert or delete on comments
  for each row execute function bump_comment_count();

create or replace function bump_share_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update posts set share_count = share_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update posts set share_count = greatest(share_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end; $$;

create trigger trg_share_count
  after insert or delete on post_shares
  for each row execute function bump_share_count();

-- ---------------------------------------------------------------------
-- Central feed visibility. THE single place that decides what appears
-- publicly: active posts only. The future sweeper takes a post down by
-- setting status = 'removed', so it drops out of this view automatically
-- — no change needed here. security_invoker = on so row-level security
-- still applies through the view.
-- ---------------------------------------------------------------------
create view feed_posts with (security_invoker = on) as
  select *
  from posts
  where status = 'active';

-- ---------------------------------------------------------------------
-- Security: deny-by-default RLS (policies added later).
-- ---------------------------------------------------------------------
alter table posts          enable row level security;
alter table post_media     enable row level security;
alter table comments       enable row level security;
alter ta