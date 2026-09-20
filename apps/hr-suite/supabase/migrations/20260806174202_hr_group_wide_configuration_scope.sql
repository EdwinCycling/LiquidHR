begin;

-- These configuration records are owned by an HR group. The nullable
-- administration_id columns remain only as historical provenance for rows
-- created before the scope correction.

-- Company branding ---------------------------------------------------------
alter table public.administration_branding
  add column if not exists hr_group_id uuid;

update public.administration_branding branding
set hr_group_id = administration.hr_group_id
from public.administrations administration
where administration.tenant_id = branding.tenant_id
  and administration.id = branding.administration_id
  and branding.hr_group_id is null;

with ranked as (
  select ctid,
    row_number() over (
      partition by tenant_id, hr_group_id
      order by (logo_storage_path is not null) desc, updated_at desc, administration_id nulls last, ctid
    ) as row_number
  from public.administration_branding
)
delete from public.administration_branding branding
using ranked
where branding.ctid = ranked.ctid
  and ranked.row_number > 1;

alter table public.administration_branding
  drop constraint if exists administration_branding_administration_fkey,
  drop constraint if exists administration_branding_pkey,
  alter column administration_id drop not null,
  alter column hr_group_id set not null,
  add constraint administration_branding_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete cascade,
  add constraint administration_branding_pkey primary key (tenant_id, hr_group_id);

drop policy if exists administration_branding_select_scoped on public.administration_branding;
drop policy if exists administration_branding_insert_scoped on public.administration_branding;
drop policy if exists administration_branding_update_scoped on public.administration_branding;
drop policy if exists administration_branding_delete_scoped on public.administration_branding;

create policy administration_branding_select_group_scoped
on public.administration_branding for select to authenticated
using ((select internal_security.has_hr_group_access(tenant_id, hr_group_id)));
create policy administration_branding_insert_group_scoped
on public.administration_branding for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'settings:write')));
create policy administration_branding_update_group_scoped
on public.administration_branding for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'settings:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'settings:write')));
create policy administration_branding_delete_group_scoped
on public.administration_branding for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'settings:write')));

drop policy if exists administration_branding_logo_insert on storage.objects;
drop policy if exists administration_branding_logo_read on storage.objects;
drop policy if exists administration_branding_logo_delete on storage.objects;

create policy administration_branding_logo_insert_group
on storage.objects for insert to authenticated
with check (
  bucket_id = 'administration-branding'
  and (select internal_security.current_user_has_hr_group_permission(
    (storage.foldername(name))[1]::uuid,
    (storage.foldername(name))[2]::uuid,
    'settings:write'
  ))
);
create policy administration_branding_logo_read_group
on storage.objects for select to authenticated
using (
  bucket_id = 'administration-branding'
  and exists (
    select 1
    from public.administration_branding branding
    where branding.logo_storage_path = name
      and internal_security.has_hr_group_access(branding.tenant_id, branding.hr_group_id)
  )
);
create policy administration_branding_logo_delete_group
on storage.objects for delete to authenticated
using (
  bucket_id = 'administration-branding'
  and exists (
    select 1
    from public.administration_branding branding
    where branding.logo_storage_path = name
      and internal_security.current_user_has_hr_group_permission(branding.tenant_id, branding.hr_group_id, 'settings:write')
  )
);

-- Holidays -----------------------------------------------------------------
alter table public.holiday_calendars
  add column if not exists hr_group_id uuid;
alter table public.holidays
  add column if not exists hr_group_id uuid;

update public.holiday_calendars calendar
set hr_group_id = administration.hr_group_id
from public.administrations administration
where administration.tenant_id = calendar.tenant_id
  and administration.id = calendar.administration_id
  and calendar.hr_group_id is null;
update public.holidays holiday
set hr_group_id = calendar.hr_group_id
from public.holiday_calendars calendar
where calendar.id = holiday.holiday_calendar_id
  and holiday.hr_group_id is null;

create temporary table holiday_calendar_scope_map on commit drop as
select id as old_id,
  first_value(id) over (
    partition by tenant_id, hr_group_id, calendar_year, country_code
    order by imported_at desc nulls last, updated_at desc, id
  ) as canonical_id
from public.holiday_calendars;

with ranked as (
  select holiday.ctid,
    row_number() over (
      partition by map.canonical_id, holiday.external_key
      order by holiday.updated_at desc, holiday.id
    ) as row_number
  from public.holidays holiday
  join holiday_calendar_scope_map map on map.old_id = holiday.holiday_calendar_id
  where holiday.external_key is not null
)
delete from public.holidays holiday
using ranked
where holiday.ctid = ranked.ctid
  and ranked.row_number > 1;

