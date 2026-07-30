-- =====================================================================
-- Zirclaire — 22_create_master.sql
-- Seed the first MASTER account. Like the first admin, the master can't be
-- created inside the app (nothing above it exists yet), so it's seeded here.
-- After this, the master creates admins from the console.
--
-- ⚠ Same caveat as 13_create_admin.sql: this writes into auth.users, GoTrue's
--   private schema — supported alternative is Dashboard → Authentication →
--   Users → Add user (auto-confirm), then run PART 2 only.
--
-- Run AFTER 20_master_role.sql has COMMITTED (so 'master' exists as a role).
-- EDIT THE THREE VALUES, then run.
-- =====================================================================

do $$
declare
  v_email    text := 'master@zirclaire.com';   -- << change
  v_password text := 'ChangeThisNow!2026';     -- << change
  v_name     text := 'Zirclaire Master';       -- << change
  v_user_id  uuid;
begin
  if exists (select 1 from auth.users where email = lower(v_email)) then
    raise exception 'A user with email % already exists', v_email;
  end if;
  v_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    lower(v_email), crypt(v_password, gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', v_name), false
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_user_id, v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', lower(v_email), 'email_verified', true),
    'email', now(), now(), now()
  );

  -- PART 2: the profile. Inserted pending, then approved so the member-ID
  -- trigger fires and issues MST00001.
  insert into profiles (id, role, full_name, email, kyc_status)
    values (v_user_id, 'master', v_name, lower(v_email), 'pending');
  update profiles set kyc_status = 'approved', kyc_reviewed_at = now() where id = v_user_id;

  raise notice 'Master created: % (id %)', v_email, v_user_id;
end $$;

select p.member_id, p.full_name, p.email, p.role
from profiles p where p.role::text = 'master' order by p.created_at;
