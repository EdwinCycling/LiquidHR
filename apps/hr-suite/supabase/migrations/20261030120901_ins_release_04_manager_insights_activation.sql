begin;

-- Phase C only: grant the Insights-specific right after the secured application
-- is available. The operational absence:* permissions and RLS policies remain
-- untouched.
do $$
begin
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