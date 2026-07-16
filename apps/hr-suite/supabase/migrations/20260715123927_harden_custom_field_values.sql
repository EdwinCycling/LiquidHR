alter table public.custom_field_definitions
  add constraint custom_field_definitions_scope_id_key_key
  unique (tenant_id, administration_id, id, key);

create table public.employee_custom_field_values (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  employee_id uuid not null,
  definition_id uuid not null,
  field_key text not null,
  value jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employee_custom_field_values_employee_scope_fkey
    foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id) on delete cascade,
  constraint employee_custom_field_values_definition_scope_fkey
    foreign key (tenant_id, administration_id, definition_id, field_key)
    references public.custom_field_definitions(tenant_id, administration_id, id, key) on delete restrict,
  constraint employee_custom_field_values_unique
    unique (tenant_id, administration_id, employee_id, definition_id)
);

create index employee_custom_field_values_employee_idx
  on public.employee_custom_field_values (tenant_id, administration_id, employee_id);
create index custom_field_counters_scope_idx
  on public.custom_field_counters (tenant_id, administration_id, definition_id);
create index custom_field_select_options_scope_idx
  on public.custom_field_select_options (tenant_id, administration_id, definition_id);

create function internal_security.custom_field_value_can_read(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_employee_id uuid,
  requested_definition_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.custom_field_definitions definition
    where definition.id = requested_definition_id
      and definition.tenant_id = requested_tenant_id
      and definition.administration_id = requested_administration_id
      and definition.is_active and definition.deleted_at is null
      and internal_security.employee_is_in_administration(
        requested_tenant_id, requested_administration_id, requested_employee_id
      )
      and (
        (
          requested_employee_id = internal_security.current_employee_id()
          and definition.employee_self_access <> 'HIDDEN'
          and internal_security.current_employee_has_permission('self:custom-field-values:read')
        )
        or (
          definition.hr_access <> 'HIDDEN'
          and internal_security.current_user_has_permission(
            requested_tenant_id, requested_administration_id, 'employee:write'
          )
          and internal_security.current_user_has_permission(
            requested_tenant_id, requested_administration_id, 'custom-field-values:read'
          )
        )
        or (
          definition.manager_access <> 'HIDDEN'
          and internal_security.can_manage_employee(requested_employee_id, 'employee:read')
          and internal_security.current_user_has_permission(
            requested_tenant_id, requested_administration_id, 'custom-field-values:read'
          )
        )
      )
  );
$$;

create function internal_security.custom_field_value_can_write(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_employee_id uuid,
  requested_definition_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.custom_field_definitions definition
    where definition.id = requested_definition_id
      and definition.tenant_id = requested_tenant_id
      and definition.administration_id = requested_administration_id
      and definition.is_active and definition.deleted_at is null
      and internal_security.employee_is_in_administration(
        requested_tenant_id, requested_administration_id, requested_employee_id
      )
      and (
        (
          requested_employee_id = internal_security.current_employee_id()
          and definition.employee_self_access = 'WRITE'
          and internal_security.current_employee_has_permission('self:custom-field-values:write')
        )
        or (
          definition.hr_access = 'WRITE'
          and internal_security.current_user_has_permission(
            requested_tenant_id, requested_administration_id, 'employee:write'
          )
          and internal_security.current_user_has_permission(
            requested_tenant_id, requested_administration_id, 'custom-field-values:write'
          )
        )
        or (
          definition.manager_access = 'WRITE'
          and internal_security.can_manage_employee(requested_employee_id, 'employee:read')
          and internal_security.current_user_has_permission(
            requested_tenant_id, requested_administration_id, 'custom-field-values:write'
          )
        )
      )
  );
$$;

revoke all on function internal_security.custom_field_value_can_read(uuid, uuid, uuid, uuid)
from public, anon, authenticated;
revoke all on function internal_security.custom_field_value_can_write(uuid, uuid, uuid, uuid)
from public, anon, authenticated;

create function internal_security.prepare_employee_custom_field_value()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  definition public.custom_field_definitions%rowtype;
  reserved_value bigint;