update public.holidays holiday
set holiday_calendar_id = map.canonical_id,
    hr_group_id = canonical_calendar.hr_group_id,
    administration_id = canonical_calendar.administration_id
from holiday_calendar_scope_map map
join public.holiday_calendars canonical_calendar on canonical_calendar.id = map.canonical_id
where holiday.holiday_calendar_id = map.old_id;

delete from public.holiday_calendars calendar
using holiday_calendar_scope_map map
where calendar.id = map.old_id
  and map.old_id <> map.canonical_id;

alter table public.holiday_calendars
  drop constraint if exists holiday_calendars_administration_fkey;
alter table public.holidays
  drop constraint if exists holidays_calendar_fkey;
do $$
declare constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.holiday_calendars'::regclass
      and contype = 'u'
  loop
    execute format('alter table public.holiday_calendars drop constraint %I', constraint_row.conname);
  end loop;
end;
$$;
alter table public.holiday_calendars
  alter column administration_id drop not null,
  alter column hr_group_id set not null,
  add constraint holiday_calendars_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete cascade,
  add constraint holiday_calendars_group_year_country_key
    unique (tenant_id, hr_group_id, calendar_year, country_code),
  add constraint holiday_calendars_group_scope_id_key
    unique (tenant_id, hr_group_id, id);

alter table public.holidays
  alter column administration_id drop not null,
  alter column hr_group_id set not null,
  add constraint holidays_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete cascade,
  add constraint holidays_calendar_group_fkey
    foreign key (tenant_id, hr_group_id, holiday_calendar_id)
    references public.holiday_calendars(tenant_id, hr_group_id, id)
    on delete cascade,
  add constraint holidays_group_scope_id_key
    unique (tenant_id, hr_group_id, id);

drop index if exists public.holiday_calendars_lookup_idx;
drop index if exists public.holidays_month_idx;
create index holiday_calendars_group_lookup_idx
  on public.holiday_calendars (tenant_id, hr_group_id, calendar_year, country_code);
create index holidays_group_month_idx
  on public.holidays (tenant_id, hr_group_id, holiday_date)
  where is_active;

drop policy if exists holiday_calendars_read on public.holiday_calendars;
drop policy if exists holiday_calendars_write on public.holiday_calendars;
drop policy if exists holiday_calendars_insert on public.holiday_calendars;
drop policy if exists holiday_calendars_update on public.holiday_calendars;
drop policy if exists holiday_calendars_delete on public.holiday_calendars;
drop policy if exists holidays_read on public.holidays;
drop policy if exists holidays_write on public.holidays;
drop policy if exists holidays_insert on public.holidays;
drop policy if exists holidays_update on public.holidays;
drop policy if exists holidays_delete on public.holidays;
create policy holiday_calendars_read_group_scoped
on public.holiday_calendars for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'holidays:read')));
create policy holiday_calendars_write_group_scoped
on public.holiday_calendars for all to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'holidays:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'holidays:write')));
create policy holidays_read_group_scoped
on public.holidays for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'holidays:read')));
create policy holidays_write_group_scoped
on public.holidays for all to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'holidays:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'holidays:write')));

