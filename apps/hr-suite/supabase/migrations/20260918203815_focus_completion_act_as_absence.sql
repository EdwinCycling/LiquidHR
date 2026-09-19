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

-- The canonical case remains the single absence truth. A self-report reserves
-- that case and its spell, but is not operational until its confirmation
-- envelope is confirmed. Direct manager/HR reports keep the default false.
alter table public.absence_cases
  add column if not exists pending_confirmation boolean not null default false;

create index if not exists absence_cases_pending_confirmation_idx
  on public.absence_cases (tenant_id, hr_group_id, employee_id, pending_confirmation, first_absence_on desc)
  where archived_at is null;

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
  (
    (select internal_security.can_manage_employee(employee_id, 'absence:read'))
    or (select internal_security.can_manage_employee(employee_id, 'absence:write'))
  )
  or (
    employee_id = (select internal_security.current_employee_id())
    and (
      (select internal_security.current_employee_has_permission('self:absence:read'))
      or (select internal_security.current_employee_has_permission('self:absence:write'))
    )
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
  existing_confirmation public.absence_confirmations%rowtype;
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

  select confirmation.* into existing_confirmation
  from public.absence_confirmations confirmation
  where confirmation.tenant_id = case_row.tenant_id
    and confirmation.hr_group_id = case_row.hr_group_id
    and confirmation.case_id = case_row.id
  for update;

  if existing_confirmation.id is not null and existing_confirmation.status = 'CONFIRMED' then
    return existing_confirmation.id;
  end if;

  update public.absence_cases
  set pending_confirmation = true,
      updated_at = timezone('utc', now())
  where tenant_id = case_row.tenant_id
    and hr_group_id = case_row.hr_group_id
    and id = case_row.id;

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

-- Focus self-report entry point. It calls the canonical report function and
-- registers the pending envelope in one transaction, so a case can never be
-- committed as an operational self-report without its pending state.
create or replace function internal_security.report_focus_employee_absence(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_start_date date,
  requested_expected_recovery_on date default null,
  requested_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  current_employee_id uuid;
  existing_case public.absence_cases%rowtype;
  result_case_id uuid;
begin
  if actor_id is null
     or not internal_security.has_hr_group_access(requested_tenant_id, requested_hr_group_id) then
    raise exception 'ABSENCE_FORBIDDEN' using errcode = '42501';
  end if;

  current_employee_id := internal_security.current_employee_id(requested_tenant_id, requested_hr_group_id);
  if requested_employee_id <> current_employee_id
     and not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'focus:act-as-employee') then
    raise exception 'ABSENCE_SELF_SERVICE_FORBIDDEN' using errcode = '42501';
  end if;

  if requested_employee_id = current_employee_id then
    if not internal_security.current_employee_has_permission('self:absence:write')
       or not exists (
         select 1
         from public.absence_settings settings
         where settings.tenant_id = requested_tenant_id
           and settings.hr_group_id = requested_hr_group_id
           and settings.employee_self_report_enabled
       ) then
      raise exception 'ABSENCE_SELF_REPORT_DISABLED' using errcode = '42501';
    end if;
  end if;

  -- Focus employee self-report is intentionally date-only. Expected recovery
  -- is an operational planning field for manager/HR reporting, never an
  -- employee self-service input, including for crafted RPC calls.
  if requested_expected_recovery_on is not null then
    raise exception 'ABSENCE_SELF_SERVICE_FIELDS_FORBIDDEN' using errcode = '42501';
  end if;

  -- A correction resubmission reuses the reserved canonical case and spell.
  -- It never creates a second case or a second open spell.
  select absence_case.* into existing_case
  from public.absence_cases absence_case
  join public.absence_confirmations confirmation
    on confirmation.tenant_id = absence_case.tenant_id
   and confirmation.hr_group_id = absence_case.hr_group_id
   and confirmation.case_id = absence_case.id
  where absence_case.tenant_id = requested_tenant_id
    and absence_case.hr_group_id = requested_hr_group_id
    and absence_case.employee_id = requested_employee_id
    and absence_case.employment_id = requested_employment_id
    and absence_case.pending_confirmation
    and confirmation.status in ('PENDING', 'CORRECTION_REQUESTED')
    and absence_case.archived_at is null
  order by confirmation.updated_at desc
  limit 1
  for update;

  if existing_case.id is not null then
    if existing_case.first_absence_on <> requested_start_date then
      raise exception 'ABSENCE_CORRECTION_DATE_UNSUPPORTED' using errcode = '22023';
    end if;

    perform internal_security.register_absence_confirmation(existing_case.id, requested_employee_id);
    return existing_case.id;
  end if;

  result_case_id := internal_security.report_absence(
    requested_tenant_id,
    requested_hr_group_id,
    requested_employee_id,
    requested_employment_id,
    requested_start_date,
    100,
    null,
    null,
    null,
    null,
    requested_idempotency_key
  );

  update public.absence_cases
  set pending_confirmation = true,
      updated_at = timezone('utc', now())
  where tenant_id = requested_tenant_id
    and hr_group_id = requested_hr_group_id
    and id = result_case_id;

  perform internal_security.register_absence_confirmation(result_case_id, requested_employee_id);
  return result_case_id;
end;
$$;

create or replace function public.report_focus_employee_absence(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_start_date date,
  requested_expected_recovery_on date default null,
  requested_idempotency_key text default null
)
returns uuid
language sql
security invoker
set search_path = public, internal_security, pg_temp
as $$
  select internal_security.report_focus_employee_absence(
    requested_tenant_id,
    requested_hr_group_id,
    requested_employee_id,
    requested_employment_id,
    requested_start_date,
    requested_expected_recovery_on,
    requested_idempotency_key
  );
$$;

-- Keep the public canonical report RPC fail-closed for direct employee calls.
-- Employee self-report must always pass through the pending Focus entry point;
-- manager/HR reports for another employee continue to use the canonical kernel.
create or replace function public.report_absence(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_start_date date,
  requested_absence_percentage numeric,
  requested_expected_recovery_on date default null,
  requested_has_sickness_benefit_safety_net boolean default null,
  requested_is_work_accident boolean default null,
  requested_is_third_party_traffic_accident boolean default null,
  requested_idempotency_key text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, internal_security, pg_temp
as $$
begin
  if requested_employee_id = internal_security.current_employee_id(requested_tenant_id, requested_hr_group_id) then
    return internal_security.report_focus_employee_absence(
      requested_tenant_id,
      requested_hr_group_id,
      requested_employee_id,
      requested_employment_id,
      requested_start_date,
      requested_expected_recovery_on,
      requested_idempotency_key
    );
  end if;

  return internal_security.report_absence(
    requested_tenant_id,
    requested_hr_group_id,
    requested_employee_id,
    requested_employment_id,
    requested_start_date,
    requested_absence_percentage,
    requested_expected_recovery_on,
    requested_has_sickness_benefit_safety_net,
    requested_is_work_accident,
    requested_is_third_party_traffic_accident,
    requested_idempotency_key
  );
end;
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

  if confirmation_row.status = 'CONFIRMED' then
    return confirmation_row.id;
  end if;

  if confirmation_row.status not in ('PENDING', 'CORRECTION_REQUESTED') then
    raise exception 'ABSENCE_CONFIRMATION_STATE_INVALID' using errcode = '23514';
  end if;

  update public.absence_cases
  set pending_confirmation = false,
      updated_at = timezone('utc', now())
  where tenant_id = confirmation_row.tenant_id
    and hr_group_id = confirmation_row.hr_group_id
    and id = confirmation_row.case_id
    and pending_confirmation;

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

  if confirmation_row.status = 'CONFIRMED' then
    raise exception 'ABSENCE_CONFIRMATION_ALREADY_CONFIRMED' using errcode = '23514';
  end if;

  update public.absence_cases
  set pending_confirmation = true,
      updated_at = timezone('utc', now())
  where tenant_id = confirmation_row.tenant_id
    and hr_group_id = confirmation_row.hr_group_id
    and id = confirmation_row.case_id;

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
revoke all on function internal_security.report_focus_employee_absence(uuid, uuid, uuid, uuid, date, date, text) from public, anon, authenticated;

revoke all on function public.register_absence_confirmation(uuid, uuid) from public, anon;
revoke all on function public.confirm_absence_confirmation(uuid) from public, anon;
revoke all on function public.request_absence_correction(uuid, text) from public, anon;
grant execute on function public.register_absence_confirmation(uuid, uuid) to authenticated;
grant execute on function public.confirm_absence_confirmation(uuid) to authenticated;
grant execute on function public.request_absence_correction(uuid, text) to authenticated;
revoke all on function public.report_focus_employee_absence(uuid, uuid, uuid, uuid, date, date, text) from public, anon;
grant execute on function public.report_focus_employee_absence(uuid, uuid, uuid, uuid, date, date, text) to authenticated;

-- The canonical report function already validates the expected date. For
-- Focus self-report, that date is safe and explicitly allowed; safety-net and
-- accident fields remain blocked. Fail closed if the historical function body
-- is not the exact body this migration was written against.
do $$
declare
  function_definition text;
  old_fragment text := $fragment$
  if self_report and (
    requested_expected_recovery_on is not null
    or requested_has_sickness_benefit_safety_net is not null
    or requested_is_work_accident is not null
    or requested_is_third_party_traffic_accident is not null
  ) then
$fragment$;
  new_fragment text := $fragment$
  if self_report and (
    requested_has_sickness_benefit_safety_net is not null
    or requested_is_work_accident is not null
    or requested_is_third_party_traffic_accident is not null
  ) then
$fragment$;
begin
  select pg_get_functiondef(
    'internal_security.report_absence(uuid,uuid,uuid,uuid,date,numeric,date,boolean,boolean,boolean,text)'::regprocedure
  ) into function_definition;
  if function_definition is null or position(old_fragment in function_definition) = 0 then
    raise exception 'FOCUS_ABSENCE_REPORT_FUNCTION_BODY_UNEXPECTED';
  end if;
  function_definition := replace(function_definition, old_fragment, new_fragment);
  execute function_definition;
end;
$$;

-- Employee recovery reuses the canonical recovery RPC. It is allowed only for
-- the current employee while the HR-group self-report setting is enabled;
-- pending sickness notifications cannot be recovered before confirmation.
do $$
declare
  function_definition text;
  old_fragment text := $fragment$
  if actor_id is null or case_record.id is null
     or not internal_security.has_hr_group_access(case_record.tenant_id, case_record.hr_group_id)
     or not (
       internal_security.current_user_has_hr_group_permission(
         case_record.tenant_id, case_record.hr_group_id, 'absence:recover'
       )
       or internal_security.can_manage_employee(case_record.employee_id, 'absence:recover')
     ) then
$fragment$;
  new_fragment text := $fragment$
  if actor_id is null or case_record.id is null
     or case_record.pending_confirmation
     or not internal_security.has_hr_group_access(case_record.tenant_id, case_record.hr_group_id)
     or not (
       internal_security.current_user_has_hr_group_permission(
         case_record.tenant_id, case_record.hr_group_id, 'absence:recover'
       )
       or internal_security.can_manage_employee(case_record.employee_id, 'absence:recover')
       or (
         case_record.employee_id = internal_security.current_employee_id(case_record.tenant_id, case_record.hr_group_id)
         and internal_security.current_employee_has_permission('self:absence:write')
         and exists (
           select 1
           from public.absence_settings settings
           where settings.tenant_id = case_record.tenant_id
             and settings.hr_group_id = case_record.hr_group_id
             and settings.employee_self_report_enabled
         )
       )
     ) then
$fragment$;
begin
  select pg_get_functiondef(
    'internal_security.recover_absence(uuid,date,text)'::regprocedure
  ) into function_definition;
  if function_definition is null or position(old_fragment in function_definition) = 0 then
    raise exception 'FOCUS_ABSENCE_RECOVERY_FUNCTION_BODY_UNEXPECTED';
  end if;
  function_definition := replace(function_definition, old_fragment, new_fragment);
  execute function_definition;
end;
$$;

-- The employee directory settings/read model is also the source for Focus.
-- Allow the existing self organization-chart permission to read that model;
-- the permission still remains subject to the canonical organization scope.
do $$
declare
  function_definition text;
  replacement_count integer := 0;
begin
  for function_definition in
    select pg_get_functiondef(functions.oid)
    from pg_proc functions
    join pg_namespace namespaces on namespaces.oid = functions.pronamespace
    where namespaces.nspname = 'public'
      and functions.proname in ('get_employee_directory_visibility', 'get_employee_directory_detail')
  loop
    if position(
      'internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, ''employee-directory:read'')'
      in function_definition
    ) = 0 then
      raise exception 'FOCUS_DIRECTORY_PERMISSION_SOURCE_NOT_FOUND';
    end if;
    function_definition := replace(
      function_definition,
      'internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, ''employee-directory:read'')',
      '(internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, ''employee-directory:read'') or internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, ''self:organization-chart:read''))'
    );
    execute function_definition;
    replacement_count := replacement_count + 1;
  end loop;
  if replacement_count <> 2 then
    raise exception 'FOCUS_DIRECTORY_FUNCTION_COUNT_UNEXPECTED';
  end if;
end;
$$;

-- Leave projections need a canonical category for manager vacation views.
-- Runtime code must not infer vacation from a localized leave type name.
do $$
begin
  create type public.leave_type_family as enum ('VACATION', 'OTHER');
exception
  when duplicate_object then null;
end;
$$;

alter table public.leave_types
  add column if not exists family public.leave_type_family not null default 'OTHER';

-- Compatibility for the existing statutory demo vacation type. New and
-- edited types use the explicit family field through the RPC below.
update public.leave_types
set family = 'VACATION'
where family = 'OTHER'
  and name = 'Wettelijk verlof';

create or replace function public.set_group_leave_type_family(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_leave_type_id uuid,
  requested_family public.leave_type_family
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, pg_temp
as $$
begin
  if not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'leave:write') then
    raise exception 'LEAVE_FORBIDDEN' using errcode = '42501';
  end if;

  update public.leave_types
  set family = requested_family,
      updated_at = timezone('utc', now())
  where tenant_id = requested_tenant_id
    and hr_group_id = requested_hr_group_id
    and id = requested_leave_type_id;

  if not found then
    raise exception 'LEAVE_TYPE_NOT_FOUND' using errcode = 'P0002';
  end if;
  return requested_leave_type_id;
end;
$$;

revoke all on function public.set_group_leave_type_family(uuid, uuid, uuid, public.leave_type_family) from public, anon;
grant execute on function public.set_group_leave_type_family(uuid, uuid, uuid, public.leave_type_family) to authenticated;

-- Pending self-reports must not leak into the colleague presence projection.
-- Keep the existing PRESENT/ABSENT privacy contract while leaving the pending
-- case available to the employee and authorized manager work list.
do $$
declare
  function_definition text;
  old_fragment text := $fragment$and absence.employee_id = requested_employee_id and absence.status = 'ACTIVE'$fragment$;
  new_fragment text := $fragment$and absence.employee_id = requested_employee_id and absence.status = 'ACTIVE' and absence.pending_confirmation is not true$fragment$;
begin
  select pg_get_functiondef(
    'public.get_employee_directory_detail(uuid,uuid,uuid,date)'::regprocedure
  ) into function_definition;
  if function_definition is null or position(old_fragment in function_definition) = 0 then
    raise exception 'FOCUS_DIRECTORY_PRESENCE_SOURCE_NOT_FOUND';
  end if;
  function_definition := replace(function_definition, old_fragment, new_fragment);
  execute function_definition;
end;
$$;

commit;