begin
  if tg_op = 'UPDATE' and (
    new.tenant_id is distinct from old.tenant_id
    or new.administration_id is distinct from old.administration_id
    or new.employee_id is distinct from old.employee_id
    or new.definition_id is distinct from old.definition_id
    or new.field_key is distinct from old.field_key
  ) then
    raise exception 'CUSTOM_FIELD_VALUE_IDENTITY_IMMUTABLE' using errcode = '23514';
  end if;

  select * into definition from public.custom_field_definitions
  where id = new.definition_id and tenant_id = new.tenant_id
    and administration_id = new.administration_id and key = new.field_key
    and is_active and deleted_at is null;
  if definition.id is null then
    raise exception 'CUSTOM_FIELD_UNKNOWN' using errcode = '22023';
  end if;

  if definition.field_type = 'AUTO_INCREMENT' then
    if tg_op = 'UPDATE' then
      raise exception 'CUSTOM_FIELD_AUTO_INCREMENT_IMMUTABLE' using errcode = '23514';
    end if;
    insert into public.custom_field_counters (
      definition_id, tenant_id, administration_id, next_value
    ) values (definition.id, definition.tenant_id, definition.administration_id, 2)
    on conflict (definition_id) do update
      set next_value = public.custom_field_counters.next_value + 1,
          updated_at = timezone('utc', now())
    returning next_value - 1 into reserved_value;
    new.value := to_jsonb(reserved_value);
  elsif new.value = 'null'::jsonb then
    if definition.is_required then
      raise exception 'CUSTOM_FIELD_REQUIRED' using errcode = '23514';
    end if;
  elsif definition.field_type in ('TEXT', 'TEXTAREA', 'DATE', 'SELECT')
    and jsonb_typeof(new.value) <> 'string' then
    raise exception 'CUSTOM_FIELD_TYPE_INVALID' using errcode = '22023';
  elsif definition.field_type = 'NUMBER' and jsonb_typeof(new.value) <> 'number' then
    raise exception 'CUSTOM_FIELD_TYPE_INVALID' using errcode = '22023';
  elsif definition.field_type = 'BOOLEAN' and jsonb_typeof(new.value) <> 'boolean' then
    raise exception 'CUSTOM_FIELD_TYPE_INVALID' using errcode = '22023';
  elsif definition.field_type = 'MULTI_SELECT' and jsonb_typeof(new.value) <> 'array' then
    raise exception 'CUSTOM_FIELD_TYPE_INVALID' using errcode = '22023';
  end if;

  if definition.field_type = 'DATE' and new.value <> 'null'::jsonb then
    perform (new.value #>> '{}')::date;
  elsif definition.field_type = 'SELECT' and new.value <> 'null'::jsonb
    and not exists (
      select 1 from public.custom_field_select_options option
      where option.definition_id = definition.id and option.is_active
        and option.value = new.value #>> '{}'
    ) then
    raise exception 'CUSTOM_FIELD_OPTION_INVALID' using errcode = '22023';
  elsif definition.field_type = 'MULTI_SELECT' and new.value <> 'null'::jsonb
    and exists (
      select 1 from jsonb_array_elements_text(new.value) selected(value)
      where not exists (
        select 1 from public.custom_field_select_options option
        where option.definition_id = definition.id and option.is_active
          and option.value = selected.value
      )
    ) then
    raise exception 'CUSTOM_FIELD_OPTION_INVALID' using errcode = '22023';
  end if;
  return new;
end;
$$;

create function internal_security.sync_employee_custom_fields_json()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  record_value public.employee_custom_field_values%rowtype;
  administration_values jsonb;
begin
  record_value := case when tg_op = 'DELETE' then old else new end;
  select coalesce(custom_fields -> record_value.administration_id::text, '{}'::jsonb)
    into administration_values
  from public.employees where id = record_value.employee_id for update;

  if tg_op = 'DELETE' or record_value.value = 'null'::jsonb then
    administration_values := administration_values - record_value.field_key;
  else
    administration_values := administration_values
      || jsonb_build_object(record_value.field_key, record_value.value);
  end if;

  update public.employees
  set custom_fields = jsonb_set(
    custom_fields, array[record_value.administration_id::text], administration_values, true
  )
  where id = record_value.employee_id;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function internal_security.prepare_employee_custom_field_value() from public, anon, authenticated;
revoke all on function internal_security.sync_employee_custom_fields_json() from public, anon, authenticated;
create trigger prepare_employee_custom_field_value
before insert or update on public.employee_custom_field_values
for each row execute function internal_security.prepare_employee_custom_field_value();
create trigger set_employee_custom_field_values_updated_at
before update on public.employee_custom_field_values
for each row execute function internal_security.set_updated_at();
create trigger sync_employee_custom_fields_json
after insert or update or delete on public.employee_custom_field_values
for each row execute function internal_security.sync_employee_custom_fields_json();
create trigger audit_employee_custom_field_values
after insert or update or delete on public.employee_custom_field_values
for each row execute function internal_security.audit_hr_change('employee_custom_field_value');

alter table public.employee_custom_field_values enable row level security;
create policy employee_custom_field_values_select_scoped
on public.employee_custom_field_values for select to authenticated
using ((select internal_security.custom_field_value_can_read(
  tenant_id, administration_id, employee_id, definition_id
)));
create policy employee_custom_field_values_insert_scoped
on public.employee_custom_field_values for insert to authenticated
with check ((select internal_security.custom_field_value_can_write(
  tenant_id, administration_id, employee_id, definition_id
)));
create policy employee_custom_field_values_update_scoped
on public.employee_custom_field_values for update to authenticated
using ((select internal_security.custom_field_value_can_write(
  tenant_id, administration_id, employee_id, definition_id
)))
with check ((select internal_security.custom_field_value_can_write(
  tenant_id, administration_id, employee_id, definition_id
)));
create policy employee_custom_field_values_delete_scoped
on public.employee_custom_field_values for delete to authenticated
using ((select internal_security.custom_field_value_can_write(
  tenant_id, administration_id, employee_id, definition_id
)));

drop policy custom_field_definitions_read_scoped on public.custom_field_definitions;
drop policy custom_field_definitions_write_scoped on public.custom_field_definitions;
create policy custom_field_definitions_read_scoped
on public.custom_field_definitions for select to authenticated
using (
  (select internal_security.has_administration_access(tenant_id, administration_id))
  and (
    (select internal_security.current_user_has_permission(tenant_id, administration_id, 'custom-field-values:read'))
    or (select internal_security.current_user_has_permission(tenant_id, administration_id, 'custom-fields:write'))
    or (select internal_security.current_employee_has_permission('self:custom-field-values:read'))
  )
);
create policy custom_field_definitions_insert_scoped
on public.custom_field_definitions for insert to authenticated
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'custom-fields:write'
)));
create policy custom_field_definitions_update_scoped
on public.custom_field_definitions for update to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'custom-fields:write'
)))
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'custom-fields:write'
)));

