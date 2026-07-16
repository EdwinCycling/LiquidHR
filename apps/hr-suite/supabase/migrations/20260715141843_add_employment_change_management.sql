create table public.employment_change_sets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_id uuid not null,
  effective_on date not null,
  reason text not null check (length(trim(reason)) between 1 and 500),
  domains text[] not null default '{}',
  status text not null default 'DRAFT' check (status in ('DRAFT', 'APPLIED', 'CANCELLED')),
  warning_codes text[] not null default '{}',
  acknowledgements jsonb not null default '{}'::jsonb check (jsonb_typeof(acknowledgements) = 'object'),
  rule_version text,
  created_by_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  applied_at timestamptz,
  constraint employment_change_sets_employment_fkey
    foreign key (tenant_id, administration_id, employee_id, employment_id)
    references public.employments(tenant_id, administration_id, employee_id, id) on delete cascade,
  constraint employment_change_sets_scope_id_key unique (tenant_id, administration_id, id)
);

create table public.employment_change_follow_ups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_id uuid not null,
  change_set_id uuid not null,
  subject text not null check (length(trim(subject)) between 1 and 160),
  description text,
  responsible_role_code text,
  responsible_user_id uuid references auth.users(id) on delete set null,
  due_on date,
  priority text not null default 'NORMAL' check (priority in ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  status text not null default 'OPEN' check (status in ('OPEN', 'DONE', 'CANCELLED')),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employment_change_follow_ups_employment_fkey
    foreign key (tenant_id, administration_id, employee_id, employment_id)
    references public.employments(tenant_id, administration_id, employee_id, id) on delete cascade,
  constraint employment_change_follow_ups_change_set_fkey
    foreign key (tenant_id, administration_id, change_set_id)
    references public.employment_change_sets(tenant_id, administration_id, id) on delete cascade
);

create table public.employee_profile_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null,
  link_type text not null check (link_type in ('LINKEDIN', 'WEBSITE', 'PORTFOLIO', 'GITHUB', 'OTHER')),
  label text not null check (length(trim(label)) between 1 and 80),
  url text not null check (url ~ '^https://'),
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employee_profile_links_employee_fkey
    foreign key (tenant_id, employee_id) references public.employees(tenant_id, id) on delete cascade,
  constraint employee_profile_links_unique_url unique (tenant_id, employee_id, url)
);

create table public.employment_chain_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_id uuid not null,
  employer_name text not null,
  employer_reference text,
  starts_on date not null,
  ends_on date not null,
  is_successive_employer boolean not null default false,
  exception_code text,
  source text not null default 'USER_DECLARED' check (source in ('USER_DECLARED', 'DOCUMENT', 'IMPORT', 'VERIFIED')),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employment_chain_history_dates_valid check (ends_on >= starts_on),
  constraint employment_chain_history_employment_fkey
    foreign key (tenant_id, administration_id, employee_id, employment_id)
    references public.employments(tenant_id, administration_id, employee_id, id) on delete cascade
);

create table public.employment_chain_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_id uuid not null,
  change_set_id uuid,
  assessed_on timestamptz not null default timezone('utc', now()),
  proposed_starts_on date not null,
  proposed_ends_on date,
  outcome text not null check (outcome in ('CLEAR', 'ATTENTION', 'LIKELY_INDEFINITE', 'INSUFFICIENT_DATA')),
  rule_version text not null,
  chain_contract_count integer not null check (chain_contract_count >= 0),
  chain_starts_on date not null,
  reason_codes text[] not null default '{}',
  history_complete boolean not null,
  override_reason text,
  override_explanation text,
  created_by_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  constraint employment_chain_assessments_employment_fkey
    foreign key (tenant_id, administration_id, employee_id, employment_id)
    references public.employments(tenant_id, administration_id, employee_id, id) on delete cascade,
  constraint employment_chain_assessments_change_set_fkey
    foreign key (tenant_id, administration_id, change_set_id)
    references public.employment_change_sets(tenant_id, administration_id, id) on delete set null
);

