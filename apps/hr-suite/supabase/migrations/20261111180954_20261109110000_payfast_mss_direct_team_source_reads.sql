-- PAYFAST MSS final single-file HR migration candidate, 9 November 2026.
-- Review artifact only; NOT APPLIED. Apply only after a separate explicit GO
-- for the exact SHA-256 of this complete file. No Payroll database is changed.
-- Strict direct-team authorization, self/admin raw-source boundaries and the
-- allowlisted Manager projection are committed atomically in one transaction.
-- Manager raw source SELECT policies are never created by this final candidate.
-- Existing broad fiscal-profile SELECT policy is replaced with guarded self/admin only;
-- Manager Payroll reads use the target-scoped allowlisted projection.

BEGIN;

-- V2: exact strict direct-team authorization helper.
create or replace function internal_security.payfast_manager_can_read_source(
  p_tenant uuid,
  p_group uuid,
  p_admin uuid,
  p_target_employee uuid,
  p_target_employment uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and p_tenant is not null
    and p_group is not null
    and p_admin is not null
    and p_target_employee is not null
    and p_target_employment is not null
    and exists (
      select 1
      from public.tenants tenant
      join public.hr_groups group_row
        on group_row.tenant_id = tenant.id
       and group_row.id = p_group
       and group_row.is_active
      join public.administrations administration
        on administration.tenant_id = tenant.id
       and administration.hr_group_id = group_row.id
       and administration.id = p_admin
       and administration.is_active
      where tenant.id = p_tenant
        and tenant.is_active
    )
    and not internal_security.current_employee_is_preboarding(p_tenant, p_group)
    and internal_security.has_hr_group_access(p_tenant, p_group)
    and internal_security.has_administration_access(p_tenant, p_admin)
    and internal_security.current_user_has_permission(p_tenant, p_admin, 'salary:read'::text)
    and (
      select count(*) = 1
      from public.employees actor
      where actor.auth_user_id = (select auth.uid())
        and actor.tenant_id = p_tenant
        and actor.hr_group_id = p_group
        and actor.is_active
        and not actor.is_archived
        and actor.deleted_at is null
    )
    and (
      select count(*) = 1
      from public.user_hr_group_access group_access
      join public.management_roles role
        on role.id = group_access.management_role_id
       and role.code = 'DIRECT_MANAGER'
       and role.is_active
       and role.deleted_at is null
       and (role.tenant_id is null or role.tenant_id = p_tenant)
      join public.role_permissions role_permission
        on role_permission.management_role_id = role.id
      join public.permissions permission
        on permission.id = role_permission.permission_id
       and permission.code = 'salary:read'
      where group_access.user_id = (select auth.uid())
        and group_access.tenant_id = p_tenant
        and group_access.hr_group_id = p_group
        and group_access.is_active
    )
    and (
      select count(*) = 1
      from public.user_access scoped_access
      join public.user_hr_group_access group_access
        on group_access.user_id = scoped_access.user_id
       and group_access.tenant_id = scoped_access.tenant_id
       and group_access.management_role_id = scoped_access.management_role_id
       and group_access.hr_group_id = p_group
       and group_access.is_active
      join public.management_roles role
        on role.id = scoped_access.management_role_id
       and role.code = 'DIRECT_MANAGER'
       and role.is_active
       and role.deleted_at is null
       and (role.tenant_id is null or role.tenant_id = p_tenant)
      join public.role_permissions role_permission
        on role_permission.management_role_id = role.id
      join public.permissions permission
        on permission.id = role_permission.permission_id
       and permission.code = 'salary:read'
      where scoped_access.user_id = (select auth.uid())
        and scoped_access.tenant_id = p_tenant
        and scoped_access.is_active
        and (
          (scoped_access.scope_type = 'TENANT'
            and scoped_access.hr_group_id is null
            and scoped_access.administration_id is null)
          or (scoped_access.scope_type = 'ADMINISTRATION'
            and scoped_access.hr_group_id = p_group
            and scoped_access.administration_id = p_admin)
        )
    )
    and not exists (
      select 1
      from public.user_hr_group_access group_access
      join public.management_roles role
        on role.id = group_access.management_role_id
       and role.code in ('HR_ADMIN', 'TENANT_ADMIN')
       and role.is_active
       and role.deleted_at is null
       and (role.tenant_id is null or role.tenant_id = p_tenant)
      where group_access.user_id = (select auth.uid())
        and group_access.tenant_id = p_tenant
        and group_access.hr_group_id = p_group
        and group_access.is_active
    )
    and not exists (
      select 1
      from public.user_access admin_access
      join public.management_roles role
        on role.id = admin_access.management_role_id
       and role.code in ('HR_ADMIN', 'TENANT_ADMIN')
       and role.is_active
       and role.deleted_at is null
       and (role.tenant_id is null or role.tenant_id = p_tenant)
      where admin_access.user_id = (select auth.uid())
        and admin_access.tenant_id = p_tenant
        and admin_access.is_active
        and (
          (admin_access.scope_type = 'TENANT'
            and admin_access.hr_group_id is null
            and admin_access.administration_id is null)
          or (admin_access.scope_type = 'ADMINISTRATION'
            and admin_access.hr_group_id = p_group
            and admin_access.administration_id = p_admin)
        )
    )
    and exists (
      select 1
      from public.employees actor
      join public.employments actor_employment
        on actor_employment.employee_id = actor.id
       and actor_employment.tenant_id = actor.tenant_id
       and actor_employment.hr_group_id = actor.hr_group_id
      join public.employee_organizations actor_placement
        on actor_placement.employee_id = actor.id
       and actor_placement.employment_id = actor_employment.id
       and actor_placement.tenant_id = actor_employment.tenant_id
       and actor_placement.hr_group_id = actor_employment.hr_group_id
       and actor_placement.administration_id = actor_employment.administration_id
      where actor.auth_user_id = (select auth.uid())
        and actor.tenant_id = p_tenant
        and actor.hr_group_id = p_group
        and actor.is_active
        and not actor.is_archived
        and actor.deleted_at is null
        and actor_employment.administration_id = p_admin
        and actor_employment.record_status = 'CONFIRMED'
        and actor_employment.deleted_at is null
        and actor_employment.starts_on <= current_date
        and (actor_employment.ends_on is null or actor_employment.ends_on >= current_date)
        and actor_placement.effective_from <= current_date
        and (actor_placement.effective_to is null or actor_placement.effective_to >= current_date)
        and (
          select count(*) = 1
          from public.employee_organizations current_placement
          join public.employments current_employment
            on current_employment.id = current_placement.employment_id
           and current_employment.employee_id = current_placement.employee_id
           and current_employment.tenant_id = current_placement.tenant_id
           and current_employment.hr_group_id = current_placement.hr_group_id
           and current_employment.administration_id = current_placement.administration_id
          where current_placement.employee_id = actor.id
            and current_placement.tenant_id = p_tenant
            and current_placement.hr_group_id = p_group
            and current_placement.administration_id = p_admin
            and current_employment.record_status = 'CONFIRMED'
            and current_employment.deleted_at is null
            and current_employment.starts_on <= current_date
            and (current_employment.ends_on is null or current_employment.ends_on >= current_date)
            and current_placement.effective_from <= current_date
            and (current_placement.effective_to is null or current_placement.effective_to >= current_date)
        )
    )
    and p_target_employee is distinct from (
      select actor.id
      from public.employees actor
      where actor.auth_user_id = (select auth.uid())
        and actor.tenant_id = p_tenant
        and actor.hr_group_id = p_group
        and actor.is_active
        and not actor.is_archived
        and actor.deleted_at is null
      limit 1
    )
    and exists (
      select 1
      from public.employees target
      join public.employments target_employment
        on target_employment.employee_id = target.id
       and target_employment.tenant_id = target.tenant_id
       and target_employment.hr_group_id = target.hr_group_id
      where target.id = p_target_employee
        and target.tenant_id = p_tenant
        and target.hr_group_id = p_group
        and target.is_active
        and not target.is_archived
        and target.deleted_at is null
        and target_employment.id = p_target_employment
        and target_employment.administration_id = p_admin
        and target_employment.record_status = 'CONFIRMED'
        and target_employment.deleted_at is null
        and target_employment.starts_on <= current_date
        and (target_employment.ends_on is null or target_employment.ends_on >= current_date)
    )
    and (
      select count(*) = 1
      from public.employee_organizations target_placement
      join public.employments current_target_employment
        on current_target_employment.id = target_placement.employment_id
       and current_target_employment.employee_id = target_placement.employee_id
       and current_target_employment.tenant_id = target_placement.tenant_id
       and current_target_employment.hr_group_id = target_placement.hr_group_id
       and current_target_employment.administration_id = target_placement.administration_id
      where target_placement.employee_id = p_target_employee
        and target_placement.tenant_id = p_tenant
        and target_placement.hr_group_id = p_group
        and target_placement.administration_id = p_admin
        and current_target_employment.record_status = 'CONFIRMED'
        and current_target_employment.deleted_at is null
        and current_target_employment.starts_on <= current_date
        and (current_target_employment.ends_on is null or current_target_employment.ends_on >= current_date)
        and target_placement.effective_from <= current_date
        and (target_placement.effective_to is null or target_placement.effective_to >= current_date)
    )
    and exists (
      select 1
      from public.employee_organizations target_placement
      where target_placement.employee_id = p_target_employee
        and target_placement.employment_id = p_target_employment
        and target_placement.tenant_id = p_tenant
        and target_placement.hr_group_id = p_group
        and target_placement.administration_id = p_admin
        and target_placement.direct_manager_id = (
          select actor.id
          from public.employees actor
          where actor.auth_user_id = (select auth.uid())
            and actor.tenant_id = p_tenant
            and actor.hr_group_id = p_group
            and actor.is_active
            and not actor.is_archived
            and actor.deleted_at is null
          limit 1
        )
        and target_placement.direct_manager_deputy_id is null
        and target_placement.effective_from <= current_date
        and (target_placement.effective_to is null or target_placement.effective_to >= current_date)
    );
$$;

alter function internal_security.payfast_manager_can_read_source(uuid, uuid, uuid, uuid, uuid)
  owner to postgres;
revoke all on function internal_security.payfast_manager_can_read_source(uuid, uuid, uuid, uuid, uuid)
  from public, anon, service_role, authenticated;
grant execute on function internal_security.payfast_manager_can_read_source(uuid, uuid, uuid, uuid, uuid)
  to authenticated;

-- V2: replace broad IKV and fiscal-profile raw-row policies.
-- Replace the existing broad employee-income-link path. The linking table has
-- no hr_group_id; every scope predicate is derived through an exact employment
-- match on employment_id, employee_id, tenant_id and administration_id.
drop policy employment_income_relationships_select_scoped
  on public.employment_income_relationships;
create policy employment_income_relationships_select_scoped
on public.employment_income_relationships for select to authenticated
using (
  exists (
    select 1
    from public.employments employment
    join public.employees employee
      on employee.id = employment_income_relationships.employee_id
     and employee.tenant_id = employment_income_relationships.tenant_id
     and employee.hr_group_id = employment.hr_group_id
     and employee.auth_user_id = (select auth.uid())
     and employee.is_active and not employee.is_archived and employee.deleted_at is null
    where employment.id = employment_income_relationships.employment_id
      and employment.employee_id = employment_income_relationships.employee_id
      and employment.tenant_id = employment_income_relationships.tenant_id
      and employment.administration_id = employment_income_relationships.administration_id
      and internal_security.current_employee_has_permission(
        employment.tenant_id, employment.hr_group_id, 'self:salary:read'::text
      )
  )
  or exists (
    select 1
    from public.employments employment
    join public.user_access access
      on access.user_id = (select auth.uid())
     and access.tenant_id = employment.tenant_id
     and access.is_active
    join public.management_roles role
      on role.id = access.management_role_id
     and role.code in ('HR_ADMIN', 'TENANT_ADMIN')
     and role.is_active and role.deleted_at is null
     and (role.tenant_id is null or role.tenant_id = employment.tenant_id)
    where employment.id = employment_income_relationships.employment_id
      and employment.employee_id = employment_income_relationships.employee_id
      and employment.tenant_id = employment_income_relationships.tenant_id
      and employment.administration_id = employment_income_relationships.administration_id
      and internal_security.has_hr_group_access(employment.tenant_id, employment.hr_group_id)
      and internal_security.has_administration_access(employment.tenant_id, employment.administration_id)
      and internal_security.current_user_has_permission(
        employment.tenant_id, employment.administration_id, 'salary:read'::text
      )
      and (
        (access.scope_type = 'TENANT' and access.hr_group_id is null and access.administration_id is null)
        or (access.scope_type = 'ADMINISTRATION'
          and access.hr_group_id = employment.hr_group_id
          and access.administration_id = employment.administration_id)
      )
  )
);

-- The row itself has no hr_group_id either. Resolve all employee/self/admin
-- scope through its exact employment-income link and exact employment tuple.
drop policy income_relationships_select_scoped on public.income_relationships;
create policy income_relationships_select_scoped
on public.income_relationships for select to authenticated
using (
  exists (
    select 1
    from public.employment_income_relationships link
    join public.employments employment
      on employment.id = link.employment_id
     and employment.employee_id = link.employee_id
     and employment.tenant_id = link.tenant_id
     and employment.administration_id = link.administration_id
    join public.employees employee
      on employee.id = employment.employee_id
     and employee.tenant_id = employment.tenant_id
     and employee.hr_group_id = employment.hr_group_id
     and employee.auth_user_id = (select auth.uid())
     and employee.is_active and not employee.is_archived and employee.deleted_at is null
    where link.tenant_id = income_relationships.tenant_id
      and link.administration_id = income_relationships.administration_id
      and link.employee_id = income_relationships.employee_id
      and link.income_relationship_id = income_relationships.id
      and internal_security.current_employee_has_permission(
        employment.tenant_id, employment.hr_group_id, 'self:salary:read'::text
      )
  )
  or exists (
    select 1
    from public.employment_income_relationships link
    join public.employments employment
      on employment.id = link.employment_id
     and employment.employee_id = link.employee_id
     and employment.tenant_id = link.tenant_id
     and employment.administration_id = link.administration_id
    join public.user_access access
      on access.user_id = (select auth.uid())
     and access.tenant_id = employment.tenant_id
     and access.is_active
    join public.management_roles role
      on role.id = access.management_role_id
     and role.code in ('HR_ADMIN', 'TENANT_ADMIN')
     and role.is_active and role.deleted_at is null
     and (role.tenant_id is null or role.tenant_id = employment.tenant_id)
    where link.tenant_id = income_relationships.tenant_id
      and link.administration_id = income_relationships.administration_id
      and link.employee_id = income_relationships.employee_id
      and link.income_relationship_id = income_relationships.id
      and internal_security.has_hr_group_access(employment.tenant_id, employment.hr_group_id)
      and internal_security.has_administration_access(employment.tenant_id, employment.administration_id)
      and internal_security.current_user_has_permission(
        employment.tenant_id, employment.administration_id, 'salary:read'::text
      )
      and (
        (access.scope_type = 'TENANT' and access.hr_group_id is null and access.administration_id is null)
        or (access.scope_type = 'ADMINISTRATION'
          and access.hr_group_id = employment.hr_group_id
          and access.administration_id = employment.administration_id)
      )
  )
);

-- Replace the broad tenant/group + salary permission predicate. A new permissive
-- policy alone would OR with the old predicate and retain the cross-team path.
-- Direct Manager reads stay denied on this full-row table until a reviewed,
-- allowlisted Payroll projection exists.
drop policy employment_payroll_tax_profiles_read on public.employment_payroll_tax_profiles;
create policy employment_payroll_tax_profiles_read
on public.employment_payroll_tax_profiles for select to authenticated
using (
  internal_security.has_hr_group_access(tenant_id, hr_group_id)
  and (
    (
      employee_id = internal_security.current_employee_id(tenant_id, hr_group_id)
      and internal_security.current_employee_has_permission(tenant_id, hr_group_id, 'self:salary:read'::text)
    )
    or (
      internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:read'::text)
      and exists (
        select 1 from public.user_access access
        join public.management_roles role on role.id = access.management_role_id
          and role.code = 'TENANT_ADMIN' and role.is_active and role.deleted_at is null
          and (role.tenant_id is null or role.tenant_id = employment_payroll_tax_profiles.tenant_id)
        where access.user_id = (select auth.uid())
          and access.tenant_id = employment_payroll_tax_profiles.tenant_id
          and access.is_active
          and (((access.scope_type = 'TENANT'::access_scope_type)
              and (access.hr_group_id is null or access.hr_group_id = employment_payroll_tax_profiles.hr_group_id))
            or ((access.scope_type = 'ADMINISTRATION'::access_scope_type)
              and (access.administration_id = employment_payroll_tax_profiles.administration_id)
              and (access.hr_group_id is null or access.hr_group_id = employment_payroll_tax_profiles.hr_group_id)))
      )
    )
  )
);

-- Least-privilege target-scoped Payroll projection and raw-SELECT clamps.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'payfast_mss_projection_reader') then
    create role payfast_mss_projection_reader nologin noinherit nobypassrls;
  end if;
