begin;

drop policy employments_select_absence_write on public.employments;
drop policy employments_select_group on public.employments;

create policy employments_select_group
on public.employments for select to authenticated
using (
  (
    employee_id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
    and (select internal_security.current_employee_has_permission('self:contract:read'))
  )
  or (select internal_security.can_manage_employee(employee_id, 'contract:read'))
  or (
    record_status = 'CONFIRMED'
    and deleted_at is null
    and (select internal_security.can_manage_employee(employee_id, 'absence:write'))
  )
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'contract:read'))
);

commit;
