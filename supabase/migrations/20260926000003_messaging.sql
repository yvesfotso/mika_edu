-- Messaging: a support conversation with the EduPrep team per learner, and direct study chats
-- between learners who exchanged friend codes. All writes go through the API (service role).

-- ---------------------------------------------------------------------------
-- Friend codes
-- ---------------------------------------------------------------------------

create or replace function public.generate_friend_code() returns text
language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where friend_code = code);
  end loop;
  return code;
end;
$$;

alter table public.profiles add column friend_code text;
update public.profiles set friend_code = public.generate_friend_code() where friend_code is null;
alter table public.profiles
  alter column friend_code set default public.generate_friend_code(),
  alter column friend_code set not null,
  add constraint profiles_friend_code_key unique (friend_code);

-- ---------------------------------------------------------------------------
-- Conversations and messages
-- ---------------------------------------------------------------------------

create type public.conversation_kind as enum ('support', 'direct');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind public.conversation_kind not null,
  -- support: the learner the conversation belongs to
  student_id uuid references public.profiles(id) on delete cascade,
  -- direct: '<lower user id>:<higher user id>' so a pair never gets two conversations
  direct_key text unique,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  staff_last_read_at timestamptz,
  constraint conversation_shape check (
    (kind = 'support' and student_id is not null and direct_key is null)
    or (kind = 'direct' and direct_key is not null and student_id is null)
  )
);
create unique index conversations_one_support_per_student on public.conversations (student_id) where kind = 'support';
create index conversations_support_recent_idx on public.conversations (last_message_at desc) where kind = 'support';

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  -- Client-generated id so a retried send never posts twice.
  client_message_id uuid,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique (sender_id, client_message_id)
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index messages_sender_recent_idx on public.messages (sender_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Safety: blocks and reports
-- ---------------------------------------------------------------------------

create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.message_reports (
  id bigint generated always as identity primary key,
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null default '',
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

-- ---------------------------------------------------------------------------
-- RLS: members may read their own conversations; everything else is API-only.
-- ---------------------------------------------------------------------------

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.user_blocks enable row level security;
alter table public.message_reports enable row level security;

create policy "read own memberships" on public.conversation_members
  for select using (user_id = auth.uid());
create policy "members read conversations" on public.conversations
  for select using (exists (
    select 1 from public.conversation_members m where m.conversation_id = conversations.id and m.user_id = auth.uid()
  ));
create policy "members read messages" on public.messages
  for select using (exists (
    select 1 from public.conversation_members m where m.conversation_id = messages.conversation_id and m.user_id = auth.uid()
  ));
create policy "read own blocks" on public.user_blocks
  for select using (blocker_id = auth.uid());