end;
$$;

alter role payfast_mss_projection_reader nologin noinherit nobypassrls;
revoke payfast_mss_projection_reader from authenticated, anon, service_role, postgres;
-- ALTER FUNCTION OWNER requires both SET ROLE membership and CREATE on the
-- destination schema. Grant these only to this migration executor, for this
-- transaction; neither permission is retained by an application role.
grant payfast_mss_projection_reader to current_user with set true, inherit false;
grant create on schema public, internal_security to payfast_mss_projection_reader;
revoke all on all tables in schema public from payfast_mss_projection_reader;
revoke all on all sequences in schema public from payfast_mss_projection_reader;
grant usage on schema public, internal_security, auth, extensions to payfast_mss_projection_reader;
grant execute on function auth.uid() to payfast_mss_projection_reader;
grant execute on function extensions.digest(bytea, text) to payfast_mss_projection_reader;
grant execute on function internal_security.payfast_manager_can_read_source(uuid, uuid, uuid, uuid, uuid)
  to payfast_mss_projection_reader;

-- Used only to suppress old broad raw source SELECT routes for active
-- direct-manager assignments. It accepts no caller-supplied actor or target.
create or replace function internal_security.payfast_actor_has_direct_manager_role()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1
      from public.user_hr_group_access access
      join public.management_roles role
        on role.id = access.management_role_id
       and role.code = 'DIRECT_MANAGER'
       and role.is_active and role.deleted_at is null
      where access.user_id = (select auth.uid())
        and access.is_active
    )
    or exists (
      select 1
      from public.user_access access
      join public.management_roles role
        on role.id = access.management_role_id
       and role.code = 'DIRECT_MANAGER'
       and role.is_active and role.deleted_at is null
      where access.user_id = (select auth.uid())
        and access.is_active
    )
  );
$$;
alter function internal_security.payfast_actor_has_direct_manager_role() owner to postgres;
revoke all on function internal_security.payfast_actor_has_direct_manager_role() from public, anon;
grant execute on function internal_security.payfast_actor_has_direct_manager_role() to authenticated;

-- Existing can_manage_employee() paths can OR-open whole contract rows for a
-- Manager without contract:read. For an active Manager, raw contracts and
-- conditions are self-only unless the same identity has an explicit scoped
-- HR/Tenant Admin grant. The fixed projection role is unaffected.
create policy payfast_manager_contract_projection_only
on public.employment_contracts as restrictive for select to authenticated
using (
  not internal_security.payfast_actor_has_direct_manager_role()
  or (
    employee_id = internal_security.current_employee_id(tenant_id, hr_group_id)
    and internal_security.current_employee_has_permission(tenant_id, hr_group_id, 'self:contract:read'::text)
  )
  or exists (
    select 1 from public.user_access access
    join public.management_roles role on role.id = access.management_role_id
      and role.code in ('HR_ADMIN', 'TENANT_ADMIN') and role.is_active and role.deleted_at is null
      and (role.tenant_id is null or role.tenant_id = employment_contracts.tenant_id)
    where access.user_id = (select auth.uid()) and access.tenant_id = employment_contracts.tenant_id
      and access.is_active
      and internal_security.has_hr_group_access(employment_contracts.tenant_id, employment_contracts.hr_group_id)
      and internal_security.has_administration_access(employment_contracts.tenant_id, employment_contracts.administration_id)
      and internal_security.current_user_has_permission(employment_contracts.tenant_id, employment_contracts.administration_id, 'contract:read'::text)
      and ((access.scope_type = 'TENANT' and access.hr_group_id is null and access.administration_id is null)
        or (access.scope_type = 'ADMINISTRATION' and access.hr_group_id = employment_contracts.hr_group_id
          and access.administration_id = employment_contracts.administration_id))
  )
);

create policy payfast_manager_labor_condition_projection_only
on public.employment_labor_conditions as restrictive for select to authenticated
using (
  not internal_security.payfast_actor_has_direct_manager_role()
  or (
    employee_id = internal_security.current_employee_id(tenant_id, hr_group_id)
    and internal_security.current_employee_has_permission(tenant_id, hr_group_id, 'self:contract:read'::text)
  )
  or exists (
    select 1 from public.user_access access
    join public.management_roles role on role.id = access.management_role_id
      and role.code in ('HR_ADMIN', 'TENANT_ADMIN') and role.is_active and role.deleted_at is null
      and (role.tenant_id is null or role.tenant_id = employment_labor_conditions.tenant_id)
    where access.user_id = (select auth.uid()) and access.tenant_id = employment_labor_conditions.tenant_id
      and access.is_active
      and internal_security.has_hr_group_access(employment_labor_conditions.tenant_id, employment_labor_conditions.hr_group_id)
      and internal_security.has_administration_access(employment_labor_conditions.tenant_id, employment_labor_conditions.administration_id)
      and internal_security.current_user_has_permission(employment_labor_conditions.tenant_id, employment_labor_conditions.administration_id, 'contract:read'::text)
      and ((access.scope_type = 'TENANT' and access.hr_group_id is null and access.administration_id is null)
        or (access.scope_type = 'ADMINISTRATION' and access.hr_group_id = employment_labor_conditions.hr_group_id
          and access.administration_id = employment_labor_conditions.administration_id))
  )
);

create policy payfast_manager_schedule_projection_only
on public.employment_schedules as restrictive for select to authenticated
using (
  not internal_security.payfast_actor_has_direct_manager_role()
  or exists (
    select 1 from public.employments employment
    where employment.id = employment_schedules.employment_id
      and employment.employee_id = employment_schedules.employee_id
      and employment.tenant_id = employment_schedules.tenant_id
      and employment.administration_id = employment_schedules.administration_id
      and (
        (employment.employee_id = internal_security.current_employee_id(employment.tenant_id, employment.hr_group_id)
          and internal_security.current_employee_has_permission(employment.tenant_id, employment.hr_group_id, 'self:contract:read'::text))
        or exists (
          select 1 from public.user_access access
          join public.management_roles role on role.id = access.management_role_id
            and role.code in ('HR_ADMIN', 'TENANT_ADMIN') and role.is_active and role.deleted_at is null
            and (role.tenant_id is null or role.tenant_id = employment.tenant_id)
          where access.user_id = (select auth.uid()) and access.tenant_id = employment.tenant_id
            and access.is_active
            and internal_security.has_hr_group_access(employment.tenant_id, employment.hr_group_id)
            and internal_security.has_administration_access(employment.tenant_id, employment.administration_id)
            and internal_security.current_user_has_permission(employment.tenant_id, employment.administration_id, 'contract:read'::text)
            and ((access.scope_type = 'TENANT' and access.hr_group_id is null and access.administration_id is null)
              or (access.scope_type = 'ADMINISTRATION' and access.hr_group_id = employment.hr_group_id
                and access.administration_id = employment.administration_id))
        )
      )
  )
);

