create type public.employment_worker_type as enum (
  'EMPLOYEE',
  'STUDENT_INTERN',
  'TEMPORARY_AGENCY',
  'EXTERNAL_NO_PAYROLL'
);

create type public.contract_duration_type as enum ('INDEFINITE', 'DEFINITE');
create type public.employment_work_scope as enum ('FULL_TIME', 'PART_TIME');

create table public.administration_hr_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  default_employment_country_code text not null default 'NL'
    check (default_employment_country_code ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint administration_hr_settings_administration_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete cascade,
  constraint administration_hr_settings_administration_key
    unique (tenant_id, administration_id),
  constraint administration_hr_settings_scope_id_key
    unique (tenant_id, administration_id, id)
);

create table public.labor_condition_sets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  code text not null,
  name text not null,
  standard_hours_per_week numeric(6,2) not null default 40
    check (standard_hours_per_week > 0 and standard_hours_per_week <= 60),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint labor_condition_sets_administration_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete cascade,
  constraint labor_condition_sets_code_key unique (tenant_id, administration_id, code),
  constraint labor_condition_sets_scope_id_key unique (tenant_id, administration_id, id)
);

create table public.flex_phases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  code text not null,
  name text not null,
  sort_order smallint not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint flex_phases_administration_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete cascade,
  constraint flex_phases_code_key unique (tenant_id, administration_id, code),
  constraint flex_phases_scope_id_key unique (tenant_id, administration_id, id)
);

create table public.salary_frequencies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  code text not null,
  name text not null,
  periods_per_year numeric(7,3) not null check (periods_per_year > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint salary_frequencies_administration_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete cascade,
  constraint salary_frequencies_code_key unique (tenant_id, administration_id, code),
  constraint salary_frequencies_scope_id_key unique (tenant_id, administration_id, id)
);

create table public.cost_carriers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint cost_carriers_administration_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete cascade,
  constraint cost_carriers_code_key unique (tenant_id, administration_id, code),
  constraint cost_carriers_scope_id_key unique (tenant_id, administration_id, id)
);

alter table public.employments
  add column country_code text not null default 'NL'
    check (country_code ~ '^[A-Z]{2}$');

alter table public.income_relationships
  drop constraint income_relationships_ikv_number_check,
  add constraint income_relationships_ikv_number_check check (ikv_number between 1 and 99);

alter table public.employments
  add constraint employments_one_overlapping_primary
  exclude using gist (
    tenant_id with =,
    administration_id with =,
    employee_id with =,
    daterange(starts_on, coalesce(ends_on + 1, 'infinity'::date), '[)') with &&
  )
  where (is_primary and deleted_at is null);

create table public.employment_contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_id uuid not null,
  sequence_number smallint not null check (sequence_number between 1 and 999),
  worker_type public.employment_worker_type not null,
  flex_phase_id uuid,
  labor_condition_set_id uuid not null,
  duration_type public.contract_duration_type not null,
  starts_on date not null,
  ends_on date,
  probation_applies boolean not null default false,
  probation_ends_on date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employment_contracts_dates_valid check (
    (duration_type = 'INDEFINITE' and ends_on is null)
    or (duration_type = 'DEFINITE' and ends_on is not null and ends_on >= starts_on)
  ),
  constraint employment_contracts_probation_valid check (
    (not probation_applies and probation_ends_on is null)
    or (
      probation_applies
      and probation_ends_on is not null
      and probation_ends_on >= starts_on
      and (ends_on is null or probation_ends_on <= ends_on)
    )
  ),
  constraint employment_contracts_flex_phase_valid check (
    (worker_type = 'TEMPORARY_AGENCY' and flex_phase_id is not null)
    or (worker_type <> 'TEMPORARY_AGENCY' and flex_phase_id is null)
  ),
  constraint employment_contracts_employment_fkey
    foreign key (tenant_id, administration_id, employee_id, employment_id)
    references public.employments(tenant_id, administration_id, employee_id, id)
    on delete cascade,
  constraint employment_contracts_labor_condition_set_fkey
    foreign key (tenant_id, administration_id, labor_condition_set_id)
    references public.labor_condition_sets(tenant_id, administration_id, id)
    on delete restrict,
  constraint employment_contracts_flex_phase_fkey
    foreign key (tenant_id, administration_id, flex_phase_id)
    references public.flex_phases(tenant_id, administration_id, id)
    on delete restrict,
  constraint employment_contracts_sequence_key
    unique (tenant_id, employment_id, sequence_number),
  constraint employment_contracts_scope_id_key
    unique (tenant_id, administration_id, employee_id, employment_id, id),
  constraint employment_contracts_no_overlap
    exclude using gist (
      tenant_id with =,
      employment_id with =,
      daterange(starts_on, coalesce(ends_on + 1, 'infinity'::date), '[)') with &&
    )
);

