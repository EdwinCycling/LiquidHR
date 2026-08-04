drop policy if exists employees_write_scoped on public.employees;
drop policy if exists employees_self_update_scoped on public.employees;
drop policy if exists employees_update_scoped on public.employees;

create policy employees_update_scoped
on public.employees for update to authenticated
using (
  (
    id = (select internal_security.current_employee_id())
    and (select internal_security.current_employee_has_permission('self:employee:write'))
  )
  or internal_security.can_manage_employee(id, 'employee:write')
)
with check (
  internal_security.has_tenant_access(tenant_id)
  and (
    (
      id = (select internal_security.current_employee_id())
      and (select internal_security.current_employee_has_permission('self:employee:write'))
    )
    or internal_security.can_manage_employee(id, 'employee:write')
  )
);