-- Remove the V2 row policies that intentionally exposed entire team catalog rows.
drop policy if exists payfast_manager_salary_direct_scope_guard on public.employment_salaries;
drop policy if exists payfast_manager_direct_pension_assignment_read on public.employment_pension_arrangement_assignments;
drop policy if exists payfast_manager_direct_labor_condition_set_read on public.labor_condition_sets;
drop policy if exists payfast_manager_direct_labor_pension_mapping_read on public.labor_condition_pension_arrangements;
drop policy if exists payfast_manager_direct_pension_arrangement_read on public.pension_arrangements;
drop policy if exists payfast_manager_direct_pension_tier_read on public.pension_arrangement_tiers;
drop policy if exists payfast_manager_direct_pension_version_read on public.pension_arrangement_versions;
drop policy if exists payfast_manager_direct_pension_version_tier_read on public.pension_arrangement_version_tiers;
drop policy if exists payfast_manager_direct_job_read on public.jobs;
drop policy if exists payfast_manager_direct_job_revision_read on public.job_revisions;
drop policy if exists payfast_manager_direct_labor_salary_structure_read on public.labor_condition_salary_structures;
drop policy if exists payfast_manager_direct_salary_structure_revision_read on public.salary_structure_revisions;
drop policy if exists payfast_manager_direct_salary_scale_read on public.salary_scales;
drop policy if exists payfast_manager_direct_salary_scale_revision_value_read on public.salary_scale_revision_values;
drop policy if exists payfast_manager_direct_salary_scale_step_read on public.salary_scale_steps;
drop policy if exists payfast_manager_direct_salary_band_read on public.salary_bands;
drop policy if exists payfast_manager_direct_salary_band_value_read on public.salary_band_values;

-- Existing salary policies are permissive and OR together. Keep Employee self and
-- explicit HR/Tenant Admin rows, but suppress raw salary rows for Direct Managers;
-- the fixed projection below is their only PAYFAST source path.
create policy payfast_manager_salary_projection_only
on public.employment_salaries as restrictive for select to authenticated
using (
  not internal_security.payfast_actor_has_direct_manager_role()
  or (
    employee_id = internal_security.current_employee_id(tenant_id, hr_group_id)
    and internal_security.current_employee_has_permission(tenant_id, hr_group_id, 'self:salary:read'::text)
  )
  or exists (
    select 1
    from public.user_access access
    join public.management_roles role on role.id = access.management_role_id
      and role.code in ('HR_ADMIN', 'TENANT_ADMIN') and role.is_active and role.deleted_at is null
    where access.user_id = (select auth.uid())
      and access.tenant_id = employment_salaries.tenant_id
      and access.is_active
      and internal_security.has_hr_group_access(employment_salaries.tenant_id, employment_salaries.hr_group_id)
      and internal_security.has_administration_access(employment_salaries.tenant_id, employment_salaries.administration_id)
      and internal_security.current_user_has_permission(employment_salaries.tenant_id, employment_salaries.administration_id, 'salary:read'::text)
      and (
        (access.scope_type = 'TENANT' and access.hr_group_id is null and access.administration_id is null)
        or (access.scope_type = 'ADMINISTRATION' and access.hr_group_id = employment_salaries.hr_group_id
          and access.administration_id = employment_salaries.administration_id)
      )
  )
);

-- Column privileges are granted only to the private NOLOGIN RPC owner. The
-- authenticated role keeps its pre-existing grants/policies for non-MSS flows.
grant select (id, tenant_id, hr_group_id, administration_id, employee_id, starts_on, ends_on, record_status,
  employment_type, contract_type, original_hire_date, seniority_date, updated_at, deleted_at)
  on public.employments to payfast_mss_projection_reader;
grant select (id, tenant_id, hr_group_id, administration_id, employee_id, employment_id, labor_condition_set_id,
  fulltime_hours_per_week, starts_on, ends_on, updated_at)
  on public.employment_contracts to payfast_mss_projection_reader;
grant select (id, tenant_id, hr_group_id, administration_id, employee_id, employment_id, condition_group,
  valid_from, valid_until, updated_at, employment_contract_id)
  on public.employment_labor_conditions to payfast_mss_projection_reader;
grant select (id, tenant_id, hr_group_id, administration_id, employee_id, employment_id, salary_basis, salary_route,
  payment_type, payment_frequency, currency_code, fulltime_amount, parttime_amount, hourly_rate, salary_structure_id,
  salary_scale_id, salary_scale_step_id, salary_step_code, cao_scale_name, cao_step_name, salary_band_id,
  valid_from, valid_until, updated_at)
  on public.employment_salaries to payfast_mss_projection_reader;
grant select (id, tenant_id, administration_id, employee_id, employment_id, schedule_type, start_week,
  average_days_per_week, average_hours_per_week, fulltime_hours_per_week, part_time_factor, time_for_time_accrual,
  monday_hours, tuesday_hours, wednesday_hours, thursday_hours, friday_hours, saturday_hours, sunday_hours,
  is_on_call, valid_from, valid_until, updated_at)
  on public.employment_schedules to payfast_mss_projection_reader;
grant select (id, tenant_id, hr_group_id, administration_id, employment_id, effective_from, effective_to,
  participation_start_date, assignment_reason, provenance_json, updated_at, version_number, supersedes_assignment_id,
  pension_arrangement_id)
  on public.employment_pension_arrangement_assignments to payfast_mss_projection_reader;
grant select (id, tenant_id, administration_id, employee_id, employment_id, income_relationship_id,
  valid_from, valid_until, updated_at)
  on public.employment_income_relationships to payfast_mss_projection_reader;
grant select (id, tenant_id, administration_id, employee_id, ikv_number, reporting_status, relationship_type,
  starts_on, ends_on, updated_at, deleted_at)
  on public.income_relationships to payfast_mss_projection_reader;
grant select (id, tenant_id, hr_group_id, administration_id, employee_id, employment_id, income_relationship_id,
  employment_income_relationship_id, residence_country_code, wage_tax_table, herleiding_code, time_period,
  regular_wage_only, full_period_only, has_special_situation, payroll_tax_credit_applies, source_classification,
  source_reference, effective_from, effective_to, version_number, supersedes_profile_id, confirmed_at, created_at)
  on public.employment_payroll_tax_profiles to payfast_mss_projection_reader;
grant select (id, tenant_id, hr_group_id, administration_id, code, name, standard_hours_per_week, is_active, valid_from, updated_at)
  on public.labor_condition_sets to payfast_mss_projection_reader;
grant select (id, tenant_id, hr_group_id, administration_id, labor_condition_set_id, pension_arrangement_id,
  participant_group, effective_from, effective_to, provenance_json, version_number, supersedes_mapping_id)
  on public.labor_condition_pension_arrangements to payfast_mss_projection_reader;
grant select (id, tenant_id, hr_group_id, administration_id, pension_arrangement_id, version_number, code, name,
  arrangement_type, effective_from, effective_to, transition_date, grandfathering_mode, flat_total_rate,
  employer_share_pct, employee_share_pct, annual_franchise, annual_pensionable_salary_cap, pensionable_salary_definition,
  eligibility_rule, contract_classification, contract_classification_provenance, provenance_json, is_active, created_at)
  on public.pension_arrangement_versions to payfast_mss_projection_reader;
grant select (id, tenant_id, hr_group_id, administration_id, pension_arrangement_id, min_age, max_age, total_rate, created_at)
  on public.pension_arrangement_tiers to payfast_mss_projection_reader;
grant select (id, tenant_id, hr_group_id, administration_id, pension_arrangement_id, pension_arrangement_version_id,
  min_age, max_age, total_rate, created_at)
  on public.pension_arrangement_version_tiers to payfast_mss_projection_reader;
grant select (id, tenant_id, hr_group_id, administration_id, code, name, arrangement_type, effective_from, effective_to,
  transition_date, grandfathering_mode, flat_total_rate, employer_share_pct, employee_share_pct, annual_franchise,
  annual_pensionable_salary_cap, pensionable_salary_definition, eligibility_rule, provenance_json, is_active, updated_at)
  on public.pension_arrangements to payfast_mss_projection_reader;
grant select (id, tenant_id, hr_group_id, administration_id, employee_id, employment_id, department_id, job_id,
  job_title, effective_from, effective_to, updated_at)
  on public.employee_organizations to payfast_mss_projection_reader;
grant select (id, tenant_id, hr_group_id, code, updated_at) on public.jobs to payfast_mss_projection_reader;
grant select (tenant_id, hr_group_id, job_id, name, valid_from, valid_until, updated_at)
  on public.job_revisions to payfast_mss_projection_reader;
grant select (id, tenant_id, hr_group_id, birth_date, updated_at, deleted_at)
  on public.employees to payfast_mss_projection_reader;

-- Actual Work grants omit free-text note/reason, actor identity and audit payloads.
grant select (id, tenant_id, hr_group_id, administration_id, period_start, period_end, status, updated_at)
  on public.actual_work_periods to payfast_mss_projection_reader;
grant select (id, tenant_id, hr_group_id, administration_id, employee_id, employment_id, work_hour_type_id,
  work_date, hours, status, approved_at, updated_at, entry_granularity, subject_period_start, subject_period_end,
  posting_period_start)
  on public.employment_work_hour_entries to payfast_mss_projection_reader;
grant select (id, tenant_id, hr_group_id, administration_id, employee_id, employment_id, entry_id, revision_number,
  subject_period_start, subject_period_end, posting_period_start, delta_hours, created_at)
  on public.actual_work_revisions to payfast_mss_projection_reader;
grant select (id, tenant_id, hr_group_id, administration_id, code, name, family, valid_from, valid_until,
  approval_required, updated_at)
  on public.work_hour_types to payfast_mss_projection_reader;
grant select (id, tenant_id, hr_group_id, administration_id, employee_id, employment_id, entry_id, entry_revision_number,
  payroll_period_start, mapping_id, release_class, work_hour_type_updated_at, content_fingerprint, released_at,
  payroll_period_id, payroll_period_end, payroll_periodicity)
  on public.actual_work_payroll_releases to payfast_mss_projection_reader;
grant select (id, tenant_id, hr_group_id, administration_id, work_hour_type_id, salary_component_id,
  salary_component_code, salary_component_version, salary_component_output, processing_target, calculation_rule,
  factor, valid_from, valid_until, version_number)
  on public.actual_work_payroll_mappings to payfast_mss_projection_reader;
grant select (tenant_id, hr_group_id, administration_id, leave_type_id, work_hour_type_id)
  on public.leave_type_overtime_work_hours to payfast_mss_projection_reader;
grant select (id, tenant_id, hr_group_id, administration_id, employee_id, employment_id, source_type, source_id, amount)
  on public.leave_accrual_transactions to payfast_mss_projection_reader;
grant select (id, tenant_id, administration_id, hr_group_id, entitlement_mode, is_active)
  on public.leave_types to payfast_mss_projection_reader;

