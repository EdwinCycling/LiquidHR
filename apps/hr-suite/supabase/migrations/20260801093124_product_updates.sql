create table public.product_updates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null default 'IMPROVEMENT',
  title text not null check (char_length(btrim(title)) between 1 and 180),
  summary text not null check (char_length(btrim(summary)) between 1 and 320),
  content text not null check (char_length(btrim(content)) between 1 and 10000),
  starts_at timestamptz not null default timezone('utc', now()),
  ends_at timestamptz,
  display_channels text[] not null default array['GIFT_WINDOW']::text[],
  audience_roles text[] not null default array['EMPLOYEE']::text[],
  is_active boolean not null default true,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint product_updates_kind_valid check (kind in ('NEW_FEATURE', 'IMPROVEMENT')),
  constraint product_updates_dates_valid check (ends_at is null or ends_at >= starts_at),
  constraint product_updates_channels_valid check (
    cardinality(display_channels) > 0
    and display_channels <@ array['GIFT_WINDOW', 'LOGIN_POPUP', 'TOP_BANNER']::text[]
  ),
  constraint product_updates_roles_valid check (
    cardinality(audience_roles) > 0
    and audience_roles <@ array['TENANT_ADMIN', 'DIRECT_MANAGER', 'EMPLOYEE']::text[]
  )
);

create table public.product_update_user_state (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_seen_at timestamptz,
  last_seen_update_id uuid references public.product_updates(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, user_id)
);

create index product_updates_visible_idx
  on public.product_updates (tenant_id, starts_at desc, ends_at)
  where is_active = true;
create index product_updates_created_by_idx
  on public.product_updates (created_by_user_id);
create index product_update_user_state_user_idx
  on public.product_update_user_state (user_id, tenant_id);

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
      and access.tenant_id = requested_tenant_id
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
      and actor.tenant_id = requested_tenant_id
      and actor.deleted_at is null
      and assignment.tenant_id = requested_tenant_id
      and assignment.effective_from <= current_date
      and (assignment.effective_to is null or assignment.effective_to >= current_date)
      and management_role.is_active
      and management_role.deleted_at is null
      and management_role.code = any(requested_role_codes)
  );
$$;

revoke all on function internal_security.current_user_has_audience_role(uuid, text[]) from public;
grant execute on function internal_security.current_user_has_audience_role(uuid, text[]) to authenticated;

create trigger set_product_updates_updated_at
before update on public.product_updates
for each row execute function internal_security.set_updated_at();

create trigger set_product_update_user_state_updated_at
before update on public.product_update_user_state
for each row execute function internal_security.set_updated_at();

alter table public.product_updates enable row level security;
alter table public.product_update_user_state enable row level security;

create policy product_updates_select_scoped
on public.product_updates for select to authenticated
using (
  internal_security.has_tenant_access(tenant_id)
  and (
    internal_security.current_user_has_permission(tenant_id, null, 'product-updates:write')
    or (
      is_active
      and starts_at <= timezone('utc', now())
      and (ends_at is null or ends_at >= timezone('utc', now()))
      and internal_security.current_user_has_audience_role(tenant_id, audience_roles)
    )
  )
);

create policy product_updates_insert_scoped
on public.product_updates for insert to authenticated
with check (internal_security.current_user_has_permission(tenant_id, null, 'product-updates:write'));

create policy product_updates_update_scoped
on public.product_updates for update to authenticated
using (internal_security.current_user_has_permission(tenant_id, null, 'product-updates:write'))
with check (internal_security.current_user_has_permission(tenant_id, null, 'product-updates:write'));

create policy product_updates_delete_scoped
on public.product_updates for delete to authenticated
using (internal_security.current_user_has_permission(tenant_id, null, 'product-updates:write'));

create policy product_update_user_state_select_self
on public.product_update_user_state for select to authenticated
using (user_id = (select auth.uid()) and internal_security.has_tenant_access(tenant_id));

create policy product_update_user_state_insert_self
on public.product_update_user_state for insert to authenticated
with check (user_id = (select auth.uid()) and internal_security.has_tenant_access(tenant_id));

create policy product_update_user_state_update_self
on public.product_update_user_state for update to authenticated
using (user_id = (select auth.uid()) and internal_security.has_tenant_access(tenant_id))
with check (user_id = (select auth.uid()) and internal_security.has_tenant_access(tenant_id));

grant select, insert, update, delete on table public.product_updates to authenticated;
grant select, insert, update on table public.product_update_user_state to authenticated;

insert into public.permissions (code, name, category, description)
values (
  'product-updates:write',
  'Productupdates beheren',
  'settings',
  'Beheert nieuwe functionaliteiten en verbeteringen die in Liquid HR worden getoond.'
)
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select management_role.id, permission.id
from public.management_roles management_role
join public.permissions permission on permission.code = 'product-updates:write'
where management_role.code = 'TENANT_ADMIN'
  and management_role.is_active
  and management_role.deleted_at is null
on conflict do nothing;


