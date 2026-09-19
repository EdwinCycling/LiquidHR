begin;

-- Focus act-as is an operational HR capability. It never changes the
-- authenticated user and is only valid inside the signed Focus context.
insert into public.permissions (code, name, category, description)
values (
  'focus:act-as-employee',
  'Handelen als medewerker in Focus',
  'Focus',
  'Opent een kortlevende, gelogde Employee Focus-sessie voor ondersteuning.'
)
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission on permission.code = 'focus:act-as-employee'
where role.code in ('TENANT_ADMIN', 'HR_ADMIN')
  and role.tenant_id is null
on conflict do nothing;

-- A self-reported absence is visible to the employee's scoped manager/HR
-- operator as a separate confirmation state. The absence case remains owned by
-- the existing absence kernel; this table only records the operational
-- confirmation envelope and never duplicates case, spell or capacity data.
create table if not exists public.absence_confirmations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hr_group_id uuid not null,
  case_id uuid not null,
  employee_id uuid not null,
  status text not null default 'PENDING',
  correction_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  confirmed_at timestamptz,
  confirmed_by_user_id uuid references auth.users(id) on delete set null,
  correction_requested_at timestamptz,
  correction_requested_by_user_id uuid references auth.users(id) on delete set null,
  constraint absence_confirmations_status_check
    check (status in ('PENDING', 'CONFIRMED', 'CORRECTION_REQUESTED')),
  constraint absence_confirmations_correction_reason_check
    check (status <> 'CORRECTION_REQUESTED' or length(btrim(coalesce(correction_reason, ''))) between 1 and 500),
  constraint absence_confirmations_case_scope_fkey
    foreign key (tenant_id, hr_group_id, case_id)
    references public.absence_cases(tenant_id, hr_group_id, id)
    on delete cascade,
  constraint absence_confirmations_employee_scope_fkey
    foreign key (tenant_id, hr_group_id, employee_id)
    references public.employees(tenant_id, hr_group_id, id)
    on delete cascade,
  constraint absence_confirmations_case_unique unique (tenant_id, hr_group_id, case_id)
);

create index if not exists absence_confirmations_employee_status_idx
  on public.absence_confirmations (tenant_id, hr_group_id, employee_id, status, updated_at desc);

drop trigger if exists absence_confirmations_updated_at on public.absence_confirmations;
create trigger absence_confirmations_updated_at
before update on public.absence_confirmations
for each row execute function internal_security.set_updated_at();

alter table public.absence_confirmations enable row level security;
revoke all on public.absence_confirmations from public, anon, authenticated;
grant select on public.absence_confirmations to authenticated;

create policy absence_confirmations_select_scoped
on public.absence_confirmations
for select to authenticated
using (
  (select internal_security.can_manage_employee(employee_id, 'absence:read'))
  or (
    employee_id = (select internal_security.current_employee_id())
    and (select internal_security.current_employee_has_permission('self:absence:read'))
  )
);

create or replace function internal_security.register_absence_confirmation(
  requested_case_id uuid,
  requested_subject_employee_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, pg_temp
as $$
declare
  case_row public.absence_cases%rowtype;
  subject_id uuid;
  self_report_allowed boolean := false;
  act_as_allowed boolean := false;
  result_id uuid;
begin
  select absence_case.* into case_row
  from public.absence_cases absence_case
  where absence_case.id = requested_case_id
  for update;

  if case_row.id is null then
    raise exception 'ABSENCE_CASE_NOT_FOUND' using errcode = 'P0002';
  end if;

  subject_id := coalesce(requested_subject_employee_id, case_row.employee_id);
  if subject_id <> case_row.employee_id then
    raise exception 'ABSENCE_CONFIRMATION_SCOPE_INVALID' using errcode = '42501';
  end if;

  self_report_allowed := subject_id = internal_security.current_employee_id(case_row.tenant_id, case_row.hr_group_id)
    and internal_security.current_employee_has_permission('self:absence:write')
    and exists (
      select 1
      from public.absence_settings settings
      where settings.tenant_id = case_row.tenant_id
        and settings.hr_group_id = case_row.hr_group_id
        and settings.employee_self_report_enabled
    );
  act_as_allowed := internal_security.current_user_has_hr_group_permission(
    case_row.tenant_id,
    case_row.hr_group_id,
    'focus:act-as-employee'
  );

  if not self_report_allowed and not act_as_allowed then
    raise exception 'ABSENCE_CONFIRMATION_FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.absence_confirmations (
    tenant_id, hr_group_id, case_id, employee_id, status, correction_reason,
    confirmed_at, confirmed_by_user_id, correction_requested_at, correction_requested_by_user_id
  )
  values (case_row.tenant_id, case_row.hr_group_id, case_row.id, subject_id, 'PENDING', null, null, null, null, null)
  on conflict (tenant_id, hr_group_id, case_id) do update
    set status = 'PENDING',
        correction_reason = null,
        confirmed_at = null,
        confirmed_by_user_id = null,
        correction_requested_at = null,
        correction_requested_by_user_id = null,
        updated_at = timezone('utc', now())
  returning id into result_id;

  return result_id;
