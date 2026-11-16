begin;

-- SEC-01: absence_cases, absence_spells and absence_capacity_changes are
-- readable through RLS, but writable only through the canonical RPCs.
revoke insert, update, delete on table public.absence_cases, public.absence_spells, public.absence_capacity_changes from public, anon, authenticated;
drop policy if exists absence_cases_insert on public.absence_cases;
drop policy if exists absence_cases_update on public.absence_cases;
drop policy if exists absence_spells_insert on public.absence_spells;
drop policy if exists absence_spells_update on public.absence_spells;
drop policy if exists absence_capacity_insert on public.absence_capacity_changes;
drop policy if exists absence_capacity_update on public.absence_capacity_changes;

-- Recovery-window lifecycle is deterministic and can be advanced by a
-- permitted read before an employee or report is loaded. There is no
-- scheduler dependency and the update is safe under concurrent callers.
create or replace function internal_security.normalize_expired_absence_cases(
  requested_tenant_id uuid,
  requested_hr_group_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, internal_security, pg_temp
as $$
declare
  normalized_count integer;
begin
  if auth.uid() is null
     or not internal_security.has_hr_group_access(requested_tenant_id, requested_hr_group_id)
     or not internal_security.current_user_has_hr_group_permission(
       requested_tenant_id, requested_hr_group_id, 'absence:read'
     ) then
    raise exception 'ABSENCE_FORBIDDEN' using errcode = '42501';
  end if;

  update public.absence_cases absence_case
  set status = 'CLOSED',
      closed_at = coalesce(absence_case.closed_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
  where absence_case.tenant_id = requested_tenant_id
    and absence_case.hr_group_id = requested_hr_group_id
    and absence_case.status = 'RECOVERY_WINDOW'
    and absence_case.recovery_window_ends_on <= current_date
    and (
      internal_security.current_user_has_hr_group_permission(
        absence_case.tenant_id, absence_case.hr_group_id, 'absence:read'
      )
      or internal_security.can_manage_employee(absence_case.employee_id, 'absence:read')
    );

  get diagnostics normalized_count = row_count;
  return normalized_count;
end;
$$;

create or replace function public.normalize_expired_absence_cases(
  requested_tenant_id uuid,
  requested_hr_group_id uuid
)
returns integer
language sql
set search_path = public, internal_security, pg_temp
as $$
  select internal_security.normalize_expired_absence_cases(
    requested_tenant_id, requested_hr_group_id
  );
$$;

revoke all on function internal_security.normalize_expired_absence_cases(uuid, uuid) from public, anon, authenticated;
grant execute on function internal_security.normalize_expired_absence_cases(uuid, uuid) to authenticated;
revoke all on function public.normalize_expired_absence_cases(uuid, uuid) from public, anon;
grant execute on function public.normalize_expired_absence_cases(uuid, uuid) to authenticated;

-- WvP foundation: this is a neutral, versioned milestone projection. It is
-- deliberately not a legal advice engine. Every generated row requires human
-- confirmation before it can be treated as an operationally complete task.
create table public.absence_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hr_group_id uuid not null,
  case_id uuid not null,
  milestone_code text not null check (milestone_code = upper(milestone_code) and milestone_code ~ '^[A-Z0-9][A-Z0-9_-]{1,79}$'),
  milestone_type text not null default 'STATUTORY_CANDIDATE' check (milestone_type in ('STATUTORY_CANDIDATE', 'REVIEW')),
  due_on date not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'COMPLETED', 'CANCELLED')),
  human_confirmation_required boolean not null default true,
  source_version text not null default 'WVP_FOUNDATION_V1',
  completion_note text check (completion_note is null or char_length(completion_note) <= 1000),
  completed_at timestamptz,
  completed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint absence_tasks_case_scope_fkey
    foreign key (tenant_id, hr_group_id, case_id)
    references public.absence_cases (tenant_id, hr_group_id, id) on delete cascade,
  constraint absence_tasks_case_milestone_unique unique (tenant_id, hr_group_id, case_id, milestone_code),
  constraint absence_tasks_completion_check check (
    (status = 'COMPLETED' and completed_at is not null and completed_by_user_id is not null)
    or (status <> 'COMPLETED')
  )
);

create index absence_tasks_case_due_idx
  on public.absence_tasks (tenant_id, hr_group_id, case_id, due_on);

alter table public.absence_tasks enable row level security;

