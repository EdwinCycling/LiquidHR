-- HR mag het adres tijdens de medewerkerwizard opslaan voordat er een
-- organisatieplaatsing of dienstverband bestaat. De bestaande helper keek
-- voor beheerders alleen naar een doelplaatsing en gaf daarom 403 terug voor
-- een zojuist aangemaakte persoon.
create or replace function internal_security.employee_subresource_can_write(
  requested_tenant_id uuid,
  requested_employee_id uuid,
  self_permission text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.employees employee
    where employee.id = requested_employee_id
      and employee.tenant_id = requested_tenant_id
      and (
        (
          requested_employee_id = internal_security.current_employee_id()
          and internal_security.current_employee_has_permission(self_permission)
        )
        or internal_security.current_user_has_hr_group_permission(
          employee.tenant_id,
          employee.hr_group_id,
          'employee:write'
        )
        or internal_security.can_manage_employee(requested_employee_id, 'employee:write')
      )
  );
$$;
