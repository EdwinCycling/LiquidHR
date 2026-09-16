begin;

-- GPT-Live stores session metadata only. Raw audio and transcripts are never persisted.
create table public.ai_voice_sessions (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  hr_group_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_employee_id uuid,
  employee_id uuid not null,
  model_id text not null check (char_length(btrim(model_id)) between 1 and 120),
  status text not null check (status in ('ACTIVE', 'ENDED', 'FAILED')),
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  tool_call_count integer not null default 0 check (tool_call_count >= 0),
  constraint ai_voice_sessions_tenant_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete restrict,
  constraint ai_voice_sessions_actor_employee_fkey
    foreign key (tenant_id, actor_employee_id)
    references public.employees(tenant_id, id)
    on delete set null,
  constraint ai_voice_sessions_employee_fkey
    foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id)
    on delete restrict
);

create index ai_voice_sessions_scope_started_idx
  on public.ai_voice_sessions (tenant_id, hr_group_id, started_at desc);
create index ai_voice_sessions_actor_idx
  on public.ai_voice_sessions (tenant_id, hr_group_id, actor_user_id, started_at desc);

alter table public.ai_voice_sessions enable row level security;
revoke all on table public.ai_voice_sessions from public, anon, authenticated;
grant select on table public.ai_voice_sessions to authenticated;
grant select, insert, update on table public.ai_voice_sessions to service_role;

create policy ai_voice_sessions_select_scoped
on public.ai_voice_sessions for select to authenticated
using (
  (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (
    actor_user_id = (select auth.uid())
    or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'ai:usage-read'))
  )
);

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'DIRECT_MANAGER'
  and permission.code = 'ai:use'
on conflict do nothing;

comment on table public.ai_voice_sessions is 'GPT-Live session metadata only; raw audio and transcripts are never stored.';

commit;
