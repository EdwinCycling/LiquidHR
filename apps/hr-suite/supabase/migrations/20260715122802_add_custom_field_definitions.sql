create type public.custom_field_entity_type as enum ('EMPLOYEE');
create type public.custom_field_type as enum (
  'TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'AUTO_INCREMENT'
);
create type public.custom_field_audience_access as enum ('HIDDEN', 'READ', 'WRITE');

create table public.custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  entity_type public.custom_field_entity_type not null default 'EMPLOYEE',
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,62}$'),
  label_nl text not null check (length(trim(label_nl)) between 1 and 120),
  label_en text not null check (length(trim(label_en)) between 1 and 120),
  description_nl text,
  description_en text,
  field_type public.custom_field_type not null,
  is_required boolean not null default false,
  hr_access public.custom_field_audience_access not null default 'WRITE',
  manager_access public.custom_field_audience_access not null default 'HIDDEN',
  employee_self_access public.custom_field_audience_access not null default 'HIDDEN',
  validation_rules jsonb not null default '{}'::jsonb check (jsonb_typeof(validation_rules) = 'object'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint custom_field_definitions_administration_scope_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete restrict,
  constraint custom_field_definitions_scope_key_key
    unique (tenant_id, administration_id, entity_type, key),
  constraint custom_field_definitions_scope_id_key
    unique (tenant_id, administration_id, id)
);

create table public.custom_field_select_options (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  definition_id uuid not null,
  value text not null check (length(trim(value)) between 1 and 120),
  label_nl text not null check (length(trim(label_nl)) between 1 and 120),
  label_en text not null check (length(trim(label_en)) between 1 and 120),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint custom_field_select_options_definition_scope_fkey
    foreign key (tenant_id, administration_id, definition_id)
    references public.custom_field_definitions(tenant_id, administration_id, id) on delete cascade,
  constraint custom_field_select_options_definition_value_key unique (definition_id, value)
);

create table public.custom_field_counters (
  definition_id uuid primary key references public.custom_field_definitions(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  next_value bigint not null default 1 check (next_value > 0),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint custom_field_counters_definition_scope_fkey
    foreign key (tenant_id, administration_id, definition_id)
    references public.custom_field_definitions(tenant_id, administration_id, id) on delete cascade
);

create index custom_field_definitions_active_idx
  on public.custom_field_definitions (tenant_id, administration_id, entity_type, sort_order, key)
  where deleted_at is null and is_active;
create index custom_field_select_options_active_idx
  on public.custom_field_select_options (definition_id, sort_order, value)
  where is_active;

insert into public.permissions (code, name, category, description)
values
  ('custom-field-values:read', 'Vrije veldwaarden bekijken', 'Medewerkers', 'Bekijkt vrije veldwaarden binnen de geldige scope.'),
  ('custom-field-values:write', 'Vrije veldwaarden wijzigen', 'Medewerkers', 'Wijzigt vrije veldwaarden binnen de geldige scope.'),
  ('self:custom-field-values:read', 'Eigen vrije veldwaarden bekijken', 'Medewerkers', 'Bekijkt eigen vrije veldwaarden als het veld dit toestaat.'),
  ('self:custom-field-values:write', 'Eigen vrije veldwaarden wijzigen', 'Medewerkers', 'Wijzigt eigen vrije veldwaarden als het veld dit toestaat.')
on conflict (code) do update set
  name = excluded.name, category = excluded.category, description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'TENANT_ADMIN' and role.tenant_id is null
  and permission.code in ('custom-fields:write', 'custom-field-values:read', 'custom-field-values:write')
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'DIRECT_MANAGER' and role.tenant_id is null
  and permission.code = 'custom-field-values:read'
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'EMPLOYEE' and role.tenant_id is null
  and permission.code in ('self:custom-field-values:read', 'self:custom-field-values:write')
on conflict do nothing;

create function internal_security.guard_custom_field_definition_key()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if old.key is distinct from new.key
    or old.tenant_id is distinct from new.tenant_id
    or old.administration_id is distinct from new.administration_id
    or old.entity_type is distinct from new.entity_type then
    raise exception 'CUSTOM_FIELD_TECHNICAL_IDENTITY_IMMUTABLE' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function internal_security.guard_custom_field_definition_key() from public, anon, authenticated;

create trigger guard_custom_field_definition_key
before update on public.custom_field_definitions
for each row execute function internal_security.guard_custom_field_definition_key();
create trigger set_custom_field_definitions_updated_at
before update on public.custom_field_definitions
for each row execute function internal_security.set_updated_at();
create trigger set_custom_field_select_options_updated_at
before update on public.custom_field_select_options
for each row execute function internal_security.set_updated_at();
create trigger audit_custom_field_definitions
after insert or update or delete on public.custom_field_definitions
for each row execute function internal_security.audit_hr_change('custom_field_definition');
create trigger audit_custom_field_select_options
after insert or update or delete on public.custom_field_select_options
for each row execute function internal_security.audit_hr_change('custom_field_select_option');

alter table public.custom_field_definitions enable row level security;
alter table public.custom_field_select_options enable row level security;
alter table public.custom_field_counters enable row level security;

create policy custom_field_definitions_read_scoped
on public.custom_field_definitions for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, administration_id, 'custom-field-values:read'))
  or (select internal_security.current_user_has_permission(tenant_id, administration_id, 'custom-fields:write'))
);
create policy custom_field_definitions_write_scoped
on public.custom_field_definitions for all to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'custom-fields:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'custom-fields:write')));

create policy custom_field_select_options_read_scoped
on public.custom_field_select_options for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, administration_id, 'custom-field-values:read'))
  or (select internal_security.current_user_has_permission(tenant_id, administration_id, 'custom-fields:write'))
);
create policy custom_field_select_options_write_scoped
on public.custom_field_select_options for all to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'custom-fields:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'custom-fields:write')));

create policy custom_field_counters_read_scoped
on public.custom_field_counters for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'custom-field-values:write')));
create policy custom_field_counters_insert_scoped
on public.custom_field_counters for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'custom-field-values:write')));
create policy custom_field_counters_update_scoped
on public.custom_field_counters for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'custom-field-values:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'custom-field-values:write')));

create function public.next_custom_field_value(p_definition_id uuid)
returns bigint
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  definition public.custom_field_definitions%rowtype;
  reserved_value bigint;
begin
  select * into definition
  from public.custom_field_definitions
  where id = p_definition_id and deleted_at is null and is_active;

  if definition.id is null or definition.field_type <> 'AUTO_INCREMENT' then
    raise exception 'CUSTOM_FIELD_NOT_AUTO_INCREMENT' using errcode = '22023';
  end if;
  if current_user not in ('postgres', 'service_role')
    and not internal_security.current_user_has_permission(
      definition.tenant_id, definition.administration_id, 'custom-field-values:write'
    ) then
    raise exception 'CUSTOM_FIELD_VALUE_FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.custom_field_counters (
    definition_id, tenant_id, administration_id, next_value
  ) values (
    definition.id, definition.tenant_id, definition.administration_id, 2
  )
  on conflict (definition_id) do update
    set next_value = public.custom_field_counters.next_value + 1,
        updated_at = timezone('utc', now())
  returning next_value - 1 into reserved_value;

  return reserved_value;
end;
$$;

revoke all on function public.next_custom_field_value(uuid) from public, anon;
grant execute on function public.next_custom_field_value(uuid) to authenticated, service_role;

grant select, insert, update on public.custom_field_definitions to authenticated;
grant select, insert, update, delete on public.custom_field_select_options to authenticated;
grant select, insert, update on public.custom_field_counters to authenticated;
