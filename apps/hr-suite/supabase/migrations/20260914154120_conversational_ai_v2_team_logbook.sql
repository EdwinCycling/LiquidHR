begin;

-- Conversational AI V2 keeps team scope and personal notes separate from
-- employee dossiers. Session tables are server-owned; logbook rows are
-- owner-owned and contain only the reviewed business artifact.
create table public.ai_team_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  hr_group_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_employee_id uuid,
  administration_id uuid,
  context_department_id uuid,
  context_name_snapshot text not null check (length(btrim(context_name_snapshot)) between 1 and 200),
  scope_type text not null check (scope_type in ('DIRECT_TEAM', 'DEPARTMENT')),
  conversation_type text not null default 'VOICE' check (conversation_type in ('VOICE', 'TEXT')),
  model_id text not null check (length(btrim(model_id)) between 1 and 120),
  status text not null check (status in ('ACTIVE', 'ENDED', 'FAILED')),
  authorized_employee_count integer not null check (authorized_employee_count >= 0),
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  tool_call_count integer not null default 0 check (tool_call_count >= 0),
  constraint ai_team_sessions_tenant_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete restrict,
  constraint ai_team_sessions_actor_employee_fkey
    foreign key (tenant_id, hr_group_id, actor_employee_id)
    references public.employees(tenant_id, hr_group_id, id)
    on delete set null,
  constraint ai_team_sessions_administration_fkey
    foreign key (tenant_id, hr_group_id, administration_id)
    references public.administrations(tenant_id, hr_group_id, id)
    on delete restrict,
  constraint ai_team_sessions_department_fkey
    foreign key (tenant_id, hr_group_id, context_department_id)
    references public.departments(tenant_id, hr_group_id, id)
    on delete restrict,
  constraint ai_team_sessions_scope_key unique (tenant_id, hr_group_id, id)
);

create index ai_team_sessions_actor_started_idx
  on public.ai_team_sessions (tenant_id, hr_group_id, actor_user_id, started_at desc);
create index ai_team_sessions_scope_started_idx
  on public.ai_team_sessions (tenant_id, hr_group_id, started_at desc);

create table public.ai_team_session_members (
  session_id uuid not null,
  tenant_id uuid not null,
  hr_group_id uuid not null,
  employee_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (session_id, employee_id),
  constraint ai_team_session_members_session_fkey
    foreign key (tenant_id, hr_group_id, session_id)
    references public.ai_team_sessions(tenant_id, hr_group_id, id)
    on delete cascade,
  constraint ai_team_session_members_employee_fkey
    foreign key (tenant_id, hr_group_id, employee_id)
    references public.employees(tenant_id, hr_group_id, id)
    on delete restrict
);

create index ai_team_session_members_employee_idx
  on public.ai_team_session_members (tenant_id, hr_group_id, employee_id);

create table public.personal_logbook_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hr_group_id uuid not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  administration_id uuid,
  context_department_id uuid,
  context_name_snapshot text,
  source text not null check (source in ('MANUAL', 'AI_TEAM_SUMMARY')),
  source_session_id uuid,
  title text not null check (length(btrim(title)) between 1 and 160),
  description text not null default '' check (length(description) <= 4000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint personal_logbook_entries_tenant_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete restrict,
  constraint personal_logbook_entries_administration_fkey
    foreign key (tenant_id, hr_group_id, administration_id)
    references public.administrations(tenant_id, hr_group_id, id)
    on delete restrict,
  constraint personal_logbook_entries_department_fkey
    foreign key (tenant_id, hr_group_id, context_department_id)
    references public.departments(tenant_id, hr_group_id, id)
    on delete restrict,
  constraint personal_logbook_entries_session_fkey
    foreign key (tenant_id, hr_group_id, source_session_id)
    references public.ai_team_sessions(tenant_id, hr_group_id, id)
    on delete restrict,
  constraint personal_logbook_entries_source_context_check
    check (
      (source = 'MANUAL' and source_session_id is null)
      or (source = 'AI_TEAM_SUMMARY' and source_session_id is not null)
    )
);

create index personal_logbook_entries_owner_created_idx
  on public.personal_logbook_entries (tenant_id, hr_group_id, owner_user_id, created_at desc);

create trigger set_personal_logbook_entries_updated_at
before update on public.personal_logbook_entries
for each row execute function internal_security.set_updated_at();

-- Do not copy private title/body values into generic audit logs. The audit
-- record proves the mutation and its context without turning the audit log
-- into a second copy of the personal journal.
create or replace function internal_security.audit_personal_logbook_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_row jsonb;
  previous_row jsonb;
  audit_action text;
  audit_tenant uuid;
  audit_entity_id uuid;
  audit_administration uuid;
