alter table public.ai_memory_items
  drop constraint ai_memory_items_source_conversation_same_tenant_fkey;

alter table public.ai_memory_items
  add constraint ai_memory_items_source_conversation_fkey
  foreign key (source_conversation_id)
  references public.ai_conversations(id)
  on delete set null;

create or replace function internal_security.enforce_ai_memory_source_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source_conversation_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.ai_conversations conversation
    where conversation.id = new.source_conversation_id
      and conversation.tenant_id = new.tenant_id
      and conversation.owner_user_id = new.owner_user_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'HERA_MEMORY_SOURCE_SCOPE_INVALID';
  end if;

  return new;
end;
$$;

revoke all on function internal_security.enforce_ai_memory_source_scope() from public;

create trigger enforce_ai_memory_source_scope
before insert or update of tenant_id, owner_user_id, source_conversation_id
on public.ai_memory_items
for each row execute function internal_security.enforce_ai_memory_source_scope();

create index ai_memory_items_source_conversation_idx
on public.ai_memory_items (source_conversation_id)
where source_conversation_id is not null;

create table public.ai_user_preferences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  tone text not null default 'BUSINESS'
    check (tone in ('FRIENDLY', 'BUSINESS', 'DIRECT')),
  detail_level text not null default 'BALANCED'
    check (detail_level in ('COMPACT', 'BALANCED', 'EXTENDED')),
  seniority_level text not null default 'EXPERIENCED'
    check (seniority_level in ('BASIC', 'EXPERIENCED', 'EXPERT')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, owner_user_id)
);

create trigger set_ai_user_preferences_updated_at
before update on public.ai_user_preferences
for each row execute function internal_security.set_updated_at();

create index ai_user_preferences_owner_idx
on public.ai_user_preferences (owner_user_id);

alter table public.ai_user_preferences enable row level security;

create policy ai_user_preferences_owner_access
on public.ai_user_preferences
for all
to authenticated
using (
  owner_user_id = (select auth.uid())
  and (select internal_security.has_tenant_access(tenant_id))
)
with check (
  owner_user_id = (select auth.uid())
  and (select internal_security.has_tenant_access(tenant_id))
);

grant select, insert, update, delete on public.ai_user_preferences to authenticated;

alter type public.ai_draft_status add value if not exists 'AWAITING_CONFIRMATION';
alter type public.ai_draft_status add value if not exists 'EXECUTING';
alter type public.ai_draft_status add value if not exists 'SUCCEEDED';

alter table public.ai_action_drafts
  add column action_type text not null default 'PERSONAL_REMINDER'
    check (action_type in (
      'PERSONAL_REMINDER',
      'EMPLOYEE_ADDRESS_CHANGE',
      'EMPLOYMENT_SALARY_CHANGE',
      'EMPLOYMENT_SCHEDULE_CHANGE',
      'ORGANIZATION_PLACEMENT_CHANGE'
    )),
  add column version integer not null default 1 check (version > 0),
  add column control_payload jsonb not null default '{}'::jsonb;

alter table public.ai_action_drafts
  drop constraint ai_action_drafts_tool_name_check;

alter table public.ai_action_drafts
  add constraint ai_action_drafts_tool_name_check
  check (tool_name in (
    'draft_personal_reminder',
    'draft_employee_address_change',
    'draft_employment_salary_change',
    'draft_employment_schedule_change',
    'draft_organization_placement_change'
  ));
