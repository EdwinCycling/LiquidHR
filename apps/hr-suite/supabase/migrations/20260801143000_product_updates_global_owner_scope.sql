-- Productupdates hebben twee beheerscopes:
-- - tenant_id is null: bericht van de Liquid HR-eigenaar voor alle klanten;
-- - tenant_id gevuld: bericht van de HR Admin voor de eigen tenant.

alter table public.product_updates
  alter column tenant_id drop not null,
  alter column starts_at drop not null;

alter table public.product_updates
  drop constraint product_updates_dates_valid;

alter table public.product_updates
  add constraint product_updates_dates_valid check (
    starts_at is null
    or ends_at is null
    or ends_at >= starts_at
  );

create or replace function internal_security.current_user_has_global_permission(
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
      from public.user_access access
      join public.management_roles role on role.id = access.management_role_id
      join public.role_permissions role_permission
        on role_permission.management_role_id = role.id
      join public.permissions permission on permission.id = role_permission.permission_id
      where access.user_id = (select auth.uid())
        and access.is_active
        and role.tenant_id is null
        and role.is_active
        and role.deleted_at is null
        and permission.code = requested_permission_code
    );
$$;

create or replace function internal_security.current_user_has_any_permission(
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
      from public.user_access access
      join public.management_roles role on role.id = access.management_role_id
      join public.role_permissions role_permission
        on role_permission.management_role_id = role.id
      join public.permissions permission on permission.id = role_permission.permission_id
      where access.user_id = (select auth.uid())
        and access.is_active
        and role.is_active
        and role.deleted_at is null
        and permission.code = requested_permission_code
    );
$$;

revoke all on function internal_security.current_user_has_global_permission(text) from public, anon, authenticated;
revoke all on function internal_security.current_user_has_any_permission(text) from public, anon, authenticated;
grant execute on function internal_security.current_user_has_global_permission(text) to authenticated;
grant execute on function internal_security.current_user_has_any_permission(text) to authenticated;

create or replace function internal_security.current_user_has_audience_role(
  requested_tenant_id uuid,
  requested_role_codes text[]
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.user_access access
    join public.management_roles management_role
      on management_role.id = access.management_role_id
    where access.user_id = (select auth.uid())
      and (requested_tenant_id is null or access.tenant_id = requested_tenant_id)
      and access.is_active
      and management_role.is_active
      and management_role.deleted_at is null
      and management_role.code = any(requested_role_codes)
  )
  or exists (
    select 1
    from public.department_management assignment
    join public.management_roles management_role
      on management_role.id = assignment.management_role_id
    join public.employees actor
      on actor.id = assignment.employee_id
    where actor.auth_user_id = (select auth.uid())
      and (requested_tenant_id is null or actor.tenant_id = requested_tenant_id)
      and actor.deleted_at is null
      and (requested_tenant_id is null or assignment.tenant_id = requested_tenant_id)
      and assignment.effective_from <= current_date
      and (assignment.effective_to is null or assignment.effective_to >= current_date)
      and management_role.is_active
      and management_role.deleted_at is null
      and management_role.code = any(requested_role_codes)
  );
$$;

drop policy product_updates_select_scoped on public.product_updates;
drop policy product_updates_insert_scoped on public.product_updates;
drop policy product_updates_update_scoped on public.product_updates;
drop policy product_updates_delete_scoped on public.product_updates;

create policy product_updates_select_scoped
on public.product_updates for select to authenticated
using (
  (
    tenant_id is null
    and (
      internal_security.current_user_has_global_permission('product-updates:global-write')
      or internal_security.current_user_has_any_permission('product-updates:write')
      or (
        is_active
        and (starts_at is null or starts_at <= timezone('utc', now()))
        and (ends_at is null or ends_at >= timezone('utc', now()))
        and internal_security.current_user_has_audience_role(null, audience_roles)
      )
    )
  )
  or (
    tenant_id is not null
    and internal_security.has_tenant_access(tenant_id)
    and (
      internal_security.current_user_has_permission(tenant_id, null, 'product-updates:write')
      or (
        is_active
        and (starts_at is null or starts_at <= timezone('utc', now()))
        and (ends_at is null or ends_at >= timezone('utc', now()))
        and internal_security.current_user_has_audience_role(tenant_id, audience_roles)
      )
    )
  )
);

create policy product_updates_insert_scoped
on public.product_updates for insert to authenticated
with check (
  (
    tenant_id is null
    and internal_security.current_user_has_global_permission('product-updates:global-write')
  )
  or (
    tenant_id is not null
    and internal_security.current_user_has_permission(tenant_id, null, 'product-updates:write')
  )
);

create policy product_updates_update_scoped
on public.product_updates for update to authenticated
using (
  (
    tenant_id is null
    and internal_security.current_user_has_global_permission('product-updates:global-write')
  )
  or (
    tenant_id is not null
    and internal_security.current_user_has_permission(tenant_id, null, 'product-updates:write')
  )
)
with check (
  (
    tenant_id is null
    and internal_security.current_user_has_global_permission('product-updates:global-write')
  )
  or (
    tenant_id is not null
    and internal_security.current_user_has_permission(tenant_id, null, 'product-updates:write')
  )
);

create policy product_updates_delete_scoped
on public.product_updates for delete to authenticated
using (
  (
    tenant_id is null
    and internal_security.current_user_has_global_permission('product-updates:global-write')
  )
  or (
    tenant_id is not null
    and internal_security.current_user_has_permission(tenant_id, null, 'product-updates:write')
  )
);

insert into public.permissions (code, name, category, description)
values (
  'product-updates:global-write',
  'Globale productupdates beheren',
  'settings',
  'Maakt productupdates voor alle klanten aan en beheert alleen de globale eigenaarberichten.'
)
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select management_role.id, permission.id
from public.management_roles management_role
join public.permissions permission on permission.code = 'product-updates:global-write'
where management_role.code = 'TENANT_ADMIN'
  and management_role.tenant_id is null
  and management_role.is_active
  and management_role.deleted_at is null
on conflict do nothing;
