-- CONTROL01 CONVERGENCE_REQUIRED
-- Static migration only. Do not apply to a shared or remote Supabase project in
-- this run. This slice adds the first-admin bootstrap contract and hardens the
-- existing onboarding transaction without changing the existing RPC shape.

begin;

alter table public.user_invitations
  add column if not exists hr_group_id uuid,
  add column if not exists bootstrap_request_key text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.user_invitations'::regclass
      and constraint_row.conname = 'user_invitations_hr_group_fkey'
  ) then
    alter table public.user_invitations
      add constraint user_invitations_hr_group_fkey
      foreign key (tenant_id, hr_group_id)
      references public.hr_groups(tenant_id, id)
      on delete cascade;
  end if;
end;
$$;

alter table public.user_invitations
  drop constraint if exists user_invitations_purpose_valid;

alter table public.user_invitations
  add constraint user_invitations_purpose_valid
  check (
    (
      purpose in ('PREBOARDING_EMPLOYEE', 'EMPLOYEE_ACTIVATION')
      and email_kind = 'PRIVATE'
      and employee_id is not null
      and hr_group_id is null
      and bootstrap_request_key is null
    )
    or (
      purpose = 'BUSINESS_USER'
      and email_kind = 'BUSINESS'
      and hr_group_id is null
      and bootstrap_request_key is null
    )
    or (
      purpose = 'TENANT_FIRST_ADMIN'
      and email_kind = 'BUSINESS'
      and employee_id is null
      and scope_type = 'ADMINISTRATION'
      and administration_id is not null
      and hr_group_id is not null
      and bootstrap_request_key is not null
      and btrim(bootstrap_request_key) <> ''
    )
  );

create unique index if not exists user_invitations_pending_bootstrap_request_key
  on public.user_invitations (tenant_id, bootstrap_request_key)
  where status = 'PENDING' and bootstrap_request_key is not null;

create index if not exists user_invitations_hr_group_idx
  on public.user_invitations (tenant_id, hr_group_id)
  where hr_group_id is not null;

comment on column public.user_invitations.bootstrap_request_key is
  'Deterministische bootstrap-idempotency key; bevat geen uitnodigingstoken.';

create or replace function internal_security.validate_control_plane_tenant_input()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if btrim(new.name) = '' or new.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'INVALID_TENANT_INPUT' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.tenants tenant
    where lower(tenant.slug) = lower(new.slug)
      and tenant.id <> new.id
  ) then
    raise exception 'TENANT_SLUG_DUPLICATE' using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_control_plane_tenant_input_before_insert on public.tenants;
create trigger validate_control_plane_tenant_input_before_insert
before insert on public.tenants
for each row execute function internal_security.validate_control_plane_tenant_input();

revoke all on function internal_security.validate_control_plane_tenant_input() from public, anon, authenticated;

create or replace function internal_security.validate_control_plane_administration_input()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if btrim(new.code) = ''
     or btrim(new.name) = ''
     or btrim(new.code) !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'INVALID_ADMINISTRATION_INPUT' using errcode = '22023';
  end if;

  if (select count(*) from public.administrations administration where administration.tenant_id = new.tenant_id) >= 25 then
    raise exception 'ADMINISTRATION_LIMIT_EXCEEDED' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.administrations administration
    where administration.tenant_id = new.tenant_id
      and lower(administration.code) = lower(new.code)
      and administration.id <> new.id
  ) then
    raise exception 'ADMINISTRATION_CODE_DUPLICATE' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.administrations administration
    where administration.tenant_id = new.tenant_id
      and lower(btrim(administration.name)) = lower(btrim(new.name))
      and administration.id <> new.id
  ) then
    raise exception 'ADMINISTRATION_NAME_DUPLICATE' using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_control_plane_administration_input_before_insert on public.administrations;
create trigger validate_control_plane_administration_input_before_insert
before insert on public.administrations
for each row execute function internal_security.validate_control_plane_administration_input();

revoke all on function internal_security.validate_control_plane_administration_input() from public, anon, authenticated;

