insert into public.permissions (code, name, category, description)
values ('self:absence:read', 'Eigen verzuim bekijken', 'Persoonlijk', 'Bekijkt eigen historische en open verzuimgevallen zonder WvP-taken of beheeracties.')
on conflict (code) do update set name = excluded.name, category = excluded.category, description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission on permission.code = 'self:absence:read'
where role.code = 'EMPLOYEE' and role.tenant_id is null
on conflict do nothing;

drop policy if exists absence_cases_select on public.absence_cases;
create policy absence_cases_select on public.absence_cases for select to authenticated
using (
  (select internal_security.can_manage_employee(employee_id, 'absence:read'))
  or (employee_id = (select internal_security.current_employee_id()) and (select internal_security.current_employee_has_permission('self:absence:read')))
);

drop policy if exists absence_spells_select on public.absence_spells;
create policy absence_spells_select on public.absence_spells for select to authenticated
using (exists (
  select 1 from public.absence_cases c
  where c.id = absence_spells.case_id and c.tenant_id = absence_spells.tenant_id
    and ((select internal_security.can_manage_employee(c.employee_id, 'absence:read'))
      or (c.employee_id = (select internal_security.current_employee_id()) and (select internal_security.current_employee_has_permission('self:absence:read'))))
));

drop policy if exists absence_capacity_select on public.absence_capacity_changes;
create policy absence_capacity_select on public.absence_capacity_changes for select to authenticated
using (exists (
  select 1 from public.absence_cases c
  where c.id = absence_capacity_changes.case_id and c.tenant_id = absence_capacity_changes.tenant_id
    and ((select internal_security.can_manage_employee(c.employee_id, 'absence:read'))
      or (c.employee_id = (select internal_security.current_employee_id()) and (select internal_security.current_employee_has_permission('self:absence:read'))))
));
