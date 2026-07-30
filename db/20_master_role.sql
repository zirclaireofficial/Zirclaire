-- =====================================================================
-- Zirclaire — 20_master_role.sql
-- Introduces the MASTER role — the highest level, above admin. This file
-- only adds the role value and the helpers to recognise it; the full master
-- console (audit log, analytics, all-inboxes, admin creation) comes later.
--
-- For now the master's one active power is suspension reach: an admin may
-- suspend members, a master may also suspend admins (enforced in the server
-- routes, using is_master below).
--
-- NOTE on enum values: we never write the literal 'master'::user_role in any
-- function body here (we compare role::text = 'master' instead), so this file
-- is safe to run in a single transaction even though the value is brand new.
-- The master account itself is seeded separately (like the first admin) once
-- this has committed.
--
-- Run AFTER the identity layer (03 + 07).
-- =====================================================================

alter type user_role add value if not exists 'master';

-- Is this user the master? (text compare avoids needing the enum literal
-- committed before this function is created.)
create or replace function is_master(uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = uid and role::text = 'master');
$$;

-- Admin OR master — "staff". Handy for read policies the master should also
-- pass. Existing admin-only policies are left untouched for now.
create or replace function is_staff(uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = uid and role::text in ('admin', 'master'));
$$;

-- Masters get an MST id from their own sequence (like admins get ADM).
create sequence if not exists master_member_seq start 1;

-- Extend the member-ID trigger to know about master. Rewritten with ::text
-- role comparisons so the brand-new 'master' value doesn't need to be
-- committed before this function is created.
create or replace function assign_member_id()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_prefix     text;
  v_role_token text;
  v_number     int;
begin
  if new.kyc_status = 'approved'
     and (old.kyc_status is distinct from 'approved')
     and new.member_id is null
  then
    if new.role::text = 'admin' then
      new.member_id := 'ADM' || lpad(nextval('admin_member_seq')::text, 5, '0');
    elsif new.role::text = 'master' then
      new.member_id := 'MST' || lpad(nextval('master_member_seq')::text, 5, '0');
    else
      if new.country_id is null then
        raise exception 'country_id is required to generate a member_id for role %', new.role;
      end if;
      v_role_token := case new.role::text
        when 'service_requester' then 'SR'
        when 'service_provider'  then 'SP'
      end;
      insert into member_id_counters (country_id, role, last_number)
        values (new.country_id, new.role, 1)
      on conflict (country_id, role)
        do update set last_number = member_id_counters.last_number + 1
      returning last_number into v_number;
      select member_prefix into v_prefix from countries where id = new.country_id;
      new.member_id := v_prefix || v_role_token || lpad(v_number::text, 5, '0');
    end if;
  end if;
  return new;
end; $$;