drop policy custom_field_select_options_read_scoped on public.custom_field_select_options;
drop policy custom_field_select_options_write_scoped on public.custom_field_select_options;
create policy custom_field_select_options_read_scoped
on public.custom_field_select_options for select to authenticated
using (
  (select internal_security.has_administration_access(tenant_id, administration_id))
  and (
    (select internal_security.current_user_has_permission(tenant_id, administration_id, 'custom-field-values:read'))
    or (select internal_security.current_user_has_permission(tenant_id, administration_id, 'custom-fields:write'))
    or (select internal_security.current_employee_has_permission('self:custom-field-values:read'))
  )
);
create policy custom_field_select_options_insert_scoped
on public.custom_field_select_options for insert to authenticated
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'custom-fields:write'
)));
create policy custom_field_select_options_update_scoped
on public.custom_field_select_options for update to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'custom-fields:write'
)))
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'custom-fields:write'
)));
create policy custom_field_select_options_delete_scoped
on public.custom_field_select_options for delete to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'custom-fields:write'
)));

grant select, insert, update, delete on public.employee_custom_field_values to authenticated;
revoke execute on function public.get_employee_custom_field_values(uuid, uuid) from authenticated, service_role;
revoke execute on function public.set_employee_custom_field_values(uuid, uuid, jsonb) from authenticated, service_role;
drop function public.get_employee_custom_field_values(uuid, uuid);
drop function public.set_employee_custom_field_values(uuid, uuid, jsonb);
