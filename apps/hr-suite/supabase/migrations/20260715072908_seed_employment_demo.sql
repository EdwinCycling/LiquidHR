insert into public.cost_centers (id, tenant_id, administration_id, code, name)
select md5('cost-center:' || administration.id::text || ':GENERAL')::uuid,
       administration.tenant_id, administration.id, 'GENERAL', 'Algemene kostenplaats'
from public.administrations administration
on conflict (tenant_id, administration_id, code) do update set name = excluded.name;

insert into public.salary_scales (id, tenant_id, administration_id, code, name, description)
select md5('salary-scale:' || administration.id::text || ':DEMO')::uuid,
       administration.tenant_id, administration.id, 'DEMO', 'Demo loonschaal', 'Fictieve schaal voor ontwikkeldata.'
from public.administrations administration
on conflict (tenant_id, administration_id, code) do update set name = excluded.name;

insert into public.salary_scale_steps (
  id, tenant_id, administration_id, salary_scale_id, step_code, step_name,
  fulltime_amount, valid_from
)
select md5('salary-step:' || scale.id::text || ':1')::uuid,
       scale.tenant_id, scale.administration_id, scale.id, '1', 'Trede 1', 3500.00, '2024-01-01'
from public.salary_scales scale
where scale.code = 'DEMO'
on conflict (id) do update set fulltime_amount = excluded.fulltime_amount;

insert into public.employment_end_reasons (
  id, tenant_id, administration_id, code, name_nl, name_en
)
select md5('employment-end-reason:' || administration.id::text || ':CONTRACT_END')::uuid,
       administration.tenant_id, administration.id, 'CONTRACT_END', 'Einde contract', 'End of contract'
from public.administrations administration
on conflict (tenant_id, administration_id, code) do update
set name_nl = excluded.name_nl, name_en = excluded.name_en;

with selected_employees as (
  select employee.*,
         substring(employee.employee_number from '([0-9]+)$')::integer as number_suffix
  from public.employees employee
  where employee.deleted_at is null
    and (
      employee.employee_number ~ '^DEMO-0(0[1-9]|[12][0-9]|3[0-9]|40|4[1-3])$'
      or employee.employee_number ~ '^NZG-00[1-9]$'
    )
), employee_scope as (
  select employee.*,
         assignment.administration_id
  from selected_employees employee
  cross join lateral (
    select scope.administration_id
    from public.employee_administration_assignments scope
    where scope.tenant_id = employee.tenant_id
      and scope.employee_id = employee.id
    order by scope.effective_from desc, scope.id
    limit 1
  ) assignment
)
insert into public.employments (
  id, tenant_id, administration_id, employee_id, employment_number,
  employment_type, contract_type, record_status, starts_on, ends_on,
  seniority_date, original_hire_date, is_primary, reason_started
)
select md5('employment:' || employee.tenant_id::text || ':' || employee.employee_number || ':primary')::uuid,
       employee.tenant_id,
       employee.administration_id,
       employee.id,
       'EMP-' || employee.employee_number || '-A',
       'EMPLOYEE',
       case when employee.employee_number in ('DEMO-036','DEMO-037','DEMO-038','DEMO-039','DEMO-040','NZG-009')
         then 'DEFINITE'::public.contract_type else 'INDEFINITE'::public.contract_type end,
       'CONFIRMED',
       case when employee.employee_number ~ '^DEMO-04[1-3]$'
         then ('2026-08-01'::date + (employee.number_suffix - 41))
         else ('2024-01-01'::date + ((employee.number_suffix - 1) % 20)) end,
       case when employee.employee_number in ('DEMO-036','DEMO-037','DEMO-038','DEMO-039','DEMO-040','NZG-009')
         then '2026-06-30'::date else null end,
       case when employee.employee_number ~ '^DEMO-04[1-3]$'
         then ('2026-08-01'::date + (employee.number_suffix - 41))
         else ('2024-01-01'::date + ((employee.number_suffix - 1) % 20)) end,
       case when employee.employee_number ~ '^DEMO-04[1-3]$'
         then ('2026-08-01'::date + (employee.number_suffix - 41))
         else ('2024-01-01'::date + ((employee.number_suffix - 1) % 20)) end,
       true,
       'Deterministische ontwikkeldata'
from employee_scope employee
on conflict (id) do update
set ends_on = excluded.ends_on,
    record_status = excluded.record_status;

with special_employee as (
  select employee.*,
         assignment.administration_id
  from public.employees employee
  cross join lateral (
    select scope.administration_id
    from public.employee_administration_assignments scope
    where scope.tenant_id = employee.tenant_id and scope.employee_id = employee.id
    order by scope.effective_from desc, scope.id limit 1
  ) assignment
  where employee.employee_number in ('DEMO-044', 'DEMO-045', 'DEMO-046')
)
insert into public.employments (
  id, tenant_id, administration_id, employee_id, employment_number,
  contract_type, record_status, starts_on, ends_on, seniority_date,
  original_hire_date, is_primary, reason_started
)
select id, tenant_id, administration_id, employee_id, employment_number,
       contract_type, 'CONFIRMED', starts_on, ends_on, starts_on,
       original_hire_date, is_primary, reason_started
