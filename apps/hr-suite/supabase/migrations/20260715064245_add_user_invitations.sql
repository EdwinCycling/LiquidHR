create extension if not exists pgcrypto with schema extensions;

create type public.invitation_email_kind as enum ('PRIVATE', 'BUSINESS');
create type public.invitation_purpose as enum ('PREBOARDING_EMPLOYEE', 'BUSINESS_USER');
create type public.invitation_status as enum ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

insert into public.permissions (code, name, category, description)
values
  ('user:read', 'Gebruikerstoegang lezen', 'Autorisatie', 'Leest gebruikers en openstaande uitnodigingen binnen de toegestane scope.'),
  ('user:invite', 'Gebruikers uitnodigen', 'Autorisatie', 'Nodigt gebruikers uit en beheert uitnodigingen binnen de toegestane scope.')
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'TENANT_ADMIN'
  and role.tenant_id is null
  and permission.code in ('user:read', 'user:invite')
on conflict do nothing;

create table public.user_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid,
  employee_id uuid,
  management_role_id uuid not null references public.management_roles(id) on delete restrict,
  scope_type public.access_scope_type not null,
  email text not null,
  email_kind public.invitation_email_kind not null,
  purpose public.invitation_purpose not null,
  token_hash text not null unique,
  status public.invitation_status not null default 'PENDING',
  expires_at timestamptz not null,
  invited_by_user_id uuid not null references auth.users(id) on delete restrict,
  accepted_by_user_id uuid references auth.users(id) on delete restrict,
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_invitations_email_normalized
    check (email = lower(btrim(email))),
  constraint user_invitations_token_hash_valid
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint user_invitations_expiry_valid
    check (expires_at > created_at),
  constraint user_invitations_scope_valid
    check (
      (scope_type = 'TENANT' and administration_id is null)
      or (scope_type = 'ADMINISTRATION' and administration_id is not null)
    ),
  constraint user_invitations_purpose_valid
    check (
      (
        purpose = 'PREBOARDING_EMPLOYEE'
        and email_kind = 'PRIVATE'
        and employee_id is not null
      )
      or (
        purpose = 'BUSINESS_USER'
        and email_kind = 'BUSINESS'
      )
    ),
  constraint user_invitations_acceptance_valid
    check (
      (
        status = 'ACCEPTED'
        and accepted_by_user_id is not null
        and accepted_at is not null
      )
      or (
        status <> 'ACCEPTED'
        and accepted_by_user_id is null
        and accepted_at is null
      )
    ),
  constraint user_invitations_administration_same_tenant_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id)
    on delete cascade,
  constraint user_invitations_employee_same_tenant_fkey
    foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id)
    on delete cascade
);

create unique index user_invitations_pending_email_key
  on public.user_invitations (tenant_id, email)
  where status = 'PENDING';
create index user_invitations_tenant_status_expiry_idx
  on public.user_invitations (tenant_id, status, expires_at);
create index user_invitations_administration_id_idx
  on public.user_invitations (administration_id)
  where administration_id is not null;
create index user_invitations_employee_id_idx
  on public.user_invitations (employee_id)
  where employee_id is not null;
create index user_invitations_management_role_id_idx
  on public.user_invitations (management_role_id);
create index user_invitations_invited_by_user_id_idx
  on public.user_invitations (invited_by_user_id);

create or replace function internal_security.validate_user_invitation_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.management_roles role
    where role.id = new.management_role_id
      and (role.tenant_id is null or role.tenant_id = new.tenant_id)
  ) then
    raise exception 'INVITATION_ROLE_SCOPE_INVALID';
  end if;

  if (select auth.uid()) is not null
     and new.invited_by_user_id <> (select auth.uid()) then
    raise exception 'INVITATION_ACTOR_INVALID';
  end if;

  return new;
end;
$$;

revoke all on function internal_security.validate_user_invitation_scope() from public, anon, authenticated;

create trigger validate_user_invitation_scope_before_write
before insert or update of tenant_id, management_role_id, invited_by_user_id
on public.user_invitations
for each row execute function internal_security.validate_user_invitation_scope();

