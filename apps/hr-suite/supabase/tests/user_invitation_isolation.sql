begin;

delete from public.user_access
where user_id = (
  select id from auth.users where lower(email) = 'edwin@editsolutions.nl' limit 1
);

insert into public.user_access (
  user_id,
  tenant_id,
  management_role_id,
  scope_type
)
select
  auth_user.id,
  md5('tenant:liquid-hr-demo-holding')::uuid,
  role.id,
  'TENANT'
from auth.users auth_user
join public.management_roles role
  on role.code = 'TENANT_ADMIN'
 and role.tenant_id is null
where lower(auth_user.email) = 'edwin@editsolutions.nl'
on conflict do nothing;

insert into public.user_invitations (
  tenant_id,
  administration_id,
  management_role_id,
  scope_type,
  email,
  email_kind,
  purpose,
  token_hash,
  expires_at,
  invited_by_user_id
)
select
  tenant.tenant_id,
  null,
  role.id,
  'TENANT',
  'test-uitnodiging@liquid-demo.invalid',
  'BUSINESS',
  'BUSINESS_USER',
  repeat(case when tenant.tenant_id = md5('tenant:liquid-hr-demo-holding')::uuid then 'a' else 'b' end, 64),
  now() + interval '1 day',
  auth_user.id
from (
  values
    (md5('tenant:liquid-hr-demo-holding')::uuid),
    (md5('tenant:noorderlicht-zorggroep')::uuid)
) tenant(tenant_id)
join public.management_roles role
  on role.code = 'TENANT_ADMIN'
 and role.tenant_id is null
cross join lateral (
  select id
  from auth.users
  where lower(email) = 'edwin@editsolutions.nl'
  limit 1
) auth_user
on conflict do nothing;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select id from auth.users where lower(email) = 'edwin@editsolutions.nl' limit 1),
    'role', 'authenticated',
    'email', 'edwin@editsolutions.nl'
  )::text,
  true
);

set local role authenticated;

do $$
begin
  if (select count(*) from public.user_invitations) <> 1 then
    raise exception 'Uitnodigingsisolatie faalt: verwacht exact één zichtbare tenantuitnodiging.';
  end if;

  update public.user_invitations
  set status = 'REVOKED'
  where tenant_id = md5('tenant:noorderlicht-zorggroep')::uuid;

  if found then
    raise exception 'Uitnodigingsisolatie faalt: een uitnodiging uit tenant 2 kon worden gewijzigd.';
  end if;
end
$$;

rollback;
