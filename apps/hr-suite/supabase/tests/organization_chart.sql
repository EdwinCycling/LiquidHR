begin;

do $$
declare
  definition_columns integer;
begin
  select count(*) into definition_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'custom_field_definitions'
    and column_name = 'show_in_organization_chart_filter'
    and data_type = 'boolean'
    and is_nullable = 'NO';

  if definition_columns <> 1 then
    raise exception 'ORGANIZATION_CHART_FILTER_COLUMN_MISSING';
  end if;

  if not exists (select 1 from public.permissions where code = 'organization-chart:read') then
    raise exception 'ORGANIZATION_CHART_PERMISSION_MISSING';
  end if;

  if exists (
    select 1
    from public.custom_field_definitions
    where show_in_organization_chart_filter = true
      and (is_active = false or deleted_at is not null)
  ) then
    raise exception 'INACTIVE_ORGANIZATION_CHART_FILTER_EXPOSED';
  end if;

  if not exists (
    select 1
    from public.management_roles role
    join public.role_permissions role_permission on role_permission.management_role_id = role.id
    join public.permissions permission on permission.id = role_permission.permission_id
    where role.code = 'TENANT_ADMIN'
      and permission.code = 'organization-chart:read'
  ) then
    raise exception 'TENANT_ADMIN_ORGANIZATION_CHART_PERMISSION_MISSING';
  end if;
end
$$;

rollback;
