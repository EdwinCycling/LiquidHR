create or replace view public.hr_change_events with (security_invoker = true) as
select 'employment:'||employment.id||':start' event_id, employment.tenant_id, employment.administration_id, employment.employee_id, employment.id employment_id,
  employment.starts_on event_date, 'EMPLOYMENT_STARTED'::text event_type, 'employment.event.started'::text title_key,
  jsonb_build_object('number',employment.employment_number,'contractType',employment.contract_type) title_values,
  '/employees/'||employment.employee_id||'/employments/'||employment.id||'?tab=basics' source_href, 'INFO'::text severity
from public.employments employment where employment.deleted_at is null
union all
select 'employment:'||employment.id||':end', employment.tenant_id, employment.administration_id, employment.employee_id, employment.id,
  employment.ends_on, 'EMPLOYMENT_ENDED', 'employment.event.ended', jsonb_build_object('number',employment.employment_number),
  '/employees/'||employment.employee_id||'/employments/'||employment.id||'?tab=basics', 'ATTENTION'
from public.employments employment where employment.deleted_at is null and employment.ends_on is not null
union all
select 'ikv:'||link.id, link.tenant_id, link.administration_id, link.employee_id, link.employment_id, link.valid_from,
  'INCOME_RELATIONSHIP_CHANGED', 'employment.event.incomeRelationship', jsonb_build_object('number',relationship.ikv_number),
  '/employees/'||link.employee_id||'/employments/'||link.employment_id||'?tab=basics', 'INFO'
from public.employment_income_relationships link join public.income_relationships relationship on relationship.id=link.income_relationship_id
union all
select 'organization:'||organization.id, organization.tenant_id, organization.administration_id, organization.employee_id, organization.employment_id,
  organization.effective_from, 'ORGANIZATION_CHANGED', 'employment.event.organization', jsonb_build_object('jobTitle',organization.job_title,'department',department.name),
  '/employees/'||organization.employee_id||'/employments/'||organization.employment_id||'?tab=organization', 'INFO'
from public.employee_organizations organization join public.departments department on department.id=organization.department_id where organization.employment_id is not null
union all
select 'labor:'||labor.id, labor.tenant_id, labor.administration_id, labor.employee_id, labor.employment_id, labor.valid_from,
  'LABOR_CONDITIONS_CHANGED', 'employment.event.labor', jsonb_build_object('conditionGroup',labor.condition_group),
  '/employees/'||labor.employee_id||'/employments/'||labor.employment_id||'?tab=labor', 'INFO'
from public.employment_labor_conditions labor
union all
select 'schedule:'||schedule.id, schedule.tenant_id, schedule.administration_id, schedule.employee_id, schedule.employment_id, schedule.valid_from,
  'SCHEDULE_CHANGED', 'employment.event.schedule', jsonb_build_object('hours',schedule.average_hours_per_week,'factor',schedule.part_time_factor),
  '/employees/'||schedule.employee_id||'/employments/'||schedule.employment_id||'?tab=schedule', 'INFO'
from public.employment_schedules schedule
union all
select 'salary:'||salary.id, salary.tenant_id, salary.administration_id, salary.employee_id, salary.employment_id, salary.valid_from,
  'SALARY_CHANGED', 'employment.event.salary', jsonb_build_object('amount',salary.fulltime_amount,'currency',salary.currency_code),
  '/employees/'||salary.employee_id||'/employments/'||salary.employment_id||'?tab=salary', 'ATTENTION'
from public.employment_salaries salary
union all
select 'cost:'||allocation.id, allocation.tenant_id, allocation.administration_id, allocation.employee_id, allocation.employment_id, allocation.valid_from,
  'COST_ALLOCATION_CHANGED', 'employment.event.costAllocation', jsonb_build_object('percentage',allocation.percentage,'costCenter',center.name),
  '/employees/'||allocation.employee_id||'/employments/'||allocation.employment_id||'?tab=costs', 'INFO'
from public.employment_cost_allocations allocation join public.cost_centers center on center.id=allocation.cost_center_id
union all
select 'document:'||document.id||':added', document.tenant_id, document.administration_id, document.employee_id, null::uuid, document.created_at::date,
  'DOCUMENT_ADDED', 'employment.event.documentAdded', jsonb_build_object('title',document.title),
  '/employees/'||document.employee_id||'#documents', 'INFO'
from public.employee_documents document where document.deleted_at is null
union all
select 'document:'||document.id||':expiry', document.tenant_id, document.administration_id, document.employee_id, null::uuid, document.expires_on,
  'DOCUMENT_EXPIRES', 'employment.event.documentExpires', jsonb_build_object('title',document.title),
  '/employees/'||document.employee_id||'#documents', 'ATTENTION'
from public.employee_documents document where document.deleted_at is null and document.expires_on is not null;

grant select on public.hr_change_events to authenticated;