-- Target policies apply only inside the NOLOGIN projection role; no grant makes
-- that role selectable through an authenticated direct table request.
create policy payfast_projection_employments_select on public.employments for select to payfast_mss_projection_reader
using (internal_security.payfast_manager_can_read_source(tenant_id, hr_group_id, administration_id, employee_id, id));
create policy payfast_projection_employees_select on public.employees for select to payfast_mss_projection_reader
using (exists (
  select 1 from public.employments employment
  where employment.employee_id = employees.id and employment.tenant_id = employees.tenant_id
    and employment.hr_group_id = employees.hr_group_id and employment.deleted_at is null
    and internal_security.payfast_manager_can_read_source(
      employment.tenant_id, employment.hr_group_id, employment.administration_id,
      employment.employee_id, employment.id
    )
));
create policy payfast_projection_contracts_select on public.employment_contracts for select to payfast_mss_projection_reader
using (internal_security.payfast_manager_can_read_source(tenant_id, hr_group_id, administration_id, employee_id, employment_id));
create policy payfast_projection_labor_conditions_select on public.employment_labor_conditions for select to payfast_mss_projection_reader
using (internal_security.payfast_manager_can_read_source(tenant_id, hr_group_id, administration_id, employee_id, employment_id));
create policy payfast_projection_salaries_select on public.employment_salaries for select to payfast_mss_projection_reader
using (internal_security.payfast_manager_can_read_source(tenant_id, hr_group_id, administration_id, employee_id, employment_id));
create policy payfast_projection_schedules_select on public.employment_schedules for select to payfast_mss_projection_reader
using (exists (select 1 from public.employments e where e.id = employment_schedules.employment_id
  and e.employee_id = employment_schedules.employee_id and e.tenant_id = employment_schedules.tenant_id
  and e.administration_id = employment_schedules.administration_id
  and internal_security.payfast_manager_can_read_source(e.tenant_id, e.hr_group_id, e.administration_id, e.employee_id, e.id)));
create policy payfast_projection_income_links_select on public.employment_income_relationships for select to payfast_mss_projection_reader
using (exists (select 1 from public.employments e where e.id = employment_income_relationships.employment_id
  and e.employee_id = employment_income_relationships.employee_id and e.tenant_id = employment_income_relationships.tenant_id
  and e.administration_id = employment_income_relationships.administration_id
  and internal_security.payfast_manager_can_read_source(e.tenant_id, e.hr_group_id, e.administration_id, e.employee_id, e.id)));
create policy payfast_projection_income_select on public.income_relationships for select to payfast_mss_projection_reader
using (exists (select 1 from public.employment_income_relationships link join public.employments e
  on e.id = link.employment_id and e.employee_id = link.employee_id and e.tenant_id = link.tenant_id
  and e.administration_id = link.administration_id where link.income_relationship_id = income_relationships.id
  and link.employee_id = income_relationships.employee_id and link.tenant_id = income_relationships.tenant_id
  and link.administration_id = income_relationships.administration_id
  and internal_security.payfast_manager_can_read_source(e.tenant_id, e.hr_group_id, e.administration_id, e.employee_id, e.id)));
create policy payfast_projection_tax_select on public.employment_payroll_tax_profiles for select to payfast_mss_projection_reader
using (internal_security.payfast_manager_can_read_source(tenant_id, hr_group_id, administration_id, employee_id, employment_id));
create policy payfast_projection_pension_assignments_select on public.employment_pension_arrangement_assignments for select to payfast_mss_projection_reader
using (exists (select 1 from public.employments e where e.id = employment_pension_arrangement_assignments.employment_id
  and e.tenant_id = employment_pension_arrangement_assignments.tenant_id and e.hr_group_id = employment_pension_arrangement_assignments.hr_group_id
  and e.administration_id = employment_pension_arrangement_assignments.administration_id
  and internal_security.payfast_manager_can_read_source(e.tenant_id, e.hr_group_id, e.administration_id, e.employee_id, e.id)));
create policy payfast_projection_labor_sets_select on public.labor_condition_sets for select to payfast_mss_projection_reader
using (exists (select 1 from public.employment_contracts c where c.labor_condition_set_id = labor_condition_sets.id
  and c.tenant_id = labor_condition_sets.tenant_id and c.hr_group_id = labor_condition_sets.hr_group_id
  and c.administration_id = labor_condition_sets.administration_id
  and internal_security.payfast_manager_can_read_source(c.tenant_id, c.hr_group_id, c.administration_id, c.employee_id, c.employment_id)));
create policy payfast_projection_labor_pension_select on public.labor_condition_pension_arrangements for select to payfast_mss_projection_reader
using (exists (select 1 from public.employment_contracts c where c.labor_condition_set_id = labor_condition_pension_arrangements.labor_condition_set_id
  and c.tenant_id = labor_condition_pension_arrangements.tenant_id and c.hr_group_id = labor_condition_pension_arrangements.hr_group_id
  and c.administration_id = labor_condition_pension_arrangements.administration_id
  and internal_security.payfast_manager_can_read_source(c.tenant_id, c.hr_group_id, c.administration_id, c.employee_id, c.employment_id)));
create policy payfast_projection_pension_arrangements_select on public.pension_arrangements for select to payfast_mss_projection_reader
using (exists (select 1 from public.employment_pension_arrangement_assignments a join public.employments e on e.id = a.employment_id
  and e.tenant_id = a.tenant_id and e.hr_group_id = a.hr_group_id and e.administration_id = a.administration_id
  where a.pension_arrangement_id = pension_arrangements.id and a.tenant_id = pension_arrangements.tenant_id
  and a.hr_group_id = pension_arrangements.hr_group_id and a.administration_id = pension_arrangements.administration_id
  and internal_security.payfast_manager_can_read_source(e.tenant_id, e.hr_group_id, e.administration_id, e.employee_id, e.id))
  or exists (select 1 from public.labor_condition_pension_arrangements m join public.employment_contracts c
  on c.labor_condition_set_id = m.labor_condition_set_id and c.tenant_id = m.tenant_id and c.hr_group_id = m.hr_group_id
  and c.administration_id = m.administration_id where m.pension_arrangement_id = pension_arrangements.id
  and m.tenant_id = pension_arrangements.tenant_id and m.hr_group_id = pension_arrangements.hr_group_id
  and m.administration_id = pension_arrangements.administration_id
  and internal_security.payfast_manager_can_read_source(c.tenant_id, c.hr_group_id, c.administration_id, c.employee_id, c.employment_id)));
create policy payfast_projection_pension_tiers_select on public.pension_arrangement_tiers for select to payfast_mss_projection_reader
using (exists (select 1 from public.pension_arrangements a where a.id = pension_arrangement_tiers.pension_arrangement_id
  and a.tenant_id = pension_arrangement_tiers.tenant_id and a.hr_group_id = pension_arrangement_tiers.hr_group_id
  and a.administration_id = pension_arrangement_tiers.administration_id));
create policy payfast_projection_pension_versions_select on public.pension_arrangement_versions for select to payfast_mss_projection_reader
using (exists (select 1 from public.pension_arrangements a where a.id = pension_arrangement_versions.pension_arrangement_id
  and a.tenant_id = pension_arrangement_versions.tenant_id and a.hr_group_id = pension_arrangement_versions.hr_group_id
  and a.administration_id = pension_arrangement_versions.administration_id));
create policy payfast_projection_pension_version_tiers_select on public.pension_arrangement_version_tiers for select to payfast_mss_projection_reader
using (exists (select 1 from public.pension_arrangement_versions v where v.id = pension_arrangement_version_tiers.pension_arrangement_version_id
  and v.pension_arrangement_id = pension_arrangement_version_tiers.pension_arrangement_id
  and v.tenant_id = pension_arrangement_version_tiers.tenant_id and v.hr_group_id = pension_arrangement_version_tiers.hr_group_id
  and v.administration_id = pension_arrangement_version_tiers.administration_id));
create policy payfast_projection_organizations_select on public.employee_organizations for select to payfast_mss_projection_reader
using (employment_id is not null and exists (select 1 from public.employments e where e.id = employee_organizations.employment_id
  and e.employee_id = employee_organizations.employee_id and e.tenant_id = employee_organizations.tenant_id
  and e.hr_group_id = employee_organizations.hr_group_id and e.administration_id = employee_organizations.administration_id
  and internal_security.payfast_manager_can_read_source(e.tenant_id, e.hr_group_id, e.administration_id, e.employee_id, e.id)));
create policy payfast_projection_jobs_select on public.jobs for select to payfast_mss_projection_reader
using (exists (select 1 from public.employee_organizations o join public.employments e on e.id = o.employment_id
  and e.employee_id = o.employee_id and e.tenant_id = o.tenant_id and e.hr_group_id = o.hr_group_id
  and e.administration_id = o.administration_id where o.job_id = jobs.id and o.tenant_id = jobs.tenant_id
  and o.hr_group_id = jobs.hr_group_id and internal_security.payfast_manager_can_read_source(e.tenant_id, e.hr_group_id, e.administration_id, e.employee_id, e.id)));
create policy payfast_projection_job_revisions_select on public.job_revisions for select to payfast_mss_projection_reader
using (exists (select 1 from public.jobs j where j.id = job_revisions.job_id and j.tenant_id = job_revisions.tenant_id
  and j.hr_group_id = job_revisions.hr_group_id));
create policy payfast_projection_actual_work_entries_select on public.employment_work_hour_entries for select to payfast_mss_projection_reader
using (internal_security.payfast_manager_can_read_source(tenant_id, hr_group_id, administration_id, employee_id, employment_id));
create policy payfast_projection_actual_work_revisions_select on public.actual_work_revisions for select to payfast_mss_projection_reader
using (internal_security.payfast_manager_can_read_source(tenant_id, hr_group_id, administration_id, employee_id, employment_id));
create policy payfast_projection_actual_work_releases_select on public.actual_work_payroll_releases for select to payfast_mss_projection_reader
using (internal_security.payfast_manager_can_read_source(tenant_id, hr_group_id, administration_id, employee_id, employment_id));
create policy payfast_projection_actual_work_types_select on public.work_hour_types for select to payfast_mss_projection_reader
using (exists (select 1 from public.employment_work_hour_entries e where e.work_hour_type_id = work_hour_types.id
  and e.tenant_id = work_hour_types.tenant_id and e.hr_group_id = work_hour_types.hr_group_id
  and internal_security.payfast_manager_can_read_source(e.tenant_id, e.hr_group_id, e.administration_id, e.employee_id, e.employment_id)));
create policy payfast_projection_actual_work_periods_select on public.actual_work_periods for select to payfast_mss_projection_reader
using (exists (select 1 from public.employment_work_hour_entries e where e.tenant_id = actual_work_periods.tenant_id
  and e.hr_group_id = actual_work_periods.hr_group_id
  and (actual_work_periods.administration_id is null or e.administration_id = actual_work_periods.administration_id)
  and e.posting_period_start = actual_work_periods.period_start
  and internal_security.payfast_manager_can_read_source(e.tenant_id, e.hr_group_id, e.administration_id, e.employee_id, e.employment_id)));
create policy payfast_projection_actual_work_mappings_select on public.actual_work_payroll_mappings for select to payfast_mss_projection_reader
using (exists (select 1 from public.employment_work_hour_entries e where e.work_hour_type_id = actual_work_payroll_mappings.work_hour_type_id
  and e.tenant_id = actual_work_payroll_mappings.tenant_id and e.hr_group_id = actual_work_payroll_mappings.hr_group_id
  and e.administration_id = actual_work_payroll_mappings.administration_id
  and internal_security.payfast_manager_can_read_source(e.tenant_id, e.hr_group_id, e.administration_id, e.employee_id, e.employment_id)));
create policy payfast_projection_overtime_links_select on public.leave_type_overtime_work_hours for select to payfast_mss_projection_reader
using (exists (select 1 from public.employment_work_hour_entries e where e.work_hour_type_id = leave_type_overtime_work_hours.work_hour_type_id
  and e.tenant_id = leave_type_overtime_work_hours.tenant_id and e.hr_group_id = leave_type_overtime_work_hours.hr_group_id
  and e.administration_id = leave_type_overtime_work_hours.administration_id
  and internal_security.payfast_manager_can_read_source(e.tenant_id, e.hr_group_id, e.administration_id, e.employee_id, e.employment_id)));