create policy absence_tasks_select
on public.absence_tasks
for select to authenticated
using (
  exists (
    select 1
    from public.absence_cases absence_case
    where absence_case.tenant_id = absence_tasks.tenant_id
      and absence_case.hr_group_id = absence_tasks.hr_group_id
      and absence_case.id = absence_tasks.case_id
      and internal_security.can_manage_employee(absence_case.employee_id, 'absence:read')
  )
);

grant select on table public.absence_tasks to authenticated;
revoke insert, update, delete on table public.absence_tasks from public, anon, authenticated;

create trigger absence_tasks_updated_at
before update on public.absence_tasks
for each row execute function internal_security.set_updated_at();

create trigger audit_absence_tasks
after insert or update or delete on public.absence_tasks
for each row execute function internal_security.audit_hr_change('absence_task');

create or replace function internal_security.generate_absence_wvp_tasks(
  requested_case_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, internal_security, pg_temp
as $$
declare
  case_record public.absence_cases%rowtype;
  horizon_date date;
  generated_count integer;
begin
  select * into case_record
  from public.absence_cases absence_case
  where absence_case.id = requested_case_id
  for update;

  if auth.uid() is null
     or case_record.id is null
     or not internal_security.has_hr_group_access(case_record.tenant_id, case_record.hr_group_id)
     or not (
       internal_security.current_user_has_hr_group_permission(
         case_record.tenant_id, case_record.hr_group_id, 'absence:write'
       )
       or internal_security.can_manage_employee(case_record.employee_id, 'absence:write')
     ) then
    raise exception 'ABSENCE_FORBIDDEN' using errcode = '42501';
  end if;

  horizon_date := case when case_record.status = 'ACTIVE' then current_date
    else coalesce(
      (select max(spell.recovered_on)
       from public.absence_spells spell
       where spell.tenant_id = case_record.tenant_id
         and spell.hr_group_id = case_record.hr_group_id
         and spell.case_id = case_record.id),
      current_date
    )
  end;

  with definitions(milestone_code, milestone_type, due_after_days) as (
    values
      ('WVP_WEEK_6', 'STATUTORY_CANDIDATE', 42),
      ('WVP_WEEK_8', 'STATUTORY_CANDIDATE', 56),
      ('WVP_EVALUATION_6W_01', 'REVIEW', 98),
      ('WVP_EVALUATION_6W_02', 'REVIEW', 140),
      ('WVP_EVALUATION_6W_03', 'REVIEW', 182),
      ('WVP_EVALUATION_6W_04', 'REVIEW', 224),
      ('WVP_EVALUATION_6W_05', 'REVIEW', 266),
      ('WVP_WEEK_42', 'STATUTORY_CANDIDATE', 294),
      ('WVP_EVALUATION_6W_06', 'REVIEW', 308),
      ('WVP_EVALUATION_6W_07', 'REVIEW', 350),
      ('WVP_FIRST_YEAR_REVIEW', 'STATUTORY_CANDIDATE', 365)
  )
  insert into public.absence_tasks (
    tenant_id, hr_group_id, case_id, milestone_code, milestone_type,
    due_on, human_confirmation_required, source_version
  )
  select case_record.tenant_id, case_record.hr_group_id, case_record.id,
         definition.milestone_code, definition.milestone_type,
         case_record.effective_clock_start_on + definition.due_after_days,
         true, 'WVP_FOUNDATION_V1'
  from definitions definition
  where case_record.effective_clock_start_on + definition.due_after_days <= horizon_date
  on conflict (tenant_id, hr_group_id, case_id, milestone_code) do nothing;

  get diagnostics generated_count = row_count;
  return generated_count;
end;
$$;

create or replace function public.generate_absence_wvp_tasks(requested_case_id uuid)
returns integer
language sql
set search_path = public, internal_security, pg_temp
as $$
  select internal_security.generate_absence_wvp_tasks(requested_case_id);
$$;

create or replace function internal_security.complete_absence_wvp_task(
  requested_task_id uuid,
  requested_completion_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, pg_temp
as $$
declare
  task_record public.absence_tasks%rowtype;
  actor_id uuid := auth.uid();
begin
  select task.* into task_record
  from public.absence_tasks task
  join public.absence_cases absence_case
    on absence_case.tenant_id = task.tenant_id
   and absence_case.hr_group_id = task.hr_group_id
   and absence_case.id = task.case_id
  where task.id = requested_task_id
  for update;

  if actor_id is null
     or task_record.id is null
     or not internal_security.has_hr_group_access(task_record.tenant_id, task_record.hr_group_id)
     or not (
       internal_security.current_user_has_hr_group_permission(
         task_record.tenant_id, task_record.hr_group_id, 'absence:write'
       )
       or exists (
         select 1
         from public.absence_cases absence_case
         where absence_case.tenant_id = task_record.tenant_id
           and absence_case.hr_group_id = task_record.hr_group_id
           and absence_case.id = task_record.case_id
           and internal_security.can_manage_employee(absence_case.employee_id, 'absence:write')
       )
     ) then
    raise exception 'ABSENCE_FORBIDDEN' using errcode = '42501';
  end if;

  if task_record.status = 'CANCELLED' then
    raise exception 'ABSENCE_WVP_TASK_CANCELLED' using errcode = '22023';
  end if;
  if task_record.status = 'COMPLETED' then
    return task_record.id;
  end if;

  update public.absence_tasks
  set status = 'COMPLETED',
      completion_note = nullif(trim(requested_completion_note), ''),
      completed_at = timezone('utc', now()),
      completed_by_user_id = actor_id,
      updated_at = timezone('utc', now())
  where id = task_record.id;

  return task_record.id;
end;
$$;

create or replace function public.complete_absence_wvp_task(
  requested_task_id uuid,
  requested_completion_note text default null
)
returns uuid
language sql
set search_path = public, internal_security, pg_temp
as $$
  select internal_security.complete_absence_wvp_task(
    requested_task_id, requested_completion_note
  );
$$;

revoke all on function internal_security.generate_absence_wvp_tasks(uuid) from public, anon, authenticated;
revoke all on function internal_security.complete_absence_wvp_task(uuid, text) from public, anon, authenticated;
grant execute on function internal_security.generate_absence_wvp_tasks(uuid) to authenticated;
grant execute on function internal_security.complete_absence_wvp_task(uuid, text) to authenticated;
revoke all on function public.generate_absence_wvp_tasks(uuid) from public, anon;
revoke all on function public.complete_absence_wvp_task(uuid, text) from public, anon;
grant execute on function public.generate_absence_wvp_tasks(uuid) to authenticated;
grant execute on function public.complete_absence_wvp_task(uuid, text) to authenticated;

-- SEC-02: bind the signed Focus capability to a revocable server-side session.
create table public.focus_act_as_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hr_group_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  subject_employee_id uuid not null,
  nonce uuid not null unique,
  mode text not null default 'FOCUS_ESS' check (mode = 'FOCUS_ESS'),
  expires_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint focus_act_as_sessions_group_fkey
    foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id) on delete cascade,
  constraint focus_act_as_sessions_subject_fkey
    foreign key (tenant_id, hr_group_id, subject_employee_id)
    references public.employees(tenant_id, hr_group_id, id) on delete cascade
);

