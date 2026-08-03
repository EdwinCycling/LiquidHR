begin;

drop policy if exists talent_development_goals_update on public.talent_development_goals;

create policy talent_development_goals_update
on public.talent_development_goals for update to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-goal:manage'))
  or (
    employee_id = (select internal_security.current_employee_id())
    and source_type = 'SELF_ENTERED'
    and status in ('DRAFT', 'ACTIVE')
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-goal:write'))
  )
  or (
    source_type = 'MANAGER_ENTERED'
    and status in ('DRAFT', 'ACTIVE')
    and (select internal_security.can_manage_employee(employee_id, 'talent-goal:write'))
    and (select internal_security.current_user_has_permission(tenant_id, null, 'talent-goal:write'))
  )
)
with check (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-goal:manage'))
  or (
    employee_id = (select internal_security.current_employee_id())
    and source_type = 'SELF_ENTERED'
    and status in ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED')
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-goal:write'))
  )
  or (
    source_type = 'MANAGER_ENTERED'
    and status in ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED')
    and (select internal_security.can_manage_employee(employee_id, 'talent-goal:write'))
    and (select internal_security.current_user_has_permission(tenant_id, null, 'talent-goal:write'))
  )
);

commit;
