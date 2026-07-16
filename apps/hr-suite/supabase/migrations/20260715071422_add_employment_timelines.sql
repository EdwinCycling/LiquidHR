create type public.schedule_type as enum (
  'HOURS_PER_DAY',
  'HOURS_AND_AVG_DAYS',
  'HOURS_AND_SPECIFIC_DAYS',
  'TIMES_PER_DAY'
);
create type public.salary_payment_type as enum ('PERIODIC_FIXED', 'HOURLY_VARIABLE');
create type public.salary_frequency as enum ('MONTHLY', 'FOUR_WEEKLY');
create type public.salary_basis as enum ('MANUAL', 'MINIMUM_WAGE', 'CUSTOM_SCALE', 'CAO_SCALE');

create table public.salary_scales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  code text not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint salary_scales_administration_fkey foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete cascade,
  constraint salary_scales_code_key unique (tenant_id, administration_id, code),
  constraint salary_scales_scope_id_key unique (tenant_id, administration_id, id)
);

create table public.salary_scale_steps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  salary_scale_id uuid not null,
  step_code text not null,
  step_name text not null,
  fulltime_amount numeric(12,2) not null check (fulltime_amount >= 0),
  currency_code text not null default 'EUR' check (currency_code ~ '^[A-Z]{3}$'),
  valid_from date not null,
  valid_until date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint salary_scale_steps_period_valid check (valid_until is null or valid_until > valid_from),
  constraint salary_scale_steps_scale_fkey
    foreign key (tenant_id, administration_id, salary_scale_id)
    references public.salary_scales(tenant_id, administration_id, id) on delete cascade,
  constraint salary_scale_steps_code_period_key
    unique (tenant_id, administration_id, salary_scale_id, step_code, valid_from),
  constraint salary_scale_steps_scope_id_key unique (tenant_id, administration_id, id)
);

create table public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint cost_centers_administration_fkey foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete cascade,
  constraint cost_centers_code_key unique (tenant_id, administration_id, code),
  constraint cost_centers_scope_id_key unique (tenant_id, administration_id, id)
);

create table public.employment_end_reasons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  code text not null,
  name_nl text not null,
  name_en text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employment_end_reasons_administration_fkey foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete cascade,
  constraint employment_end_reasons_code_key unique (tenant_id, administration_id, code),
  constraint employment_end_reasons_scope_id_key unique (tenant_id, administration_id, id)
);

create table public.employment_labor_conditions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_id uuid not null,
  condition_group text not null,
  valid_from date not null,
  valid_until date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employment_labor_conditions_period_valid check (valid_until is null or valid_until > valid_from),
  constraint employment_labor_conditions_employment_fkey
    foreign key (tenant_id, administration_id, employee_id, employment_id)
    references public.employments(tenant_id, administration_id, employee_id, id) on delete cascade,
  constraint employment_labor_conditions_no_overlap exclude using gist (
    tenant_id with =, employment_id with =, daterange(valid_from, valid_until, '[)') with &&
  )
);

create table public.employment_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_id uuid not null,
  schedule_type public.schedule_type not null,
  start_week smallint not null default 1 check (start_week between 1 and 53),
  average_days_per_week numeric(6,3) not null check (average_days_per_week between 0 and 7),
  average_hours_per_week numeric(7,3) not null check (average_hours_per_week >= 0),
  part_time_factor numeric(10,6) not null check (part_time_factor between 0 and 2),
  time_for_time_accrual numeric(7,3) not null default 0 check (time_for_time_accrual >= 0),
  monday_hours numeric(6,3),
  tuesday_hours numeric(6,3),
  wednesday_hours numeric(6,3),
  thursday_hours numeric(6,3),
  friday_hours numeric(6,3),
  saturday_hours numeric(6,3),
  sunday_hours numeric(6,3),
  valid_from date not null,
  valid_until date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employment_schedules_period_valid check (valid_until is null or valid_until > valid_from),
  constraint employment_schedules_daily_hours_valid check (
    coalesce(monday_hours, 0) >= 0 and coalesce(tuesday_hours, 0) >= 0
    and coalesce(wednesday_hours, 0) >= 0 and coalesce(thursday_hours, 0) >= 0
    and coalesce(friday_hours, 0) >= 0 and coalesce(saturday_hours, 0) >= 0
    and coalesce(sunday_hours, 0) >= 0
  ),
  constraint employment_schedules_employment_fkey
    foreign key (tenant_id, administration_id, employee_id, employment_id)
    references public.employments(tenant_id, administration_id, employee_id, id) on delete cascade,
  constraint employment_schedules_no_overlap exclude using gist (
    tenant_id with =, employment_id with =, daterange(valid_from, valid_until, '[)') with &&
  )
);

