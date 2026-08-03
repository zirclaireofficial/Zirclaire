-- =====================================================================
-- Zirclaire — 28_ticket_lifecycle.sql
-- A member's support is a continuous chat, but each ticket is its own unit:
-- once a ticket is CLOSED, the member's next message starts a NEW ticket with
-- a new number, rather than reopening the old one.
--
-- This changes start_support_conversation so it only resumes the member's
-- latest support ticket while it is still OPEN; otherwise it opens a fresh
-- ticket. (Admins still see each ticket as a separate conversation.)
--
-- Run AFTER 26 (ticket status) — needs closed_at + ticket_number.
-- =====================================================================

create or replace function start_support_conversation(p_actor uuid)
returns conversations language plpgsql as $$
declare v_convo conversations;
begin
  -- The member's most recent support ticket.
  select c.* into v_convo
    from conversations c
    where c.type = 'support' and c.created_by = p_actor
    order by c.created_at desc
    limit 1;

  -- Resume it only if it's still open; a closed ticket is done.
  if found and v_convo.closed_at is null then
    return v_convo;
  end if;

  -- Otherwise open a fresh ticket.
  insert into conversations (type, created_by, last_message_at, ticket_number)
    values ('support', p_actor, now(), nextval('support_ticket_seq'))
    returning * into v_convo;

  insert into conversation_participants (conversation_id, user_id)
    values (v_convo.id, p_actor);

  return v_convo;
end; $$;

revoke execute on function start_support_conversation(uuid) from public;
grant execute on function start_support_conversation(uuid) to service_role;
