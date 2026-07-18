-- =====================================================================
-- Zirclaire — 03_identity.sql
-- Users (profiles), KYC data, and localized member-ID generation.
-- Run AFTER 02_reference.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Per-(country, role) counter that powers SR/SP member IDs.
-- Admins use a separate global sequence (below).
-- ---------------------------------------------------------------------
create table member_id_counters (
  country_id  smallint  not null references countries(id) on delete cascade,
  role        user_role not null,
  last_number int       not null default 0,
  primary key (country_id, role)
);

-- Global counter for admin IDs (ADM00001, ADM00002, ...).
create sequence admin_member_seq start 1;

-- ---------------------------------------------------------------------
-- Profiles: one row per authenticated user.
-- FK to Supabase's auth.users. The app inserts this row at signup with
-- the KYC form data; admins are provisioned internally.
--
-- Most KYC fields are nullable at the DB level (admins don't have them);
-- required-ness for SR/SP signups is enforced in the application layer.
-- ---------------------------------------------------------------------
create table profiles (
  id                 uuid        primary key references auth.users(id) on delete cascade,
  role               user_role   not null,

  -- Identity / KYC
  full_name          text        not null,           -- as per national ID
  email              text        not null,
  phone              text,                            -- includes country code
  home_address       text,
  id_document_number text,                            -- national ID / passport no
  country_id         smallint    references countries(id),

  -- Payout / financial receiving account
  payout_provider    payout_provider,
  payout_account     text,

  -- Media (Cloudinary public IDs)
  id_document_image  text,                            -- sensitive: admin/owner only
  profile_picture    text,

  -- Verification
  kyc_status         kyc_status  not null default 'pending',
  kyc_reviewed_by    uuid        references profiles(id),
  kyc_reviewed_at    timestamptz,
  kyc_reject_reason  text,
  member_id          text        unique,              -- null until approved

  -- Housekeeping
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_profiles_role       on profiles(role);
create index idx_profiles_kyc_status on profiles(kyc_status);
create index idx_profiles_country    on profiles(country_id);

-- ---------------------------------------------------------------------
-- Generic updated_at maintenance
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on profiles
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Member-ID generation
-- Fires when a profile transitions INTO 'approved' and has no ID yet.
-- Format:  <country_prefix><role_token><5+ digit number>   e.g. MYRSR00001
--          admins:  ADM<5+ digit number>                   e.g. ADM00001
-- The per-(country, role) counter is incremented atomically via UPSERT,
-- so concurrent approvals never collide or skip.
-- ---------------------------------------------------------------------
create or replace function assign_member_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix     text;
  v_role_token text;
  v_number     int;
begin
  if new.kyc_status = 'approved'
     and (old.kyc_status is distinct from 'approved')
     and new.member_id is null
  then
    if new.role = 'admin' then
      v_number := nextval('admin_member_seq');
      new.member_id := 'ADM' || lpad(v_number::text, 5, '0');
    else
      if new.country_id is null then
        raise exception 'country_id is required to generate a member_id for role %', new.role;
      end if;

      v_role_token := case new.role
        when 'service_requester' then 'SR'
        when 'service_provider'  then 'SP'
      end;

      insert into member_id_counters (country_id, role, last_number)
        values (new.country_id, new.role, 1)
      on conflict (country_id, role)
        do update set last_number = member_id_counters.last_number + 1
      returning last_number into v_number;

      select member_prefix into v_prefix
        from countries where id = new.country_id;

      new.member_id := v_prefix || v_role_token || lpad(v_number::text, 5, '0');
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_assign_member_id
  before update on profiles
  for each row
  execute function assign_member_id();

-- ---------------------------------------------------------------------
-- Security: enable RLS now (deny-by-default). Access policies are added
-- in the dedicated RLS step. The server (service_role key) bypasses RLS
-- for privileged admin/escrow operations.
-- (Reference tables enable their own RLS in 02_reference.sql.)
-- ---------------------------------------------------------------------
alter table member_id_counters enable row level security;
alter table profiles           enable row level security;