create policy payfast_projection_leave_types_select on public.leave_types for select to payfast_mss_projection_reader
using (exists (
  select 1
  from public.leave_type_overtime_work_hours l
  join public.employment_work_hour_entries e
    on e.work_hour_type_id = l.work_hour_type_id
   and e.tenant_id = l.tenant_id
   and e.hr_group_id = l.hr_group_id
   and (l.administration_id is null or l.administration_id = e.administration_id)
  where l.leave_type_id = leave_types.id
    and l.tenant_id = leave_types.tenant_id
    and l.hr_group_id = leave_types.hr_group_id
    and (leave_types.administration_id is null or leave_types.administration_id = e.administration_id)
    and internal_security.payfast_manager_can_read_source(
      e.tenant_id, e.hr_group_id, e.administration_id, e.employee_id, e.employment_id
    )
));
create policy payfast_projection_leave_tvt_select on public.leave_accrual_transactions for select to payfast_mss_projection_reader
using (source_type = 'ACTUAL_WORK_TVT' and exists (select 1 from public.employment_work_hour_entries e
  where e.id = leave_accrual_transactions.source_id and e.tenant_id = leave_accrual_transactions.tenant_id
  and e.hr_group_id = leave_accrual_transactions.hr_group_id
  and internal_security.payfast_manager_can_read_source(e.tenant_id, e.hr_group_id, e.administration_id, e.employee_id, e.employment_id)));

-- Private JSON sanitizer preserves the calculation definition but never returns
-- free-text source references embedded in pension metadata.
create or replace function internal_security.payfast_mss_sanitize_source_references(p_value jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
  v_item record;
  v_key text;
begin
  if p_value is null then return null; end if;
  if jsonb_typeof(p_value) = 'object' then
    v_result := '{}'::jsonb;
    for v_item in select key, value from jsonb_each(p_value)
    loop
      v_key := lower(regexp_replace(v_item.key, '[^a-zA-Z0-9]', '', 'g'));
      v_result := v_result || jsonb_build_object(
        v_item.key,
        case when v_key like '%sourcereference%'
          or v_key in ('note', 'notes', 'comment', 'comments', 'description', 'descriptionnl', 'descriptionen',
            'documenturl', 'documentname', 'filepath', 'filename', 'referencetext')
          then to_jsonb('PAYFAST_SOURCE_REFERENCE_REDACTED'::text)
          else internal_security.payfast_mss_sanitize_source_references(v_item.value)
        end
      );
    end loop;
    return v_result;
  end if;
  if jsonb_typeof(p_value) = 'array' then
    select coalesce(jsonb_agg(internal_security.payfast_mss_sanitize_source_references(item.value)
      order by item.ordinality), '[]'::jsonb)
      into v_result
      from jsonb_array_elements(p_value) with ordinality as item(value, ordinality);
    return v_result;
  end if;
  return p_value;
end;
$$;
revoke all on function internal_security.payfast_mss_sanitize_source_references(jsonb) from public, anon, authenticated;
grant execute on function internal_security.payfast_mss_sanitize_source_references(jsonb) to payfast_mss_projection_reader;
alter function internal_security.payfast_mss_sanitize_source_references(jsonb) owner to payfast_mss_projection_reader;

-- Returns only an arrangement DTO reached from a target assignment or target
-- contract mapping, under the private role's target-scoped SELECT policies.
create or replace function internal_security.payfast_mss_pension_arrangement_source_v1(
  p_tenant uuid,
  p_group uuid,
  p_admin uuid,
  p_arrangement uuid,
  p_period_start date,
  p_period_end date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_history_count integer;
  v_change_ids jsonb;
  v_selected record;
  v_legacy record;
  v_reason text;
  v_arrangement jsonb;
  v_tiers jsonb;
  v_established_from date;
begin
  select count(*) into v_history_count
  from public.pension_arrangement_versions version_row
  where version_row.tenant_id = p_tenant and version_row.hr_group_id = p_group
    and version_row.administration_id = p_admin and version_row.pension_arrangement_id = p_arrangement;

  select coalesce(jsonb_agg(change_row.id order by change_row.effective_from, change_row.version_number, change_row.id), '[]'::jsonb)
    into v_change_ids
  from public.pension_arrangement_versions change_row
  where change_row.tenant_id = p_tenant and change_row.hr_group_id = p_group
    and change_row.administration_id = p_admin and change_row.pension_arrangement_id = p_arrangement
    and change_row.effective_from > p_period_start and change_row.effective_from <= p_period_end;

  select version_row.id, version_row.pension_arrangement_id, version_row.version_number,
    version_row.code, version_row.name, version_row.arrangement_type, version_row.effective_from,
    version_row.effective_to, version_row.transition_date, version_row.grandfathering_mode,
    version_row.flat_total_rate, version_row.employer_share_pct, version_row.employee_share_pct,
    version_row.annual_franchise, version_row.annual_pensionable_salary_cap,
    version_row.pensionable_salary_definition, version_row.eligibility_rule,
    version_row.contract_classification, version_row.contract_classification_provenance,
    version_row.provenance_json, version_row.is_active, version_row.created_at
  into v_selected
  from public.pension_arrangement_versions version_row
  where version_row.tenant_id = p_tenant and version_row.hr_group_id = p_group
    and version_row.administration_id = p_admin and version_row.pension_arrangement_id = p_arrangement
    and version_row.effective_from <= p_period_start
  order by version_row.version_number desc, version_row.effective_from desc, version_row.id
  limit 1;

  if jsonb_array_length(v_change_ids) > 0 then
    v_reason := 'PENSION_ARRANGEMENT_VERSION_CHANGE_WITHIN_PERIOD';
  elsif v_history_count > 0 and v_selected.id is null then
    v_reason := 'PENSION_ARRANGEMENT_VERSION_NOT_EFFECTIVE';
  elsif v_selected.id is null then
    v_reason := null;
  elsif not v_selected.is_active or (v_selected.effective_to is not null and v_selected.effective_to < p_period_start) then
    v_reason := 'PENSION_ARRANGEMENT_NOT_ACTIVE';
  elsif v_selected.effective_to is not null and v_selected.effective_to < p_period_end then
    v_reason := 'PENSION_ARRANGEMENT_PERIOD_GAP';
  else
    v_reason := null;
  end if;

  if v_selected.id is not null then
    select case when count(*) = 1 then min(version_row.effective_from) else null end
      into v_established_from
    from public.pension_arrangement_versions version_row
    where version_row.tenant_id = p_tenant and version_row.hr_group_id = p_group
      and version_row.administration_id = p_admin and version_row.pension_arrangement_id = p_arrangement
      and version_row.version_number = 1;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', tier.id, 'min_age', tier.min_age, 'max_age', tier.max_age,
      'total_rate', tier.total_rate, 'created_at', tier.created_at
    ) order by tier.min_age, tier.id), '[]'::jsonb)
      into v_tiers
    from public.pension_arrangement_version_tiers tier
    where tier.tenant_id = p_tenant and tier.hr_group_id = p_group
      and tier.administration_id = p_admin and tier.pension_arrangement_id = p_arrangement
      and tier.pension_arrangement_version_id = v_selected.id;

    v_arrangement := jsonb_build_object(
      'id', v_selected.pension_arrangement_id,
      'code', v_selected.code,
      'name', v_selected.name,
      'arrangement_type', v_selected.arrangement_type,
      'effective_from', v_selected.effective_from,
      'arrangement_established_from', v_established_from,
      'effective_to', v_selected.effective_to,
      'transition_date', v_selected.transition_date,
      'grandfathering_mode', v_selected.grandfathering_mode,
      'flat_total_rate', v_selected.flat_total_rate,
      'employer_share_pct', v_selected.employer_share_pct,
      'employee_share_pct', v_selected.employee_share_pct,
      'annual_franchise', v_selected.annual_franchise,
      'annual_pensionable_salary_cap', v_selected.annual_pensionable_salary_cap,
      'pensionable_salary_definition', internal_security.payfast_mss_sanitize_source_references(v_selected.pensionable_salary_definition),
      'eligibility_rule', internal_security.payfast_mss_sanitize_source_references(v_selected.eligibility_rule),
      'contract_classification', v_selected.contract_classification,
      'contract_classification_provenance', internal_security.payfast_mss_sanitize_source_references(v_selected.contract_classification_provenance),
      'provenance_json', internal_security.payfast_mss_sanitize_source_references(v_selected.provenance_json),
      'is_active', v_selected.is_active,
      'version_id', v_selected.id,
      'version_number', v_selected.version_number,
      'version_created_at', v_selected.created_at,
      'source_updated_at', null,
      'tiers', v_tiers
    );
  else
    select arrangement.id, arrangement.code, arrangement.name, arrangement.arrangement_type,
      arrangement.effective_from, arrangement.effective_to, arrangement.transition_date,
      arrangement.grandfathering_mode, arrangement.flat_total_rate, arrangement.employer_share_pct,
      arrangement.employee_share_pct, arrangement.annual_franchise, arrangement.annual_pensionable_salary_cap,
      arrangement.pensionable_salary_definition, arrangement.eligibility_rule, arrangement.provenance_json,
      arrangement.is_active, arrangement.updated_at
    into v_legacy
    from public.pension_arrangements arrangement
    where arrangement.id = p_arrangement and arrangement.tenant_id = p_tenant
      and arrangement.hr_group_id = p_group and arrangement.administration_id = p_admin;
    if v_legacy.id is not null then
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', tier.id, 'min_age', tier.min_age, 'max_age', tier.max_age,
        'total_rate', tier.total_rate, 'created_at', tier.created_at
      ) order by tier.min_age, tier.id), '[]'::jsonb)
        into v_tiers
      from public.pension_arrangement_tiers tier
      where tier.tenant_id = p_tenant and tier.hr_group_id = p_group
        and tier.administration_id = p_admin and tier.pension_arrangement_id = p_arrangement;

      v_arrangement := jsonb_build_object(
        'id', v_legacy.id, 'code', v_legacy.code, 'name', v_legacy.name,
        'arrangement_type', v_legacy.arrangement_type, 'effective_from', v_legacy.effective_from,
        'arrangement_established_from', v_legacy.effective_from, 'effective_to', v_legacy.effective_to,
        'transition_date', v_legacy.transition_date, 'grandfathering_mode', v_legacy.grandfathering_mode,
        'flat_total_rate', v_legacy.flat_total_rate, 'employer_share_pct', v_legacy.employer_share_pct,
        'employee_share_pct', v_legacy.employee_share_pct, 'annual_franchise', v_legacy.annual_franchise,
        'annual_pensionable_salary_cap', v_legacy.annual_pensionable_salary_cap,
        'pensionable_salary_definition', internal_security.payfast_mss_sanitize_source_references(v_legacy.pensionable_salary_definition),
        'eligibility_rule', internal_security.payfast_mss_sanitize_source_references(v_legacy.eligibility_rule),
        'contract_classification', 'UNKNOWN',
        'contract_classification_provenance', jsonb_build_object('status', 'UNVERIFIED'),
        'provenance_json', internal_security.payfast_mss_sanitize_source_references(v_legacy.provenance_json),
        'is_active', v_legacy.is_active, 'version_id', null, 'version_number', null,
        'version_created_at', null, 'source_updated_at', v_legacy.updated_at, 'tiers', v_tiers
      );
    end if;
  end if;

  return jsonb_build_object('arrangement', v_arrangement, 'reasonCode', v_reason, 'changeVersionIds', v_change_ids);
end;
$$;
revoke all on function internal_security.payfast_mss_pension_arrangement_source_v1(uuid, uuid, uuid, uuid, date, date)
  from public, anon, authenticated;
grant execute on function internal_security.payfast_mss_pension_arrangement_source_v1(uuid, uuid, uuid, uuid, date, date)
  to payfast_mss_projection_reader;
