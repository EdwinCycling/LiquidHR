alter function public.confirm_employment_termination(uuid) security invoker;

create index employee_organizations_employment_scope_idx
  on public.employee_organizations (tenant_id, administration_id, employee_id, employment_id)
  where employment_id is not null;
create index employment_income_relationships_employment_scope_idx
  on public.employment_income_relationships (tenant_id, administration_id, employee_id, employment_id);
create index employment_income_relationships_income_scope_idx
  on public.employment_income_relationships (tenant_id, administration_id, employee_id, income_relationship_id);
create index employment_labor_conditions_employment_scope_idx
  on public.employment_labor_conditions (tenant_id, administration_id, employee_id, employment_id);
create index employment_schedules_employment_scope_idx
  on public.employment_schedules (tenant_id, administration_id, employee_id, employment_id);
create index employment_salaries_employment_scope_idx
  on public.employment_salaries (tenant_id, administration_id, employee_id, employment_id);
create index employment_salaries_scale_step_scope_idx
  on public.employment_salaries (tenant_id, administration_id, salary_scale_step_id)
  where salary_scale_step_id is not null;
create index employment_cost_allocations_employment_scope_idx
  on public.employment_cost_allocations (tenant_id, administration_id, employee_id, employment_id);
create index employment_cost_allocations_cost_center_scope_idx
  on public.employment_cost_allocations (tenant_id, administration_id, cost_center_id);
create index employment_terminations_employment_scope_idx
  on public.employment_terminations (tenant_id, administration_id, employee_id, employment_id);
create index employment_terminations_internal_reason_scope_idx
  on public.employment_terminations (tenant_id, administration_id, internal_reason_id)
  where internal_reason_id is not null;

drop policy salary_scales_write on public.salary_scales;
create policy salary_scales_insert on public.salary_scales for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')));
create policy salary_scales_update on public.salary_scales for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')));
create policy salary_scales_delete on public.salary_scales for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')));

drop policy salary_scale_steps_write on public.salary_scale_steps;
create policy salary_scale_steps_insert on public.salary_scale_steps for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')));
create policy salary_scale_steps_update on public.salary_scale_steps for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')));
create policy salary_scale_steps_delete on public.salary_scale_steps for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')));

drop policy cost_centers_write on public.cost_centers;
create policy cost_centers_insert on public.cost_centers for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));
create policy cost_centers_update on public.cost_centers for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));
create policy cost_centers_delete on public.cost_centers for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));

drop policy employment_end_reasons_write on public.employment_end_reasons;
create policy employment_end_reasons_insert on public.employment_end_reasons for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));
create policy employment_end_reasons_update on public.employment_end_reasons for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));
create policy employment_end_reasons_delete on public.employment_end_reasons for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));

drop policy employment_labor_conditions_write on public.employment_labor_conditions;
create policy employment_labor_conditions_insert on public.employment_labor_conditions for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));
create policy employment_labor_conditions_update on public.employment_labor_conditions for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));
create policy employment_labor_conditions_delete on public.employment_labor_conditions for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));

drop policy employment_schedules_write on public.employment_schedules;
create policy employment_schedules_insert on public.employment_schedules for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));
create policy employment_schedules_update on public.employment_schedules for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));
create policy employment_schedules_delete on public.employment_schedules for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));

drop policy employment_salaries_write on public.employment_salaries;
create policy employment_salaries_insert on public.employment_salaries for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')));
create policy employment_salaries_update on public.employment_salaries for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')));
create policy employment_salaries_delete on public.employment_salaries for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')));

drop policy employment_cost_allocations_write on public.employment_cost_allocations;
create policy employment_cost_allocations_insert on public.employment_cost_allocations for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));
create policy employment_cost_allocations_update on public.employment_cost_allocations for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));
create policy employment_cost_allocations_delete on public.employment_cost_allocations for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));

drop policy employment_labor_conditions_read on public.employment_labor_conditions;
create policy employment_labor_conditions_read on public.employment_labor_conditions for select to authenticated
using (
  (select internal_security.can_manage_employee(employee_id, 'contract:read'))
  or (
    exists (
      select 1 from public.employees employee
      where employee.id = employment_labor_conditions.employee_id
        and employee.tenant_id = employment_labor_conditions.tenant_id
        and employee.auth_user_id = (select auth.uid())
    )
    and (select internal_security.current_employee_has_permission('self:contract:read'))
  )
);

drop policy employment_schedules_read on public.employment_schedules;
create policy employment_schedules_read on public.employment_schedules for select to authenticated
using (
  (select internal_security.can_manage_employee(employee_id, 'contract:read'))
  or (
    exists (
      select 1 from public.employees employee
      where employee.id = employment_schedules.employee_id
        and employee.tenant_id = employment_schedules.tenant_id
        and employee.auth_user_id = (select auth.uid())
    )
    and (select internal_security.current_employee_has_permission('self:contract:read'))
  )
);

drop policy employment_cost_allocations_read on public.employment_cost_allocations;
create policy employment_cost_allocations_read on public.employment_cost_allocations for select to authenticated
using (
  (select internal_security.can_manage_employee(employee_id, 'contract:read'))
  or (
    exists (
      select 1 from public.employees employee
      where employee.id = employment_cost_allocations.employee_id
        and employee.tenant_id = employment_cost_allocations.tenant_id
        and employee.auth_user_id = (select auth.uid())
    )
    and (select internal_security.current_employee_has_permission('self:contract:read'))
  )
);
