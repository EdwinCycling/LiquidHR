begin;

-- Stap 4: de actieve HR-groep is de primaire servercontext. Alleen de aparte
-- Control Plane mag nieuwe groepen aanmaken; een HR-admin beheert een
-- bestaande groep en kan daarbinnen administraties toevoegen.
insert into public.permissions (code, name, category, description)
values
  ('hr-group:manage', 'HR-groepinrichting beheren', 'HR-groepen', 'Beheert naam, omschrijving en administraties binnen een toegestane HR-groep.'),
  ('hr-group:create', 'HR-groepen aanmaken', 'HR-groepen', 'Maakt HR-groepen aan vanuit de aparte LiquidHR Control Plane.')
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.tenant_id is null
  and role.code = 'TENANT_ADMIN'
  and permission.code in ('hr-group:read', 'hr-group:manage')
on conflict do nothing;

drop policy if exists hr_groups_insert_authorized on public.hr_groups;
drop policy if exists hr_groups_update_authorized on public.hr_groups;
drop policy if exists hr_groups_delete_authorized on public.hr_groups;

create policy hr_groups_insert_authorized
on public.hr_groups for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'hr-group:create')));

create policy hr_groups_update_authorized
on public.hr_groups for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, id, 'hr-group:manage')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, id, 'hr-group:manage')));

create or replace function internal_security.prevent_hr_group_identity_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.code is distinct from old.code then
    raise exception 'HR_GROUP_IDENTITY_IMMUTABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_hr_group_identity_change on public.hr_groups;
create trigger prevent_hr_group_identity_change
before update of id, tenant_id, code on public.hr_groups
for each row execute function internal_security.prevent_hr_group_identity_change();

revoke all on function internal_security.prevent_hr_group_identity_change() from public, anon, authenticated;

create or replace function internal_security.prevent_hr_group_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'HR_GROUP_DELETE_FORBIDDEN' using errcode = 'P0001';
  return old;
end;
$$;

drop trigger if exists prevent_hr_group_delete on public.hr_groups;
create trigger prevent_hr_group_delete
before delete on public.hr_groups
for each row execute function internal_security.prevent_hr_group_delete();

revoke all on function internal_security.prevent_hr_group_delete() from public, anon, authenticated;

-- Nieuwe gebruikers en nieuw aangemaakte groepen krijgen dezelfde expliciete
-- groepsrelatie als hun bestaande tenant- of administratieaccess.
create or replace function internal_security.sync_user_hr_group_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.user_hr_group_access group_access
    set is_active = exists (
      select 1
      from public.user_access access
      left join public.administrations administration
        on administration.tenant_id = access.tenant_id
       and administration.id = access.administration_id
       and administration.is_active
      where access.user_id = group_access.user_id
        and access.tenant_id = group_access.tenant_id
        and access.management_role_id = group_access.management_role_id
        and access.is_active
        and (
          access.scope_type = 'TENANT'
          or administration.hr_group_id = group_access.hr_group_id
        )
    )
    where group_access.user_id = old.user_id
      and group_access.tenant_id = old.tenant_id
      and group_access.management_role_id = old.management_role_id;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    update public.user_hr_group_access group_access
    set is_active = exists (
      select 1
      from public.user_access access
      left join public.administrations administration
        on administration.tenant_id = access.tenant_id
       and administration.id = access.administration_id
       and administration.is_active
      where access.user_id = group_access.user_id
        and access.tenant_id = group_access.tenant_id
        and access.management_role_id = group_access.management_role_id
        and access.is_active
        and (
          access.scope_type = 'TENANT'
          or administration.hr_group_id = group_access.hr_group_id
        )
    )
    where (group_access.user_id, group_access.tenant_id, group_access.management_role_id) in (
      (old.user_id, old.tenant_id, old.management_role_id),
      (new.user_id, new.tenant_id, new.management_role_id)
    );
  end if;

  update public.user_hr_group_access group_access
  set is_active = exists (
    select 1
    from public.user_access access
    left join public.administrations administration
      on administration.tenant_id = access.tenant_id
     and administration.id = access.administration_id
     and administration.is_active
    where access.user_id = group_access.user_id
      and access.tenant_id = group_access.tenant_id
      and access.management_role_id = group_access.management_role_id
      and access.is_active
      and (
        access.scope_type = 'TENANT'
        or administration.hr_group_id = group_access.hr_group_id
      )
  )
  where group_access.user_id = new.user_id
    and group_access.tenant_id = new.tenant_id
    and group_access.management_role_id = new.management_role_id;

  insert into public.user_hr_group_access (user_id, tenant_id, hr_group_id, management_role_id)
  select distinct
    access.user_id,
    access.tenant_id,
    group_row.id,
    access.management_role_id
  from public.user_access access
  join public.hr_groups group_row
    on group_row.tenant_id = access.tenant_id
   and group_row.is_active
  left join public.administrations administration
    on administration.tenant_id = access.tenant_id
   and administration.id = access.administration_id
   and administration.is_active
  where access.user_id = new.user_id
    and access.tenant_id = new.tenant_id
    and access.management_role_id = new.management_role_id
    and access.is_active
    and (
      access.scope_type = 'TENANT'
      or administration.hr_group_id = group_row.id
    )
  on conflict (user_id, tenant_id, hr_group_id, management_role_id) do update
  set is_active = true,
      updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists sync_user_hr_group_access_after_user_access on public.user_access;
