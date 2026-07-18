-- =====================================================================
-- Zirclaire — 12_social_grants.sql
-- Explicit table/view privileges for the public feed.
--
-- RLS decides WHICH ROWS a role may see; GRANT decides whether the role may
-- touch the table at all. Supabase's default privileges usually cover this,
-- but the feed is the one part of the app anonymous visitors must reach (for
-- SEO), so it is stated outright here rather than left to a default.
--
-- Row visibility is still entirely governed by the policies in
-- 09_rls_social.sql — these grants add no access beyond them.
--
-- Safe to re-run.
-- =====================================================================

-- Read side: the feed and everything hanging off it.
grant select on feed_posts    to anon, authenticated;
grant select on posts         to anon, authenticated;
grant select on post_media    to anon, authenticated;
grant select on comments      to anon, authenticated;
grant select on comment_media to anon, authenticated;

-- Write side: signed-in members only. RLS still restricts these to approved
-- users, correct roles, and own rows.
grant insert, delete on posts          to authenticated;
grant insert, delete on post_media     to authenticated;
grant insert, delete on comments       to authenticated;
grant insert, delete on comment_media  to authenticated;
grant insert, delete on post_favorites to authenticated;
grant insert, delete on post_shares    to authenticated;
grant select                on post_favorites to authenticated;
grant select                on post_shares    to authenticated;

-- Reports: file one, read your own (admins read all — same policy).
grant select, insert on reports to authenticated;
