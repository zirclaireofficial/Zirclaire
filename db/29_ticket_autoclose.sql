-- =====================================================================
-- Zirclaire — 29_ticket_autoclose.sql
-- Auto-close support tickets that have gone quiet for 24 hours, and post the
-- same closure notice a manual close does. Runs on a schedule (pg_cron).
--
-- Setup: enable pg_cron once (Supabase → Database → Extensions → pg_cron).
-- If it isn't enabled, the function is still created — you can call it manually
-- or trigger it from any external scheduler; only the cron.schedule below is
-- skipped.
--
-- Run AFTER 26/28 (tickets + lifecycle).
-- =====================================================================

create or replace function autoclose_stale_tickets()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  with stale as (
    update conversations
      set closed_at = now()
      where type = 'support'
        and closed_at is null
        and coalesce(last_message_at, created_at) < now() - interval '24 hours'
      returning id, ticket_number
  )
  insert into messages (conversation_id, sender_id, is_system, body)
    select id, null, true,
           'Ticket #' || coalesce(ticket_number::text, '—') ||
           ' was closed automatically after 24 hours with no activity. Send a new message any time and we''ll open a new ticket.'
    from stale;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

-- Schedule hourly if pg_cron is available (24h idle only needs hourly checks).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    -- Replace any existing job of this name, then (re)create it.
    perform cron.unschedule('zc-autoclose-tickets')
      where exists (select 1 from cron.job where jobname = 'zc-autoclose-tickets');
    perform cron.schedule('zc-autoclose-tickets', '0 * * * *', 'select autoclose_stale_tickets();');
  end if;
end $$;
