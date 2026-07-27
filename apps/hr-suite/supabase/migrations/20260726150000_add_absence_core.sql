create type public.absence_case_status as enum ('ACTIVE', 'RECOVERY_WINDOW', 'CLOSED');

create table public.absence_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  frequent_absence_threshold smallint not null default 3 check (frequent_absence_threshold between 1 and 20),
  default_case_manager_employee_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint absence_settings_administration_scope_fkey
    foreign key (tenant_id, administration_id) references public.administrations(tenant_id, id) on delete cascade,
  constraint absence_settings_default_manager_fkey
    foreign key (tenant_id, default_case_manager_employee_id) references public.employees(tenant_id, id) on delete set null,
  constraint absence_settings_administration_unique unique (tenant_id, administration_id)
);

create table public.absence_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_id uuid not null,
  status public.absence_case_status not null default 'ACTIVE',
  first_absence_on date not null,
  effective_clock_start_on date not null,
  case_manager_employee_id uuid,
  has_sickness_benefit_safety_net boolean,
  is_work_accident boolean,
  is_third_party_traffic_accident boolean,
  prior_case_count_12_months smallint not null default 0 check (prior_case_count_12_months >= 0),
  frequent_absence_threshold smallint not null default 3 check (frequent_absence_threshold between 1 and 20),
  is_frequent_absence boolean not null default false,
  recovery_window_ends_on date,
  closed_at timestamptz,
  archived_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint absence_cases_administration_scope_fkey
    foreign key (tenant_id, administration_id) references public.administrations(tenant_id, id) on delete cascade,
  constraint absence_cases_employee_scope_fkey
    foreign key (tenant_id, employee_id) references public.employees(tenant_id, id) on delete cascade,
  constraint absence_cases_employment_scope_fkey
    foreign key (tenant_id, administration_id, employee_id, employment_id)
    references public.employments(tenant_id, administration_id, employee_id, id) on delete restrict,
  constraint absence_cases_manager_scope_fkey
    foreign key (tenant_id, case_manager_employee_id) references public.employees(tenant_id, id) on delete set null,
  constraint absence_cases_tenant_id_key unique (tenant_id, id),
  constraint absence_cases_recovery_window_check check (
    (status = 'RECOVERY_WINDOW' and recovery_window_ends_on is not null)
    or (status <> 'RECOVERY_WINDOW')
  )
);

create unique index absence_cases_one_open_per_employment_idx
  on public.absence_cases (tenant_id, administration_id, employment_id)
  where status in ('ACTIVE', 'RECOVERY_WINDOW') and archived_at is null;
create index absence_cases_employee_idx on public.absence_cases (tenant_id, administration_id, employee_id, first_absence_on desc);

create table public.absence_spells (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  case_id uuid not null references public.absence_cases(id) on delete cascade,
  started_on date not null,
  reported_at timestamptz not null default timezone('utc', now()),
  reported_by_user_id uuid references auth.users(id) on delete set null,
  expected_recovery_on date,
  recovered_on date,
  recovered_at timestamptz,
  recovered_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint absence_spells_dates_check check (expected_recovery_on is null or expected_recovery_on >= started_on),
  constraint absence_spells_recovery_check check (recovered_on is null or recovered_on >= started_on),
  constraint absence_spells_tenant_id_key unique (tenant_id, id),
  constraint absence_spells_case_tenant_fkey foreign key (tenant_id, case_id)
    references public.absence_cases(tenant_id, id) on delete cascade
);
create unique index absence_spells_one_open_idx on public.absence_spells (tenant_id, case_id) where recovered_on is null;
create index absence_spells_case_idx on public.absence_spells (tenant_id, case_id, started_on desc);

create table public.absence_capacity_changes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  case_id uuid not null references public.absence_cases(id) on delete cascade,
  spell_id uuid not null references public.absence_spells(id) on delete cascade,
  effective_on date not null,
  absence_percentage numeric(5,2) not null check (absence_percentage > 0 and absence_percentage <= 100),
  expected_next_review_on date,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint absence_capacity_changes_case_tenant_fkey foreign key (tenant_id, case_id)
    references public.absence_cases(tenant_id, id) on delete cascade,
  constraint absence_capacity_changes_spell_tenant_fkey foreign key (tenant_id, spell_id)
    references public.absence_spells(tenant_id, id) on delete cascade,
  constraint absence_capacity_changes_case_spell_unique unique (case_id, spell_id, effective_on)
);
create index absence_capacity_changes_spell_idx on public.absence_capacity_changes (tenant_id, spell_id, effective_on desc);

create table public.absence_mutations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_key text not null,
  operation_type text not null check (operation_type in ('REPORT', 'CAPACITY', 'RECOVERY')),
  result_case_id uuid references public.absence_cases(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint absence_mutations_key_unique unique (tenant_id, operation_key)
);

