begin;

do $$
declare
  writer_user_id uuid;
  target_tenant_id uuid;
  target_hr_group_id uuid;
  visible_address_rows integer;
begin
  select access.user_id, access.tenant_id, access.hr_group_id
    into writer_user_id, target_tenant_id, target_hr_group_id
  from public.user_hr_group_access access
  join public.role_permissions role_permission
    on role_permission.management_role_id = access.management_role_id
  join public.permissions permission
    on permission.id = role_permission.permission_id
   and permission.code = 'employee:read'
  where access.is_active
  order by access.created_at
  limit 1;

  if writer_user_id is null or target_tenant_id is null or target_hr_group_id is null then
    raise exception 'EMPLOYEE_PREPLACEMENT_SUBRESOURCE_WRITER_FIXTURE_MISSING';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', writer_user_id, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  select count(*)
    into visible_address_rows
  from public.employee_addresses
  where employee_id = 'fe3d9482-52c1-4edc-b85f-77cfb79bc901'::uuid
    and deleted_at is null;

  if visible_address_rows <> 1 then
    raise exception 'EMPLOYEE_PREPLACEMENT_ADDRESS_READ_BLOCKED';
  end if;
end;
$$;

do $$
declare
  protected_avatar_policy_count integer;
begin
  select count(*)
    into protected_avatar_policy_count
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname in (
      'employee_avatar_objects_insert',
      'employee_avatar_objects_update',
      'employee_avatar_objects_delete'
    )
    and coalesce(qual, '') || coalesce(with_check, '')
      like '%employee_subresource_can_write%';

  if protected_avatar_policy_count <> 3 then
    raise exception 'EMPLOYEE_PREPLACEMENT_AVATAR_STORAGE_POLICY_MISSING';
  end if;
end;
$$;

rollback;