create trigger sync_user_hr_group_access_after_user_access
after insert or delete or update of is_active, tenant_id, scope_type, administration_id, management_role_id
on public.user_access
for each row execute function internal_security.sync_user_hr_group_access();

revoke all on function internal_security.sync_user_hr_group_access() from public, anon, authenticated;

create or replace function internal_security.current_user_has_hr_group_permission(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.user_hr_group_access access
      join public.management_roles role
        on role.id = access.management_role_id
      join public.role_permissions role_permission
        on role_permission.management_role_id = role.id
      join public.permissions permission
        on permission.id = role_permission.permission_id
      join public.hr_groups group_row
        on group_row.tenant_id = access.tenant_id
       and group_row.id = access.hr_group_id
       and group_row.is_active
      where access.user_id = (select auth.uid())
        and access.tenant_id = requested_tenant_id
        and access.hr_group_id = requested_hr_group_id
        and access.is_active
        and permission.code = requested_permission_code
        and (role.tenant_id is null or role.tenant_id = requested_tenant_id)
    );
$$;

revoke all on function internal_security.current_user_has_hr_group_permission(uuid, uuid, text) from public, anon, authenticated;
grant execute on function internal_security.current_user_has_hr_group_permission(uuid, uuid, text) to authenticated;

create or replace function internal_security.populate_administration_scope_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  default_group_id uuid;
begin
  if new.administration_number is null or btrim(new.administration_number) = '' then
    new.administration_number := btrim(new.code);
  end if;

  if new.hr_group_id is null then
    select group_row.id
    into default_group_id
    from public.hr_groups group_row
    where group_row.tenant_id = new.tenant_id
      and group_row.code = 'DEFAULT'
      and group_row.is_active
    limit 1;

    if default_group_id is null then
      insert into public.hr_groups (tenant_id, code, name, description, created_by_user_id, updated_by_user_id)
      values (
        new.tenant_id,
        'DEFAULT',
        btrim(new.name) || ' HR-groep',
        'Automatisch aangemaakte startgroep voor een nieuwe tenant.',
        (select auth.uid()),
        (select auth.uid())
      )
      returning id into default_group_id;
    end if;
    new.hr_group_id := default_group_id;
  end if;

  if not exists (
    select 1
    from public.hr_groups group_row
    where group_row.tenant_id = new.tenant_id
      and group_row.id = new.hr_group_id
      and group_row.is_active
  ) then
    raise exception 'ADMINISTRATION_HR_GROUP_INVALID' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists populate_administration_scope_defaults_before_insert on public.administrations;
create trigger populate_administration_scope_defaults_before_insert
before insert on public.administrations
for each row execute function internal_security.populate_administration_scope_defaults();

revoke all on function internal_security.populate_administration_scope_defaults() from public, anon, authenticated;

drop policy if exists administrations_insert_hr_group_manager on public.administrations;
create policy administrations_insert_hr_group_manager
on public.administrations for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'hr-group:manage')));

grant insert on public.administrations to authenticated;