begin
  if tg_op = 'DELETE' then
    current_row := to_jsonb(old);
    previous_row := '{}'::jsonb;
    audit_action := 'DELETE';
    audit_tenant := old.tenant_id;
    audit_entity_id := old.id;
    audit_administration := old.administration_id;
  else
    current_row := to_jsonb(new);
    previous_row := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
    audit_action := case when tg_op = 'INSERT' then 'CREATE' else 'UPDATE' end;
    audit_tenant := new.tenant_id;
    audit_entity_id := new.id;
    audit_administration := new.administration_id;
  end if;

  insert into public.audit_logs (
    tenant_id, administration_id, entity_name, entity_id, actor_user_id, action, changes
  ) values (
    audit_tenant,
    audit_administration,
    tg_argv[0],
    audit_entity_id,
    auth.uid(),
    audit_action,
    jsonb_build_object(
      'source', current_row ->> 'source',
      'context_department_id', current_row ->> 'context_department_id',
      'source_session_id', current_row ->> 'source_session_id',
      'title_changed', case when tg_op = 'UPDATE' then (current_row ->> 'title') is distinct from (previous_row ->> 'title') else true end,
      'description_changed', case when tg_op = 'UPDATE' then (current_row ->> 'description') is distinct from (previous_row ->> 'description') else true end
    )
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function internal_security.audit_personal_logbook_change() from public, anon, authenticated;

create trigger audit_personal_logbook_entries
after insert or update or delete on public.personal_logbook_entries
for each row execute function internal_security.audit_personal_logbook_change('personal_logbook_entry');

insert into public.permissions (code, name, category, description)
values
  ('logbook:read', 'Mijn logboek bekijken', 'Persoonlijk', 'Leest uitsluitend het eigen persoonlijke logboek.'),
  ('logbook:write', 'Mijn logboek beheren', 'Persoonlijk', 'Maakt en wijzigt uitsluitend eigen logboeknotities.'),
  ('logbook:delete', 'Mijn logboeknotities verwijderen', 'Persoonlijk', 'Verwijdert uitsluitend eigen logboeknotities.')
on conflict (code) do update
set name = excluded.name, category = excluded.category, description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code in ('EMPLOYEE', 'DIRECT_MANAGER', 'TEAM_LEAD', 'TENANT_ADMIN', 'HR_ADMIN', 'HR_ADVISOR')
  and permission.code in ('logbook:read', 'logbook:write', 'logbook:delete')
on conflict do nothing;

insert into public.ai_credit_charge_catalog (
  feature_code, quality_profile, charge_reference, credit_amount, config_version
)
values
  ('TEAM_SUMMARY', 'EFFICIENT', 'ai.team-summary.efficient', 1, 'ai-everywhere-v1.20260907.1'),
  ('TEAM_SUMMARY', 'BALANCED', 'ai.team-summary.balanced', 2, 'ai-everywhere-v1.20260907.1'),
  ('TEAM_SUMMARY', 'IN_DEPTH', 'ai.team-summary.in-depth', 3, 'ai-everywhere-v1.20260907.1')
on conflict (feature_code, quality_profile) do update
set charge_reference = excluded.charge_reference,
    credit_amount = excluded.credit_amount,
    config_version = excluded.config_version,
    is_active = true,
    updated_at = timezone('utc', now());

alter table public.ai_team_sessions enable row level security;
alter table public.ai_team_session_members enable row level security;
alter table public.personal_logbook_entries enable row level security;

revoke all on table public.ai_team_sessions, public.ai_team_session_members from public, anon, authenticated;
grant select, insert, update on table public.ai_team_sessions, public.ai_team_session_members to service_role;

create policy personal_logbook_entries_select_owner
on public.personal_logbook_entries for select to authenticated
using (
  owner_user_id = (select auth.uid())
  and (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'logbook:read'))
);

create policy personal_logbook_entries_insert_owner
on public.personal_logbook_entries for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'logbook:write'))
);

create policy personal_logbook_entries_update_owner
on public.personal_logbook_entries for update to authenticated
using (
  owner_user_id = (select auth.uid())
  and (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'logbook:write'))
)
with check (
  owner_user_id = (select auth.uid())
  and (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'logbook:write'))
);

create policy personal_logbook_entries_delete_owner
on public.personal_logbook_entries for delete to authenticated
using (
  owner_user_id = (select auth.uid())
  and (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'logbook:delete'))
);

grant select, insert, update, delete on public.personal_logbook_entries to authenticated;

comment on table public.ai_team_sessions is 'Immutable server-authorized Team AI scope metadata; no audio or transcript content.';
comment on table public.ai_team_session_members is 'The fixed employee membership for an active Team AI session.';
comment on table public.personal_logbook_entries is 'Owner-private working notes; reviewed text only, never raw realtime audio or transcript.';

commit;

