-- =====================================================================
-- Zirclaire — 21_suspension.sql
-- Member (and admin) suspension. A suspended account:
--   * loses ALL write access — folded into is_approved(), so every existing
--     insert policy that already requires approval now also blocks the
--     suspended user. No new checks scattered around.
--   * becomes invisible to others — dropped from the public profile view, the
--     feed, and comment listings.
--   * still sees their OWN profile and content, plus a suspension notice with
--     the reason (the app reads is_suspended on their own row).
--
-- Suspension is NOT deletion — nothing is removed. Lifting it (unsuspend)
-- restores everything exactly as it was.
--
-- Suspension is written ONLY by the server (service_role): an admin may
-- suspend members; a master may also suspend admins. No client policy.
--
-- Run AFTER 20_master_role.sql (uses is_master) and the social layer.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Suspension state on the profile.
-- ---------------------------------------------------------------------
alter table profiles
  add column if not exists is_suspended    boolean not null default false,
  add column if not exists suspended_reason text,
  add column if not exists suspended_at     timestamptz,
  add column if not exists suspended_by     uuid references profiles(id);

-- ---------------------------------------------------------------------
-- Fold suspension into approval: a suspended account is treated as not
-- approved, so it can no longer post, comment, apply, order, or publish —
-- every write policy already gates on is_approved(). One change, total block.
-- ---------------------------------------------------------------------
create or replace function is_approved(uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = uid and kyc_status = 'approved' and is_suspended = false
  );
$$;

-- Definer helper so visibility checks can read suspension without tripping
-- over the profiles table's own RLS.
create or replace function author_not_suspended(uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select not exists (select 1 from profiles where id = uid and is_suspended = true);
$$;

-- ---------------------------------------------------------------------
-- Profile visibility — the public window now also excludes suspended
-- accounts. (The owner still reads their own row via the base-table policy.)
-- ---------------------------------------------------------------------
create or replace view public_profiles as
  select id, member_id, full_name, role, profile_picture, country_id, created_at
  from profiles
  where kyc_status = 'approved' and is_suspended = false;

grant select on public_profiles to anon, authenticated;

-- ---------------------------------------------------------------------
-- Post visibility — the feed drops posts by suspended authors.
-- ---------------------------------------------------------------------
create or replace view feed_posts with (security_invoker = on) as
  select *
  from posts p
  where p.status = 'active' and author_not_suspended(p.author_id);

-- ---------------------------------------------------------------------
-- Comment soft-delete. Comments gain a status so a removal can be UNDONE
-- (previously removal was a hard delete). Combined with the suspension check,
-- a comment is publicly visible only if it's active AND its author isn't
-- suspended; the author and staff always see it.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'comment_status') then
    create type comment_status as enum ('active', 'removed');
  end if;
end $$;

alter table comments add column if not exists status comment_status not null default 'active';

drop policy if exists "comments: visible on visible posts" on comments;
create policy "comments: visible on visible posts"
  on comments for select using (
    (post_is_visible(post_id) and status = 'active' and author_not_suspended(author_id))
    or author_id = auth.uid()
    or is_admin(auth.uid())
    or is_master(auth.uid())
  );

-- The comment_count trigger still fires on hard rows; with soft-delete we keep
-- the denormalised count meaningful by decrementing when a comment is hidden
-- and incrementing when restored.
create or replace function bump_comment_count_on_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'removed' and old.status = 'active' then
    update posts set comment_count = greatest(comment_count - 1, 0) where id = new.post_id;
  elsif new.status = 'active' and old.status = 'removed' then
    update posts set comment_count = comment_count + 1 where id = new.post_id;
  end if;
  return null;
end; $$;

drop trigger if exists trg_comment_count_status on comments;
create trigger trg_comment_count_status
  after update of status on comments
  for each row execute function bump_comment_count_on_status();
