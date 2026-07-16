begin;

delete from public.user_access
where user_id = (
  select id from auth.users where lower(email) = 'edwin@editsolutions.nl' limit 1
);

insert into public.user_access (
  user_id,
  tenant_id,
  management_role_id,
  scope_type,
  administration_id
)
select
  auth_user.id,
  md5('tenant:liquid-hr-demo-holding')::uuid,
  role.id,
  'ADMINISTRATION',
  md5('administration:liquid-services')::uuid
from auth.users auth_user
join public.management_roles role
  on role.code = 'TENANT_ADMIN'
 and role.tenant_id is null
where lower(auth_user.email) = 'edwin@editsolutions.nl';

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select id from auth.users where lower(email) = 'edwin@editsolutions.nl' limit 1),
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

do $$
begin
  if (select count(*) from public.tenants) <> 1 then
    raise exception 'Tenantisolatie faalt: verwacht exact één zichtbare tenant.';
  end if;

  if (select count(*) from public.administrations) <> 1 then
    raise exception 'Administratie-isolatie faalt: verwacht exact één zichtbare administratie.';
  end if;

  if (select count(*) from public.departments) <> 4 then
    raise exception 'Administratie-isolatie faalt: verwacht exact vier afdelingen binnen Services.';
  end if;

  if (
    select count(*)
    from public.employees employee
    where employee.employee_number between 'DEMO-002' and 'DEMO-005'
  ) <> 0 then
    raise exception 'Administratie-isolatie faalt: directe reports uit een niet-toegestane sibling zijn zichtbaar.';
  end if;

  if (
    select count(*)
    from public.employees employee
    where employee.tenant_id = md5('tenant:noorderlicht-zorggroep')::uuid
  ) <> 0 then
    raise exception 'Tenantisolatie faalt: medewerkers uit tenant 2 zijn zichtbaar.';
  end if;
end
$$;

rollback;
