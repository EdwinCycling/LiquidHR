drop policy if exists employees_update_group on public.employees;

create policy employees_update_group
on public.employees for update to authenticated
using (
  (
    id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
    and (select internal_security.current_employee_has_permission('self:employee:write'))
  )
  or (select internal_security.can_manage_employee(id, 'employee:write'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'employee:write'))
)
with check (
  (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (
    (
      id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
      and (select internal_security.current_employee_has_permission('self:employee:write'))
    )
    or (select internal_security.can_manage_employee(id, 'employee:write'))
    or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'employee:write'))
  )
);