create table public.employment_salaries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_id uuid not null,
  payment_type public.salary_payment_type not null,
  payment_frequency public.salary_frequency not null,
  salary_basis public.salary_basis not null,
  fulltime_amount numeric(12,2),
  hourly_rate numeric(12,4),
  currency_code text not null default 'EUR' check (currency_code ~ '^[A-Z]{3}$'),
  salary_scale_step_id uuid,
  cao_scale_name text,
  cao_step_name text,
  valid_from date not null,
  valid_until date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employment_salaries_period_valid check (valid_until is null or valid_until > valid_from),
  constraint employment_salaries_amounts_valid check (
    coalesce(fulltime_amount, 0) >= 0 and coalesce(hourly_rate, 0) >= 0
    and (payment_type <> 'PERIODIC_FIXED' or fulltime_amount is not null)
    and (payment_type <> 'HOURLY_VARIABLE' or hourly_rate is not null)
    and (salary_basis <> 'CUSTOM_SCALE' or salary_scale_step_id is not null)
    and (salary_basis <> 'CAO_SCALE' or (cao_scale_name is not null and cao_step_name is not null))
  ),
  constraint employment_salaries_employment_fkey
    foreign key (tenant_id, administration_id, employee_id, employment_id)
    references public.employments(tenant_id, administration_id, employee_id, id) on delete cascade,
  constraint employment_salaries_scale_step_fkey
    foreign key (tenant_id, administration_id, salary_scale_step_id)
    references public.salary_scale_steps(tenant_id, administration_id, id) on delete restrict,
  constraint employment_salaries_no_overlap exclude using gist (
    tenant_id with =, employment_id with =, daterange(valid_from, valid_until, '[)') with &&
  )
);

create table public.employment_cost_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_id uuid not null,
  cost_center_id uuid not null,
  percentage numeric(7,4) not null check (percentage > 0 and percentage <= 100),
  valid_from date not null,
  valid_until date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employment_cost_allocations_period_valid check (valid_until is null or valid_until > valid_from),
  constraint employment_cost_allocations_employment_fkey
    foreign key (tenant_id, administration_id, employee_id, employment_id)
    references public.employments(tenant_id, administration_id, employee_id, id) on delete cascade,
  constraint employment_cost_allocations_cost_center_fkey
    foreign key (tenant_id, administration_id, cost_center_id)
    references public.cost_centers(tenant_id, administration_id, id) on delete restrict,
  constraint employment_cost_allocations_no_overlap exclude using gist (
    tenant_id with =, employment_id with =, cost_center_id with =,
    daterange(valid_from, valid_until, '[)') with &&
  )
);

alter table public.employee_organizations add column employment_id uuid;
alter table public.employee_organizations
  add constraint employee_organizations_employment_scope_fkey
  foreign key (tenant_id, administration_id, employee_id, employment_id)
  references public.employments(tenant_id, administration_id, employee_id, id)
  on delete restrict;
create index employee_organizations_employment_id_idx
  on public.employee_organizations (employment_id) where employment_id is not null;

