-- PAYFAST-ESS: expose only the source rows attached to the authenticated employee's active employment.
-- Existing HR read/write policies remain unchanged. Every policy below grants SELECT only.
-- Self-service permission is resolved through current_employee_has_permission. Do not require
-- current_user_has_permission here: that helper uses user_access roles, which Employee ESS
-- identities do not need and which may contain only unrelated Manager permissions.

create policy labor_condition_sets_self_source_read
on public.labor_condition_sets
for select to authenticated
using (
  (select internal_security.current_employee_has_permission(
    labor_condition_sets.tenant_id,
    labor_condition_sets.hr_group_id,
    'self:contract:read'::text
  ))
  and exists (
    select 1
    from public.employment_contracts contract
    where contract.tenant_id = labor_condition_sets.tenant_id
      and contract.hr_group_id = labor_condition_sets.hr_group_id
      and contract.administration_id = labor_condition_sets.administration_id
      and contract.employee_id = internal_security.current_employee_id(
        labor_condition_sets.tenant_id,
        labor_condition_sets.hr_group_id
      )
      and contract.labor_condition_set_id = labor_condition_sets.id
      and contract.starts_on <= current_date
      and (contract.ends_on is null or contract.ends_on >= current_date)
  )
);

create policy employment_pension_arrangement_assignments_self_source_read
on public.employment_pension_arrangement_assignments
for select to authenticated
using (
  (select internal_security.current_employee_has_permission(
    employment_pension_arrangement_assignments.tenant_id,
    employment_pension_arrangement_assignments.hr_group_id,
    'self:contract:read'::text
  ))
  and exists (
    select 1
    from public.employment_contracts contract
    where contract.tenant_id = employment_pension_arrangement_assignments.tenant_id
      and contract.hr_group_id = employment_pension_arrangement_assignments.hr_group_id
      and contract.administration_id = employment_pension_arrangement_assignments.administration_id
      and contract.employment_id = employment_pension_arrangement_assignments.employment_id
      and contract.employee_id = internal_security.current_employee_id(
        employment_pension_arrangement_assignments.tenant_id,
        employment_pension_arrangement_assignments.hr_group_id
      )
      and contract.starts_on <= current_date
      and (contract.ends_on is null or contract.ends_on >= current_date)
  )
  and employment_pension_arrangement_assignments.effective_from <= current_date
  and (employment_pension_arrangement_assignments.effective_to is null
    or employment_pension_arrangement_assignments.effective_to >= current_date)
);

create policy labor_condition_pension_arrangements_self_source_read
on public.labor_condition_pension_arrangements
for select to authenticated
using (
  (select internal_security.current_employee_has_permission(
    labor_condition_pension_arrangements.tenant_id,
    labor_condition_pension_arrangements.hr_group_id,
    'self:contract:read'::text
  ))
  and exists (
    select 1
    from public.employment_contracts contract
    where contract.tenant_id = labor_condition_pension_arrangements.tenant_id
      and contract.hr_group_id = labor_condition_pension_arrangements.hr_group_id
      and contract.administration_id = labor_condition_pension_arrangements.administration_id
      and contract.employee_id = internal_security.current_employee_id(
        labor_condition_pension_arrangements.tenant_id,
        labor_condition_pension_arrangements.hr_group_id
      )
      and contract.labor_condition_set_id = labor_condition_pension_arrangements.labor_condition_set_id
      and contract.starts_on <= current_date
      and (contract.ends_on is null or contract.ends_on >= current_date)
  )
  and labor_condition_pension_arrangements.effective_from <= current_date
  and (labor_condition_pension_arrangements.effective_to is null
    or labor_condition_pension_arrangements.effective_to >= current_date)
);

create policy pension_arrangements_self_source_read
on public.pension_arrangements
for select to authenticated
using (
  (select internal_security.current_employee_has_permission(
    pension_arrangements.tenant_id,
    pension_arrangements.hr_group_id,
    'self:contract:read'::text
  ))
  and (
    exists (
      select 1
      from public.employment_pension_arrangement_assignments assignment
      where assignment.tenant_id = pension_arrangements.tenant_id
        and assignment.hr_group_id = pension_arrangements.hr_group_id
        and assignment.administration_id = pension_arrangements.administration_id
        and assignment.pension_arrangement_id = pension_arrangements.id
    )
    or exists (
      select 1
      from public.labor_condition_pension_arrangements mapping
      where mapping.tenant_id = pension_arrangements.tenant_id
        and mapping.hr_group_id = pension_arrangements.hr_group_id
        and mapping.administration_id = pension_arrangements.administration_id
        and mapping.pension_arrangement_id = pension_arrangements.id
    )
  )
);

create policy pension_arrangement_tiers_self_source_read
on public.pension_arrangement_tiers
for select to authenticated
using (
  (select internal_security.current_employee_has_permission(
    pension_arrangement_tiers.tenant_id,
    pension_arrangement_tiers.hr_group_id,
    'self:contract:read'::text
  ))
  and exists (
    select 1
    from public.pension_arrangements arrangement
    where arrangement.tenant_id = pension_arrangement_tiers.tenant_id
      and arrangement.hr_group_id = pension_arrangement_tiers.hr_group_id
      and arrangement.administration_id = pension_arrangement_tiers.administration_id
      and arrangement.id = pension_arrangement_tiers.pension_arrangement_id
  )
);

create policy pension_arrangement_versions_self_source_read
on public.pension_arrangement_versions
for select to authenticated
using (
  (select internal_security.current_employee_has_permission(
    pension_arrangement_versions.tenant_id,
    pension_arrangement_versions.hr_group_id,
    'self:contract:read'::text
  ))
  and exists (
    select 1
    from public.pension_arrangements arrangement
    where arrangement.tenant_id = pension_arrangement_versions.tenant_id
      and arrangement.hr_group_id = pension_arrangement_versions.hr_group_id
      and arrangement.administration_id = pension_arrangement_versions.administration_id
      and arrangement.id = pension_arrangement_versions.pension_arrangement_id
  )
);

create policy pension_arrangement_version_tiers_self_source_read
on public.pension_arrangement_version_tiers
for select to authenticated
using (
  (select internal_security.current_employee_has_permission(
    pension_arrangement_version_tiers.tenant_id,
    pension_arrangement_version_tiers.hr_group_id,
    'self:contract:read'::text
  ))
  and exists (
    select 1
    from public.pension_arrangement_versions version
    where version.tenant_id = pension_arrangement_version_tiers.tenant_id
      and version.hr_group_id = pension_arrangement_version_tiers.hr_group_id
      and version.administration_id = pension_arrangement_version_tiers.administration_id
      and version.id = pension_arrangement_version_tiers.pension_arrangement_version_id
      and version.pension_arrangement_id = pension_arrangement_version_tiers.pension_arrangement_id
  )
);
