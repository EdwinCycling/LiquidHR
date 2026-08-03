do $$
declare
  table_name text;
  policy_count integer;
  function_count integer;
begin
  foreach table_name in array array['talent_import_batches', 'talent_import_rows'] loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'Missing Talent import table: %', table_name;
    end if;
    if not exists (
      select 1
      from pg_class
      where oid = to_regclass('public.' || table_name)
        and relrowsecurity
    ) then
      raise exception 'RLS is disabled on %', table_name;
    end if;
    if has_table_privilege('anon', 'public.' || table_name, 'SELECT')
      or has_table_privilege('public', 'public.' || table_name, 'SELECT') then
      raise exception 'Anonymous/public SELECT grant exists on %', table_name;
    end if;
  end loop;

  select count(*) into policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('talent_import_batches', 'talent_import_rows');
  if policy_count < 6 then
    raise exception 'Expected HR-only import policies, found %', policy_count;
  end if;

  if not has_function_privilege('authenticated', 'public.commit_talent_import_batch(uuid,uuid,text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.rollback_talent_import_batch(uuid,uuid,text)', 'EXECUTE') then
    raise exception 'Authenticated command grants are missing';
  end if;
  if has_function_privilege('anon', 'public.commit_talent_import_batch(uuid,uuid,text)', 'EXECUTE')
    or has_function_privilege('public', 'public.commit_talent_import_batch(uuid,uuid,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.rollback_talent_import_batch(uuid,uuid,text)', 'EXECUTE')
    or has_function_privilege('public', 'public.rollback_talent_import_batch(uuid,uuid,text)', 'EXECUTE') then
    raise exception 'Anonymous/public command grant exists';
  end if;

  select count(*) into function_count
  from pg_proc
  where pronamespace = 'public'::regnamespace
    and proname in ('commit_talent_import_batch', 'rollback_talent_import_batch');
  if function_count <> 2 then
    raise exception 'Expected two import command functions, found %', function_count;
  end if;
  if exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('commit_talent_import_batch', 'rollback_talent_import_batch')
      and prosecdef
  ) then
    raise exception 'Import command functions must remain SECURITY INVOKER';
  end if;

  if not exists (select 1 from public.permissions where code = 'talent-comparison:read')
    or not exists (select 1 from public.permissions where code = 'talent-import:manage') then
    raise exception 'Talent comparison/import permissions are missing';
  end if;
  if not exists (
    select 1
    from public.role_permissions role_permission
    join public.management_roles role on role.id = role_permission.management_role_id
    join public.permissions permission on permission.id = role_permission.permission_id
    where role.tenant_id is null
      and role.code = 'DIRECT_MANAGER'
      and permission.code = 'talent-comparison:read'
  ) then
    raise exception 'Direct-manager comparison permission is missing';
  end if;
  if not exists (
    select 1
    from public.role_permissions role_permission
    join public.management_roles role on role.id = role_permission.management_role_id
    join public.permissions permission on permission.id = role_permission.permission_id
    where role.tenant_id is null
      and role.code = 'TENANT_ADMIN'
      and permission.code = 'talent-import:manage'
  ) then
    raise exception 'Tenant-admin import permission is missing';
  end if;
  if exists (
    select 1
    from public.management_roles role
    join public.tenants tenant on tenant.id = role.tenant_id
    where tenant.slug = 'liquid-hr-demo-holding'
      and role.code = 'TENANT_ADMIN'
      and not exists (
        select 1
        from public.role_permissions role_permission
        join public.permissions permission on permission.id = role_permission.permission_id
        where role_permission.management_role_id = role.id
          and permission.code = 'talent-import:manage'
      )
  ) then
    raise exception 'A tenant-admin override is missing the import permission';
  end if;
  if exists (
    select 1
    from public.management_roles role
    join public.tenants tenant on tenant.id = role.tenant_id
    where tenant.slug = 'liquid-hr-demo-holding'
      and role.code = 'DIRECT_MANAGER'
      and not exists (
        select 1
        from public.role_permissions role_permission
        join public.permissions permission on permission.id = role_permission.permission_id
        where role_permission.management_role_id = role.id
          and permission.code = 'talent-comparison:read'
      )
  ) then
    raise exception 'A direct-manager override is missing the comparison permission';
  end if;

  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'talent_import_rows_batch_status_idx') then
    raise exception 'Import row status index is missing';
  end if;
end;
$$;
