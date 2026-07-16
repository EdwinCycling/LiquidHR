create index department_management_department_id_idx on public.department_management (department_id);
create index department_management_employee_id_idx on public.department_management (employee_id);
create index department_management_management_role_id_idx on public.department_management (management_role_id);
create index departments_parent_id_idx on public.departments (parent_id);
create index employee_organizations_department_id_idx on public.employee_organizations (department_id);
create index employee_organizations_employee_id_idx on public.employee_organizations (employee_id);
create index employee_organizations_manager_employee_id_idx on public.employee_organizations (manager_employee_id);
create index employees_auth_user_id_idx on public.employees (auth_user_id);
create index management_roles_deputy_role_id_idx on public.management_roles (deputy_role_id);
create index role_permissions_permission_id_idx on public.role_permissions (permission_id);

drop policy employees_write_scoped on public.employees;
create policy employees_insert_scoped
on public.employees for insert to authenticated
with check (internal_security.has_tenant_access(tenant_id));
create policy employees_update_scoped
on public.employees for update to authenticated
using (internal_security.can_manage_employee(id, 'employee:write'))
with check (internal_security.has_tenant_access(tenant_id));
create policy employees_delete_scoped
on public.employees for delete to authenticated
using (internal_security.can_manage_employee(id, 'employee:write'));

drop policy departments_write_scoped on public.departments;
create policy departments_insert_scoped
on public.departments for insert to authenticated
with check (internal_security.has_tenant_access(tenant_id));
create policy departments_update_scoped
on public.departments for update to authenticated
using (
  internal_security.has_tenant_access(tenant_id)
  and internal_security.can_manage_employee(internal_security.current_employee_id(), 'department:write')
)
with check (internal_security.has_tenant_access(tenant_id));
create policy departments_delete_scoped
on public.departments for delete to authenticated
using (
  internal_security.has_tenant_access(tenant_id)
  and internal_security.can_manage_employee(internal_security.current_employee_id(), 'department:write')
);
