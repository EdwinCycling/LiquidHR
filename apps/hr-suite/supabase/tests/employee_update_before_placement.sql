begin;

do $$
declare
  writer_user_id uuid;
  target_tenant_id uuid;
  target_hr_group_id uuid;
  target_employee_id constant uuid := md5('test:employee-update-before-placement')::uuid;
begin
  select access.user_id, access.tenant_id, access.hr_group_id
    into writer_user_id, target_tenant_id, target_hr_group_id
  from public.user_hr_group_access access
  join public.role_permissions role_permission
    on role_permission.management_role_id = access.management_role_id
  join public.permissions permission
    on permission.id = role_permission.permission_id
   and permission.code = 'employee:write'
  where access.is_active
  order by access.created_at
  limit 1;

  if writer_user_id is null or target_tenant_id is null or target_hr_group_id is null then
    raise exception 'EMPLOYEE_UPDATE_BEFORE_PLACEMENT_WRITER_FIXTURE_MISSING';
  end if;

  insert into public.employees (
    id, tenant_id, hr_group_id, employee_number, first_name, birth_name,
    gender, name_usage, nationality
  ) values (
    target_employee_id, target_tenant_id, target_hr_group_id,
    'RLS-PREPLACEMENT-TEST', 'RLS', 'Zonder plaatsing',
    'PREFER_NOT_TO_SAY', 'BIRTH_NAME', null
  );

  if exists (
    select 1
    from public.employee_organizations
    where employee_id = target_employee_id
  ) then
    raise exception 'EMPLOYEE_UPDATE_BEFORE_PLACEMENT_UNEXPECTED_PLACEMENT';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (
      select access.user_id
      from public.user_hr_group_access access
      join public.role_permissions role_permission
        on role_permission.management_role_id = access.management_role_id
      join public.permissions permission
        on permission.id = role_permission.permission_id
       and permission.code = 'employee:write'
      where access.is_active
      order by access.created_at
      limit 1
    ),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
declare
  target_employee_id constant uuid := md5('test:employee-update-before-placement')::uuid;
  target_employee public.employees%rowtype;
  updated_rows integer;
begin
  select * into target_employee
  from public.employees
  where id = target_employee_id;

  if target_employee.id is null then
    raise exception 'EMPLOYEE_UPDATE_BEFORE_PLACEMENT_NOT_VISIBLE';
  end if;

  if not internal_security.current_user_has_hr_group_permission(
    target_employee.tenant_id,
    target_employee.hr_group_id,
    'employee:write'
  ) then
    raise exception 'EMPLOYEE_UPDATE_BEFORE_PLACEMENT_PERMISSION_MISSING';
  end if;

  update public.employees
  set nationality = 'NL'
  where id = target_employee_id
    and updated_at = target_employee.updated_at;
  get diagnostics updated_rows = row_count;

  if updated_rows <> 1 then
    raise exception 'EMPLOYEE_UPDATE_BEFORE_PLACEMENT_BLOCKED';
  end if;
end;
$$;

rollback;
