-- =====================================================================
-- Zirclaire — 23_audit.sql
-- The audit log: an append-only record of every privileged (staff) action,
-- with who did it and when. This is the Master's oversight trail.
--
-- Written ONLY by the server (service_role) from inside each privileged route,
-- so it can't be forged or edited from the browser. Readable ONLY by the
-- master. Append-only — corrections are new entries, never edits.
--
-- Run AFTER 20_master_role.sql (uses is_master).
-- =====================================================================

create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles(id) on delete set null,
  actor_role  text,
  action      text not null,        -- machine key, e.g. 'kyc.approve'
  target_type text,                 -- 'profile' | 'project' | 'post' | ...
  target_id   text,
  summary     text,                 -- human-readable one-liner
  detail      jsonb,                -- optional extra context
  created_at  timestamptz not null default now()
);

create index idx_audit_created on audit_log(created_at desc);
create index idx_audit_actor   on audit_log(actor_id);
create index idx_audit_action  on audit_log(action);
create index idx_audit_target  on audit_log(target_type, target_id);

alter table audit_log enable row level security;

-- Only the master reads the trail. No client write policy — the server writes
-- via the service role, which bypasses RLS.
create policy "audit: master reads" on audit_log for select using (is_master(auth.uid()));

-- Append-only: block edits/deletes even for the service role.
create or replace function forbid_audit_mutation()
returns trigger language plpgsql as $$
begin raise exception 'audit_log is append-only; % is not permitted', tg_op; end; $$;

create trigger trg_audit_no_update before update on audit_log
  for each row execute function forbid_audit_mutation();
create trigger trg_audit_no_delete before delete on audit_log
  for each row execute function forbid_audit_mutation();

grant select on audit_log to authenticated;
