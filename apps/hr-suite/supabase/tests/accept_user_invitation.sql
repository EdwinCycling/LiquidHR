begin;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
)
values (
  md5('auth-user:invitation-test')::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'uitgenodigd@liquid-demo.invalid',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  false,
  false
)
on conflict (id) do update
set email = excluded.email,
    email_confirmed_at = excluded.email_confirmed_at,
    updated_at = excluded.updated_at;

insert into public.user_invitations (
  tenant_id,
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
  md5('tenant:liquid-hr-demo-holding')::uuid,
  role.id,
  'TENANT',
  'uitgenodigd@liquid-demo.invalid',
  'BUSINESS',
  'BUSINESS_USER',
  encode(extensions.digest('geldige-uitnodiging', 'sha256'), 'hex'),
  now() + interval '1 day',
  auth_user.id
from public.management_roles role
cross join lateral (
  select id
  from auth.users
  where lower(email) = 'edwin@editsolutions.nl'
  limit 1
) auth_user
where role.code = 'TENANT_ADMIN'
  and role.tenant_id is null;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', md5('auth-user:invitation-test')::uuid,
    'role', 'authenticated',
    'email', 'uitgenodigd@liquid-demo.invalid'
  )::text,
  true
);

set local role authenticated;

do $$
begin
  perform public.accept_user_invitation(
    'geldige-uitnodiging',
    md5('auth-user:invitation-test')::uuid,
    'uitgenodigd@liquid-demo.invalid'
  );
  raise exception 'Uitnodigingsacceptatie faalt: authenticated kon de server-only RPC uitvoeren.';
exception
  when insufficient_privilege then null;
end
$$;

reset role;
set local role service_role;

select *
from public.accept_user_invitation(
  'geldige-uitnodiging',
  md5('auth-user:invitation-test')::uuid,
  'uitgenodigd@liquid-demo.invalid'
);

reset role;

do $$
begin
  if not exists (
    select 1
    from public.user_access access
    where access.user_id = md5('auth-user:invitation-test')::uuid
      and access.tenant_id = md5('tenant:liquid-hr-demo-holding')::uuid
      and access.is_active
  ) then
    raise exception 'Uitnodigingsacceptatie faalt: user_access ontbreekt.';
  end if;

  if not exists (
    select 1
    from public.user_invitations invitation
    where invitation.email = 'uitgenodigd@liquid-demo.invalid'
      and invitation.status = 'ACCEPTED'
      and invitation.accepted_by_user_id = md5('auth-user:invitation-test')::uuid
  ) then
    raise exception 'Uitnodigingsacceptatie faalt: status is niet ACCEPTED.';
  end if;
end
$$;

set local role service_role;

do $$
begin
  perform public.accept_user_invitation(
    'geldige-uitnodiging',
    md5('auth-user:invitation-test')::uuid,
    'uitgenodigd@liquid-demo.invalid'
  );
  raise exception 'Uitnodigingsacceptatie faalt: token kon tweemaal worden gebruikt.';
exception
  when others then
    if sqlerrm not like '%INVITATION_INVALID%' then
      raise;
    end if;
end
$$;

rollback;
