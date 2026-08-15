-- =====================================================================
-- Zirclaire — 07_rls_identity.sql
-- Row-Level Security for the identity + reference layer.
-- Run AFTER the schema files (01–06).
--
-- Principle (agreed): the browser reads via RLS; all sensitive/money
-- writes go through server routes using the secret key (which bypasses
-- RLS). So here we define READ access; profile writes are handled by the
-- server and need no client policy.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper functions. SECURITY DEFINER so they read profiles WITHOUT
-- triggering RLS (prevents policy recursion on the profiles table).
-- ---------------------------------------------------------------------
create or replace function is_admin(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = uid and role = 'admin'
  );
$$;

create or replace function is_approved(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = uid and kyc_status = 'approved'
  );
$$;

-- Role of the currently authenticated user (null if not logged in).
create or replace function auth_role()
returns user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- Reference data — public lookup tables, readable by everyone.
-- (Writes only ever happen via the server / migrations.)
-- ---------------------------------------------------------------------
create policy "countries: readable by all"
  on countries for select using (true);

create policy "categories: readable by all"
  on categories for select using (true);

create policy "subcategories: readable by all"
  on subcategories for select using (true);

-- ---------------------------------------------------------------------
-- Profiles — the locked table.
-- Only the owner and admins can read the full row (with all its PII).
-- Everyone else is denied. No client INSERT/UPDATE/DELETE policies:
-- profile creation (signup) and edits go through server routes.
-- ---------------------------------------------------------------------
create policy "profiles: owner reads own"
  on profiles for select using (id = auth.uid());

create policy "profiles: admin reads all"
  on profiles for select using (is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- Public window over the locked table. A normal (definer-rights) view,
-- so it can read past the table's RLS — but it only ever selects the
-- safe columns, and only for approved users. This is what profile pages
-- and post author bylines read.
-- ---------------------------------------------------------------------
create view public_profiles as
  select
    id,
    member_id,
    full_name,
    role,
    profile_picture,
    country_id,
    created_at
  from profiles
  where kyc_status = 'approved';

grant select on public_profiles to anon, authenticated;

-- ---------------------------------------------------------------------
-- member_id_counters: no client policy, by design. RLS is enabled
-- (deny-all); the counter rows are written only by the assign_member_id()
-- SECURITY DEFINER trigger during KYC approval, never directly by a client.
-- ---------------------------------------------------------------------