insert into public.permissions (code, name, category, description)
values
  ('absence:read', 'Verzuim bekijken', 'Verzuim', 'Operationele verzuimgegevens bekijken binnen de geldige scope.'),
  ('absence:write', 'Verzuim registreren', 'Verzuim', 'Een ziekmelding, percentagewijziging of herstel registreren.'),
  ('absence:recover', 'Herstel registreren', 'Verzuim', 'Een herstelmelding registreren.'),
  ('absence-settings:read', 'Verzuiminstellingen bekijken', 'Verzuim', 'Verzuiminstellingen bekijken.'),
  ('absence-settings:write', 'Verzuiminstellingen beheren', 'Verzuim', 'Verzuiminstellingen beheren.')
on conflict (code) do update set name = excluded.name, category = excluded.category, description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code in ('TENANT_ADMIN', 'DIRECT_MANAGER')
  and role.tenant_id is null
  and permission.code in ('absence:read', 'absence:write', 'absence:recover')
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'TENANT_ADMIN'
  and role.tenant_id is null
  and permission.code in ('absence-settings:read', 'absence-settings:write')
on conflict do nothing;

alter table public.absence_settings enable row level security;
alter table public.absence_cases enable row level security;
alter table public.absence_spells enable row level security;
alter table public.absence_capacity_changes enable row level security;
alter table public.absence_mutations enable row level security;

create policy absence_settings_select on public.absence_settings for select to authenticated
  using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'absence-settings:read')));
create policy absence_settings_write on public.absence_settings for all to authenticated
  using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'absence-settings:write')))
  with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'absence-settings:write')));

create policy absence_cases_select on public.absence_cases for select to authenticated
  using ((select internal_security.can_manage_employee(employee_id, 'absence:read')));
create policy absence_cases_insert on public.absence_cases for insert to authenticated
  with check ((select internal_security.can_manage_employee(employee_id, 'absence:write')));
create policy absence_cases_update on public.absence_cases for update to authenticated
  using ((select internal_security.can_manage_employee(employee_id, 'absence:write')))
  with check ((select internal_security.can_manage_employee(employee_id, 'absence:write')));

create policy absence_spells_select on public.absence_spells for select to authenticated
  using (exists (select 1 from public.absence_cases c where c.id = absence_spells.case_id and c.tenant_id = absence_spells.tenant_id and internal_security.can_manage_employee(c.employee_id, 'absence:read')));
create policy absence_spells_insert on public.absence_spells for insert to authenticated
  with check (exists (select 1 from public.absence_cases c where c.id = absence_spells.case_id and c.tenant_id = absence_spells.tenant_id and internal_security.can_manage_employee(c.employee_id, 'absence:write')));
create policy absence_spells_update on public.absence_spells for update to authenticated
  using (exists (select 1 from public.absence_cases c where c.id = absence_spells.case_id and c.tenant_id = absence_spells.tenant_id and internal_security.can_manage_employee(c.employee_id, 'absence:write')))
  with check (exists (select 1 from public.absence_cases c where c.id = absence_spells.case_id and c.tenant_id = absence_spells.tenant_id and internal_security.can_manage_employee(c.employee_id, 'absence:write')));

create policy absence_capacity_select on public.absence_capacity_changes for select to authenticated
  using (exists (select 1 from public.absence_cases c where c.id = absence_capacity_changes.case_id and c.tenant_id = absence_capacity_changes.tenant_id and internal_security.can_manage_employee(c.employee_id, 'absence:read')));
create policy absence_capacity_insert on public.absence_capacity_changes for insert to authenticated
  with check (exists (select 1 from public.absence_cases c where c.id = absence_capacity_changes.case_id and c.tenant_id = absence_capacity_changes.tenant_id and internal_security.can_manage_employee(c.employee_id, 'absence:write')));

revoke all on table public.absence_mutations from anon, authenticated;
grant select, insert, update on table public.absence_settings, public.absence_cases, public.absence_spells, public.absence_capacity_changes to authenticated;
revoke delete on table public.absence_settings, public.absence_cases, public.absence_spells, public.absence_capacity_changes from authenticated;

create trigger absence_settings_updated_at before update on public.absence_settings for each row execute function internal_security.set_updated_at();
create trigger absence_cases_updated_at before update on public.absence_cases for each row execute function internal_security.set_updated_at();
create trigger absence_spells_updated_at before update on public.absence_spells for each row execute function internal_security.set_updated_at();
create trigger audit_absence_cases after insert or update or delete on public.absence_cases for each row execute function internal_security.audit_hr_change('absence_case');
create trigger audit_absence_spells after insert or update or delete on public.absence_spells for each row execute function internal_security.audit_hr_change('absence_spell');
create trigger audit_absence_capacity after insert or update or delete on public.absence_capacity_changes for each row execute function internal_security.audit_hr_change('absence_capacity_change');

