begin;

-- Phase C only: grant the Insights-specific right after the secured application
-- is available. The operational absence:* permissions and RLS policies remain
-- untouched.
do $$
declare
  helper_source text;
  helper_config text[];
  helper_is_security_definer boolean;
  helper_is_stable boolean;
begin
  select proc.prosrc, proc.proconfig, proc.prosecdef, proc.provolatile = 's'
  into helper_source, helper_config, helper_is_security_definer, helper_is_stable
  from pg_catalog.pg_proc as proc
  where proc.oid = pg_catalog.to_regprocedure(
    'internal_security.current_user_has_hr_group_permission(uuid,uuid,text)'
  );

  if not found
    or helper_is_security_definer is distinct from true
    or helper_is_stable is distinct from true
    or not (coalesce(helper_config, '{}'::text[]) @> array['search_path=""'])
    or position('(select auth.uid()) is not null' in lower(helper_source)) = 0
    or position('current_employee_is_preboarding' in lower(helper_source)) = 0
    or position('access.is_active' in lower(helper_source)) = 0
    or position('access.tenant_id = requested_tenant_id' in lower(helper_source)) = 0
    or position('access.hr_group_id = requested_hr_group_id' in lower(helper_source)) = 0
    or position('group_row.is_active' in lower(helper_source)) = 0
    or position('role.is_active is true' in lower(helper_source)) = 0
    or position('role.deleted_at is null' in lower(helper_source)) = 0
    or position('permission.code = requested_permission_code' in lower(helper_source)) = 0
    or position('role.tenant_id = requested_tenant_id' in lower(helper_source)) = 0 then
    raise exception 'INS_RELEASE_04_ROLE_PERMISSION_GUARD_MISSING' using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.permissions as permission
    where permission.code = 'report-absence:read'
  ) then
    raise exception 'INS_RELEASE_04_REPORT_PERMISSION_MISSING' using errcode = '55000';
  end if;
end;
$$;

-- Keep exact provenance for grants inserted by this activation so containment
-- never deletes a pre-existing role permission. This table remains private and
-- has no grants to application roles.
create table if not exists internal_security.ins_release_04_manager_permission_activation_log (
  migration_version text not null,
  management_role_id uuid not null,
  permission_id uuid not null,
  activated_at timestamptz not null default pg_catalog.now(),
  primary key (migration_version, management_role_id, permission_id)
);

revoke all on table internal_security.ins_release_04_manager_permission_activation_log
  from public, anon, authenticated, service_role;

with inserted_manager_permissions as (
  insert into public.role_permissions (management_role_id, permission_id)
  select management_role.id, permission.id
  from public.management_roles as management_role
  join public.permissions as permission
    on permission.code = 'report-absence:read'
  where management_role.code = 'DIRECT_MANAGER'
    and management_role.is_active is true
    and management_role.deleted_at is null
  on conflict (management_role_id, permission_id) do nothing
  returning management_role_id, permission_id
)
insert into internal_security.ins_release_04_manager_permission_activation_log (
  migration_version,
  management_role_id,
  permission_id
)
select
  '20261030120901',
  inserted.management_role_id,
  inserted.permission_id
from inserted_manager_permissions as inserted
on conflict (migration_version, management_role_id, permission_id) do nothing;

commit;
