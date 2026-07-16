create index employment_change_sets_employment_scope_idx
  on public.employment_change_sets (tenant_id, administration_id, employee_id, employment_id);
create index employment_change_sets_created_by_user_idx
  on public.employment_change_sets (created_by_user_id) where created_by_user_id is not null;
create index employment_change_follow_ups_employment_scope_idx
  on public.employment_change_follow_ups (tenant_id, administration_id, employee_id, employment_id);
create index employment_change_follow_ups_change_set_scope_idx
  on public.employment_change_follow_ups (tenant_id, administration_id, change_set_id);
create index employment_change_follow_ups_responsible_user_idx
  on public.employment_change_follow_ups (responsible_user_id) where responsible_user_id is not null;
create index employment_chain_history_employment_scope_idx
  on public.employment_chain_history (tenant_id, administration_id, employee_id, employment_id);
create index employment_chain_assessments_employment_scope_idx
  on public.employment_chain_assessments (tenant_id, administration_id, employee_id, employment_id);
create index employment_chain_assessments_change_set_scope_idx
  on public.employment_chain_assessments (tenant_id, administration_id, change_set_id)
  where change_set_id is not null;
create index employment_chain_assessments_created_by_user_idx
  on public.employment_chain_assessments (created_by_user_id) where created_by_user_id is not null;
create index employment_labor_conditions_change_set_idx
  on public.employment_labor_conditions (change_set_id) where change_set_id is not null;
create index employment_schedules_change_set_idx
  on public.employment_schedules (change_set_id) where change_set_id is not null;
create index employment_salaries_change_set_idx
  on public.employment_salaries (change_set_id) where change_set_id is not null;
create index employment_cost_allocations_change_set_idx
  on public.employment_cost_allocations (change_set_id) where change_set_id is not null;

drop policy employment_change_follow_ups_write on public.employment_change_follow_ups;
create policy employment_change_follow_ups_insert on public.employment_change_follow_ups for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));
create policy employment_change_follow_ups_update on public.employment_change_follow_ups for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));
create policy employment_change_follow_ups_delete on public.employment_change_follow_ups for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));

drop policy employee_profile_links_write on public.employee_profile_links;
create policy employee_profile_links_insert on public.employee_profile_links for insert to authenticated
with check ((select internal_security.can_manage_employee(employee_id, 'employee:write')));
create policy employee_profile_links_update on public.employee_profile_links for update to authenticated
using ((select internal_security.can_manage_employee(employee_id, 'employee:write')))
with check ((select internal_security.can_manage_employee(employee_id, 'employee:write')));
create policy employee_profile_links_delete on public.employee_profile_links for delete to authenticated
using ((select internal_security.can_manage_employee(employee_id, 'employee:write')));

drop policy employment_chain_history_write on public.employment_chain_history;
create policy employment_chain_history_insert on public.employment_chain_history for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));
create policy employment_chain_history_update on public.employment_chain_history for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));
create policy employment_chain_history_delete on public.employment_chain_history for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));

drop policy employment_chain_assessments_write on public.employment_chain_assessments;
create policy employment_chain_assessments_insert on public.employment_chain_assessments for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));
create policy employment_chain_assessments_update on public.employment_chain_assessments for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));
create policy employment_chain_assessments_delete on public.employment_chain_assessments for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));