create trigger prevent_user_invitations_tenant_change
before update of tenant_id on public.user_invitations
for each row execute function internal_security.prevent_tenant_scope_change();

create trigger set_user_invitations_updated_at
before update on public.user_invitations
for each row execute function internal_security.set_updated_at();

alter table public.user_invitations enable row level security;

create policy user_invitations_select_scoped
on public.user_invitations
for select
to authenticated
using (
  internal_security.current_user_has_permission(
    tenant_id,
    administration_id,
    'user:read'
  )
);

create policy user_invitations_insert_scoped
on public.user_invitations
for insert
to authenticated
with check (
  invited_by_user_id = (select auth.uid())
  and internal_security.current_user_has_permission(
    tenant_id,
    administration_id,
    'user:invite'
  )
);

create policy user_invitations_update_scoped
on public.user_invitations
for update
to authenticated
using (
  internal_security.current_user_has_permission(
    tenant_id,
    administration_id,
    'user:invite'
  )
)
with check (
  internal_security.current_user_has_permission(
    tenant_id,
    administration_id,
    'user:invite'
  )
);

grant select, insert, update on table public.user_invitations to authenticated;

create or replace function internal_security.accept_user_invitation(invitation_token text)
returns table (tenant_id uuid, employee_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.user_invitations%rowtype;
  current_user_id uuid := (select auth.uid());
  current_email text;
begin
  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select lower(auth_user.email)
  into current_email
  from auth.users auth_user
  where auth_user.id = current_user_id
    and auth_user.email_confirmed_at is not null;

  if current_email is null then
    raise exception 'VERIFIED_EMAIL_REQUIRED';
  end if;

  select invitation_row.*
  into invitation
  from public.user_invitations invitation_row
  where invitation_row.token_hash = encode(
    extensions.digest(invitation_token, 'sha256'),
    'hex'
  )
  for update;

  if not found or invitation.status <> 'PENDING' then
    raise exception 'INVITATION_INVALID';
  end if;

  if invitation.expires_at <= now() then
    raise exception 'INVITATION_EXPIRED';
  end if;

  if invitation.email <> current_email then
    raise exception 'INVITATION_EMAIL_MISMATCH';
  end if;

  if invitation.employee_id is not null then
    if exists (
      select 1
      from public.employees employee
      where employee.id = invitation.employee_id
        and employee.tenant_id = invitation.tenant_id
        and employee.auth_user_id is not null
        and employee.auth_user_id <> current_user_id
    ) then
      raise exception 'EMPLOYEE_ALREADY_LINKED';
    end if;

    update public.employees employee
    set auth_user_id = current_user_id
    where employee.id = invitation.employee_id
      and employee.tenant_id = invitation.tenant_id
      and (
        employee.auth_user_id is null
        or employee.auth_user_id = current_user_id
      );

    if not found then
      raise exception 'INVITATION_EMPLOYEE_INVALID';
    end if;
  end if;

  insert into public.user_access (
    user_id,
    tenant_id,
    management_role_id,
    scope_type,
    administration_id
  )
  values (
    current_user_id,
    invitation.tenant_id,
    invitation.management_role_id,
    invitation.scope_type,
    invitation.administration_id
  )
  on conflict do nothing;

  update public.user_invitations invitation_row
  set status = 'ACCEPTED',
      accepted_by_user_id = current_user_id,
      accepted_at = timezone('utc', now())
  where invitation_row.id = invitation.id;

  return query
  select invitation.tenant_id, invitation.employee_id;
end;
$$;

revoke all on function internal_security.accept_user_invitation(text) from public, anon, authenticated;

create or replace function public.accept_user_invitation(invitation_token text)
returns table (tenant_id uuid, employee_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select result.tenant_id, result.employee_id
  from internal_security.accept_user_invitation(invitation_token) result;
end;
$$;

revoke all on function public.accept_user_invitation(text) from public, anon;
grant execute on function public.accept_user_invitation(text) to authenticated;
