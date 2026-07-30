-- =====================================================================
-- Zirclaire — 25_master_desk.sql
-- Two things:
--  (1) Give the MASTER full read across projects and messaging (same gap we
--      fixed for profiles — master isn't literally 'admin', so the admin
--      read policies didn't include it). This makes the all-projects view and
--      inbox oversight actually populate for the master.
--  (2) The service-desk workflow: human ticket numbers, system (bot) messages,
--      and an auto-reply that greets the user and tells them an agent is coming.
--
-- Run AFTER 20 (is_master) and 18/19 (messaging).
-- =====================================================================

-- ---------------------------------------------------------------------
-- (1) Master read policies. Permissive policies combine with OR, so these
-- simply add master on top of the existing admin/party rules.
-- ---------------------------------------------------------------------
create policy "projects: master reads all"            on projects            for select using (is_master(auth.uid()));
create policy "applications: master reads all"         on applications         for select using (is_master(auth.uid()));
create policy "deliverables: master reads all"         on deliverables         for select using (is_master(auth.uid()));
create policy "reviews: master reads all"              on reviews              for select using (is_master(auth.uid()));
create policy "escrow_ledger: master reads all"        on escrow_ledger        for select using (is_master(auth.uid()));
create policy "project_attachments: master reads all"  on project_attachments  for select using (is_master(auth.uid()));
create policy "payments: master reads all"             on payments             for select using (is_master(auth.uid()));
create policy "conversations: master reads all"        on conversations        for select using (is_master(auth.uid()));
create policy "participants: master reads all"         on conversation_participants for select using (is_master(auth.uid()));
create policy "messages: master reads all"             on messages             for select using (is_master(auth.uid()));

-- ---------------------------------------------------------------------
-- (2a) System messages. The bot posts with no human sender, so sender_id
-- becomes nullable and a flag marks it as automated (rendered differently).
-- ---------------------------------------------------------------------
alter table messages add column if not exists is_system boolean not null default false;
alter table messages alter column sender_id drop not null;

-- ---------------------------------------------------------------------
-- (2b) Human ticket numbers for support threads.
-- ---------------------------------------------------------------------
create sequence if not exists support_ticket_seq start 1000;
alter table conversations add column if not exists ticket_number int;

-- Recreate start_support_conversation to stamp a ticket number on creation.
create or replace function start_support_conversation(p_actor uuid)
returns conversations language plpgsql as $$
declare v_convo conversations;
begin
  select c.* into v_convo
    from conversations c
    join conversation_participants p on p.conversation_id = c.id
    where c.type = 'support' and p.user_id = p_actor
    limit 1;
  if found then return v_convo; end if;

  insert into conversations (type, created_by, last_message_at, ticket_number)
    values ('support', p_actor, now(), nextval('support_ticket_seq'))
    returning * into v_convo;

  insert into conversation_participants (conversation_id, user_id)
    values (v_convo.id, p_actor);

  return v_convo;
end; $$;
revoke execute on function start_support_conversation(uuid) from public;
grant execute on function start_support_conversation(uuid) to service_role;

-- ---------------------------------------------------------------------
-- (2c) Auto-reply. On the ticket owner's messages only:
--   * their 1st message -> ask them to explain the problem,
--   * their 2nd message -> confirm the ticket and that an agent is coming.
-- System replies have sender_id NULL, so they never re-trigger this (the
-- guard requires the sender to be the ticket owner). Admin replies (sender is
-- not the owner) don't trigger it either.
-- ---------------------------------------------------------------------
create or replace function support_autoreply()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_conv conversations; v_user_msgs int;
begin
  select * into v_conv from conversations where id = new.conversation_id;
  if v_conv.type <> 'support' then return null; end if;
  if new.sender_id is null or new.sender_id <> v_conv.created_by then return null; end if;

  select count(*) into v_user_msgs
    from messages where conversation_id = new.conversation_id and sender_id = v_conv.created_by;

  if v_user_msgs = 1 then
    insert into messages (conversation_id, sender_id, body, is_system) values (
      new.conversation_id, null,
      'Welcome to the Zirclaire service desk. Please describe your issue in as much detail as you can — what happened, what you were trying to do, and any project or order it relates to.',
      true
    );
  elsif v_user_msgs = 2 then
    insert into messages (conversation_id, sender_id, body, is_system) values (
      new.conversation_id, null,
      'Thanks — your request has been logged as ticket #' || coalesce(v_conv.ticket_number::text, '—') ||
      '. An agent will review it and be with you shortly. Feel free to add any more details here in the meantime.',
      true
    );
  end if;
  return null;
end; $$;

drop trigger if exists trg_support_autoreply on messages;
create trigger trg_support_autoreply
  after insert on messages
  for each row execute function support_autoreply();