from (
  select md5('employment:DEMO-044:old')::uuid id, tenant_id, administration_id, id employee_id,
         'EMP-DEMO-044-A' employment_number, 'DEFINITE'::public.contract_type contract_type,
         '2024-01-01'::date starts_on, '2025-12-31'::date ends_on,
         '2024-01-01'::date original_hire_date, false is_primary, 'Eerder dienstverband' reason_started
  from special_employee where employee_number = 'DEMO-044'
  union all
  select md5('employment:DEMO-044:rehire')::uuid, tenant_id, administration_id, id,
         'EMP-DEMO-044-B', 'INDEFINITE', '2026-03-01', null, '2024-01-01', true, 'Herintreding'
  from special_employee where employee_number = 'DEMO-044'
  union all
  select md5('employment:DEMO-045:one')::uuid, tenant_id, administration_id, id,
         'EMP-DEMO-045-A', 'INDEFINITE', '2025-01-01', null, '2025-01-01', true, 'Primair parallel dienstverband'
  from special_employee where employee_number = 'DEMO-045'
  union all
  select md5('employment:DEMO-045:two')::uuid, tenant_id, administration_id, id,
         'EMP-DEMO-045-B', 'DEFINITE', '2026-01-01', null, '2025-01-01', false, 'Tweede parallel dienstverband'
  from special_employee where employee_number = 'DEMO-045'
  union all
  select md5('employment:DEMO-046:one')::uuid, tenant_id, administration_id, id,
         'EMP-DEMO-046-A', 'INDEFINITE', '2025-01-01', null, '2025-01-01', true, 'Primair dienstverband'
  from special_employee where employee_number = 'DEMO-046'
) employment
on conflict (id) do update set ends_on = excluded.ends_on;

with employee as (
  select * from public.employees where employee_number = 'DEMO-046'
), second_administration as (
  select administration.*
  from public.administrations administration, employee
  where administration.tenant_id = employee.tenant_id
    and administration.id <> (
      select assignment.administration_id
      from public.employee_administration_assignments assignment
      where assignment.employee_id = employee.id
      order by assignment.effective_from desc, assignment.id limit 1
    )
  order by administration.code limit 1
)
insert into public.employee_administration_assignments (
  id, tenant_id, administration_id, employee_id, effective_from
)
select md5('employee-admin:DEMO-046:second')::uuid,
       employee.tenant_id, administration.id, employee.id, '2026-01-01'
from employee cross join second_administration administration
on conflict (id) do nothing;

with employee as (
  select * from public.employees where employee_number = 'DEMO-046'
), second_scope as (
  select assignment.administration_id
  from public.employee_administration_assignments assignment, employee
  where assignment.employee_id = employee.id
    and assignment.id = md5('employee-admin:DEMO-046:second')::uuid
  limit 1
)
insert into public.employments (
  id, tenant_id, administration_id, employee_id, employment_number,
  contract_type, record_status, starts_on, seniority_date,
  original_hire_date, is_primary, reason_started
)
select md5('employment:DEMO-046:two')::uuid, employee.tenant_id,
       scope.administration_id, employee.id, 'EMP-DEMO-046-B',
       'DEFINITE', 'CONFIRMED', '2026-01-01', '2025-01-01',
       '2025-01-01', false, 'Parallel dienstverband in tweede administratie'
from employee cross join second_scope scope
on conflict (id) do nothing;

with numbered as (
  select employment.*,
         row_number() over (partition by employment.tenant_id, employment.administration_id order by employment.employment_number) as ikv_number
  from public.employments employment
  where employment.reason_started in (
    'Deterministische ontwikkeldata', 'Eerder dienstverband', 'Herintreding',
    'Primair parallel dienstverband', 'Tweede parallel dienstverband',
    'Primair dienstverband', 'Parallel dienstverband in tweede administratie'
  )
)
insert into public.income_relationships (
  id, tenant_id, administration_id, employee_id, payroll_tax_subnumber,
  ikv_number, relationship_type, starts_on, ends_on, reporting_status
)
select md5('income:' || employment.id::text)::uuid,
       employment.tenant_id, employment.administration_id, employment.employee_id,
       'L01', employment.ikv_number, 'EMPLOYMENT', employment.starts_on,
       employment.ends_on, case when employment.ends_on is null then 'READY'::public.payroll_reporting_status else 'CLOSED'::public.payroll_reporting_status end
from numbered employment
on conflict (id) do update set ends_on = excluded.ends_on;

insert into public.employment_income_relationships (
  id, tenant_id, administration_id, employee_id, employment_id,
  income_relationship_id, valid_from, valid_until
)
select md5('employment-income:' || employment.id::text)::uuid,
       employment.tenant_id, employment.administration_id, employment.employee_id,
       employment.id, income.id, employment.starts_on,
       case when employment.ends_on is null then null else employment.ends_on + 1 end
from public.employments employment
join public.income_relationships income
  on income.id = md5('income:' || employment.id::text)::uuid
on conflict (id) do update set valid_until = excluded.valid_until;