create index salary_scale_steps_scale_id_idx on public.salary_scale_steps (salary_scale_id);
create index employment_salaries_scale_step_id_idx on public.employment_salaries (salary_scale_step_id)
  where salary_scale_step_id is not null;
create index employment_cost_allocations_cost_center_id_idx on public.employment_cost_allocations (cost_center_id);

create trigger set_salary_scales_updated_at before update on public.salary_scales
for each row execute function internal_security.set_updated_at();
create trigger set_salary_scale_steps_updated_at before update on public.salary_scale_steps
for each row execute function internal_security.set_updated_at();
create trigger set_cost_centers_updated_at before update on public.cost_centers
for each row execute function internal_security.set_updated_at();
create trigger set_employment_end_reasons_updated_at before update on public.employment_end_reasons
for each row execute function internal_security.set_updated_at();
create trigger set_employment_labor_conditions_updated_at before update on public.employment_labor_conditions
for each row execute function internal_security.set_updated_at();
create trigger set_employment_schedules_updated_at before update on public.employment_schedules
for each row execute function internal_security.set_updated_at();
create trigger set_employment_salaries_updated_at before update on public.employment_salaries
for each row execute function internal_security.set_updated_at();
create trigger set_employment_cost_allocations_updated_at before update on public.employment_cost_allocations
for each row execute function internal_security.set_updated_at();

alter table public.salary_scales enable row level security;
alter table public.salary_scale_steps enable row level security;
alter table public.cost_centers enable row level security;
alter table public.employment_end_reasons enable row level security;
alter table public.employment_labor_conditions enable row level security;
alter table public.employment_schedules enable row level security;
alter table public.employment_salaries enable row level security;
alter table public.employment_cost_allocations enable row level security;

create policy salary_scales_read on public.salary_scales for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:read')));
create policy salary_scales_write on public.salary_scales for all to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')));
create policy salary_scale_steps_read on public.salary_scale_steps for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:read')));
create policy salary_scale_steps_write on public.salary_scale_steps for all to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')));

create policy cost_centers_read on public.cost_centers for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:read')));
create policy cost_centers_write on public.cost_centers for all to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));
create policy employment_end_reasons_read on public.employment_end_reasons for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:read')));
create policy employment_end_reasons_write on public.employment_end_reasons for all to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));

create policy employment_labor_conditions_read on public.employment_labor_conditions for select to authenticated
using ((select internal_security.can_manage_employee(employee_id, 'contract:read')));
create policy employment_labor_conditions_write on public.employment_labor_conditions for all to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));
create policy employment_schedules_read on public.employment_schedules for select to authenticated
using ((select internal_security.can_manage_employee(employee_id, 'contract:read')));
create policy employment_schedules_write on public.employment_schedules for all to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));
create policy employment_salaries_read on public.employment_salaries for select to authenticated
using (
  (select internal_security.can_manage_employee(employee_id, 'salary:read'))
  or (
    employee_id in (select id from public.employees where auth_user_id = (select auth.uid()))
    and (select internal_security.current_employee_has_permission('self:salary:read'))
  )
);
create policy employment_salaries_write on public.employment_salaries for all to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')));
create policy employment_cost_allocations_read on public.employment_cost_allocations for select to authenticated
using ((select internal_security.can_manage_employee(employee_id, 'contract:read')));
create policy employment_cost_allocations_write on public.employment_cost_allocations for all to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));

grant select, insert, update, delete on public.salary_scales to authenticated;
grant select, insert, update, delete on public.salary_scale_steps to authenticated;
grant select, insert, update, delete on public.cost_centers to authenticated;
grant select, insert, update, delete on public.employment_end_reasons to authenticated;
grant select, insert, update, delete on public.employment_labor_conditions to authenticated;
grant select, insert, update, delete on public.employment_schedules to authenticated;
grant select, insert, update, delete on public.employment_salaries to authenticated;
grant select, insert, update, delete on public.employment_cost_allocations to authenticated;