create or replace function internal_security.enforce_first_admin_invitation_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'ACCEPTED'
     and new.purpose = 'TENANT_FIRST_ADMIN'
     and new.accepted_by_user_id is not null then
    if not exists (
      select 1
      from public.user_hr_group_access access
      where access.user_id = new.accepted_by_user_id
        and access.tenant_id = new.tenant_id
        and access.hr_group_id = new.hr_group_id
        and access.management_role_id = new.management_role_id
        and access.is_active
    ) then
      raise exception 'FIRST_ADMIN_HR_GROUP_ACCESS_NOT_CREATED';
    end if;

    update public.user_hr_group_access access
    set is_active = false,
        updated_at = timezone('utc', now())
    where access.user_id = new.accepted_by_user_id
      and access.tenant_id = new.tenant_id
      and access.management_role_id = new.management_role_id
      and access.hr_group_id <> new.hr_group_id;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_first_admin_invitation_scope_after_update on public.user_invitations;
create trigger enforce_first_admin_invitation_scope_after_update
after update of status on public.user_invitations
for each row execute function internal_security.enforce_first_admin_invitation_scope();

revoke all on function internal_security.enforce_first_admin_invitation_scope() from public, anon, authenticated;

create or replace function public.bootstrap_platform_first_admin(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_email text,
  requested_token_hash text,
  requested_expires_at timestamptz,
  requested_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, internal_security, auth, pg_temp
as $$
declare
  lifecycle_row public.tenant_lifecycle%rowtype;
  administration_row public.administrations%rowtype;
  pending_invitation public.user_invitations%rowtype;
  first_admin_role_id uuid;
  existing_user_id uuid;
  normalized_email text := lower(btrim(requested_email));
begin
  if not internal_security.is_platform_operator(array['OWNER'::public.platform_operator_role, 'OPERATOR'::public.platform_operator_role]) then
    raise exception 'PLATFORM_WRITE_ACCESS_DENIED' using errcode = '42501';
  end if;

  if requested_tenant_id is null
     or requested_hr_group_id is null
     or requested_administration_id is null
     or coalesce(normalized_email, '') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or coalesce(requested_token_hash, '') !~ '^[0-9a-f]{64}$'
     or requested_expires_at is null
     or requested_expires_at <= now()
     or requested_expires_at > now() + interval '8 days'
     or coalesce(btrim(requested_request_key), '') = '' then
    raise exception 'INVALID_FIRST_ADMIN_BOOTSTRAP_INPUT' using errcode = '22023';
  end if;

  select lifecycle.*
  into lifecycle_row
  from public.tenant_lifecycle lifecycle
  where lifecycle.tenant_id = requested_tenant_id
  for update;

  if lifecycle_row.tenant_id is null then
    raise exception 'TENANT_LIFECYCLE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if lifecycle_row.status <> 'PROVISIONING' then
    raise exception 'FIRST_ADMIN_BOOTSTRAP_REQUIRES_PROVISIONING';
  end if;

  select administration.*
  into administration_row
  from public.administrations administration
  where administration.tenant_id = requested_tenant_id
    and administration.id = requested_administration_id
    and administration.hr_group_id = requested_hr_group_id
    and administration.is_active
  for update;

  if administration_row.id is null then
    raise exception 'FIRST_ADMIN_ADMINISTRATION_SCOPE_INVALID';
  end if;

  if not exists (
    select 1
    from public.hr_groups group_row
    where group_row.tenant_id = requested_tenant_id
      and group_row.id = requested_hr_group_id
      and group_row.is_active
  ) then
    raise exception 'FIRST_ADMIN_HR_GROUP_SCOPE_INVALID';
  end if;

  select role.id
  into first_admin_role_id
  from public.management_roles role
  where role.code = 'TENANT_ADMIN'
    and role.tenant_id is null
    and role.is_system;

  if first_admin_role_id is null then
    raise exception 'FIRST_ADMIN_ROLE_NOT_CONFIGURED';
  end if;

  if exists (
    select 1
    from public.user_access access
    where access.tenant_id = requested_tenant_id
      and access.is_active
      and access.management_role_id = first_admin_role_id
  ) then
    raise exception 'FIRST_ADMIN_ALREADY_EXISTS';
  end if;

  select auth_user.id
  into existing_user_id
  from auth.users auth_user
  where lower(auth_user.email) = normalized_email
  order by auth_user.created_at
  limit 1;

  if existing_user_id is not null and exists (
    select 1
    from public.user_access access
    where access.user_id = existing_user_id
      and access.tenant_id = requested_tenant_id
      and access.is_active
  ) then
    raise exception 'FIRST_ADMIN_IDENTITY_ALREADY_LINKED';
  end if;

  select invitation.*
  into pending_invitation
  from public.user_invitations invitation
  where invitation.tenant_id = requested_tenant_id
    and invitation.status = 'PENDING'
    and invitation.purpose = 'TENANT_FIRST_ADMIN'
    and invitation.bootstrap_request_key = btrim(requested_request_key)
  order by invitation.created_at desc
  limit 1
  for update;

  if pending_invitation.id is not null then
    return jsonb_build_object(
      'invitationId', pending_invitation.id,
      'expiresAt', pending_invitation.expires_at,
      'reused', true
    );
  end if;

  if exists (
    select 1
    from public.user_invitations invitation
    where invitation.tenant_id = requested_tenant_id
      and invitation.email = normalized_email
      and invitation.status = 'PENDING'
  ) then
    raise exception 'FIRST_ADMIN_ALREADY_PENDING';
  end if;

  insert into public.user_invitations (
    tenant_id,
    administration_id,
    employee_id,
    management_role_id,
    scope_type,
    email,
    email_kind,
    purpose,
    token_hash,
    expires_at,
    invited_by_user_id,
    hr_group_id,
    bootstrap_request_key
  )
  values (
    requested_tenant_id,
    requested_administration_id,
    null,
    first_admin_role_id,
    'ADMINISTRATION',
    normalized_email,
    'BUSINESS',
    'TENANT_FIRST_ADMIN',
    requested_token_hash,
    requested_expires_at,
    auth.uid(),
    requested_hr_group_id,
    btrim(requested_request_key)
  )
  returning * into pending_invitation;

  insert into public.platform_audit_logs (
    tenant_id,
    actor_user_id,
    action,
    reason,
    after_state
  )
  values (
    requested_tenant_id,
    auth.uid(),
    'FIRST_ADMIN_INVITATION_CREATED',
    'Eerste HR-admin uitnodiging aangemaakt vanuit de Control Plane.',
    jsonb_build_object(
      'invitationId', pending_invitation.id,
      'hrGroupId', requested_hr_group_id,
      'administrationId', requested_administration_id,
      'delivery', 'DEFERRED'
    )
  );

  return jsonb_build_object(
    'invitationId', pending_invitation.id,
    'expiresAt', pending_invitation.expires_at,
    'reused', false
  );
end;
$$;

create or replace function public.revoke_platform_first_admin_invitation(
  requested_invitation_id uuid,
  requested_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public, internal_security, auth, pg_temp
as $$
declare
  invitation public.user_invitations%rowtype;
begin
  if not internal_security.is_platform_operator(array['OWNER'::public.platform_operator_role, 'OPERATOR'::public.platform_operator_role]) then
    raise exception 'PLATFORM_WRITE_ACCESS_DENIED' using errcode = '42501';
  end if;
  if length(btrim(requested_reason)) < 5 then
    raise exception 'INVITATION_REVOKE_REASON_REQUIRED' using errcode = '22023';
  end if;

  select invitation_row.*
  into invitation
  from public.user_invitations invitation_row
  where invitation_row.id = requested_invitation_id
    and invitation_row.purpose = 'TENANT_FIRST_ADMIN'
  for update;

  if invitation.id is null then
    return false;
  end if;
  if invitation.status <> 'PENDING' then
    return false;
  end if;

  update public.user_invitations invitation_row
  set status = 'REVOKED'
  where invitation_row.id = invitation.id;

  insert into public.platform_audit_logs (tenant_id, actor_user_id, action, reason, before_state, after_state)
  values (
    invitation.tenant_id,
    auth.uid(),
    'FIRST_ADMIN_INVITATION_REVOKED',
    btrim(requested_reason),
    jsonb_build_object('invitationId', invitation.id, 'status', invitation.status),
    jsonb_build_object('invitationId', invitation.id, 'status', 'REVOKED')
  );

  return true;
end;
$$;

revoke all on function public.bootstrap_platform_first_admin(uuid, uuid, uuid, text, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.revoke_platform_first_admin_invitation(uuid, text) from public, anon, authenticated;
grant execute on function public.bootstrap_platform_first_admin(uuid, uuid, uuid, text, text, timestamptz, text) to authenticated;
grant execute on function public.revoke_platform_first_admin_invitation(uuid, text) to authenticated;

commit;
