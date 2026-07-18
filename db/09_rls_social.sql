-- =====================================================================
-- Zirclaire — 09_rls_social.sql
-- Row-Level Security for the social feed. Run AFTER 08_rls_projects.sql.
--
-- Agreed rules:
--   * Feed is PUBLIC to read (anonymous visitors included) — active posts,
--     their media, and comments are world-readable.
--   * Any WRITE requires an approved, logged-in user (RLS blocks anon;
--     the UI additionally shows a sign-up modal).
--   * Posts: only approved SPs create; author may DELETE own; NO editing
--     (no update policy exists).
--   * Comments: any approved SR or SP; author deletes own.
--   * Favorites/shares: each user manages their own.
--   * Reports: anyone approved may file; only admin (and the reporter)
--     can read them.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Visibility / ownership helpers (SECURITY DEFINER -> no policy recursion)
-- ---------------------------------------------------------------------
create or replace function post_is_visible(pid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from posts
    where id = pid and (status = 'active' or author_id = auth.uid())
  ) or is_admin(auth.uid());
$$;

create or replace function owns_post(pid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from posts where id = pid and author_id = auth.uid());
$$;

create or replace function comment_is_visible(cid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from comments c join posts p on p.id = c.post_id
    where c.id = cid and (p.status = 'active' or c.author_id = auth.uid())
  ) or is_admin(auth.uid());
$$;

create or replace function owns_comment(cid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from comments where id = cid and author_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- Posts
--   read   : public — active posts; author also sees own; admin sees all.
--   insert : approved Service Providers, authoring as themselves.
--   delete : the author (hard delete). Admin removal is server-side.
--   update : intentionally none (editing is disabled by design).
-- ---------------------------------------------------------------------
create policy "posts: public reads active; author/admin read all"
  on posts for select using (
    status = 'active' or author_id = auth.uid() or is_admin(auth.uid())
  );

create policy "posts: approved provider creates own"
  on posts for insert with check (
    author_id = auth.uid()
    and auth_role() = 'service_provider'
    and is_approved(auth.uid())
  );

create policy "posts: author deletes own"
  on posts for delete using (author_id = auth.uid());

-- ---------------------------------------------------------------------
-- Post media — visible with the post; written/removed by the post author.
-- ---------------------------------------------------------------------
create policy "post_media: visible with post"
  on post_media for select using (post_is_visible(post_id));

create policy "post_media: author inserts"
  on post_media for insert with check (owns_post(post_id));

create policy "post_media: author deletes"
  on post_media for delete using (owns_post(post_id));

-- ---------------------------------------------------------------------
-- Comments
--   read   : public (on visible posts).
--   insert : any approved user (SR or SP) on a visible post.
--   delete : the author. Admin removal is server-side.
-- ---------------------------------------------------------------------
create policy "comments: visible on visible posts"
  on comments for select using (post_is_visible(post_id));

create policy "comments: approved user comments on visible post"
  on comments for insert with check (
    author_id = auth.uid()
    and is_approved(auth.uid())
    and post_is_visible(post_id)
  );

create policy "comments: author deletes own"
  on comments for delete using (author_id = auth.uid());

-- ---------------------------------------------------------------------
-- Comment media — visible with the comment; managed by the comment author.
-- ---------------------------------------------------------------------
create policy "comment_media: visible with comment"
  on comment_media for select using (comment_is_visible(comment_id));

create policy "comment_media: author inserts"
  on comment_media for insert with check (owns_comment(comment_id));

create policy "comment_media: author deletes"
  on comment_media for delete using (owns_comment(comment_id));

-- ---------------------------------------------------------------------
-- Favorites & shares — each user manages only their own rows.
-- (Public-facing counts come from the denormalised columns on posts.)
-- ---------------------------------------------------------------------
create policy "favorites: user reads own"
  on post_favorites for select using (user_id = auth.uid() or is_admin(auth.uid()));

create policy "favorites: approved user adds own"
  on post_favorites for insert with check (user_id = auth.uid() and is_approved(auth.uid()));

create policy "favorites: user removes own"
  on post_favorites for delete using (user_id = auth.uid());

create policy "shares: user reads own"
  on post_shares for select using (user_id = auth.uid() or is_admin(auth.uid()));

create policy "shares: approved user adds own"
  on post_shares for insert with check (user_id = auth.uid() and is_approved(auth.uid()));

create policy "shares: user removes own"
  on post_shares for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Reports
--   read   : the reporter (their own) and admin.
--   insert : any approved user files a report as themselves.
--   resolve: server-side (admin), so no client update policy.
-- ---------------------------------------------------------------------
create policy "reports: reporter and admin read"
  on reports for select using (reporter_id = auth.uid() or is_admin(auth.uid()));

create policy "reports: approved user files own"
  on reports for insert with check (reporter_id = auth.uid() and is_approved(auth.uid()));
