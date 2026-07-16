drop function if exists public.accept_user_invitation(text);
drop function if exists internal_security.accept_user_invitation(text);

drop index if exists public.user_invitations_administration_id_idx;
drop index if exists public.user_invitations_employee_id_idx;

create index user_invitations_tenant_administration_idx
  on public.user_invitations (tenant_id, administration_id);
create index user_invitations_tenant_employee_idx
  on public.user_invitations (tenant_id, employee_id);
create index user_invitations_accepted_by_user_id_idx
  on public.user_invitations (accepted_by_user_id);

create or replace function public.accept_user_invitation(
  invitation_token text,
  accepted_user_id uuid,
  accepted_email text
)
returns table (tenant_id uuid, employee_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.user_invitations%rowtype;
  verified_email text;
begin
  if accepted_user_id is null or nullif(btrim(accepted_email), '') is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select lower(auth_user.email)
  into verified_email
  from auth.users auth_user
  where auth_user.id = accepted_user_id
    and auth_user.email_confirmed_at is not null;

  if verified_email is null then
    raise exception 'VERIFIED_EMAIL_REQUIRED';
  end if;

  if verified_email <> lower(btrim(accepted_email)) then
    raise exception 'VERIFIED_EMAIL_MISMATCH';
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

  if invitation.email <> verified_email then
    raise exception 'INVITATION_EMAIL_MISMATCH';
  end if;

  if invitation.employee_id is not null then
    if exists (
      select 1
      from public.employees employee
      where employee.id = invitation.employee_id
        and employee.tenant_id = invitation.tenant_id
        and employee.auth_user_id is not null
        and employee.auth_user_id <> accepted_user_id
    ) then
      raise exception 'EMPLOYEE_ALREADY_LINKED';
    end if;

    update public.employees employee
    set auth_user_id = accepted_user_id
    where employee.id = invitation.employee_id
      and employee.tenant_id = invitation.tenant_id
      and (
        employee.auth_user_id is null
        or employee.auth_user_id = accepted_user_id
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
    accepted_user_id,
    invitation.tenant_id,
    invitation.management_role_id,
    invitation.scope_type,
    invitation.administration_id
  )
  on conflict do nothing;

  update public.user_invitations invitation_row
  set status = 'ACCEPTED',
      accepted_by_user_id = accepted_user_id,
      accepted_at = timezone('utc', now())
  where invitation_row.id = invitation.id;

  return query
  select invitation.tenant_id, invitation.employee_id;
end;
$$;

revoke all on function public.accept_user_invitation(text, uuid, text)
from public, anon, authenticated;
grant execute on function public.accept_user_invitation(text, uuid, text)
to service_role;