drop function if exists public.import_holiday_snapshot(uuid, smallint, text, jsonb);
create function public.import_holiday_snapshot(
  requested_hr_group_id uuid,
  requested_calendar_year smallint,
  requested_country_code text,
  requested_holidays jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  requested_tenant_id uuid;
  calendar_id uuid;
begin
  select group_row.tenant_id into requested_tenant_id
  from public.hr_groups group_row
  where group_row.id = requested_hr_group_id and group_row.is_active;
  if requested_tenant_id is null then
    raise exception using errcode = 'P0002', message = 'HOLIDAY_HR_GROUP_NOT_FOUND';
  end if;
  if not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'holidays:write') then
    raise exception using errcode = '42501', message = 'HOLIDAY_FORBIDDEN';
  end if;
  if requested_calendar_year not between 2000 and 2200
     or requested_country_code !~ '^[A-Z]{2}$'
     or jsonb_typeof(requested_holidays) <> 'array'
     or jsonb_array_length(requested_holidays) > 400 then
    raise exception using errcode = '22023', message = 'HOLIDAY_IMPORT_INVALID';
  end if;

  insert into public.holiday_calendars(
    tenant_id, hr_group_id, administration_id, calendar_year, country_code, imported_at, imported_by
  )
  values (
    requested_tenant_id, requested_hr_group_id, null, requested_calendar_year,
    requested_country_code, timezone('utc', now()), auth.uid()
  )
  on conflict (tenant_id, hr_group_id, calendar_year, country_code)
  do update set imported_at = excluded.imported_at, imported_by = excluded.imported_by
  returning id into calendar_id;

  update public.holidays holiday
  set is_active = false, updated_by = auth.uid()
  where holiday.holiday_calendar_id = calendar_id
    and holiday.source = 'API'
    and not exists (
      select 1 from jsonb_array_elements(requested_holidays) item
      where item ->> 'external_key' = holiday.external_key
    );

  insert into public.holidays(
    tenant_id, hr_group_id, administration_id, holiday_calendar_id, holiday_date, provider_name,
    display_name, source, external_key, holiday_types, subdivision_codes, created_by, updated_by
  )
  select requested_tenant_id, requested_hr_group_id, null, calendar_id,
    item.holiday_date, item.provider_name, item.display_name, 'API', item.external_key,
    coalesce(item.holiday_types, '{}'), coalesce(item.subdivision_codes, '{}'), auth.uid(), auth.uid()
  from jsonb_to_recordset(requested_holidays) item(
    holiday_date date,
    provider_name text,
    display_name text,
    external_key text,
    holiday_types text[],
    subdivision_codes text[]
  )
  on conflict (holiday_calendar_id, external_key) where external_key is not null
  do update set holiday_date = excluded.holiday_date,
    provider_name = excluded.provider_name,
    display_name = excluded.display_name,
    holiday_types = excluded.holiday_types,
    subdivision_codes = excluded.subdivision_codes,
    updated_by = auth.uid();
  return calendar_id;
end;
$$;
revoke all on function public.import_holiday_snapshot(uuid, smallint, text, jsonb) from public, anon;
grant execute on function public.import_holiday_snapshot(uuid, smallint, text, jsonb) to authenticated;

-- End reasons --------------------------------------------------------------
alter table public.employment_end_reasons
  add column if not exists hr_group_id uuid;
alter table public.employment_terminations
  add column if not exists hr_group_id uuid;

alter table public.employment_terminations
  drop constraint if exists employment_terminations_internal_reason_fkey;

update public.employment_end_reasons reason
set hr_group_id = administration.hr_group_id
from public.administrations administration
where administration.tenant_id = reason.tenant_id
  and administration.id = reason.administration_id
  and reason.hr_group_id is null;
update public.employment_terminations termination
set hr_group_id = administration.hr_group_id
from public.administrations administration
where administration.tenant_id = termination.tenant_id
  and administration.id = termination.administration_id
  and termination.hr_group_id is null;

create temporary table end_reason_scope_map on commit drop as
select id as old_id,
  first_value(id) over (
    partition by tenant_id, hr_group_id, country_code, code
    order by is_active desc, updated_at desc, id
  ) as canonical_id
from public.employment_end_reasons;

update public.employment_terminations termination
set internal_reason_id = map.canonical_id
from end_reason_scope_map map
where termination.internal_reason_id = map.old_id
  and map.old_id <> map.canonical_id;

delete from public.employment_end_reasons reason
using end_reason_scope_map map
where reason.id = map.old_id
  and map.old_id <> map.canonical_id;

alter table public.employment_end_reasons
  drop constraint if exists employment_end_reasons_administration_fkey,
  drop constraint if exists employment_end_reasons_code_key,
  drop constraint if exists employment_end_reasons_country_code_key,
  drop constraint if exists employment_end_reasons_scope_id_key,
  alter column administration_id drop not null,
  alter column hr_group_id set not null,
  add constraint employment_end_reasons_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete cascade,
  add constraint employment_end_reasons_group_code_key
    unique (tenant_id, hr_group_id, country_code, code),
  add constraint employment_end_reasons_group_scope_id_key
    unique (tenant_id, hr_group_id, id);

alter table public.employment_terminations
  alter column hr_group_id set not null,
  add constraint employment_terminations_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete restrict,
  add constraint employment_terminations_internal_reason_hr_group_fkey
    foreign key (tenant_id, hr_group_id, internal_reason_id)
    references public.employment_end_reasons(tenant_id, hr_group_id, id)
    on delete restrict;