alter function internal_security.payfast_mss_pension_arrangement_source_v1(uuid, uuid, uuid, uuid, date, date)
  owner to payfast_mss_projection_reader;

-- Fixed DTO: no table-row serialization, client-supplied actor/scope, raw
-- employment documents, raw tax references/confirmers, person identity fields,
-- free-text Actual Work notes/reasons, or salary-catalog dossiers are returned.
create or replace function public.payfast_manager_payroll_source_projection_v1(
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_period_start date,
  requested_period_end date,
  requested_payroll_period_id uuid default null,
  requested_periodicity text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_employment record;
  v_birth_date date;
  v_employee_updated_at timestamptz;
  v_age integer;
  v_month_start date;
  v_timeline jsonb;
  v_actual_work jsonb;
  v_tax_profiles jsonb;
  v_ikv_rows jsonb;
  v_active_ikv_rows jsonb;
  v_link_rows jsonb;
  v_identity jsonb;
  v_gap boolean;
  v_limit integer := 2000;
begin
  if (select auth.uid()) is null
    or requested_employee_id is null or requested_employment_id is null
    or requested_period_start is null or requested_period_end is null
    or requested_period_end < requested_period_start
    or requested_period_end > requested_period_start + 62
    or requested_periodicity not in ('MONTHLY', 'FOUR_WEEKLY')
    or (requested_payroll_period_id is null and requested_periodicity = 'FOUR_WEEKLY') then
    return null;
  end if;

  select employment.id, employment.tenant_id, employment.hr_group_id, employment.administration_id,
    employment.employee_id, employment.starts_on, employment.ends_on, employment.record_status,
    employment.employment_type, employment.contract_type, employment.original_hire_date,
    employment.seniority_date, employment.updated_at, employment.deleted_at
  into v_employment
  from public.employments employment
  where employment.id = requested_employment_id
    and employment.employee_id = requested_employee_id
    and employment.record_status = 'CONFIRMED'
    and employment.deleted_at is null
    and employment.starts_on <= requested_period_end
    and (employment.ends_on is null or employment.ends_on >= requested_period_start)
    and internal_security.payfast_manager_can_read_source(
      employment.tenant_id, employment.hr_group_id, employment.administration_id,
      employment.employee_id, employment.id
    );
  if v_employment.id is null then return null; end if;

  select employee.birth_date, employee.updated_at
    into v_birth_date, v_employee_updated_at
  from public.employees employee
  where employee.id = v_employment.employee_id
    and employee.tenant_id = v_employment.tenant_id
    and employee.hr_group_id = v_employment.hr_group_id
    and employee.deleted_at is null;
  if not found then return null; end if;

  v_month_start := date_trunc('month', requested_period_start)::date;
  v_age := case when v_birth_date is null then null
    else extract(year from age(requested_period_end, v_birth_date))::integer end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', profile.id,
    'employee_id', profile.employee_id,
    'employment_id', profile.employment_id,
    'income_relationship_id', profile.income_relationship_id,
    'employment_income_relationship_id', profile.employment_income_relationship_id,
    'residence_country_code', profile.residence_country_code,
    'wage_tax_table', profile.wage_tax_table,
    'herleiding_code', profile.herleiding_code,
    'time_period', profile.time_period,
    'regular_wage_only', profile.regular_wage_only,
    'full_period_only', profile.full_period_only,
    'has_special_situation', profile.has_special_situation,
    'payroll_tax_credit_applies', profile.payroll_tax_credit_applies,
    'source_classification', profile.source_classification,
    'source_reference_hash', case when profile.source_reference is null then null
      else encode(extensions.digest(convert_to(profile.source_reference, 'UTF8'), 'sha256'), 'hex') end,
    'effective_from', profile.effective_from,
    'effective_to', profile.effective_to,
    'version_number', profile.version_number,
    'supersedes_profile_id', profile.supersedes_profile_id,
    'confirmed_at', profile.confirmed_at,
    'created_at', profile.created_at
  ) order by profile.effective_from, profile.version_number, profile.id), '[]'::jsonb)
    into v_tax_profiles
  from (
    select tax_profile.id, tax_profile.tenant_id, tax_profile.hr_group_id, tax_profile.administration_id,
      tax_profile.employee_id, tax_profile.employment_id, tax_profile.income_relationship_id,
      tax_profile.employment_income_relationship_id, tax_profile.residence_country_code,
      tax_profile.wage_tax_table, tax_profile.herleiding_code, tax_profile.time_period,
      tax_profile.regular_wage_only, tax_profile.full_period_only, tax_profile.has_special_situation,
      tax_profile.payroll_tax_credit_applies, tax_profile.source_classification, tax_profile.source_reference,
      tax_profile.effective_from, tax_profile.effective_to, tax_profile.version_number,
      tax_profile.supersedes_profile_id, tax_profile.confirmed_at, tax_profile.created_at
    from public.employment_payroll_tax_profiles tax_profile
    where tax_profile.tenant_id = v_employment.tenant_id
      and tax_profile.hr_group_id = v_employment.hr_group_id
      and tax_profile.administration_id = v_employment.administration_id
      and tax_profile.employee_id = requested_employee_id
      and tax_profile.employment_id = requested_employment_id
      and tax_profile.effective_from <= requested_period_end
      and (tax_profile.effective_to is null or tax_profile.effective_to >= requested_period_start)
    order by tax_profile.effective_from, tax_profile.version_number, tax_profile.id
    limit v_limit + 1
  ) profile;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', income.id, 'updatedAt', income.updated_at, 'reportingStatus', income.reporting_status,
    'ikvNumber', income.ikv_number, 'startsOn', income.starts_on, 'endsOn', income.ends_on
  ) order by income.starts_on, income.id), '[]'::jsonb)
    into v_active_ikv_rows
  from public.income_relationships income
  where income.tenant_id = v_employment.tenant_id
    and income.administration_id = v_employment.administration_id
    and income.employee_id = requested_employee_id
    and income.relationship_type = 'EMPLOYMENT'
    and income.reporting_status <> 'DRAFT'
    and income.deleted_at is null
    and income.starts_on <= requested_period_end
    and (income.ends_on is null or income.ends_on >= requested_period_start)
    and exists (
      select 1 from public.employment_income_relationships link
      where link.id is not null
        and link.tenant_id = income.tenant_id
        and link.administration_id = income.administration_id
        and link.employee_id = income.employee_id
        and link.employment_id = requested_employment_id
        and link.income_relationship_id = income.id
        and link.valid_from <= requested_period_end
        and (link.valid_until is null or link.valid_until >= requested_period_start)
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', income.id, 'incomeRelationshipId', income.id,
    'validFrom', link.valid_from, 'validUntil', link.valid_until,
    'linkUpdatedAt', link.updated_at,
    'reportingStatus', income.reporting_status, 'startsOn', income.starts_on,
    'endsOn', income.ends_on, 'incomeRelationshipUpdatedAt', income.updated_at
  ) order by link.valid_from, link.id), '[]'::jsonb)
    into v_link_rows
  from public.employment_income_relationships link
  join public.income_relationships income
    on income.id = link.income_relationship_id
   and income.tenant_id = link.tenant_id
   and income.administration_id = link.administration_id
   and income.employee_id = link.employee_id
  where link.tenant_id = v_employment.tenant_id
    and link.administration_id = v_employment.administration_id
    and link.employee_id = requested_employee_id
    and link.employment_id = requested_employment_id
    and link.valid_from <= requested_period_end
    and (link.valid_until is null or link.valid_until >= requested_period_start)
    and income.deleted_at is null
    and income.starts_on <= requested_period_end
    and (income.ends_on is null or income.ends_on >= requested_period_start);

  select exists (
    select 1
    from public.employment_income_relationships link
    left join public.income_relationships income
      on income.id = link.income_relationship_id
     and income.tenant_id = link.tenant_id
     and income.administration_id = link.administration_id
     and income.employee_id = link.employee_id
     and income.deleted_at is null
    where link.tenant_id = v_employment.tenant_id
      and link.administration_id = v_employment.administration_id
      and link.employee_id = requested_employee_id
      and link.employment_id = requested_employment_id
      and link.valid_from <= requested_period_end
      and (link.valid_until is null or link.valid_until >= requested_period_start)
      and (income.id is null or income.starts_on > requested_period_end
        or (income.ends_on is not null and income.ends_on < requested_period_start))
  ) or exists (
    select 1
    from public.employment_income_relationships link
    join public.income_relationships income
      on income.id = link.income_relationship_id
     and income.tenant_id = link.tenant_id
     and income.administration_id = link.administration_id
     and income.employee_id = link.employee_id
    where link.tenant_id = v_employment.tenant_id
      and link.administration_id = v_employment.administration_id
      and link.employee_id = requested_employee_id
      and link.employment_id = requested_employment_id
      and income.relationship_type = 'EMPLOYMENT'
      and income.reporting_status <> 'DRAFT'
      and income.deleted_at is null
      and income.starts_on <= requested_period_end
      and (income.ends_on is null or income.ends_on >= requested_period_start)
      and link.valid_from <= requested_period_end
      and (link.valid_until is null or link.valid_until >= requested_period_start)
    group by income.id
    having count(*) <> 1
  ) into v_gap;

  v_timeline := jsonb_build_object(
    'employment', jsonb_build_object(
      'id', v_employment.id, 'tenant_id', v_employment.tenant_id, 'hr_group_id', v_employment.hr_group_id,
      'administration_id', v_employment.administration_id, 'employee_id', v_employment.employee_id,
      'starts_on', v_employment.starts_on, 'ends_on', v_employment.ends_on,
      'record_status', v_employment.record_status, 'employment_type', v_employment.employment_type,
      'contract_type', v_employment.contract_type, 'original_hire_date', v_employment.original_hire_date,
      'seniority_date', v_employment.seniority_date, 'updated_at', v_employment.updated_at,
      'deleted_at', v_employment.deleted_at
    ),
    'salaries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', salary.id, 'salary_basis', salary.salary_basis, 'salary_route', salary.salary_route,
        'payment_type', salary.payment_type, 'payment_frequency', salary.payment_frequency,
        'currency_code', salary.currency_code, 'fulltime_amount', salary.fulltime_amount,
        'parttime_amount', salary.parttime_amount, 'hourly_rate', salary.hourly_rate,
        'salary_structure_id', salary.salary_structure_id, 'salary_scale_id', salary.salary_scale_id,
        'salary_scale_step_id', salary.salary_scale_step_id, 'salary_step_code', salary.salary_step_code,
        'cao_scale_name', salary.cao_scale_name, 'cao_step_name', salary.cao_step_name,
        'salary_band_id', salary.salary_band_id, 'valid_from', salary.valid_from,
        'valid_until', salary.valid_until, 'updated_at', salary.updated_at
      ) order by salary.valid_from, salary.id)
      from (
        select source.id, source.salary_basis, source.salary_route, source.payment_type, source.payment_frequency,
          source.currency_code, source.fulltime_amount, source.parttime_amount, source.hourly_rate,
          source.salary_structure_id, source.salary_scale_id, source.salary_scale_step_id, source.salary_step_code,
          source.cao_scale_name, source.cao_step_name, source.salary_band_id,
          source.valid_from, source.valid_until, source.updated_at
        from public.employment_salaries source
        where source.tenant_id = v_employment.tenant_id and source.hr_group_id = v_employment.hr_group_id
          and source.administration_id = v_employment.administration_id and source.employee_id = requested_employee_id
          and source.employment_id = requested_employment_id and source.valid_from <= requested_period_end
          and (source.valid_until is null or source.valid_until >= requested_period_start)
        order by source.valid_from, source.id limit v_limit + 1
      ) salary
    ), '[]'::jsonb),
    'schedules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', schedule.id, 'average_days_per_week', schedule.average_days_per_week,
        'average_hours_per_week', schedule.average_hours_per_week, 'fulltime_hours_per_week', schedule.fulltime_hours_per_week,
        'part_time_factor', schedule.part_time_factor, 'schedule_type', schedule.schedule_type,
        'is_on_call', schedule.is_on_call, 'start_week', schedule.start_week,
        'time_for_time_accrual', schedule.time_for_time_accrual,
        'monday_hours', schedule.monday_hours, 'tuesday_hours', schedule.tuesday_hours,
        'wednesday_hours', schedule.wednesday_hours, 'thursday_hours', schedule.thursday_hours,
        'friday_hours', schedule.friday_hours, 'saturday_hours', schedule.saturday_hours,
        'sunday_hours', schedule.sunday_hours, 'valid_from', schedule.valid_from,
        'valid_until', schedule.valid_until, 'updated_at', schedule.updated_at
      ) order by schedule.valid_from, schedule.id)
      from public.employment_schedules schedule
      join public.employments scoped_employment on scoped_employment.id = schedule.employment_id
        and scoped_employment.employee_id = schedule.employee_id and scoped_employment.tenant_id = schedule.tenant_id
        and scoped_employment.administration_id = schedule.administration_id
      where scoped_employment.id = requested_employment_id and schedule.employee_id = requested_employee_id
        and schedule.valid_from <= requested_period_end
        and (schedule.valid_until is null or schedule.valid_until >= requested_period_start)
    ), '[]'::jsonb),
    'contracts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', contract.id, 'labor_condition_set_id', contract.labor_condition_set_id,
        'fulltime_hours_per_week', contract.fulltime_hours_per_week,
        'starts_on', contract.starts_on, 'ends_on', contract.ends_on, 'updated_at', contract.updated_at
      ) order by contract.starts_on, contract.id)
      from public.employment_contracts contract
      where contract.tenant_id = v_employment.tenant_id and contract.hr_group_id = v_employment.hr_group_id
        and contract.administration_id = v_employment.administration_id and contract.employee_id = requested_employee_id
        and contract.employment_id = requested_employment_id and contract.starts_on <= requested_period_end
        and (contract.ends_on is null or contract.ends_on >= requested_period_start)
    ), '[]'::jsonb),
    'laborConditions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', condition.id, 'condition_group', condition.condition_group,
        'labor_condition_set_id', contract.labor_condition_set_id,
        'valid_from', condition.valid_from, 'valid_until', condition.valid_until, 'updated_at', condition.updated_at,
        'set', case when condition_set.id is null then null else jsonb_build_object(
          'id', condition_set.id, 'code', condition_set.code, 'name', condition_set.name,
          'standard_hours_per_week', condition_set.standard_hours_per_week,
          'is_active', condition_set.is_active, 'valid_from', condition_set.valid_from,
          'updated_at', condition_set.updated_at
        ) end
      ) order by condition.valid_from, condition.id)
      from public.employment_labor_conditions condition
      left join public.employment_contracts contract on contract.id = condition.employment_contract_id
        and contract.tenant_id = condition.tenant_id and contract.hr_group_id = condition.hr_group_id
        and contract.administration_id = condition.administration_id and contract.employee_id = condition.employee_id
        and contract.employment_id = condition.employment_id
      left join public.labor_condition_sets condition_set on condition_set.id = contract.labor_condition_set_id
        and condition_set.tenant_id = condition.tenant_id and condition_set.hr_group_id = condition.hr_group_id
        and condition_set.administration_id = condition.administration_id
      where condition.tenant_id = v_employment.tenant_id and condition.hr_group_id = v_employment.hr_group_id
        and condition.administration_id = v_employment.administration_id and condition.employee_id = requested_employee_id
        and condition.employment_id = requested_employment_id
        and condition.valid_from <= requested_period_end
        and (condition.valid_until is null or condition.valid_until >= requested_period_start)
    ), '[]'::jsonb),
    'organizations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', placement.id, 'department_id', placement.department_id, 'job_id', placement.job_id,
        'job_code', job.code, 'job_title', coalesce(revision.name, placement.job_title),
        'job_revision_valid_from', revision.valid_from, 'job_revision_valid_until', revision.valid_until,
        'job_revision_updated_at', revision.updated_at, 'effective_from', placement.effective_from,
        'effective_to', placement.effective_to, 'updated_at', placement.updated_at
      ) order by placement.effective_from, placement.id)
      from public.employee_organizations placement
      left join public.jobs job on job.id = placement.job_id and job.tenant_id = placement.tenant_id
        and job.hr_group_id = placement.hr_group_id
      left join lateral (
        select job_revision.name, job_revision.valid_from, job_revision.valid_until, job_revision.updated_at
        from public.job_revisions job_revision
        where job_revision.tenant_id = placement.tenant_id and job_revision.hr_group_id = placement.hr_group_id
          and job_revision.job_id = placement.job_id and job_revision.valid_from <= placement.effective_from
          and (job_revision.valid_until is null or job_revision.valid_until > placement.effective_from)
        order by job_revision.valid_from desc, job_revision.updated_at desc limit 1
      ) revision on true
      where placement.tenant_id = v_employment.tenant_id and placement.hr_group_id = v_employment.hr_group_id
        and placement.administration_id = v_employment.administration_id and placement.employee_id = requested_employee_id
        and placement.employment_id = requested_employment_id and placement.effective_from <= requested_period_end
        and (placement.effective_to is null or placement.effective_to >= requested_period_start)
    ), '[]'::jsonb),
    'pensionAssignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', assignment.id, 'pension_arrangement_id', assignment.pension_arrangement_id,
        'effective_from', assignment.effective_from, 'effective_to', assignment.effective_to,
        'participation_start_date', assignment.participation_start_date,
        'assignment_reason', 'PAYFAST_SOURCE_REASON_REDACTED',
        'provenance_json', jsonb_build_object(
          'status', assignment.provenance_json->'status',
          'sourceClassification', assignment.provenance_json->'sourceClassification',
          'laborConditionMappingId', assignment.provenance_json->'laborConditionMappingId',
          'laborConditionMappingVersion', assignment.provenance_json->'laborConditionMappingVersion'
        ),
        'updated_at', assignment.updated_at, 'version_number', assignment.version_number,
        'supersedes_assignment_id', assignment.supersedes_assignment_id,
        'arrangement', arrangement_projection->'arrangement',
        'arrangement_resolution_reason', arrangement_projection->>'reasonCode',
        'arrangement_resolution_change_version_ids', coalesce(arrangement_projection->'changeVersionIds', '[]'::jsonb),
        'age_for_tier', case when v_birth_date is null or arrangement_projection->'arrangement' is null then null
          when coalesce(
            arrangement_projection->'arrangement'->'pensionable_salary_definition'->>'ageDetermination',
            arrangement_projection->'arrangement'->'eligibility_rule'->>'ageDetermination'
          ) = 'AGE_AT_END_OF_CALENDAR_YEAR'
            then extract(year from age(make_date(extract(year from requested_period_end)::integer, 12, 31), v_birth_date))::integer
          when coalesce(
            arrangement_projection->'arrangement'->'pensionable_salary_definition'->>'ageDetermination',
            arrangement_projection->'arrangement'->'eligibility_rule'->>'ageDetermination'
          ) = 'AGE_AT_PERIOD_END'
            then extract(year from age(requested_period_end, v_birth_date))::integer
          else null end
      ) order by assignment.effective_from, assignment.id)
      from public.employment_pension_arrangement_assignments assignment
      cross join lateral internal_security.payfast_mss_pension_arrangement_source_v1(
        assignment.tenant_id, assignment.hr_group_id, assignment.administration_id,
        assignment.pension_arrangement_id, requested_period_start, requested_period_end
      ) arrangement_projection
      where assignment.tenant_id = v_employment.tenant_id and assignment.hr_group_id = v_employment.hr_group_id
        and assignment.administration_id = v_employment.administration_id
        and assignment.employment_id = requested_employment_id
        and assignment.effective_from <= requested_period_end
        and (assignment.effective_to is null or assignment.effective_to >= requested_period_start)
    ), '[]'::jsonb),
    'laborConditionPensionArrangements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', mapping.id, 'labor_condition_set_id', mapping.labor_condition_set_id,
        'pension_arrangement_id', mapping.pension_arrangement_id, 'participant_group', mapping.participant_group,
        'effective_from', mapping.effective_from, 'effective_to', mapping.effective_to,
        'provenance_json', jsonb_build_object(
          'status', mapping.provenance_json->'status',
          'sourceClassification', mapping.provenance_json->'sourceClassification'
        ),
        'version_number', mapping.version_number, 'supersedes_mapping_id', mapping.supersedes_mapping_id,
        'arrangement', arrangement_projection->'arrangement',
        'arrangement_resolution_reason', arrangement_projection->>'reasonCode',
        'arrangement_resolution_change_version_ids', coalesce(arrangement_projection->'changeVersionIds', '[]'::jsonb)
      ) order by mapping.effective_from, mapping.id)
      from public.labor_condition_pension_arrangements mapping
      cross join lateral internal_security.payfast_mss_pension_arrangement_source_v1(
        mapping.tenant_id, mapping.hr_group_id, mapping.administration_id,
        mapping.pension_arrangement_id, requested_period_start, requested_period_end
      ) arrangement_projection
      where mapping.tenant_id = v_employment.tenant_id and mapping.hr_group_id = v_employment.hr_group_id
        and mapping.administration_id = v_employment.administration_id
        and mapping.effective_from <= requested_period_end
        and (mapping.effective_to is null or mapping.effective_to >= requested_period_start)
        and exists (
          select 1 from public.employment_contracts contract
          where contract.tenant_id = v_employment.tenant_id and contract.hr_group_id = v_employment.hr_group_id
            and contract.administration_id = v_employment.administration_id and contract.employee_id = requested_employee_id
            and contract.employment_id = requested_employment_id and contract.labor_condition_set_id = mapping.labor_condition_set_id
            and contract.starts_on <= requested_period_end and (contract.ends_on is null or contract.ends_on >= requested_period_start)
        )
    ), '[]'::jsonb),
    'salaryTableSource', case when exists (
      select 1 from public.employment_salaries salary
      where salary.tenant_id = v_employment.tenant_id and salary.hr_group_id = v_employment.hr_group_id
        and salary.administration_id = v_employment.administration_id and salary.employee_id = requested_employee_id
        and salary.employment_id = requested_employment_id and salary.valid_from <= requested_period_end
        and (salary.valid_until is null or salary.valid_until >= requested_period_start)
        and (salary.salary_basis = 'CAO_SCALE' or salary.salary_route = 'SCALE_WITH_STEPS')
    ) then jsonb_build_object('status', 'MISSING', 'reasonCode', 'PAYFAST_CAOSALARY_SOURCE_NOT_INCLUDED', 'source', null)
      else jsonb_build_object('status', 'NOT_APPLICABLE', 'reasonCode', null, 'source', null) end,
    'incomeRelationships', v_link_rows,
    'taxProfileProjection', jsonb_build_object(
      'ageCategory', case when v_age is null then null when v_age < 67 then 'UNDER_AOW' else 'AT_OR_ABOVE_AOW' end,
      'ageSourceUpdatedAt', v_employee_updated_at,
      'activeIncomeRelationshipCount', jsonb_array_length(v_active_ikv_rows),
      'incomeRelationshipLinkGap', coalesce(v_gap, false),
      'incomeRelationships', v_active_ikv_rows,
      'payrollIncomeRelationshipProjection', jsonb_build_object(
        'complete', jsonb_array_length(v_link_rows) < 100,
        'rows', v_link_rows
      ),
      'taxProfiles', v_tax_profiles
    )
  );

  select jsonb_build_object(
    'period', case when requested_periodicity = 'FOUR_WEEKLY' then null else (
      select jsonb_build_object('id', period_row.id, 'period_start', period_row.period_start,
        'period_end', period_row.period_end, 'status', period_row.status::text, 'updated_at', period_row.updated_at)
      from public.actual_work_periods period_row
      where period_row.tenant_id = v_employment.tenant_id and period_row.hr_group_id = v_employment.hr_group_id
        and (period_row.administration_id is null or period_row.administration_id = v_employment.administration_id)
        and period_row.period_start = v_month_start
      order by period_row.administration_id nulls last, period_row.id limit 1
    ) end,
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', entry.id, 'employment_id', entry.employment_id, 'work_hour_type_id', entry.work_hour_type_id,
        'work_date', entry.work_date, 'entry_granularity', entry.entry_granularity::text,
        'subject_period_start', entry.subject_period_start, 'subject_period_end', entry.subject_period_end,
        'posting_period_start', entry.posting_period_start, 'hours', entry.hours, 'status', entry.status::text,
        'approved_at', entry.approved_at, 'updated_at', entry.updated_at
      ) order by entry.work_date, entry.id)
      from (
        select work_entry.id, work_entry.tenant_id, work_entry.hr_group_id, work_entry.administration_id,
          work_entry.employee_id, work_entry.employment_id, work_entry.work_hour_type_id, work_entry.work_date,
          work_entry.entry_granularity, work_entry.subject_period_start, work_entry.subject_period_end,
          work_entry.posting_period_start, work_entry.hours, work_entry.status, work_entry.approved_at, work_entry.updated_at
        from public.employment_work_hour_entries work_entry
        where work_entry.tenant_id = v_employment.tenant_id and work_entry.hr_group_id = v_employment.hr_group_id
          and work_entry.administration_id = v_employment.administration_id
          and work_entry.employee_id = requested_employee_id and work_entry.employment_id = requested_employment_id
          and case when requested_periodicity = 'FOUR_WEEKLY' then exists (
            select 1 from public.actual_work_payroll_releases release_row
            where release_row.tenant_id = work_entry.tenant_id and release_row.hr_group_id = work_entry.hr_group_id
              and release_row.administration_id = work_entry.administration_id
              and release_row.employee_id = work_entry.employee_id and release_row.employment_id = work_entry.employment_id
              and release_row.entry_id = work_entry.id and release_row.payroll_period_id = requested_payroll_period_id
              and release_row.payroll_period_start = requested_period_start
              and release_row.payroll_period_end = requested_period_end
              and release_row.payroll_periodicity = requested_periodicity
          ) else work_entry.posting_period_start = v_month_start end
        order by work_entry.work_date, work_entry.id limit v_limit + 1
      ) entry
    ), '[]'::jsonb),
    'types', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', work_type.id, 'family', work_type.family::text, 'valid_from', work_type.valid_from,
        'valid_until', work_type.valid_until, 'approval_required', work_type.approval_required,
        'updated_at', work_type.updated_at, 'code', work_type.code, 'name', work_type.name
      ) order by work_type.id)
      from public.work_hour_types work_type
      where work_type.tenant_id = v_employment.tenant_id and work_type.hr_group_id = v_employment.hr_group_id
        and exists (
          select 1 from public.employment_work_hour_entries work_entry
          where work_entry.tenant_id = v_employment.tenant_id and work_entry.hr_group_id = v_employment.hr_group_id
            and work_entry.administration_id = v_employment.administration_id and work_entry.employee_id = requested_employee_id
            and work_entry.employment_id = requested_employment_id and work_entry.work_hour_type_id = work_type.id
            and case when requested_periodicity = 'FOUR_WEEKLY' then exists (
              select 1 from public.actual_work_payroll_releases release_row
              where release_row.entry_id = work_entry.id and release_row.payroll_period_id = requested_payroll_period_id
                and release_row.payroll_period_start = requested_period_start and release_row.payroll_period_end = requested_period_end
                and release_row.payroll_periodicity = requested_periodicity
            ) else work_entry.posting_period_start = v_month_start end
        )
    ), '[]'::jsonb),
    'currentRevisionNumbers', coalesce((
      select jsonb_object_agg(revision.entry_id::text, revision.revision_number)
      from (
        select revision_row.entry_id, max(revision_row.revision_number) as revision_number
        from public.actual_work_revisions revision_row
        where revision_row.tenant_id = v_employment.tenant_id and revision_row.hr_group_id = v_employment.hr_group_id
          and revision_row.administration_id = v_employment.administration_id and revision_row.employee_id = requested_employee_id
          and revision_row.employment_id = requested_employment_id
          and exists (
            select 1 from public.employment_work_hour_entries work_entry
            where work_entry.id = revision_row.entry_id and work_entry.employee_id = requested_employee_id
              and work_entry.employment_id = requested_employment_id
              and case when requested_periodicity = 'FOUR_WEEKLY' then exists (
                select 1 from public.actual_work_payroll_releases release_row
                where release_row.entry_id = work_entry.id and release_row.payroll_period_id = requested_payroll_period_id
                  and release_row.payroll_period_start = requested_period_start and release_row.payroll_period_end = requested_period_end
                  and release_row.payroll_periodicity = requested_periodicity
              ) else work_entry.posting_period_start = v_month_start end
          )
        group by revision_row.entry_id
      ) revision
    ), '{}'::jsonb),
    'payrollReleases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', release_row.id, 'entry_id', release_row.entry_id,
        'entry_revision_number', release_row.entry_revision_number,
        'payroll_period_start', release_row.payroll_period_start,
        'payroll_period_id', release_row.payroll_period_id,
        'payroll_period_end', release_row.payroll_period_end,
        'payroll_periodicity', release_row.payroll_periodicity,
        'release_class', release_row.release_class, 'content_fingerprint', release_row.content_fingerprint,
        'work_hour_type_updated_at', release_row.work_hour_type_updated_at, 'released_at', release_row.released_at,
        'mapping', case when mapping.id is null then null else jsonb_build_object(
          'id', mapping.id, 'processing_target', mapping.processing_target,
          'salary_component_id', mapping.salary_component_id, 'salary_component_code', mapping.salary_component_code,
          'salary_component_version', mapping.salary_component_version, 'salary_component_output', mapping.salary_component_output,
          'calculation_rule', mapping.calculation_rule, 'factor', mapping.factor,
          'version_number', mapping.version_number, 'valid_from', mapping.valid_from, 'valid_until', mapping.valid_until
        ) end
      ) order by release_row.released_at, release_row.id)
      from public.actual_work_payroll_releases release_row
      left join public.actual_work_payroll_mappings mapping on mapping.id = release_row.mapping_id
        and mapping.tenant_id = release_row.tenant_id and mapping.hr_group_id = release_row.hr_group_id
        and mapping.administration_id = release_row.administration_id
      where release_row.tenant_id = v_employment.tenant_id and release_row.hr_group_id = v_employment.hr_group_id
        and release_row.administration_id = v_employment.administration_id
        and release_row.employee_id = requested_employee_id and release_row.employment_id = requested_employment_id
        and exists (
          select 1 from public.employment_work_hour_entries work_entry
          where work_entry.id = release_row.entry_id and work_entry.employee_id = requested_employee_id
            and work_entry.employment_id = requested_employment_id
            and case when requested_periodicity = 'FOUR_WEEKLY' then release_row.payroll_period_id = requested_payroll_period_id
              else work_entry.posting_period_start = v_month_start end
        )
    ), '[]'::jsonb),
    'tvtWorkHourTypeIds', coalesce((
      select jsonb_agg(distinct link.work_hour_type_id)
      from public.leave_type_overtime_work_hours link
      join public.leave_types leave_type on leave_type.id = link.leave_type_id
        and leave_type.tenant_id = link.tenant_id and leave_type.hr_group_id = link.hr_group_id
      join public.employment_work_hour_entries work_entry on work_entry.work_hour_type_id = link.work_hour_type_id
        and work_entry.tenant_id = link.tenant_id and work_entry.hr_group_id = link.hr_group_id
        and (link.administration_id is null or link.administration_id = work_entry.administration_id)
      where link.tenant_id = v_employment.tenant_id and link.hr_group_id = v_employment.hr_group_id
        and leave_type.is_active and leave_type.entitlement_mode::text = 'OVERTIME_HOURS'
        and work_entry.administration_id = v_employment.administration_id
        and work_entry.employee_id = requested_employee_id and work_entry.employment_id = requested_employment_id
    ), '[]'::jsonb),
    'informationalWorkHourTypeIds', coalesce((
      select jsonb_agg(distinct mapping.work_hour_type_id)
      from public.actual_work_payroll_mappings mapping
      join public.employment_work_hour_entries work_entry on work_entry.work_hour_type_id = mapping.work_hour_type_id
        and work_entry.tenant_id = mapping.tenant_id and work_entry.hr_group_id = mapping.hr_group_id
        and work_entry.administration_id = mapping.administration_id
      where mapping.tenant_id = v_employment.tenant_id and mapping.hr_group_id = v_employment.hr_group_id
        and mapping.administration_id = v_employment.administration_id
        and mapping.processing_target = 'INFORMATIONAL'
        and work_entry.employee_id = requested_employee_id and work_entry.employment_id = requested_employment_id
    ), '[]'::jsonb),
    'tvtAccruedHoursByEntryId', coalesce((
      select jsonb_object_agg(transaction.source_id::text, transaction.total_amount::text)
      from (
        select accrual.source_id, sum(accrual.amount) as total_amount
        from public.leave_accrual_transactions accrual
        join public.employment_work_hour_entries work_entry on work_entry.id = accrual.source_id
          and work_entry.tenant_id = accrual.tenant_id and work_entry.hr_group_id = accrual.hr_group_id
          and work_entry.administration_id = accrual.administration_id
          and work_entry.employee_id = accrual.employee_id and work_entry.employment_id = accrual.employment_id
        where accrual.tenant_id = v_employment.tenant_id and accrual.hr_group_id = v_employment.hr_group_id
          and accrual.administration_id = v_employment.administration_id and accrual.employee_id = requested_employee_id
          and accrual.employment_id = requested_employment_id and accrual.source_type = 'ACTUAL_WORK_TVT'
          and accrual.source_id is not null
        group by accrual.source_id
      ) transaction
    ), '{}'::jsonb)
  ) into v_actual_work;

  if jsonb_array_length(v_tax_profiles) > v_limit
    or jsonb_array_length(v_link_rows) > 100
    or jsonb_array_length(v_actual_work->'entries') > v_limit
    or jsonb_array_length(v_actual_work->'payrollReleases') > v_limit then
    raise exception using errcode = '54000', message = 'PAYFAST_MANAGER_SOURCE_LIMIT';
  end if;

  return jsonb_build_object(
    'schemaVersion', 1,
    'target', jsonb_build_object(
      'employeeId', v_employment.employee_id, 'employmentId', v_employment.id,
      'tenantId', v_employment.tenant_id, 'hrGroupId', v_employment.hr_group_id,
      'administrationId', v_employment.administration_id
    ),
    'period', jsonb_build_object(
      'startsOn', requested_period_start, 'endsOn', requested_period_end,
      'periodId', requested_payroll_period_id, 'periodicity', requested_periodicity
    ),
    'timeline', v_timeline,
    'actualWork', v_actual_work
  );
end;
$$;
revoke all on function public.payfast_manager_payroll_source_projection_v1(uuid, uuid, date, date, uuid, text)
  from public, anon, service_role, authenticated;
grant execute on function public.payfast_manager_payroll_source_projection_v1(uuid, uuid, date, date, uuid, text)
  to authenticated;
alter function public.payfast_manager_payroll_source_projection_v1(uuid, uuid, date, date, uuid, text)
  owner to payfast_mss_projection_reader;

-- The private role itself cannot mutate business or audit rows.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from payfast_mss_projection_reader;

-- Do not leave migration-executor membership or schema-creation rights behind.
revoke create on schema public, internal_security from payfast_mss_projection_reader;
revoke payfast_mss_projection_reader from current_user;

COMMIT;
