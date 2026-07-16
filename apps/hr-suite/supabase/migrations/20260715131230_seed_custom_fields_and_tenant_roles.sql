insert into public.management_roles (tenant_id, code, name, description, is_system)
select tenant.id, role.code, role.name, role.description, false
from public.tenants tenant
cross join (values
  ('HR_ADVISOR', 'HR-adviseur', 'Beheert medewerker- en contractgegevens binnen de toegekende scope.'),
  ('PAYROLL_SPECIALIST', 'Salarisspecialist', 'Beheert salaris- en payrollgegevens binnen de toegekende scope.'),
  ('TEAM_LEAD', 'Teamleider', 'Leest medewerkers en organisatiegegevens binnen de eigen afdelingsscope.')
) role(code, name, description)
where tenant.slug in ('liquid-hr-demo-holding', 'noorderlicht-zorggroep')
on conflict (tenant_id, code) where tenant_id is not null do update set
  name = excluded.name, description = excluded.description, is_active = true, deleted_at = null;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission on (
  (role.code = 'HR_ADVISOR' and permission.code in (
    'employee:read', 'employee:write', 'employee:match', 'employee-bsn:read',
    'employee-bsn:write', 'contract:read', 'contract:write', 'department:read',
    'custom-field-values:read', 'custom-field-values:write'
  ))
  or (role.code = 'PAYROLL_SPECIALIST' and permission.code in (
    'employee:read', 'contract:read', 'salary:read', 'salary:write',
    'bank-account:read', 'bank-account:write'
  ))
  or (role.code = 'TEAM_LEAD' and permission.code in (
    'employee:read', 'department:read', 'organization-placement:read',
    'management-assignment:read', 'custom-field-values:read'
  ))
)
where role.tenant_id is not null
  and exists (select 1 from public.tenants tenant where tenant.id = role.tenant_id and tenant.slug in ('liquid-hr-demo-holding', 'noorderlicht-zorggroep'))
on conflict do nothing;

insert into public.custom_field_definitions (
  tenant_id, administration_id, key, label_nl, label_en, description_nl,
  description_en, field_type, is_required, hr_access, manager_access,
  employee_self_access, sort_order
)
select administration.tenant_id, administration.id, field.key, field.label_nl,
  field.label_en, field.description_nl, field.description_en,
  field.field_type::public.custom_field_type, field.is_required,
  field.hr_access::public.custom_field_audience_access,
  field.manager_access::public.custom_field_audience_access,
  field.self_access::public.custom_field_audience_access, field.sort_order
from public.administrations administration
join public.tenants tenant on tenant.id = administration.tenant_id
cross join (values
  ('shirt_size', 'Shirtmaat', 'Shirt size', 'Maat voor bedrijfskleding.', 'Size for company clothing.', 'SELECT', false, 'WRITE', 'READ', 'WRITE', 10),
  ('bhv_certified', 'BHV-gecertificeerd', 'Emergency response certified', 'Actuele BHV-indicatie.', 'Current emergency response indicator.', 'BOOLEAN', false, 'WRITE', 'READ', 'READ', 20),
  ('parking_permit_number', 'Parkeervergunning', 'Parking permit', 'Automatisch administratienummer.', 'Automatic administration number.', 'AUTO_INCREMENT', false, 'READ', 'HIDDEN', 'READ', 30)
) field(key, label_nl, label_en, description_nl, description_en, field_type, is_required, hr_access, manager_access, self_access, sort_order)
where tenant.slug in ('liquid-hr-demo-holding', 'noorderlicht-zorggroep')
on conflict (tenant_id, administration_id, entity_type, key) do update set
  label_nl = excluded.label_nl, label_en = excluded.label_en,
  description_nl = excluded.description_nl, description_en = excluded.description_en,
  is_active = true, deleted_at = null;

insert into public.custom_field_select_options (
  tenant_id, administration_id, definition_id, value, label_nl, label_en, sort_order
)
select definition.tenant_id, definition.administration_id, definition.id,
  option.value, option.label_nl, option.label_en, option.sort_order
from public.custom_field_definitions definition
cross join (values
  ('XS', 'XS', 'XS', 10), ('S', 'S', 'S', 20), ('M', 'M', 'M', 30),
  ('L', 'L', 'L', 40), ('XL', 'XL', 'XL', 50), ('XXL', 'XXL', 'XXL', 60)
) option(value, label_nl, label_en, sort_order)
where definition.key = 'shirt_size' and definition.deleted_at is null
  and exists (select 1 from public.tenants tenant where tenant.id = definition.tenant_id and tenant.slug in ('liquid-hr-demo-holding', 'noorderlicht-zorggroep'))
on conflict (definition_id, value) do update set
  label_nl = excluded.label_nl, label_en = excluded.label_en,
  sort_order = excluded.sort_order, is_active = true;

with assignments as (
  select distinct on (assignment.tenant_id, assignment.administration_id, assignment.employee_id)
    assignment.tenant_id, assignment.administration_id, assignment.employee_id
  from public.employee_administration_assignments assignment
  join public.tenants tenant on tenant.id = assignment.tenant_id
  where tenant.slug in ('liquid-hr-demo-holding', 'noorderlicht-zorggroep')
  order by assignment.tenant_id, assignment.administration_id, assignment.employee_id, assignment.effective_from
), numbered as (
  select assignments.*, row_number() over (
    partition by tenant_id, administration_id order by employee_id
  ) as row_number
  from assignments
)
insert into public.employee_custom_field_values (
  tenant_id, administration_id, employee_id, definition_id, field_key, value
)
select numbered.tenant_id, numbered.administration_id, numbered.employee_id,
  definition.id, definition.key,
  case definition.key
    when 'shirt_size' then to_jsonb((array['XS', 'S', 'M', 'L', 'XL', 'XXL'])[((numbered.row_number - 1) % 6 + 1)::integer])
    when 'bhv_certified' then to_jsonb((numbered.row_number % 3) = 0)
    else 'null'::jsonb
  end
from numbered
join public.custom_field_definitions definition
  on definition.tenant_id = numbered.tenant_id
 and definition.administration_id = numbered.administration_id
 and definition.key in ('shirt_size', 'bhv_certified', 'parking_permit_number')
 and definition.deleted_at is null
on conflict (tenant_id, administration_id, employee_id, definition_id) do nothing;

with candidates as (
  select distinct on (organization.tenant_id, organization.administration_id)
    organization.tenant_id, organization.administration_id,
    organization.department_id, organization.employee_id
  from public.employee_organizations organization
  join public.tenants tenant on tenant.id = organization.tenant_id
  where tenant.slug in ('liquid-hr-demo-holding', 'noorderlicht-zorggroep')
  order by organization.tenant_id, organization.administration_id,
    organization.effective_from, organization.employee_id
)
insert into public.department_management (
  tenant_id, administration_id, department_id, management_role_id,
  employee_id, effective_from
)
select candidate.tenant_id, candidate.administration_id, candidate.department_id,
  role.id, candidate.employee_id, date '2026-01-01'
from candidates candidate
join public.management_roles role
  on role.tenant_id = candidate.tenant_id and role.code = 'HR_ADVISOR'
where not exists (
  select 1 from public.department_management existing
  where existing.tenant_id = candidate.tenant_id
    and existing.administration_id = candidate.administration_id
    and existing.department_id = candidate.department_id
    and existing.management_role_id = role.id
    and existing.employee_id = candidate.employee_id
);