alter table public.employment_labor_conditions
  add column employment_contract_id uuid;

alter table public.employment_schedules
  add column is_on_call boolean not null default false,
  add column on_call_obligation boolean,
  add column work_scope public.employment_work_scope not null default 'FULL_TIME';

update public.employment_schedules
set work_scope = case
  when part_time_factor = 1 then 'FULL_TIME'::public.employment_work_scope
  else 'PART_TIME'::public.employment_work_scope
end;

update public.employment_schedules
set
  monday_hours = average_hours_per_week / 5,
  tuesday_hours = average_hours_per_week / 5,
  wednesday_hours = average_hours_per_week / 5,
  thursday_hours = average_hours_per_week / 5,
  friday_hours = average_hours_per_week / 5
where coalesce(monday_hours, 0) + coalesce(tuesday_hours, 0)
  + coalesce(wednesday_hours, 0) + coalesce(thursday_hours, 0)
  + coalesce(friday_hours, 0) + coalesce(saturday_hours, 0)
  + coalesce(sunday_hours, 0) = 0
  and average_hours_per_week > 0;

alter table public.employment_schedules
  add constraint employment_schedules_call_valid check (
    (is_on_call and on_call_obligation is not null and work_scope is null)
    or (not is_on_call and on_call_obligation is null and work_scope is not null)
  ),
  add constraint employment_schedules_weekly_hours_valid check (
    average_hours_per_week between 0 and 50
  ),
  add constraint employment_schedules_parttime_valid check (
    work_scope <> 'FULL_TIME' or part_time_factor = 1
  ),
  add constraint employment_schedules_roster_total_valid check (
    abs(
      coalesce(monday_hours, 0) + coalesce(tuesday_hours, 0)
      + coalesce(wednesday_hours, 0) + coalesce(thursday_hours, 0)
      + coalesce(friday_hours, 0) + coalesce(saturday_hours, 0)
      + coalesce(sunday_hours, 0) - average_hours_per_week
    ) < 0.001
  );

alter table public.employment_salaries
  add column salary_frequency_id uuid,
  add column parttime_amount numeric(12,2) check (parttime_amount >= 0);

alter table public.employment_cost_allocations
  add column cost_carrier_id uuid;

insert into public.administration_hr_settings (
  tenant_id, administration_id, default_employment_country_code
)
select administration.tenant_id, administration.id, 'NL'
from public.administrations administration
on conflict (tenant_id, administration_id) do nothing;

insert into public.labor_condition_sets (
  id, tenant_id, administration_id, code, name, standard_hours_per_week
)
select
  md5('labor-condition-set:' || administration.id::text || ':COMPANY')::uuid,
  administration.tenant_id,
  administration.id,
  'COMPANY',
  'Bedrijfseigen regeling',
  40
from public.administrations administration
on conflict (tenant_id, administration_id, code) do nothing;

insert into public.salary_frequencies (
  id, tenant_id, administration_id, code, name, periods_per_year
)
select
  md5('salary-frequency:' || administration.id::text || ':' || seed.code)::uuid,
  administration.tenant_id,
  administration.id,
  seed.code,
  seed.name,
  seed.periods_per_year
from public.administrations administration
cross join (
  values
    ('MONTHLY', 'Maand', 12::numeric),
    ('FOUR_WEEKLY', '4-weken', 13::numeric)
) as seed(code, name, periods_per_year)
on conflict (tenant_id, administration_id, code) do nothing;

insert into public.flex_phases (
  id, tenant_id, administration_id, code, name, sort_order
)
select
  md5('flex-phase:' || administration.id::text || ':' || seed.code)::uuid,
  administration.tenant_id,
  administration.id,
  seed.code,
  seed.name,
  seed.sort_order
