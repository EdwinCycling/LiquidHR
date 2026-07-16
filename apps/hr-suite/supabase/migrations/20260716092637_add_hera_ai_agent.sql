create type public.ai_message_role as enum ('USER', 'ASSISTANT', 'TOOL');
create type public.ai_memory_category as enum ('PREFERENCE', 'WORKING_CONTEXT');
create type public.ai_draft_status as enum ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'EXECUTED', 'FAILED');

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nieuw gesprek' check (char_length(title) between 1 and 160),
  origin_channel text not null default 'WEB' check (char_length(origin_channel) between 1 and 32),
  summary text check (summary is null or char_length(summary) <= 6000),
  summary_cursor_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_conversations_tenant_id_id_key unique (tenant_id, id),
  constraint ai_conversations_administration_same_tenant_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id)
    on delete restrict
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  conversation_id uuid not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  role public.ai_message_role not null,
  content text not null check (char_length(content) between 1 and 12000),
  visible_tool_name text check (visible_tool_name is null or char_length(visible_tool_name) <= 80),
  origin_channel text not null default 'WEB' check (char_length(origin_channel) between 1 and 32),
  external_message_id text check (external_message_id is null or char_length(external_message_id) <= 255),
  model_id text check (model_id is null or char_length(model_id) <= 160),
  created_at timestamptz not null default timezone('utc', now()),
  constraint ai_messages_conversation_same_tenant_fkey
    foreign key (tenant_id, conversation_id)
    references public.ai_conversations(tenant_id, id)
    on delete cascade,
  constraint ai_messages_owner_matches_conversation check (owner_user_id is not null)
);

create unique index ai_messages_external_message_id_unique
  on public.ai_messages (conversation_id, external_message_id)
  where external_message_id is not null;

create table public.ai_memory_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  source_conversation_id uuid,
  category public.ai_memory_category not null,
  content text not null check (char_length(content) between 1 and 1000),
  consented_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_memory_items_source_conversation_same_tenant_fkey
    foreign key (tenant_id, source_conversation_id)
    references public.ai_conversations(tenant_id, id)
    on delete set null
);

create table public.ai_action_drafts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  conversation_id uuid not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  tool_name text not null check (tool_name in ('draft_personal_reminder')),
  payload jsonb not null default '{}'::jsonb,
  summary text not null check (char_length(summary) between 1 and 2000),
  status public.ai_draft_status not null default 'PENDING',
  idempotency_key uuid not null default gen_random_uuid(),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  executed_at timestamptz,
  failure_code text check (failure_code is null or char_length(failure_code) <= 120),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_action_drafts_conversation_same_tenant_fkey
    foreign key (tenant_id, conversation_id)
    references public.ai_conversations(tenant_id, id)
    on delete cascade,
  constraint ai_action_drafts_expiry_valid check (expires_at > created_at),
  constraint ai_action_drafts_idempotency_key_key unique (idempotency_key)
);

create index ai_conversations_owner_recent_idx on public.ai_conversations (tenant_id, owner_user_id, updated_at desc);
create index ai_messages_conversation_recent_idx on public.ai_messages (tenant_id, conversation_id, created_at asc);
create index ai_memory_items_owner_recent_idx on public.ai_memory_items (tenant_id, owner_user_id, updated_at desc);
create index ai_action_drafts_pending_idx on public.ai_action_drafts (tenant_id, owner_user_id, status, expires_at);

create trigger set_ai_conversations_updated_at before update on public.ai_conversations
for each row execute function internal_security.set_updated_at();
create trigger set_ai_memory_items_updated_at before update on public.ai_memory_items
for each row execute function internal_security.set_updated_at();
create trigger set_ai_action_drafts_updated_at before update on public.ai_action_drafts
for each row execute function internal_security.set_updated_at();

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_memory_items enable row level security;
alter table public.ai_action_drafts enable row level security;

create policy ai_conversations_owner_access on public.ai_conversations for all to authenticated
using (owner_user_id = (select auth.uid()) and (select internal_security.has_tenant_access(tenant_id)))
with check (owner_user_id = (select auth.uid()) and (select internal_security.has_tenant_access(tenant_id)));

create policy ai_messages_owner_access on public.ai_messages for all to authenticated
using (
  owner_user_id = (select auth.uid())
  and exists (
    select 1 from public.ai_conversations conversation
    where conversation.id = ai_messages.conversation_id
      and conversation.tenant_id = ai_messages.tenant_id
      and conversation.owner_user_id = (select auth.uid())
  )
)
with check (
  owner_user_id = (select auth.uid())
  and exists (
    select 1 from public.ai_conversations conversation
    where conversation.id = ai_messages.conversation_id
      and conversation.tenant_id = ai_messages.tenant_id
      and conversation.owner_user_id = (select auth.uid())
  )
);

create policy ai_memory_items_owner_access on public.ai_memory_items for all to authenticated
using (owner_user_id = (select auth.uid()) and (select internal_security.has_tenant_access(tenant_id)))
with check (owner_user_id = (select auth.uid()) and (select internal_security.has_tenant_access(tenant_id)));

create policy ai_action_drafts_owner_access on public.ai_action_drafts for all to authenticated
using (
  owner_user_id = (select auth.uid())
  and exists (
    select 1 from public.ai_conversations conversation
    where conversation.id = ai_action_drafts.conversation_id
      and conversation.tenant_id = ai_action_drafts.tenant_id
      and conversation.owner_user_id = (select auth.uid())
  )
)
with check (
  owner_user_id = (select auth.uid())
  and exists (
    select 1 from public.ai_conversations conversation
    where conversation.id = ai_action_drafts.conversation_id
      and conversation.tenant_id = ai_action_drafts.tenant_id
      and conversation.owner_user_id = (select auth.uid())
  )
);

grant select, insert, update, delete on public.ai_conversations to authenticated;
grant select, insert, update, delete on public.ai_messages to authenticated;
grant select, insert, update, delete on public.ai_memory_items to authenticated;
grant select, insert, update, delete on public.ai_action_drafts to authenticated;