drop policy if exists employment_end_reasons_read on public.employment_end_reasons;
drop policy if exists employment_end_reasons_write on public.employment_end_reasons;
drop policy if exists employment_end_reasons_insert on public.employment_end_reasons;
drop policy if exists employment_end_reasons_update on public.employment_end_reasons;
drop policy if exists employment_end_reasons_delete on public.employment_end_reasons;
create policy employment_end_reasons_read_group_scoped
on public.employment_end_reasons for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'contract:read')));
create policy employment_end_reasons_insert_group_scoped
on public.employment_end_reasons for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'contract:write')));
create policy employment_end_reasons_update_group_scoped
on public.employment_end_reasons for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'contract:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'contract:write')));
create policy employment_end_reasons_delete_group_scoped
on public.employment_end_reasons for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'contract:write')));

-- Custom fields ------------------------------------------------------------
alter table public.custom_field_definitions
  add column if not exists hr_group_id uuid;
alter table public.custom_field_select_options
  add column if not exists hr_group_id uuid;
alter table public.custom_field_counters
  add column if not exists hr_group_id uuid;
alter table public.employee_custom_field_values
  add column if not exists hr_group_id uuid;

update public.custom_field_definitions definition
set hr_group_id = administration.hr_group_id
from public.administrations administration
where administration.tenant_id = definition.tenant_id
  and administration.id = definition.administration_id
  and definition.hr_group_id is null;
update public.custom_field_select_options option_row
set hr_group_id = definition.hr_group_id
from public.custom_field_definitions definition
where definition.id = option_row.definition_id
  and option_row.hr_group_id is null;
update public.custom_field_counters counter_row
set hr_group_id = definition.hr_group_id
from public.custom_field_definitions definition
where definition.id = counter_row.definition_id
  and counter_row.hr_group_id is null;

-- The legacy trigger treats the scope backfill as a value mutation for
-- AUTO_INCREMENT fields. Pause both legacy triggers before that backfill and
-- recreate their HR-group-aware versions below.
drop trigger if exists prepare_employee_custom_field_value on public.employee_custom_field_values;
drop trigger if exists sync_employee_custom_fields_json on public.employee_custom_field_values;

update public.employee_custom_field_values value_row
set hr_group_id = employee.hr_group_id
from public.employees employee
where employee.tenant_id = value_row.tenant_id
  and employee.id = value_row.employee_id
  and value_row.hr_group_id is null;

alter table public.custom_field_select_options
  drop constraint if exists custom_field_select_options_definition_scope_fkey;
alter table public.custom_field_counters
  drop constraint if exists custom_field_counters_definition_scope_fkey;
alter table public.employee_custom_field_values
  drop constraint if exists employee_custom_field_values_definition_scope_fkey,
  drop constraint if exists employee_custom_field_values_unique;

create temporary table custom_field_definition_scope_map on commit drop as
select id as old_id,
  first_value(id) over (
    partition by tenant_id, hr_group_id, entity_type, key
    order by (deleted_at is null) desc, is_active desc, updated_at desc, id
  ) as canonical_id
from public.custom_field_definitions;

with ranked as (
  select option_row.ctid,
    row_number() over (
      partition by map.canonical_id, option_row.value
      order by option_row.is_active desc, option_row.updated_at desc, option_row.id
    ) as row_number
  from public.custom_field_select_options option_row
  join custom_field_definition_scope_map map on map.old_id = option_row.definition_id
)
delete from public.custom_field_select_options option_row
using ranked
where option_row.ctid = ranked.ctid
  and ranked.row_number > 1;

update public.custom_field_select_options option_row
set definition_id = map.canonical_id,
    hr_group_id = canonical_definition.hr_group_id,
    administration_id = canonical_definition.administration_id
from custom_field_definition_scope_map map
join public.custom_field_definitions canonical_definition on canonical_definition.id = map.canonical_id
where option_row.definition_id = map.old_id;

with ranked as (
  select value_row.ctid,
    row_number() over (
      partition by value_row.tenant_id, value_row.hr_group_id, value_row.employee_id, map.canonical_id
      order by value_row.updated_at desc, value_row.id
    ) as row_number
  from public.employee_custom_field_values value_row
  join custom_field_definition_scope_map map on map.old_id = value_row.definition_id
)
delete from public.employee_custom_field_values value_row
using ranked
where value_row.ctid = ranked.ctid
  and ranked.row_number > 1;

update public.employee_custom_field_values value_row
set definition_id = map.canonical_id,
    field_key = canonical_definition.key,
    hr_group_id = canonical_definition.hr_group_id,
    administration_id = canonical_definition.administration_id