end;
$$;

create or replace function public.register_absence_confirmation(
  requested_case_id uuid,
  requested_subject_employee_id uuid default null
)
returns uuid
language sql
security invoker
set search_path = public, internal_security, pg_temp
as $$
  select internal_security.register_absence_confirmation(requested_case_id, requested_subject_employee_id);
$$;

create or replace function internal_security.confirm_absence_confirmation(requested_case_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, pg_temp
as $$
declare
  confirmation_row public.absence_confirmations%rowtype;
begin
  select confirmation.* into confirmation_row
  from public.absence_confirmations confirmation
  where confirmation.case_id = requested_case_id
  for update;

  if confirmation_row.id is null
     or not (
       internal_security.can_manage_employee(confirmation_row.employee_id, 'absence:write')
       or internal_security.current_user_has_hr_group_permission(confirmation_row.tenant_id, confirmation_row.hr_group_id, 'absence:write')
     ) then
    raise exception 'ABSENCE_CONFIRMATION_FORBIDDEN' using errcode = '42501';
  end if;

  update public.absence_confirmations
  set status = 'CONFIRMED',
      correction_reason = null,
      confirmed_at = timezone('utc', now()),
      confirmed_by_user_id = auth.uid(),
      correction_requested_at = null,
      correction_requested_by_user_id = null,
      updated_at = timezone('utc', now())
  where id = confirmation_row.id;

  return confirmation_row.id;
end;
$$;

create or replace function public.confirm_absence_confirmation(requested_case_id uuid)
returns uuid
language sql
security invoker
set search_path = public, internal_security, pg_temp
as $$
  select internal_security.confirm_absence_confirmation(requested_case_id);
$$;

create or replace function internal_security.request_absence_correction(
  requested_case_id uuid,
  requested_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, pg_temp
as $$
declare
  confirmation_row public.absence_confirmations%rowtype;
  reason_value text := btrim(coalesce(requested_reason, ''));
begin
  if length(reason_value) not between 1 and 500 then
    raise exception 'ABSENCE_CORRECTION_REASON_REQUIRED' using errcode = '22023';
  end if;

  select confirmation.* into confirmation_row
  from public.absence_confirmations confirmation
  where confirmation.case_id = requested_case_id
  for update;

  if confirmation_row.id is null
     or not (
       internal_security.can_manage_employee(confirmation_row.employee_id, 'absence:write')
       or internal_security.current_user_has_hr_group_permission(confirmation_row.tenant_id, confirmation_row.hr_group_id, 'absence:write')
     ) then
    raise exception 'ABSENCE_CONFIRMATION_FORBIDDEN' using errcode = '42501';
  end if;

  update public.absence_confirmations
  set status = 'CORRECTION_REQUESTED',
      correction_reason = reason_value,
      confirmed_at = null,
      confirmed_by_user_id = null,
      correction_requested_at = timezone('utc', now()),
      correction_requested_by_user_id = auth.uid(),
      updated_at = timezone('utc', now())
  where id = confirmation_row.id;

  return confirmation_row.id;
end;
$$;

create or replace function public.request_absence_correction(
  requested_case_id uuid,
  requested_reason text
)
returns uuid
language sql
security invoker
set search_path = public, internal_security, pg_temp
as $$
  select internal_security.request_absence_correction(requested_case_id, requested_reason);
$$;

revoke all on function internal_security.register_absence_confirmation(uuid, uuid) from public, anon, authenticated;
revoke all on function internal_security.confirm_absence_confirmation(uuid) from public, anon, authenticated;
revoke all on function internal_security.request_absence_correction(uuid, text) from public, anon, authenticated;
grant execute on function internal_security.register_absence_confirmation(uuid, uuid) to authenticated;
grant execute on function internal_security.confirm_absence_confirmation(uuid) to authenticated;
grant execute on function internal_security.request_absence_correction(uuid, text) to authenticated;

revoke all on function public.register_absence_confirmation(uuid, uuid) from public, anon;
revoke all on function public.confirm_absence_confirmation(uuid) from public, anon;
revoke all on function public.request_absence_correction(uuid, text) from public, anon;
grant execute on function public.register_absence_confirmation(uuid, uuid) to authenticated;
grant execute on function public.confirm_absence_confirmation(uuid) to authenticated;
grant execute on function public.request_absence_correction(uuid, text) to authenticated;

-- The employee directory settings/read model is also the source for Focus.
-- Allow the existing self organization-chart permission to read that model;
-- the permission still remains subject to the canonical organization scope.
do $$
declare
  function_definition text;
begin
  for function_definition in
    select pg_get_functiondef(functions.oid)
    from pg_proc functions
    join pg_namespace namespaces on namespaces.oid = functions.pronamespace
    where namespaces.nspname = 'public'
      and functions.proname in ('get_employee_directory_visibility', 'get_employee_directory_detail')
  loop
    function_definition := replace(
      function_definition,
      'internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, ''employee-directory:read'')',
      '(internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, ''employee-directory:read'') or internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, ''self:organization-chart:read''))'
    );
    execute function_definition;
  end loop;
end;
$$;

commit;