from public.administrations administration
cross join (
  values
    ('PHASE_A_AGENCY_CLAUSE', 'Fase A met uitzendbeding', 10),
    ('PHASE_B', 'Fase B', 20),
    ('PHASE_C', 'Fase C', 30),
    ('PHASE_3', 'Fase 3', 40),
    ('PHASE_A_EXCLUSION_CONTINUED_PAY', 'Fase A zonder uitzendbeding, met uitsl. van loondoorbet.', 50),
    ('PHASE_4', 'Fase 4', 60),
    ('PHASE_A_NO_AGENCY_CLAUSE', 'Fase A zonder uitzendbeding', 70),
    ('STATUTORY_REGIME', 'Wettelijk regime', 80),
    ('CHAIN_SYSTEM', 'Ketensysteem', 90)
) as seed(code, name, sort_order)
on conflict (tenant_id, administration_id, code) do nothing;

insert into public.cost_carriers (
  id, tenant_id, administration_id, code, name
)
select
  md5('cost-carrier:' || administration.id::text || ':GENERAL')::uuid,
  administration.tenant_id,
  administration.id,
  'GENERAL',
  'Algemeen'
from public.administrations administration
on conflict (tenant_id, administration_id, code) do nothing;

insert into public.employment_contracts (
  id, tenant_id, administration_id, employee_id, employment_id,
  sequence_number, worker_type, labor_condition_set_id, duration_type,
  starts_on, ends_on, probation_applies, probation_ends_on
)
select
  md5('employment-contract:' || employment.id::text || ':1')::uuid,
  employment.tenant_id,
  employment.administration_id,
  employment.employee_id,
  employment.id,
  1,
  case employment.employment_type
    when 'INTERN' then 'STUDENT_INTERN'::public.employment_worker_type
    when 'APPRENTICE' then 'STUDENT_INTERN'::public.employment_worker_type
    when 'CONTRACTOR' then 'EXTERNAL_NO_PAYROLL'::public.employment_worker_type
    else 'EMPLOYEE'::public.employment_worker_type
  end,
  md5('labor-condition-set:' || employment.administration_id::text || ':COMPANY')::uuid,
  case
    when employment.ends_on is null then 'INDEFINITE'::public.contract_duration_type
    else 'DEFINITE'::public.contract_duration_type
  end,
  employment.starts_on,
  employment.ends_on,
  employment.probation_ends_on is not null,
  employment.probation_ends_on
from public.employments employment
where employment.deleted_at is null;

update public.employment_labor_conditions condition
set employment_contract_id = contract.id
from public.employment_contracts contract
where contract.employment_id = condition.employment_id
  and contract.sequence_number = 1;

alter table public.employment_labor_conditions
  alter column employment_contract_id set not null,
  add constraint employment_labor_conditions_contract_fkey
    foreign key (
      tenant_id, administration_id, employee_id, employment_id, employment_contract_id
    )
    references public.employment_contracts(
      tenant_id, administration_id, employee_id, employment_id, id
    ) on delete cascade;

update public.employment_salaries salary
set
  salary_frequency_id = frequency.id,
  parttime_amount = case
    when salary.fulltime_amount is not null
      then round(
        salary.fulltime_amount * coalesce((
          select current_schedule.part_time_factor
          from public.employment_schedules current_schedule
          where current_schedule.employment_id = salary.employment_id
            and current_schedule.valid_from <= salary.valid_from
            and (
              current_schedule.valid_until is null
              or current_schedule.valid_until > salary.valid_from
            )
          order by current_schedule.valid_from desc
          limit 1
        ), 1),
        2
      )
    else salary.fulltime_amount
  end
from public.salary_frequencies frequency
where frequency.tenant_id = salary.tenant_id
  and frequency.administration_id = salary.administration_id
  and frequency.code = salary.payment_frequency::text;

alter table public.employment_salaries
  alter column salary_frequency_id set not null,
  add constraint employment_salaries_frequency_fkey
    foreign key (tenant_id, administration_id, salary_frequency_id)
    references public.salary_frequencies(tenant_id, administration_id, id)
    on delete restrict;

update public.employment_cost_allocations allocation
set cost_carrier_id = md5(
  'cost-carrier:' || allocation.administration_id::text || ':GENERAL'
)::uuid;