create or replace function public.report_absence(
  requested_tenant_id uuid,
  requested_administration_id uuid,
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
security definer
set search_path = public, pg_temp
as $$
declare
  existing_mutation uuid;
  case_record public.absence_cases%rowtype;
  spell_id uuid;
  threshold smallint;
  prior_count smallint;
  existing_recovered date;
begin
  if auth.uid() is null or not internal_security.can_manage_employee(requested_employee_id, 'absence:write') then
    raise exception 'ABSENCE_FORBIDDEN' using errcode = '42501';
  end if;
  if requested_absence_percentage is null or requested_absence_percentage <= 0 or requested_absence_percentage > 100 then
    raise exception 'ABSENCE_PERCENTAGE_INVALID' using errcode = '22023';
  end if;
  if requested_idempotency_key is not null then
    select result_case_id into existing_mutation from public.absence_mutations where tenant_id = requested_tenant_id and operation_key = requested_idempotency_key;
    if existing_mutation is not null then return existing_mutation; end if;
  end if;
  select frequent_absence_threshold into threshold from public.absence_settings where tenant_id = requested_tenant_id and administration_id = requested_administration_id;
  threshold := coalesce(threshold, 3);
  select count(*)::smallint into prior_count from public.absence_cases
    where tenant_id = requested_tenant_id and administration_id = requested_administration_id and employee_id = requested_employee_id
      and first_absence_on >= requested_start_date - interval '1 year' and first_absence_on < requested_start_date and archived_at is null;
  select * into case_record from public.absence_cases where tenant_id = requested_tenant_id and administration_id = requested_administration_id and employment_id = requested_employment_id and status in ('ACTIVE','RECOVERY_WINDOW') and archived_at is null order by first_absence_on desc limit 1 for update;
  if case_record.id is not null then
    select recovered_on into existing_recovered from public.absence_spells where case_id = case_record.id order by started_on desc limit 1;
    if existing_recovered is null then raise exception 'ABSENCE_ACTIVE_SPELL_EXISTS' using errcode = '23514'; end if;
    if requested_start_date - existing_recovered < 28 then
      update public.absence_cases set status = 'ACTIVE', recovery_window_ends_on = null, updated_at = timezone('utc', now()) where id = case_record.id;
    else
      update public.absence_cases set status = 'CLOSED', closed_at = timezone('utc', now()), updated_at = timezone('utc', now()) where id = case_record.id;
      case_record.id := null;
    end if;
  end if;
  if case_record.id is null then
    insert into public.absence_cases (tenant_id, administration_id, employee_id, employment_id, first_absence_on, effective_clock_start_on, has_sickness_benefit_safety_net, is_work_accident, is_third_party_traffic_accident, prior_case_count_12_months, frequent_absence_threshold, is_frequent_absence, created_by_user_id)
    values (requested_tenant_id, requested_administration_id, requested_employee_id, requested_employment_id, requested_start_date, requested_start_date, requested_has_sickness_benefit_safety_net, requested_is_work_accident, requested_is_third_party_traffic_accident, prior_count, threshold, prior_count + 1 >= threshold, auth.uid()) returning * into case_record;
  end if;
  insert into public.absence_spells (tenant_id, case_id, started_on, expected_recovery_on, reported_by_user_id) values (requested_tenant_id, case_record.id, requested_start_date, requested_expected_recovery_on, auth.uid()) returning id into spell_id;
  insert into public.absence_capacity_changes (tenant_id, case_id, spell_id, effective_on, absence_percentage, created_by_user_id) values (requested_tenant_id, case_record.id, spell_id, requested_start_date, requested_absence_percentage, auth.uid());
  if requested_idempotency_key is not null then insert into public.absence_mutations (tenant_id, operation_key, operation_type, result_case_id) values (requested_tenant_id, requested_idempotency_key, 'REPORT', case_record.id) on conflict do nothing; end if;
  return case_record.id;
end;
$$;

revoke all on function public.report_absence(uuid, uuid, uuid, uuid, date, numeric, date, boolean, boolean, boolean, text) from public, anon;
grant execute on function public.report_absence(uuid, uuid, uuid, uuid, date, numeric, date, boolean, boolean, boolean, text) to authenticated;

create or replace function public.recover_absence(requested_case_id uuid, requested_recovered_on date, requested_idempotency_key text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare case_record public.absence_cases%rowtype; begin
  select * into case_record from public.absence_cases where id = requested_case_id for update;
  if case_record.id is null or not internal_security.can_manage_employee(case_record.employee_id, 'absence:recover') then raise exception 'ABSENCE_FORBIDDEN' using errcode = '42501'; end if;
  update public.absence_spells set recovered_on = requested_recovered_on, recovered_at = timezone('utc', now()), recovered_by_user_id = auth.uid() where case_id = requested_case_id and recovered_on is null;
  if not found then raise exception 'ABSENCE_NO_OPEN_SPELL' using errcode = '23514'; end if;
  update public.absence_cases set status = 'RECOVERY_WINDOW', recovery_window_ends_on = requested_recovered_on + 28, updated_at = timezone('utc', now()) where id = requested_case_id;
  return requested_case_id;
end; $$;
revoke all on function public.recover_absence(uuid, date, text) from public, anon;
grant execute on function public.recover_absence(uuid, date, text) to authenticated;
