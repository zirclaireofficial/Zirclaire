-- =====================================================================
-- Zirclaire — 19_rls_messaging.sql
-- RLS + transitions for messaging. Run AFTER 18_messaging.sql.
--
-- Agreed rules:
--   * A conversation is readable only by its participants.
--   * EXCEPTION for support: an admin may see a support thread while it is
--     unclaimed (the shared queue) OR if it is claimed by them. Once another
--     admin claims it (assigned_admin_id set), it leaves everyone else's view.
--   * Sending a message requires being a participant. An admin therefore has
--     to CLAIM a support thread (which adds them as a participant) before they
--     can reply — that's what makes "first to pick it up owns it" real.
--   * Participants + conversations are created by server functions; the one
--     client write is sending a message (safe — no money).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers (SECURITY DEFINER -> no policy recursion)
-- ---------------------------------------------------------------------
create or replace function is_conversation_participant(cid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from conversation_participants
    where conversation_id = cid and user_id = auth.uid()
  );
$$;

-- Can the current caller access this conversation at all? Participants always;
-- admins additionally for support threads that are unclaimed or theirs.
create or replace function can_access_conversation(cid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from conversations c
    where c.id = cid and (
      is_conversation_participant(cid)
      or (
        c.type = 'support'
        and is_admin(auth.uid())
        and (c.assigned_admin_id is null or c.assigned_admin_id = auth.uid())
      )
    )
  );
$$;

-- ---------------------------------------------------------------------
-- Conversations — read only. Creation is via the server functions below.
-- ---------------------------------------------------------------------
create policy "conversations: participants and support-queue admins read"
  on conversations for select using (can_access_conversation(id));

-- ---------------------------------------------------------------------
-- Participants — a member reads and updates only their own row (the read
-- marker). No client insert (server adds participants).
-- ---------------------------------------------------------------------
create policy "participants: read own"
  on conversation_participants for select using (user_id = auth.uid());

create policy "participants: update own read marker"
  on conversation_participants for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Messages
--   read   : anyone who can access the conversation.
--   insert : a participant, as themselves. (Admins must claim support first,
--            which makes them a participant.)
-- ---------------------------------------------------------------------
create policy "messages: readable with the conversation"
  on messages for select using (can_access_conversation(conversation_id));

create policy "messages: participant sends as self"
  on messages for insert with check (
    sender_id = auth.uid() and is_conversation_participant(conversation_id)
  );

-- ---------------------------------------------------------------------
-- Get-or-create the thread for a project. Called by the server; validates the
-- caller is a party and the project has an awarded provider (nobody to talk to
-- otherwise). Idempotent: returns the existing thread if there is one.
-- ---------------------------------------------------------------------
create or replace function open_project_conversation(p_project uuid, p_actor uuid)
returns conversations language plpgsql as $$
declare
  v_project projects;
  v_convo   conversations;
begin
  select * into v_project from projects where id = p_project;
  if not found then raise exception 'project % not found', p_project; end if;
  if v_project.awarded_provider_id is null then
    raise exception 'project % has no awarded provider to message', p_project;
  end if;
  if p_actor <> v_project.requester_id and p_actor <> v_project.awarded_provider_id then
    raise exception 'only the buyer or the awarded provider may open this thread';
  end if;

  select * into v_convo from conversations where project_id = p_project;
  if found then return v_convo; end if;

  insert into conversations (type, project_id, created_by, last_message_at)
    values ('project', p_project, p_actor, now())
    returning * into v_convo;

  insert into conversation_participants (conversation_id, user_id) values
    (v_convo.id, v_project.requester_id),
    (v_convo.id, v_project.awarded_provider_id);

  return v_convo;
end; $$;

-- ---------------------------------------------------------------------
-- Get-or-create a member's support thread. One open desk thread per member
-- keeps the inbox tidy; the bot/admin replies in the same thread.
-- ---------------------------------------------------------------------
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

  insert into conversations (type, created_by, last_message_at)
    values ('support', p_actor, now())
    returning * into v_convo;

  insert into conversation_participants (conversation_id, user_id)
    values (v_convo.id, p_actor);

  return v_convo;
end; $$;

-- ---------------------------------------------------------------------
-- Claim a support thread. Atomic: sets assigned_admin_id only if still
-- unclaimed, then joins the admin as a participant so they can reply. A second
-- admin trying to claim gets a clean error.
-- ---------------------------------------------------------------------
create or replace function claim_support_conversation(p_convo uuid, p_admin uuid)
returns conversations language plpgsql as $$
declare v_convo conversations;
begin
  update conversations
    set assigned_admin_id = p_admin
    where id = p_convo and type = 'support' and assigned_admin_id is null
    returning * into v_convo;
  if not found then
    raise exception 'support thread % is already claimed or not a support thread', p_convo;
  end if;

  insert into conversation_participants (conversation_id, user_id)
    values (p_convo, p_admin)
    on conflict do nothing;

  return v_convo;
end; $$;

revoke execute on function open_project_conversation(uuid, uuid) from public;
revoke execute on function start_support_conversation(uuid) from public;
revoke execute on function claim_support_conversation(uuid, uuid) from public;
grant execute on function open_project_conversation(uuid, uuid) to service_role;
grant execute on function start_support_conversation(uuid) to service_role;
grant execute on function claim_support_conversation(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------
-- Grants.
-- ---------------------------------------------------------------------
grant select on conversations to authenticated;
grant select, update on conversation_participants to authenticated;
grant select, insert on messages to authenticated;

-- ---------------------------------------------------------------------
-- Realtime: add messages to Supabase's realtime publication so the inbox
-- receives new rows live. RLS still filters the stream per subscriber.
-- Guarded so this file also runs on a plain Postgres (tests).
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table messages;
  end if;
end $$;