alter table public.employment_labor_conditions add column change_set_id uuid references public.employment_change_sets(id) on delete set null;
alter table public.employment_schedules add column change_set_id uuid references public.employment_change_sets(id) on delete set null;
alter table public.employment_salaries add column change_set_id uuid references public.employment_change_sets(id) on delete set null;
alter table public.employment_cost_allocations add column change_set_id uuid references public.employment_change_sets(id) on delete set null;

alter table public.audit_logs add column subject_employee_id uuid;
alter table public.audit_logs add column employment_id uuid;
alter table public.audit_logs add column change_set_id uuid references public.employment_change_sets(id) on delete set null;

create index employment_change_sets_employment_idx on public.employment_change_sets (tenant_id, administration_id, employment_id, created_at desc);
create index employment_change_follow_ups_open_idx on public.employment_change_follow_ups (tenant_id, administration_id, employment_id, due_on) where status = 'OPEN';
create index employee_profile_links_employee_idx on public.employee_profile_links (tenant_id, employee_id, sort_order, created_at);
create index employment_chain_history_employee_idx on public.employment_chain_history (tenant_id, employee_id, starts_on, ends_on);
create index employment_chain_assessments_employment_idx on public.employment_chain_assessments (tenant_id, employment_id, assessed_on desc);
create index audit_logs_subject_employee_idx on public.audit_logs (tenant_id, subject_employee_id, created_at desc) where subject_employee_id is not null;
create index audit_logs_employment_idx on public.audit_logs (tenant_id, employment_id, created_at desc) where employment_id is not null;
create index audit_logs_change_set_idx on public.audit_logs (change_set_id, created_at) where change_set_id is not null;

create trigger set_employment_change_follow_ups_updated_at before update on public.employment_change_follow_ups
for each row execute function internal_security.set_updated_at();
create trigger set_employee_profile_links_updated_at before update on public.employee_profile_links
for each row execute function internal_security.set_updated_at();
create trigger set_employment_chain_history_updated_at before update on public.employment_chain_history
for each row execute function internal_security.set_updated_at();

alter table public.employment_change_sets enable row level security;
alter table public.employment_change_follow_ups enable row level security;
alter table public.employee_profile_links enable row level security;
alter table public.employment_chain_history enable row level security;
alter table public.employment_chain_assessments enable row level security;

create policy employment_change_sets_read on public.employment_change_sets for select to authenticated
using ((select internal_security.can_manage_employee(employee_id, 'contract:read')));
create policy employment_change_sets_insert on public.employment_change_sets for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));
create policy employment_change_sets_update on public.employment_change_sets for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));

create policy employment_change_follow_ups_read on public.employment_change_follow_ups for select to authenticated
using ((select internal_security.can_manage_employee(employee_id, 'contract:read')));
create policy employment_change_follow_ups_write on public.employment_change_follow_ups for all to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));

create policy employee_profile_links_read on public.employee_profile_links for select to authenticated
using ((select internal_security.employee_subresource_can_read(tenant_id, employee_id)));
create policy employee_profile_links_write on public.employee_profile_links for all to authenticated
using ((select internal_security.can_manage_employee(employee_id, 'employee:write')))
with check ((select internal_security.can_manage_employee(employee_id, 'employee:write')));

create policy employment_chain_history_read on public.employment_chain_history for select to authenticated
using ((select internal_security.can_manage_employee(employee_id, 'contract:read')));
create policy employment_chain_history_write on public.employment_chain_history for all to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));

create policy employment_chain_assessments_read on public.employment_chain_assessments for select to authenticated
using ((select internal_security.can_manage_employee(employee_id, 'contract:read')));
create policy employment_chain_assessments_write on public.employment_chain_assessments for all to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));

drop policy audit_logs_select_scoped on public.audit_logs;
create policy audit_logs_select_scoped on public.audit_logs for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, administration_id, 'audit:read'))
  and (
    entity_name <> 'employment_salary'
    or (select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:read'))
  )
);

