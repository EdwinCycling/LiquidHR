begin;

do $$
declare
  demo_tenant uuid := md5('tenant:liquid-hr-demo-holding')::uuid;
  custom_role_id uuid := md5('role:test-custom-role')::uuid;
begin
  if not exists (select 1 from public.permissions where code = 'authorization:write') then
    raise exception 'authorization:write ontbreekt.';
  end if;

  insert into public.management_roles (id, tenant_id, code, name, is_system)
  values (custom_role_id, demo_tenant, 'TEST_ROLE', 'Testrol', false);

  begin
    update public.management_roles set name = 'Gewijzigd'
    where code = 'DIRECT_MANAGER' and tenant_id is null;
    raise exception 'Systeemrol kan worden gewijzigd.';
  exception when check_violation then null;
  end;

  begin
    update public.management_roles set is_system = true where id = custom_role_id;
    raise exception 'Tenantrol kan zichzelf systeemrol maken.';
  exception when check_violation then null;
  end;
end
$$;

rollback;