from custom_field_definition_scope_map map
join public.custom_field_definitions canonical_definition on canonical_definition.id = map.canonical_id
where value_row.definition_id = map.old_id;

insert into public.custom_field_counters (definition_id, tenant_id, administration_id, hr_group_id, next_value)
select map.canonical_id,
  counter_row.tenant_id,
  (array_agg(counter_row.administration_id))[1],
  canonical_definition.hr_group_id,
  max(counter_row.next_value)
from public.custom_field_counters counter_row
join custom_field_definition_scope_map map on map.old_id = counter_row.definition_id
join public.custom_field_definitions canonical_definition on canonical_definition.id = map.canonical_id
group by map.canonical_id, counter_row.tenant_id, canonical_definition.hr_group_id
on conflict (definition_id) do update
set next_value = greatest(public.custom_field_counters.next_value, excluded.next_value),
    updated_at = timezone('utc', now());

delete from public.custom_field_counters counter_row
using custom_field_definition_scope_map map
where counter_row.definition_id = map.old_id
  and map.old_id <> map.canonical_id;
delete from public.custom_field_definitions definition
using custom_field_definition_scope_map map
where definition.id = map.old_id
  and map.old_id <> map.canonical_id;

alter table public.custom_field_definitions
  drop constraint if exists custom_field_definitions_administration_scope_fkey,
  drop constraint if exists custom_field_definitions_scope_key_key,
  drop constraint if exists custom_field_definitions_scope_id_key,
  drop constraint if exists custom_field_definitions_scope_id_key_key,
  alter column administration_id drop not null,
  alter column hr_group_id set not null,
  add constraint custom_field_definitions_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete cascade,
  add constraint custom_field_definitions_group_scope_key_key
    unique (tenant_id, hr_group_id, entity_type, key),
  add constraint custom_field_definitions_group_scope_id_key
    unique (tenant_id, hr_group_id, id),
  add constraint custom_field_definitions_group_scope_id_key_key
    unique (tenant_id, hr_group_id, id, key);

alter table public.custom_field_select_options
  alter column administration_id drop not null,
  alter column hr_group_id set not null,
  add constraint custom_field_select_options_definition_group_fkey
    foreign key (tenant_id, hr_group_id, definition_id)
    references public.custom_field_definitions(tenant_id, hr_group_id, id)
    on delete cascade;
alter table public.custom_field_counters
  alter column administration_id drop not null,
  alter column hr_group_id set not null,
  add constraint custom_field_counters_definition_group_fkey
    foreign key (tenant_id, hr_group_id, definition_id)
    references public.custom_field_definitions(tenant_id, hr_group_id, id)
    on delete cascade;
alter table public.employee_custom_field_values
  alter column administration_id drop not null,
  alter column hr_group_id set not null,
  add constraint employee_custom_field_values_employee_group_fkey
    foreign key (tenant_id, hr_group_id, employee_id)
    references public.employees(tenant_id, hr_group_id, id)
    on delete cascade,
  add constraint employee_custom_field_values_definition_group_fkey
    foreign key (tenant_id, hr_group_id, definition_id, field_key)
    references public.custom_field_definitions(tenant_id, hr_group_id, id, key)
    on delete restrict,
  add constraint employee_custom_field_values_group_unique
    unique (tenant_id, hr_group_id, employee_id, definition_id);

drop index if exists public.custom_field_definitions_active_idx;
drop index if exists public.custom_field_counters_scope_idx;
drop index if exists public.custom_field_select_options_scope_idx;
drop index if exists public.employee_custom_field_values_employee_idx;
create index custom_field_definitions_group_active_idx
  on public.custom_field_definitions (tenant_id, hr_group_id, entity_type, sort_order, key)
  where deleted_at is null and is_active;
create index custom_field_counters_group_scope_idx
  on public.custom_field_counters (tenant_id, hr_group_id, definition_id);
create index custom_field_select_options_group_scope_idx
  on public.custom_field_select_options (tenant_id, hr_group_id, definition_id);
create index employee_custom_field_values_group_employee_idx
  on public.employee_custom_field_values (tenant_id, hr_group_id, employee_id);