create function internal_security.audit_employment_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  old_data jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  configured_change_set text := current_setting('app.change_set_id', true);
begin
  insert into public.audit_logs (
    tenant_id, administration_id, entity_name, entity_id, actor_user_id, action, changes,
    subject_employee_id, employment_id, change_set_id
  ) values (
    (row_data ->> 'tenant_id')::uuid,
    nullif(row_data ->> 'administration_id', '')::uuid,
    tg_argv[0],
    (row_data ->> 'id')::uuid,
    auth.uid(),
    case when tg_op = 'INSERT' then 'CREATE' when tg_op = 'DELETE' then 'DELETE' else 'UPDATE' end,
    jsonb_build_object('before', old_data, 'after', row_data),
    nullif(row_data ->> 'employee_id', '')::uuid,
    nullif(row_data ->> 'employment_id', '')::uuid,
    coalesce(
      nullif(row_data ->> 'change_set_id', '')::uuid,
      nullif(configured_change_set, '')::uuid
    )
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function internal_security.audit_employment_change() from public, anon, authenticated;

create trigger audit_employment_change_sets after insert or update or delete on public.employment_change_sets
for each row execute function internal_security.audit_employment_change('employment_change_set');
create trigger audit_employment_change_follow_ups after insert or update or delete on public.employment_change_follow_ups
for each row execute function internal_security.audit_employment_change('employment_change_follow_up');
create trigger audit_employee_profile_links after insert or update or delete on public.employee_profile_links
for each row execute function internal_security.audit_employment_change('employee_profile_link');
create trigger audit_employment_chain_history after insert or update or delete on public.employment_chain_history
for each row execute function internal_security.audit_employment_change('employment_chain_history');
create trigger audit_employment_chain_assessments after insert or update or delete on public.employment_chain_assessments
for each row execute function internal_security.audit_employment_change('employment_chain_assessment');
create trigger audit_employment_labor_conditions after insert or update or delete on public.employment_labor_conditions
for each row execute function internal_security.audit_employment_change('employment_labor_condition');
create trigger audit_employment_schedules after insert or update or delete on public.employment_schedules
for each row execute function internal_security.audit_employment_change('employment_schedule');
create trigger audit_employment_salaries after insert or update or delete on public.employment_salaries
for each row execute function internal_security.audit_employment_change('employment_salary');
create trigger audit_employment_cost_allocations after insert or update or delete on public.employment_cost_allocations
for each row execute function internal_security.audit_employment_change('employment_cost_allocation');

create function public.apply_employment_timeline_mutation(
  requested_employment_id uuid,
  requested_timeline text,
  requested_effective_on date,
  requested_payload jsonb,
  requested_reason text,
  requested_warning_codes text[] default '{}',
  requested_acknowledgements jsonb default '{}'
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  employment public.employments%rowtype;
  change_id uuid;
  next_date date;
  allocation_count integer;
  allocation_total numeric;
  allocation jsonb;
  required_permission text;
begin
  select * into employment from public.employments
  where id = requested_employment_id and deleted_at is null
  for update;
  if employment.id is null then raise exception 'EMPLOYMENT_NOT_FOUND'; end if;
  if requested_effective_on < employment.starts_on
     or (employment.ends_on is not null and requested_effective_on > employment.ends_on) then
    raise exception 'TIMELINE_DATE_OUTSIDE_EMPLOYMENT';
  end if;
  if requested_timeline not in ('LABOR_CONDITIONS', 'SCHEDULE', 'SALARY', 'COST_ALLOCATION') then
    raise exception 'TIMELINE_UNKNOWN';
  end if;
  required_permission := case when requested_timeline = 'SALARY' then 'salary:write' else 'contract:write' end;
  if not internal_security.current_user_has_permission(
    employment.tenant_id, employment.administration_id, required_permission
  ) then raise exception 'FORBIDDEN'; end if;

  insert into public.employment_change_sets (
    tenant_id, administration_id, employee_id, employment_id, effective_on,
    reason, domains, warning_codes, acknowledgements
  ) values (
    employment.tenant_id, employment.administration_id, employment.employee_id, employment.id,
    requested_effective_on, requested_reason, array[requested_timeline],
    requested_warning_codes, requested_acknowledgements
  ) returning id into change_id;
  perform set_config('app.change_set_id', change_id::text, true);

  if requested_timeline = 'LABOR_CONDITIONS' then
    if exists (select 1 from public.employment_labor_conditions where employment_id = employment.id and valid_from = requested_effective_on) then
      raise exception 'TIMELINE_EFFECTIVE_DATE_CONFLICT';
    end if;
    select min(valid_from) into next_date from public.employment_labor_conditions
      where employment_id = employment.id and valid_from > requested_effective_on;
    update public.employment_labor_conditions set valid_until = requested_effective_on
      where employment_id = employment.id and valid_from < requested_effective_on
        and (valid_until is null or valid_until > requested_effective_on);
    insert into public.employment_labor_conditions (
      tenant_id, administration_id, employee_id, employment_id, condition_group,
      valid_from, valid_until, change_set_id
    ) values (
      employment.tenant_id, employment.administration_id, employment.employee_id, employment.id,
      requested_payload ->> 'conditionGroup', requested_effective_on, next_date, change_id
    );
  elsif requested_timeline = 'SCHEDULE' then
    if exists (select 1 from public.employment_schedules where employment_id = employment.id and valid_from = requested_effective_on) then
      raise exception 'TIMELINE_EFFECTIVE_DATE_CONFLICT';
    end if;
    select min(valid_from) into next_date from public.employment_schedules
      where employment_id = employment.id and valid_from > requested_effective_on;
    update public.employment_schedules set valid_until = requested_effective_on
      where employment_id = employment.id and valid_from < requested_effective_on
        and (valid_until is null or valid_until > requested_effective_on);
    insert into public.employment_schedules (
      tenant_id, administration_id, employee_id, employment_id, schedule_type, start_week,
      average_days_per_week, average_hours_per_week, part_time_factor, time_for_time_accrual,
      monday_hours, tuesday_hours, wednesday_hours, thursday_hours, friday_hours,
      saturday_hours, sunday_hours, valid_from, valid_until, change_set_id
    ) values (
      employment.tenant_id, employment.administration_id, employment.employee_id, employment.id,
      (requested_payload ->> 'scheduleType')::public.schedule_type,
      coalesce((requested_payload ->> 'startWeek')::smallint, 1),
      (requested_payload ->> 'averageDaysPerWeek')::numeric,
      (requested_payload ->> 'averageHoursPerWeek')::numeric,
      (requested_payload ->> 'partTimeFactor')::numeric,
      coalesce((requested_payload ->> 'timeForTimeAccrual')::numeric, 0),
      nullif(requested_payload ->> 'mondayHours', '')::numeric,
      nullif(requested_payload ->> 'tuesdayHours', '')::numeric,
      nullif(requested_payload ->> 'wednesdayHours', '')::numeric,
      nullif(requested_payload ->> 'thursdayHours', '')::numeric,
      nullif(requested_payload ->> 'fridayHours', '')::numeric,
      nullif(requested_payload ->> 'saturdayHours', '')::numeric,
      nullif(requested_payload ->> 'sundayHours', '')::numeric,
      requested_effective_on, next_date, change_id
    );
  elsif requested_timeline = 'SALARY' then
    if exists (select 1 from public.employment_salaries where employment_id = employment.id and valid_from = requested_effective_on) then
      raise exception 'TIMELINE_EFFECTIVE_DATE_CONFLICT';
    end if;
    select min(valid_from) into next_date from public.employment_salaries
      where employment_id = employment.id and valid_from > requested_effective_on;
    update public.employment_salaries set valid_until = requested_effective_on
      where employment_id = employment.id and valid_from < requested_effective_on
        and (valid_until is null or valid_until > requested_effective_on);
    insert into public.employment_salaries (
      tenant_id, administration_id, employee_id, employment_id, payment_type,
      payment_frequency, salary_basis, fulltime_amount, hourly_rate, currency_code,
      salary_scale_step_id, cao_scale_name, cao_step_name, valid_from, valid_until, change_set_id
    ) values (
      employment.tenant_id, employment.administration_id, employment.employee_id, employment.id,
      (requested_payload ->> 'paymentType')::public.salary_payment_type,
      (requested_payload ->> 'paymentFrequency')::public.salary_frequency,
      (requested_payload ->> 'salaryBasis')::public.salary_basis,
      nullif(requested_payload ->> 'fulltimeAmount', '')::numeric,
      nullif(requested_payload ->> 'hourlyRate', '')::numeric,
      coalesce(requested_payload ->> 'currencyCode', 'EUR'),
      nullif(requested_payload ->> 'salaryScaleStepId', '')::uuid,
      nullif(requested_payload ->> 'caoScaleName', ''),
      nullif(requested_payload ->> 'caoStepName', ''),
      requested_effective_on, next_date, change_id
    );
  else
    select count(*), coalesce(sum((value ->> 'percentage')::numeric), 0)
      into allocation_count, allocation_total
      from jsonb_array_elements(requested_payload -> 'allocations');
    if allocation_count = 0 or allocation_total <> 100 then raise exception 'COST_ALLOCATION_TOTAL_INVALID'; end if;
    if exists (select 1 from public.employment_cost_allocations where employment_id = employment.id and valid_from = requested_effective_on) then
      raise exception 'TIMELINE_EFFECTIVE_DATE_CONFLICT';
    end if;
    select min(valid_from) into next_date from public.employment_cost_allocations
      where employment_id = employment.id and valid_from > requested_effective_on;
    update public.employment_cost_allocations set valid_until = requested_effective_on
      where employment_id = employment.id and valid_from < requested_effective_on
        and (valid_until is null or valid_until > requested_effective_on);
    for allocation in select value from jsonb_array_elements(requested_payload -> 'allocations') loop
      insert into public.employment_cost_allocations (
        tenant_id, administration_id, employee_id, employment_id, cost_center_id,
        percentage, valid_from, valid_until, change_set_id
      ) values (
        employment.tenant_id, employment.administration_id, employment.employee_id, employment.id,
        (allocation ->> 'costCenterId')::uuid, (allocation ->> 'percentage')::numeric,
        requested_effective_on, next_date, change_id
      );
    end loop;
  end if;

  update public.employment_change_sets
    set status = 'APPLIED', applied_at = timezone('utc', now()) where id = change_id;
  return change_id;
end;
$$;

create function public.rollback_latest_employment_timeline(
  requested_employment_id uuid,
  requested_timeline text,
  requested_effective_on date,
  requested_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  employment public.employments%rowtype;
  change_id uuid;
  latest_date date;
  previous_date date;
  deleted_until date;
  block_count integer;
  required_permission text;
begin
  select * into employment from public.employments where id = requested_employment_id and deleted_at is null for update;
  if employment.id is null then raise exception 'EMPLOYMENT_NOT_FOUND'; end if;
  required_permission := case when requested_timeline = 'SALARY' then 'salary:write' else 'contract:write' end;
  if not internal_security.current_user_has_permission(employment.tenant_id, employment.administration_id, required_permission) then
    raise exception 'FORBIDDEN';
  end if;

  if requested_timeline = 'LABOR_CONDITIONS' then
    select count(distinct valid_from), max(valid_from) into block_count, latest_date from public.employment_labor_conditions where employment_id = employment.id;
    select max(valid_from) into previous_date from public.employment_labor_conditions where employment_id = employment.id and valid_from < latest_date;
    select max(valid_until) into deleted_until from public.employment_labor_conditions where employment_id = employment.id and valid_from = latest_date;
  elsif requested_timeline = 'SCHEDULE' then
    select count(distinct valid_from), max(valid_from) into block_count, latest_date from public.employment_schedules where employment_id = employment.id;
    select max(valid_from) into previous_date from public.employment_schedules where employment_id = employment.id and valid_from < latest_date;
    select max(valid_until) into deleted_until from public.employment_schedules where employment_id = employment.id and valid_from = latest_date;
  elsif requested_timeline = 'SALARY' then
    select count(distinct valid_from), max(valid_from) into block_count, latest_date from public.employment_salaries where employment_id = employment.id;
    select max(valid_from) into previous_date from public.employment_salaries where employment_id = employment.id and valid_from < latest_date;
    select max(valid_until) into deleted_until from public.employment_salaries where employment_id = employment.id and valid_from = latest_date;
  elsif requested_timeline = 'COST_ALLOCATION' then
    select count(distinct valid_from), max(valid_from) into block_count, latest_date from public.employment_cost_allocations where employment_id = employment.id;
    select max(valid_from) into previous_date from public.employment_cost_allocations where employment_id = employment.id and valid_from < latest_date;
    select max(valid_until) into deleted_until from public.employment_cost_allocations where employment_id = employment.id and valid_from = latest_date;
  else raise exception 'TIMELINE_UNKNOWN'; end if;

  if block_count <= 1 then raise exception 'TIMELINE_LAST_REMAINING_BLOCK'; end if;
  if latest_date <> requested_effective_on then raise exception 'TIMELINE_ONLY_LATEST_CAN_ROLLBACK'; end if;

  insert into public.employment_change_sets (
    tenant_id, administration_id, employee_id, employment_id, effective_on, reason, domains
  ) values (
    employment.tenant_id, employment.administration_id, employment.employee_id, employment.id,
    requested_effective_on, requested_reason, array[requested_timeline]
  ) returning id into change_id;
  perform set_config('app.change_set_id', change_id::text, true);

  if requested_timeline = 'LABOR_CONDITIONS' then
    delete from public.employment_labor_conditions where employment_id = employment.id and valid_from = latest_date;
    update public.employment_labor_conditions set valid_until = deleted_until where employment_id = employment.id and valid_from = previous_date;
  elsif requested_timeline = 'SCHEDULE' then
    delete from public.employment_schedules where employment_id = employment.id and valid_from = latest_date;
    update public.employment_schedules set valid_until = deleted_until where employment_id = employment.id and valid_from = previous_date;
  elsif requested_timeline = 'SALARY' then
    delete from public.employment_salaries where employment_id = employment.id and valid_from = latest_date;
    update public.employment_salaries set valid_until = deleted_until where employment_id = employment.id and valid_from = previous_date;
  else
    delete from public.employment_cost_allocations where employment_id = employment.id and valid_from = latest_date;
    update public.employment_cost_allocations set valid_until = deleted_until where employment_id = employment.id and valid_from = previous_date;
  end if;

  update public.employment_change_sets set status = 'APPLIED', applied_at = timezone('utc', now()) where id = change_id;
  return change_id;
end;
$$;

revoke all on function public.apply_employment_timeline_mutation(uuid, text, date, jsonb, text, text[], jsonb) from public, anon;
revoke all on function public.rollback_latest_employment_timeline(uuid, text, date, text) from public, anon;
grant execute on function public.apply_employment_timeline_mutation(uuid, text, date, jsonb, text, text[], jsonb) to authenticated;
grant execute on function public.rollback_latest_employment_timeline(uuid, text, date, text) to authenticated;

grant select, insert, update on public.employment_change_sets to authenticated;
grant select, insert, update, delete on public.employment_change_follow_ups to authenticated;
grant select, insert, update, delete on public.employee_profile_links to authenticated;
grant select, insert, update, delete on public.employment_chain_history to authenticated;
grant select, insert, update, delete on public.employment_chain_assessments to authenticated;