insert into public.employment_labor_conditions (
  id, tenant_id, administration_id, employee_id, employment_id,
  condition_group, valid_from, valid_until
)
select md5('labor-condition:' || employment.id::text)::uuid,
       employment.tenant_id, employment.administration_id, employment.employee_id,
       employment.id, 'Bedrijfsregeling Demo', employment.starts_on,
       case when employment.ends_on is null then null else employment.ends_on + 1 end
from public.employments employment
join public.income_relationships income on income.id = md5('income:' || employment.id::text)::uuid
on conflict (id) do update set valid_until = excluded.valid_until;

insert into public.employment_schedules (
  id, tenant_id, administration_id, employee_id, employment_id,
  schedule_type, average_days_per_week, average_hours_per_week,
  part_time_factor, monday_hours, tuesday_hours, wednesday_hours,
  thursday_hours, friday_hours, valid_from, valid_until
)
select md5('schedule:' || employment.id::text)::uuid,
       employment.tenant_id, employment.administration_id, employment.employee_id,
       employment.id, 'HOURS_AND_SPECIFIC_DAYS', 5, 40, 1,
       8, 8, 8, 8, 8, employment.starts_on,
       case when employment.ends_on is null then null else employment.ends_on + 1 end
from public.employments employment
join public.income_relationships income on income.id = md5('income:' || employment.id::text)::uuid
on conflict (id) do update set valid_until = excluded.valid_until;

insert into public.employment_salaries (
  id, tenant_id, administration_id, employee_id, employment_id,
  payment_type, payment_frequency, salary_basis, fulltime_amount,
  salary_scale_step_id, valid_from, valid_until
)
select md5('salary:' || employment.id::text)::uuid,
       employment.tenant_id, employment.administration_id, employment.employee_id,
       employment.id, 'PERIODIC_FIXED', 'MONTHLY', 'CUSTOM_SCALE',
       3500 + (substring(employee.employee_number from '([0-9]+)$')::integer * 17),
       step.id, employment.starts_on,
       case when employment.ends_on is null then null else employment.ends_on + 1 end
from public.employments employment
join public.employees employee on employee.id = employment.employee_id
join public.salary_scales scale on scale.tenant_id = employment.tenant_id
  and scale.administration_id = employment.administration_id and scale.code = 'DEMO'
join public.salary_scale_steps step on step.salary_scale_id = scale.id and step.step_code = '1'
join public.income_relationships income on income.id = md5('income:' || employment.id::text)::uuid
on conflict (id) do update set valid_until = excluded.valid_until;

insert into public.employment_cost_allocations (
  id, tenant_id, administration_id, employee_id, employment_id,
  cost_center_id, percentage, valid_from, valid_until
)
select md5('cost-allocation:' || employment.id::text)::uuid,
       employment.tenant_id, employment.administration_id, employment.employee_id,
       employment.id, cost_center.id, 100, employment.starts_on,
       case when employment.ends_on is null then null else employment.ends_on + 1 end
from public.employments employment
join public.cost_centers cost_center on cost_center.tenant_id = employment.tenant_id
  and cost_center.administration_id = employment.administration_id and cost_center.code = 'GENERAL'
join public.income_relationships income on income.id = md5('income:' || employment.id::text)::uuid
on conflict (id) do update set valid_until = excluded.valid_until;

insert into public.employment_terminations (
  id, tenant_id, administration_id, employee_id, employment_id,
  last_working_day, internal_reason_id, statutory_reason_id, initiator,
  workflow_status, final_settlement_status, created_by_user_id,
  confirmed_by_user_id, confirmed_at
)
select md5('termination:' || employment.id::text)::uuid,
       employment.tenant_id, employment.administration_id, employment.employee_id,
       employment.id, employment.ends_on, internal_reason.id,
       md5('termination-reason:30:2026')::uuid, 'BY_LAW',
       'CONFIRMED', 'READY', actor.id, actor.id, timezone('utc', now())
from public.employments employment
join public.employment_end_reasons internal_reason
  on internal_reason.tenant_id = employment.tenant_id
  and internal_reason.administration_id = employment.administration_id
  and internal_reason.code = 'CONTRACT_END'
cross join lateral (
  select id from auth.users where lower(email) = 'edwin@editsolutions.nl' limit 1
) actor
where employment.ends_on is not null
  and employment.ends_on >= '2026-01-01'
on conflict (id) do update set last_working_day = excluded.last_working_day;

update public.employee_organizations organization
set employment_id = (
  select employment.id
  from public.employments employment
  where employment.tenant_id = organization.tenant_id
    and employment.administration_id = organization.administration_id
    and employment.employee_id = organization.employee_id
    and employment.is_primary
    and employment.starts_on <= current_date
    and (employment.ends_on is null or employment.ends_on >= current_date)
  order by employment.starts_on desc, employment.id
  limit 1
)
where organization.employment_id is null
  and exists (
    select 1 from public.employments employment
    where employment.tenant_id = organization.tenant_id
      and employment.administration_id = organization.administration_id
      and employment.employee_id = organization.employee_id
      and employment.is_primary
      and employment.starts_on <= current_date
      and (employment.ends_on is null or employment.ends_on >= current_date)
  );