create or replace function internal_security.get_platform_hr_groups(
  requested_tenant_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, internal_security, auth, pg_temp
as $$
declare
  result jsonb;
begin
  if not internal_security.is_platform_operator() then
    raise exception 'PLATFORM_ACCESS_DENIED' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', group_row.id,
    'tenantId', group_row.tenant_id,
    'code', group_row.code,
    'name', group_row.name,
    'description', group_row.description,
    'isActive', group_row.is_active,
    'administrations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', administration.id,
        'code', administration.code,
        'name', administration.name,
        'administrationNumber', administration.administration_number,
        'isActive', administration.is_active
      ) order by administration.name)
      from public.administrations administration
      where administration.tenant_id = group_row.tenant_id
        and administration.hr_group_id = group_row.id
    ), '[]'::jsonb)
  ) order by group_row.name), '[]'::jsonb)
  into result
  from public.hr_groups group_row
  where group_row.tenant_id = requested_tenant_id;

  return result;
end;
$$;

create or replace function internal_security.create_platform_hr_group(
  requested_tenant_id uuid,
  requested_code text,
  requested_name text,
  requested_description text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, internal_security, auth, pg_temp
as $$
declare
  new_group_id uuid;
begin
  if not internal_security.is_platform_operator(array['OWNER'::public.platform_operator_role, 'OPERATOR'::public.platform_operator_role]) then
    raise exception 'PLATFORM_WRITE_ACCESS_DENIED' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tenants tenant where tenant.id = requested_tenant_id) then
    raise exception 'TENANT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if btrim(requested_code) = '' or btrim(requested_name) = '' then
    raise exception 'INVALID_HR_GROUP_INPUT' using errcode = '22023';
  end if;
  if length(btrim(requested_code)) > 80 or length(btrim(requested_name)) > 160 or coalesce(length(requested_description), 0) > 1000 then
    raise exception 'INVALID_HR_GROUP_INPUT' using errcode = '22023';
  end if;

  insert into public.hr_groups (tenant_id, code, name, description, created_by_user_id, updated_by_user_id)
  values (requested_tenant_id, upper(btrim(requested_code)), btrim(requested_name), nullif(btrim(requested_description), ''), auth.uid(), auth.uid())
  returning id into new_group_id;

  insert into public.user_hr_group_access (user_id, tenant_id, hr_group_id, management_role_id)
  select access.user_id, access.tenant_id, new_group_id, access.management_role_id
  from public.user_access access
  where access.tenant_id = requested_tenant_id
    and access.scope_type = 'TENANT'
    and access.is_active
  on conflict (user_id, tenant_id, hr_group_id, management_role_id) do update
  set is_active = true,
      updated_at = timezone('utc', now());

  insert into public.platform_audit_logs (tenant_id, actor_user_id, action, reason, after_state)
  values (
    requested_tenant_id,
    auth.uid(),
    'HR_GROUP_CREATED',
    'HR-groep aangemaakt vanuit de Control Plane.',
    jsonb_build_object('id', new_group_id, 'code', upper(btrim(requested_code)), 'name', btrim(requested_name))
  );

  return new_group_id;
end;
$$;

alter function internal_security.get_platform_hr_groups(uuid) set schema internal_security;
alter function internal_security.create_platform_hr_group(uuid, text, text, text) set schema internal_security;
revoke all on function internal_security.get_platform_hr_groups(uuid) from public, anon, authenticated;
revoke all on function internal_security.create_platform_hr_group(uuid, text, text, text) from public, anon, authenticated;
grant execute on function internal_security.get_platform_hr_groups(uuid) to authenticated;
grant execute on function internal_security.create_platform_hr_group(uuid, text, text, text) to authenticated;

create function public.get_platform_hr_groups(requested_tenant_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public, internal_security, pg_temp
as $$
  select internal_security.get_platform_hr_groups(requested_tenant_id);
$$;

create function public.create_platform_hr_group(
  requested_tenant_id uuid,
  requested_code text,
  requested_name text,
  requested_description text default null
)
returns uuid
language sql
volatile
security invoker
set search_path = pg_catalog, public, internal_security, pg_temp
as $$
  select internal_security.create_platform_hr_group(
    requested_tenant_id,
    requested_code,
    requested_name,
    requested_description
  );
$$;

revoke all on function public.get_platform_hr_groups(uuid) from public, anon, authenticated;
revoke all on function public.create_platform_hr_group(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.get_platform_hr_groups(uuid) to authenticated;
grant execute on function public.create_platform_hr_group(uuid, text, text, text) to authenticated;

commit;
