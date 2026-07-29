-- =====================================================================
-- Zirclaire — 18_messaging.sql
-- Direct messaging. Two kinds of conversation:
--   * project  — the buyer and the awarded provider on a project or service
--                order, so they can coordinate the work. Scoped to a real
--                transaction (discourages taking the deal off-platform).
--   * support  — a member and the admin team (the "service desk"). Starts in
--                a shared admin queue; the FIRST admin to claim it owns it,
--                and it then leaves every other admin's queue.
--
-- A bot may later sit in front of the support flow and hand off to a human;
-- nothing here needs to change for that — the bot would just be another way
-- messages get created.
--
-- Run AFTER 04_projects.sql (needs projects + profiles).
-- =====================================================================

create type conversation_type as enum ('project', 'support');

-- ---------------------------------------------------------------------
-- Conversations. One thread per project (the unique constraint enforces it);
-- many support threads, each owned by one member.
-- ---------------------------------------------------------------------
create table conversations (
  id                uuid primary key default gen_random_uuid(),
  type              conversation_type not null,

  project_id        uuid references projects(id) on delete cascade,   -- project threads
  created_by        uuid references profiles(id) on delete set null,  -- who opened it
  assigned_admin_id uuid references profiles(id) on delete set null,  -- support: the claimer

  last_message_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- A project thread has a project; a support thread doesn't.
  constraint chk_conversation_target check (
    (type = 'project' and project_id is not null) or
    (type = 'support' and project_id is null)
  ),
  -- Exactly one thread per project. (NULLs aren't unique in Postgres, so this
  -- doesn't constrain support threads.)
  unique (project_id)
);

create index idx_conversations_project on conversations(project_id);
create index idx_conversations_type    on conversations(type);
create index idx_conversations_admin   on conversations(assigned_admin_id);
create index idx_conversations_last    on conversations(last_message_at desc nulls last);

create trigger trg_conversations_updated_at
  before update on conversations
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Participants. Who is in a thread, plus their read marker (for unread
-- counts). Rows are written by the server functions, never the client.
-- ---------------------------------------------------------------------
create table conversation_participants (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  last_read_at    timestamptz,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index idx_participants_user on conversation_participants(user_id);

-- ---------------------------------------------------------------------
-- Messages.
-- ---------------------------------------------------------------------
create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references profiles(id) on delete cascade,
  body            text not null check (length(trim(body)) > 0),
  created_at      timestamptz not null default now()
);

create index idx_messages_conversation on messages(conversation_id, created_at);

-- Keep the conversation's last_message_at fresh so inboxes sort correctly.
-- SECURITY DEFINER so it can update conversations regardless of the sender's
-- (row-limited) rights — this is system bookkeeping.
create or replace function bump_conversation_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update conversations
    set last_message_at = new.created_at, updated_at = now()
    where id = new.conversation_id;
  return null;
end; $$;

create trigger trg_bump_conversation
  after insert on messages
  for each row execute function bump_conversation_on_message();

-- ---------------------------------------------------------------------
-- Security: deny-by-default RLS. Policies + functions in 19_rls_messaging.sql.
-- ---------------------------------------------------------------------
alter table conversations             enable row level security;
alter table conversation_participants enable row level security;
alter table messages                  enable row level security;