create index focus_act_as_sessions_actor_active_idx
  on public.focus_act_as_sessions (tenant_id, hr_group_id, actor_user_id, expires_at)
  where ended_at is null;

alter table public.focus_act_as_sessions enable row level security;

create policy focus_act_as_sessions_select
on public.focus_act_as_sessions
for select to authenticated
using (
  actor_user_id = auth.uid()
  and internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'focus:act-as-employee')
);

create policy focus_act_as_sessions_insert
on public.focus_act_as_sessions
for insert to authenticated
with check (
  actor_user_id = auth.uid()
  and internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'focus:act-as-employee')
  and exists (
    select 1 from public.employees employee
    where employee.tenant_id = focus_act_as_sessions.tenant_id
      and employee.hr_group_id = focus_act_as_sessions.hr_group_id
      and employee.id = focus_act_as_sessions.subject_employee_id
      and employee.is_active
      and not employee.is_archived
      and employee.deleted_at is null
  )
);

create policy focus_act_as_sessions_stop
on public.focus_act_as_sessions
for update to authenticated
using (
  actor_user_id = auth.uid()
  and ended_at is null
  and internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'focus:act-as-employee')
)
with check (actor_user_id = auth.uid() and ended_at is not null);

grant select, insert, update on table public.focus_act_as_sessions to authenticated;
revoke delete on table public.focus_act_as_sessions from public, anon, authenticated;

commit;
