-- =====================================================================
-- Zirclaire — 13_create_admin.sql
-- Provision an ADMIN account (auth user + profile) from the SQL editor.
--
-- ⚠ This writes directly into auth.users, which is GoTrue's private schema.
--   It works, but it is NOT officially supported: if Supabase changes the
--   auth schema, hand-written rows can break. The supported alternative is
--   Dashboard → Authentication → Users → Add user (tick "Auto Confirm
--   User"), then run PART 2 of this file only.
--
-- Admins are provisioned internally — they never go through KYC signup —
-- so this is the intended way to make one.
--
-- EDIT THE THREE VALUES BELOW, then run the whole file.
-- =====================================================================

do $$
declare
  -- ------------------------------------------------------------------
  v_email    text := 'admin@zirclaire.com';   -- << change
  v_password text := 'ChangeThisNow!2026';    -- << change
  v_name     text := 'Zirclaire Admin';       -- << change
  -- ------------------------------------------------------------------
  v_user_id  uuid;
begin
  -- Refuse to run twice for the same email rather than creating a duplicate.
  if exists (select 1 from auth.users where email = lower(v_email)) then
    raise exception 'A user with email % already exists', v_email;
  end if;

  v_user_id := gen_random_uuid();

  -- ---------------- PART 1: the auth user ----------------
  -- encrypted_password uses bcrypt via pgcrypto, which is what GoTrue
  -- expects. email_confirmed_at is stamped so there's no confirmation step.
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    lower(v_email),
    crypt(v_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', v_name),
    false
  );

  -- GoTrue also needs a matching identity row, or email/password sign-in
  -- fails even though the user exists.
  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    v_user_id,
    v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', lower(v_email), 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  );

  -- ---------------- PART 2: the profile ----------------
  -- Inserted as 'pending' first, then updated to 'approved'. That is
  -- deliberate: assign_member_id() is a BEFORE UPDATE trigger, so it only
  -- fires on the transition INTO approved. Inserting as approved directly
  -- would leave member_id null.
  insert into profiles (id, role, full_name, email, kyc_status)
  values (v_user_id, 'admin', v_name, lower(v_email), 'pending');

  update profiles
     set kyc_status = 'approved',
         kyc_reviewed_at = now()
   where id = v_user_id;

  raise notice 'Admin created: % (id %)', v_email, v_user_id;
end $$;

-- Check it worked — member_id should read ADM00001, ADM00002, ...
select p.member_id, p.full_name, p.email, p.role, p.kyc_status,
       u.email_confirmed_at is not null as email_confirmed
from profiles p
join auth.users u on u.id = p.id
where p.role = 'admin'
order by p.created_at;