alter table public.employment_cost_allocations
  alter column cost_carrier_id set not null,
  add constraint employment_cost_allocations_cost_carrier_fkey
    foreign key (tenant_id, administration_id, cost_carrier_id)
    references public.cost_carriers(tenant_id, administration_id, id)
    on delete restrict;

create index employment_contracts_employment_period_idx
  on public.employment_contracts (employment_id, starts_on, ends_on);
create index employment_contracts_labor_condition_set_idx
  on public.employment_contracts (labor_condition_set_id);
create index employment_contracts_flex_phase_idx
  on public.employment_contracts (flex_phase_id) where flex_phase_id is not null;
create index employment_labor_conditions_contract_idx
  on public.employment_labor_conditions (employment_contract_id);
create index employment_salaries_frequency_idx
  on public.employment_salaries (salary_frequency_id);
create index employment_cost_allocations_carrier_idx
  on public.employment_cost_allocations (cost_carrier_id);

create trigger set_administration_hr_settings_updated_at
before update on public.administration_hr_settings
for each row execute function internal_security.set_updated_at();
create trigger set_labor_condition_sets_updated_at
before update on public.labor_condition_sets
for each row execute function internal_security.set_updated_at();
create trigger set_flex_phases_updated_at
before update on public.flex_phases
for each row execute function internal_security.set_updated_at();
create trigger set_salary_frequencies_updated_at
before update on public.salary_frequencies
for each row execute function internal_security.set_updated_at();
create trigger set_cost_carriers_updated_at
before update on public.cost_carriers
for each row execute function internal_security.set_updated_at();
create trigger set_employment_contracts_updated_at
before update on public.employment_contracts
for each row execute function internal_security.set_updated_at();

alter table public.administration_hr_settings enable row level security;
alter table public.labor_condition_sets enable row level security;
alter table public.flex_phases enable row level security;
alter table public.salary_frequencies enable row level security;
alter table public.cost_carriers enable row level security;
alter table public.employment_contracts enable row level security;

create policy administration_hr_settings_read
on public.administration_hr_settings for select to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:read'
)));
create policy administration_hr_settings_insert
on public.administration_hr_settings for insert to authenticated
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)));
create policy administration_hr_settings_update
on public.administration_hr_settings for update to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)))
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)));

create policy labor_condition_sets_read
on public.labor_condition_sets for select to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:read'
)));
create policy labor_condition_sets_write
on public.labor_condition_sets for all to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)))
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)));

create policy flex_phases_read
on public.flex_phases for select to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:read'
)));
create policy flex_phases_write
on public.flex_phases for all to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)))
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)));

create policy salary_frequencies_read
on public.salary_frequencies for select to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'salary:read'
)));
create policy salary_frequencies_write
on public.salary_frequencies for all to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'salary:write'
)))
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'salary:write'
)));

create policy cost_carriers_read
on public.cost_carriers for select to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:read'
)));
create policy cost_carriers_write
on public.cost_carriers for all to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)))
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)));

create policy employment_contracts_read
on public.employment_contracts for select to authenticated
using (
  (
    employee_id in (
      select employee.id from public.employees employee
      where employee.auth_user_id = (select auth.uid())
        and employee.deleted_at is null
    )
    and (select internal_security.current_employee_has_permission('self:contract:read'))
  )
  or (select internal_security.can_manage_employee(employee_id, 'contract:read'))
);
create policy employment_contracts_insert
on public.employment_contracts for insert to authenticated
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)));
create policy employment_contracts_update
on public.employment_contracts for update to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)))
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)));

revoke all on public.administration_hr_settings from anon;
revoke all on public.labor_condition_sets from anon;
revoke all on public.flex_phases from anon;
revoke all on public.salary_frequencies from anon;
revoke all on public.cost_carriers from anon;
revoke all on public.employment_contracts from anon;

grant select, insert, update on public.administration_hr_settings to authenticated;
grant select, insert, update, delete on public.labor_condition_sets to authenticated;
grant select, insert, update, delete on public.flex_phases to authenticated;
grant select, insert, update, delete on public.salary_frequencies to authenticated;
grant select, insert, update, delete on public.cost_carriers to authenticated;
grant select, insert, update on public.employment_contracts to authenticated;
