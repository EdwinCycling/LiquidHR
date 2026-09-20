begin;

-- Geeft Direct Managers toegang tot Leave Insights; de bestaande Leave-RLS
-- blijft de personeels- en employment-scope bepalen. Provision blijft HR-only.
insert into public.role_permissions (management_role_id, permission_id)
select management_role.id, permission.id
from public.management_roles management_role
join public.permissions permission on permission.code = 'report-leave:read'
where management_role.code = 'DIRECT_MANAGER'
  and management_role.tenant_id is null
on conflict do nothing;

-- De report-permission is bewust geen vervanging van leave:read of
-- leave:audit-read. Deze policies maken alleen de read-modelbron voor Leave
-- Insights beschikbaar en houden employee-facts binnen de managementscope.
create policy leave_insights_employments_read
on public.employments for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'report-leave:read'))
  and (select internal_security.can_manage_employee(employee_id, 'employee:read'))
);

create policy leave_insights_leave_types_read
on public.leave_types for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'report-leave:read')));

create policy leave_insights_leave_profiles_read
on public.leave_profiles for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'report-leave:read')));

create policy leave_insights_employee_sets_read
on public.employee_sets for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'report-leave:read')));

create policy leave_insights_employee_set_members_read
on public.employee_set_members for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'report-leave:read'))
  and (select internal_security.can_manage_employee(employee_id, 'employee:read'))
);

create policy leave_insights_accrual_rules_read
on public.leave_accrual_rules for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'report-leave:read')));

create policy leave_insights_rule_pause_types_read
on public.leave_accrual_rule_pause_types for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'report-leave:read')));

create policy leave_insights_priority_rules_read
on public.leave_priority_rules for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'report-leave:read')));

create policy leave_insights_priority_rule_items_read
on public.leave_priority_rule_items for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'report-leave:read')));

create policy leave_insights_year_controls_read
on public.leave_year_controls for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'report-leave:read')));

create policy leave_insights_profile_assignments_read
on public.employment_leave_profiles for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'report-leave:read'))
  and (select internal_security.can_manage_employee(employee_id, 'employee:read'))
);

create policy leave_insights_accrual_exceptions_read
on public.leave_accrual_exceptions for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'report-leave:read'))
  and (select internal_security.can_manage_employee(employee_id, 'employee:read'))
);

create policy leave_insights_balance_buckets_read
on public.leave_balance_buckets for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'report-leave:read'))
  and (select internal_security.can_manage_employee(employee_id, 'employee:read'))
);

create policy leave_insights_accrual_transactions_read
on public.leave_accrual_transactions for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'report-leave:read'))
  and (select internal_security.can_manage_employee(employee_id, 'employee:read'))
);

create policy leave_insights_requests_read
on public.leave_requests for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'report-leave:read'))
  and (select internal_security.can_manage_employee(employee_id, 'employee:read'))
);

create policy leave_insights_absence_cases_read
on public.absence_cases for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'report-leave:read'))
  and (select internal_security.can_manage_employee(employee_id, 'employee:read'))
);

create policy leave_insights_request_allocations_read
on public.leave_request_allocations for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'report-leave:read'))
  and (select internal_security.can_manage_employee(employee_id, 'employee:read'))
);

create policy leave_insights_schedules_read
on public.employment_schedules for select to authenticated
using (
  exists (
    select 1
    from public.employments employment
    where employment.tenant_id = employment_schedules.tenant_id
      and employment.administration_id = employment_schedules.administration_id
      and employment.id = employment_schedules.employment_id
      and employment.hr_group_id is not null
      and (select internal_security.current_user_has_hr_group_permission(employment.tenant_id, employment.hr_group_id, 'report-leave:read'))
  )
  and (select internal_security.can_manage_employee(employee_id, 'employee:read'))
);

create policy leave_insights_work_patterns_read
on public.employment_work_patterns for select to authenticated
using (
  exists (
    select 1
    from public.employments employment
    where employment.tenant_id = employment_work_patterns.tenant_id
      and employment.administration_id = employment_work_patterns.administration_id
      and employment.id = employment_work_patterns.employment_id
      and employment.hr_group_id is not null
      and (select internal_security.current_user_has_hr_group_permission(employment.tenant_id, employment.hr_group_id, 'report-leave:read'))
  )
  and (select internal_security.can_manage_employee(employee_id, 'employee:read'))
);

create policy leave_insights_work_pattern_days_read
on public.employment_work_pattern_days for select to authenticated
using (
  exists (
    select 1
    from public.employment_work_patterns pattern
    join public.employments employment
      on employment.tenant_id = pattern.tenant_id
     and employment.administration_id = pattern.administration_id
     and employment.id = pattern.employment_id
    where pattern.id = employment_work_pattern_days.work_pattern_id
      and (select internal_security.current_user_has_hr_group_permission(employment.tenant_id, employment.hr_group_id, 'report-leave:read'))
      and (select internal_security.can_manage_employee(pattern.employee_id, 'employee:read'))
  )
);

create policy leave_insights_holidays_read
on public.holidays for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'report-leave:read')));

commit;