create or replace function internal_security.guard_custom_field_definition_key()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if old.key is distinct from new.key
    or old.tenant_id is distinct from new.tenant_id
    or old.hr_group_id is distinct from new.hr_group_id
    or old.entity_type is distinct from new.entity_type then
    raise exception 'CUSTOM_FIELD_TECHNICAL_IDENTITY_IMMUTABLE' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function internal_security.custom_field_value_can_read(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_employee_id uuid,
  requested_definition_id uuid
)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.custom_field_definitions definition
    where definition.id = requested_definition_id
      and definition.tenant_id = requested_tenant_id
      and definition.hr_group_id = requested_administration_id
      and definition.is_active and definition.deleted_at is null
      and exists (
        select 1 from public.employees employee
        where employee.tenant_id = requested_tenant_id
          and employee.hr_group_id = requested_administration_id
          and employee.id = requested_employee_id
          and employee.deleted_at is null
      )
      and (
        (
          requested_employee_id = internal_security.current_employee_id()
          and definition.employee_self_access <> 'HIDDEN'
          and internal_security.current_employee_has_permission('self:custom-field-values:read')
        )
        or (
          definition.hr_access <> 'HIDDEN'
          and internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_administration_id, 'employee:write')
          and internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_administration_id, 'custom-field-values:read')
        )
        or (
          definition.manager_access <> 'HIDDEN'
          and internal_security.can_manage_employee(requested_employee_id, 'employee:read')
          and internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_administration_id, 'custom-field-values:read')
        )
      )
  );
$$;

create or replace function internal_security.custom_field_value_can_write(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_employee_id uuid,
  requested_definition_id uuid
)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.custom_field_definitions definition
    where definition.id = requested_definition_id
      and definition.tenant_id = requested_tenant_id
      and definition.hr_group_id = requested_administration_id
      and definition.is_active and definition.deleted_at is null
      and exists (
        select 1 from public.employees employee
        where employee.tenant_id = requested_tenant_id
          and employee.hr_group_id = requested_administration_id
          and employee.id = requested_employee_id
          and employee.deleted_at is null
      )
      and (
        (
          requested_employee_id = internal_security.current_employee_id()
          and definition.employee_self_access = 'WRITE'
          and internal_security.current_employee_has_permission('self:custom-field-values:write')
        )
        or (
          definition.hr_access = 'WRITE'
          and internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_administration_id, 'employee:write')
          and internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_administration_id, 'custom-field-values:write')
        )
        or (
          definition.manager_access = 'WRITE'
          and internal_security.can_manage_employee(requested_employee_id, 'employee:read')
          and internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_administration_id, 'custom-field-values:write')
        )
      )
  );
$$;

create or replace function internal_security.prepare_employee_custom_field_value()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  definition public.custom_field_definitions%rowtype;
  reserved_value bigint;
