-- STAR-V2-04B: expose Star Performers insights to direct Managers through a
-- dedicated read permission. The assessment remains independent from the
-- existing 9-grid and development permissions; no write grant is added.

insert into public.permissions (code, name, category, description)
values (
  'star-performer:manager-read',
  'Star Performers van eigen team lezen',
  'Talent',
  'Leest Star Performers-inzichten en kritikaliteitsbeoordelingen van het eigen directe team.'
)
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.tenant_id is null
  and role.code = 'DIRECT_MANAGER'
  and permission.code = 'star-performer:manager-read'
on conflict do nothing;

drop policy if exists star_performer_assessments_read on public.star_performer_assessments;
create policy star_performer_assessments_read
on public.star_performer_assessments
for select
to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, administration_id, 'star-performer:read'))
  or (
    (select internal_security.current_user_has_permission(tenant_id, administration_id, 'star-performer:manager-read'))
    and employee_id <> (select internal_security.current_employee_id())
    and exists (
      select 1
      from public.employee_organizations organization
      where organization.tenant_id = star_performer_assessments.tenant_id
        and organization.administration_id = star_performer_assessments.administration_id
        and organization.employee_id = star_performer_assessments.employee_id
        and organization.direct_manager_id = (select internal_security.current_employee_id())
        and organization.effective_from <= current_date
        and (organization.effective_to is null or organization.effective_to >= current_date)
        and (select internal_security.current_user_has_hr_group_permission(
          organization.tenant_id,
          organization.hr_group_id,
          'star-performer:manager-read'
        ))
    )
  )
);
