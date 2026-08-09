-- HR moet de bestaande medewerker-subresources kunnen lezen en de
-- activiteitenfeed kunnen bijwerken voordat een organisatieplaatsing bestaat.
create or replace function internal_security.employee_subresource_can_read(
  requested_tenant_id uuid,
  requested_employee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.employees employee
    where employee.id = requested_employee_id
      and employee.tenant_id = requested_tenant_id
      and (
        (
          requested_employee_id = internal_security.current_employee_id()
          and internal_security.current_employee_has_permission('self:employee:read')
        )
        or internal_security.can_manage_employee(requested_employee_id, 'employee:read')
        or internal_security.current_user_has_hr_group_permission(
          employee.tenant_id,
          employee.hr_group_id,
          'employee:read'
        )
      )
  );
$$;

alter policy employee_activity_entries_select_scoped
on public.employee_activity_entries
using (
  (select internal_security.can_manage_employee(employee_id, 'employee-activity:read'))
  or exists (
    select 1
    from public.employees employee
    where employee.id = employee_activity_entries.employee_id
      and employee.tenant_id = employee_activity_entries.tenant_id
      and (select internal_security.current_user_has_hr_group_permission(
        employee.tenant_id,
        employee.hr_group_id,
        'employee-activity:read'
      ))
  )
);

alter policy employee_activity_entries_insert_scoped
on public.employee_activity_entries
with check (
  created_by_user_id = (select auth.uid())
  and (
    (select internal_security.can_manage_employee(employee_id, 'employee-activity:write'))
    or exists (
      select 1
      from public.employees employee
      where employee.id = employee_activity_entries.employee_id
        and employee.tenant_id = employee_activity_entries.tenant_id
        and (select internal_security.current_user_has_hr_group_permission(
          employee.tenant_id,
          employee.hr_group_id,
          'employee-activity:write'
        ))
    )
  )
);