begin
  if tg_op = 'UPDATE' and (
    new.tenant_id is distinct from old.tenant_id
    or new.hr_group_id is distinct from old.hr_group_id
    or new.administration_id is distinct from old.administration_id
    or new.employee_id is distinct from old.employee_id
    or new.definition_id is distinct from old.definition_id
    or new.field_key is distinct from old.field_key
  ) then
    raise exception 'CUSTOM_FIELD_VALUE_IDENTITY_IMMUTABLE' using errcode = '23514';
  end if;

  select * into definition
  from public.custom_field_definitions
  where id = new.definition_id
    and tenant_id = new.tenant_id
    and hr_group_id = new.hr_group_id
    and key = new.field_key
    and is_active and deleted_at is null;
  if definition.id is null then
    raise exception 'CUSTOM_FIELD_UNKNOWN' using errcode = '22023';
  end if;

  if definition.field_type = 'AUTO_INCREMENT' then
    if tg_op = 'UPDATE' then
      raise exception 'CUSTOM_FIELD_AUTO_INCREMENT_IMMUTABLE' using errcode = '23514';
    end if;
    insert into public.custom_field_counters (definition_id, tenant_id, administration_id, hr_group_id, next_value)
    values (definition.id, definition.tenant_id, definition.administration_id, definition.hr_group_id, 2)
    on conflict (definition_id) do update
      set next_value = public.custom_field_counters.next_value + 1,
          updated_at = timezone('utc', now())
    returning next_value - 1 into reserved_value;
    new.value := to_jsonb(reserved_value);
  elsif new.value = 'null'::jsonb then
    if definition.is_required then raise exception 'CUSTOM_FIELD_REQUIRED' using errcode = '23514'; end if;
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
    and not exists (select 1 from public.custom_field_select_options option_row where option_row.definition_id = definition.id and option_row.is_active and option_row.value = new.value #>> '{}') then
    raise exception 'CUSTOM_FIELD_OPTION_INVALID' using errcode = '22023';
  elsif definition.field_type = 'MULTI_SELECT' and new.value <> 'null'::jsonb
    and exists (
      select 1 from jsonb_array_elements_text(new.value) selected(value)
      where not exists (select 1 from public.custom_field_select_options option_row where option_row.definition_id = definition.id and option_row.is_active and option_row.value = selected.value)
    ) then
    raise exception 'CUSTOM_FIELD_OPTION_INVALID' using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function internal_security.sync_employee_custom_fields_json()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  record_value public.employee_custom_field_values%rowtype;
  group_values jsonb;
begin
  record_value := case when tg_op = 'DELETE' then old else new end;
  select coalesce(custom_fields -> record_value.hr_group_id::text, '{}'::jsonb)
  into group_values
  from public.employees
  where tenant_id = record_value.tenant_id
    and hr_group_id = record_value.hr_group_id
    and id = record_value.employee_id
  for update;
  if tg_op = 'DELETE' or record_value.value = 'null'::jsonb then
    group_values := group_values - record_value.field_key;
  else
    group_values := group_values || jsonb_build_object(record_value.field_key, record_value.value);
  end if;
  update public.employees
  set custom_fields = jsonb_set(custom_fields, array[record_value.hr_group_id::text], group_values, true)
  where tenant_id = record_value.tenant_id
    and hr_group_id = record_value.hr_group_id
    and id = record_value.employee_id;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.next_custom_field_value(p_definition_id uuid)
returns bigint
language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  definition public.custom_field_definitions%rowtype;
  reserved_value bigint;
begin
  select * into definition from public.custom_field_definitions where id = p_definition_id and deleted_at is null and is_active;
  if definition.id is null or definition.field_type <> 'AUTO_INCREMENT' then
    raise exception 'CUSTOM_FIELD_NOT_AUTO_INCREMENT' using errcode = '22023';
  end if;
  if current_user not in ('postgres', 'service_role')
    and not internal_security.current_user_has_hr_group_permission(definition.tenant_id, definition.hr_group_id, 'custom-field-values:write') then
    raise exception 'CUSTOM_FIELD_VALUE_FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.custom_field_counters (definition_id, tenant_id, administration_id, hr_group_id, next_value)
  values (definition.id, definition.tenant_id, definition.administration_id, definition.hr_group_id, 2)
  on conflict (definition_id) do update
    set next_value = public.custom_field_counters.next_value + 1,
        updated_at = timezone('utc', now())
  returning next_value - 1 into reserved_value;
  return reserved_value;
end;
$$;

drop policy if exists custom_field_definitions_read_scoped on public.custom_field_definitions;
drop policy if exists custom_field_definitions_write_scoped on public.custom_field_definitions;
drop policy if exists custom_field_definitions_insert_scoped on public.custom_field_definitions;
drop policy if exists custom_field_definitions_update_scoped on public.custom_field_definitions;
drop policy if exists custom_field_select_options_read_scoped on public.custom_field_select_options;
drop policy if exists custom_field_select_options_write_scoped on public.custom_field_select_options;
drop policy if exists custom_field_select_options_insert_scoped on public.custom_field_select_options;
drop policy if exists custom_field_select_options_update_scoped on public.custom_field_select_options;
drop policy if exists custom_field_select_options_delete_scoped on public.custom_field_select_options;
drop policy if exists custom_field_counters_read_scoped on public.custom_field_counters;
drop policy if exists custom_field_counters_insert_scoped on public.custom_field_counters;
drop policy if exists custom_field_counters_update_scoped on public.custom_field_counters;
drop policy if exists employee_custom_field_values_select_scoped on public.employee_custom_field_values;
drop policy if exists employee_custom_field_values_insert_scoped on public.employee_custom_field_values;
drop policy if exists employee_custom_field_values_update_scoped on public.employee_custom_field_values;
drop policy if exists employee_custom_field_values_delete_scoped on public.employee_custom_field_values;

create policy custom_field_definitions_read_group_scoped
on public.custom_field_definitions for select to authenticated
using (
  (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (
    (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-field-values:read'))
    or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-fields:write'))
    or (select internal_security.current_employee_has_permission('self:custom-field-values:read'))
  )
);
create policy custom_field_definitions_write_group_scoped
on public.custom_field_definitions for all to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-fields:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-fields:write')));
create policy custom_field_select_options_read_group_scoped
on public.custom_field_select_options for select to authenticated
using (
  (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (
    (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-field-values:read'))
    or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-fields:write'))
    or (select internal_security.current_employee_has_permission('self:custom-field-values:read'))
  )
);
create policy custom_field_select_options_write_group_scoped
on public.custom_field_select_options for all to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-fields:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-fields:write')));
create policy custom_field_counters_read_group_scoped
on public.custom_field_counters for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-field-values:write')));
create policy custom_field_counters_insert_group_scoped
on public.custom_field_counters for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-field-values:write')));
create policy custom_field_counters_update_group_scoped
on public.custom_field_counters for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-field-values:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-field-values:write')));
create policy employee_custom_field_values_select_group_scoped
on public.employee_custom_field_values for select to authenticated
using ((select internal_security.custom_field_value_can_read(tenant_id, hr_group_id, employee_id, definition_id)));
create policy employee_custom_field_values_insert_group_scoped
on public.employee_custom_field_values for insert to authenticated
with check ((select internal_security.custom_field_value_can_write(tenant_id, hr_group_id, employee_id, definition_id)));
create policy employee_custom_field_values_update_group_scoped
on public.employee_custom_field_values for update to authenticated
using ((select internal_security.custom_field_value_can_write(tenant_id, hr_group_id, employee_id, definition_id)))
with check ((select internal_security.custom_field_value_can_write(tenant_id, hr_group_id, employee_id, definition_id)));
create policy employee_custom_field_values_delete_group_scoped
on public.employee_custom_field_values for delete to authenticated
using ((select internal_security.custom_field_value_can_write(tenant_id, hr_group_id, employee_id, definition_id)));

create trigger prepare_employee_custom_field_value
before insert or update on public.employee_custom_field_values
for each row execute function internal_security.prepare_employee_custom_field_value();
create trigger sync_employee_custom_fields_json
after insert or update or delete on public.employee_custom_field_values
for each row execute function internal_security.sync_employee_custom_fields_json();

-- Company documents --------------------------------------------------------
alter table public.company_documents
  add column if not exists hr_group_id uuid;
update public.company_documents document
set hr_group_id = administration.hr_group_id
from public.administrations administration
where administration.tenant_id = document.tenant_id
  and administration.id = document.administration_id
  and document.hr_group_id is null;

alter table public.company_documents
  drop constraint if exists company_documents_administration_fkey,
  drop constraint if exists company_documents_scope_id_key,
  alter column administration_id drop not null,
  alter column hr_group_id set not null,
  add constraint company_documents_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete cascade,
  add constraint company_documents_group_scope_id_key
    unique (tenant_id, hr_group_id, id);

drop index if exists public.company_documents_tenant_created_idx;
create index company_documents_group_created_idx
  on public.company_documents (tenant_id, hr_group_id, created_at desc)
  where deleted_at is null;

drop policy if exists company_documents_read on public.company_documents;
drop policy if exists company_documents_insert on public.company_documents;
drop policy if exists company_documents_update on public.company_documents;
drop policy if exists company_documents_delete on public.company_documents;
create policy company_documents_read_group_scoped on public.company_documents
for select to authenticated
using ((select internal_security.has_hr_group_access(tenant_id, hr_group_id)) and deleted_at is null);
create policy company_documents_insert_group_scoped on public.company_documents
for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'company-document:write')));
create policy company_documents_update_group_scoped on public.company_documents
for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'company-document:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'company-document:write')));
create policy company_documents_delete_group_scoped on public.company_documents
for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'company-document:delete')));

drop policy if exists company_document_objects_insert on storage.objects;
drop policy if exists company_document_objects_read on storage.objects;
drop policy if exists company_document_objects_delete on storage.objects;
create policy company_document_objects_insert_group on storage.objects
for insert to authenticated
with check (
  bucket_id = 'company-documents'
  and (select internal_security.current_user_has_hr_group_permission(
    (storage.foldername(name))[1]::uuid,
    (storage.foldername(name))[2]::uuid,
    'company-document:write'
  ))
);
create policy company_document_objects_read_group on storage.objects
for select to authenticated
using (
  bucket_id = 'company-documents'
  and exists (
    select 1 from public.company_documents document
    where document.storage_key = name
      and document.deleted_at is null
      and internal_security.has_hr_group_access(document.tenant_id, document.hr_group_id)
  )
);
create policy company_document_objects_delete_group on storage.objects
for delete to authenticated
using (
  bucket_id = 'company-documents'
  and exists (
    select 1 from public.company_documents document
    where document.storage_key = name
      and internal_security.current_user_has_hr_group_permission(document.tenant_id, document.hr_group_id, 'company-document:delete')
  )
);

commit;
