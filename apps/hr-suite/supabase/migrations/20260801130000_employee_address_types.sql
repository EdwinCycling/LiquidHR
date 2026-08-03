alter table public.employee_addresses
  add column address_type text not null default 'PRIMARY',
  add column description text;

update public.employee_addresses
set address_type = 'PRIMARY',
    description = null
where address_type is null;

alter table public.employee_addresses
  add constraint employee_addresses_address_type_valid
    check (address_type in ('PRIMARY', 'SECONDARY')),
  add constraint employee_addresses_description_valid
    check (
      (address_type = 'PRIMARY' and description is null)
      or (address_type = 'SECONDARY' and description is not null and length(trim(description)) between 1 and 240)
    ),
  add constraint employee_addresses_secondary_period_valid
    check (address_type = 'PRIMARY' or valid_until is not null);

alter table public.employee_addresses
  drop constraint employee_addresses_no_overlap;

alter table public.employee_addresses
  add constraint employee_addresses_no_overlap_by_type
    exclude using gist (
      tenant_id with =,
      employee_id with =,
      address_type with =,
      daterange(valid_from, coalesce(valid_until, 'infinity'::date), '[]') with &&
    ) where (deleted_at is null);

create index employee_addresses_employee_type_period_idx
  on public.employee_addresses (tenant_id, employee_id, address_type, valid_from desc)
  where deleted_at is null;

create or replace function internal_security.prevent_last_employee_address_archive()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null and old.address_type = 'PRIMARY' then
    perform pg_advisory_xact_lock(hashtextextended(old.tenant_id::text || ':' || old.employee_id::text, 0));

    if not exists (
      select 1
      from public.employee_addresses address
      where address.tenant_id = old.tenant_id
        and address.employee_id = old.employee_id
        and address.address_type = 'PRIMARY'
        and address.deleted_at is null
        and address.id <> old.id
    ) then
      raise exception 'ADDRESS_PRIMARY_REQUIRED' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create or replace function internal_security.guard_employee_address_record()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and old.address_type is distinct from new.address_type then
    raise exception 'ADDRESS_TYPE_IMMUTABLE' using errcode = 'P0001';
  end if;

  if new.address_type = 'PRIMARY' then
    new.description := null;
  elsif new.description is null or length(trim(new.description)) = 0 or new.valid_until is null then
    raise exception 'ADDRESS_SECONDARY_FIELDS_REQUIRED' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_employee_address_record on public.employee_addresses;
create trigger guard_employee_address_record
before insert or update on public.employee_addresses
for each row execute function internal_security.guard_employee_address_record();

drop function if exists public.create_employee_address_with_reminders(uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, date, date, text[]);

create function public.create_employee_address_with_reminders(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_employee_id uuid,
  requested_address_line_1 text,
  requested_address_line_2 text,
  requested_street text,
  requested_house_number text,
  requested_house_number_addition text,
  requested_postal_code text,
  requested_city text,
  requested_region text,
  requested_country_code text,
  requested_source text,
  requested_source_reference text,
  requested_valid_from date,
  requested_valid_until date,
  requested_address_type text default 'PRIMARY',
  requested_description text default null,
  requested_reminder_roles text[] default '{}'::text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, auth, pg_temp
as $$
declare
  created_address_id uuid;
  created_reminder_id uuid;
  selected_role text;
  reminder_description text;
  recipient_count integer;
  created_by uuid := (select auth.uid());
  normalized_address_type text := upper(coalesce(nullif(btrim(requested_address_type), ''), 'PRIMARY'));
begin
  if created_by is null then
    raise exception 'ADDRESS_REMINDER_AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  if not internal_security.employee_subresource_can_write(
    requested_tenant_id,
    requested_employee_id,
    'self:address:write'
  ) then
    raise exception 'ADDRESS_FORBIDDEN' using errcode = '42501';
  end if;

  if normalized_address_type not in ('PRIMARY', 'SECONDARY') then
    raise exception 'ADDRESS_TYPE_INVALID' using errcode = '22023';
  end if;

  if normalized_address_type = 'PRIMARY' and requested_valid_until is not null then
    raise exception 'ADDRESS_PRIMARY_END_NOT_ALLOWED' using errcode = '22023';
  end if;

  if normalized_address_type = 'SECONDARY'
    and (requested_valid_until is null or requested_valid_until <= requested_valid_from or requested_description is null or length(btrim(requested_description)) = 0) then
    raise exception 'ADDRESS_SECONDARY_FIELDS_REQUIRED' using errcode = '22023';
  end if;

  if requested_reminder_roles is not null
    and not requested_reminder_roles <@ array['HR_ADMIN', 'MANAGER', 'EMPLOYEE']::text[] then
    raise exception 'ADDRESS_REMINDER_ROLE_INVALID' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(requested_tenant_id::text || ':' || requested_employee_id::text, 0));

  if normalized_address_type = 'PRIMARY' then
    if exists (
      select 1
      from public.employee_addresses address
      where address.tenant_id = requested_tenant_id
        and address.employee_id = requested_employee_id
        and address.address_type = 'PRIMARY'
        and address.deleted_at is null
        and address.valid_from >= requested_valid_from
    ) then
      raise exception 'ADDRESS_PRIMARY_START_INVALID' using errcode = '22023';
    end if;

    update public.employee_addresses
    set valid_until = requested_valid_from - 1
    where tenant_id = requested_tenant_id
      and employee_id = requested_employee_id
      and address_type = 'PRIMARY'
      and deleted_at is null
      and valid_until is null;
  end if;

  insert into public.employee_addresses (
    tenant_id,
    employee_id,
    address_type,
    description,
    address_line_1,
    address_line_2,
    street,
    house_number,
    house_number_addition,
    postal_code,
    city,
    region,
    country_code,
    source,
    source_reference,
    valid_from,
    valid_until
  ) values (
    requested_tenant_id,
    requested_employee_id,
    normalized_address_type,
    case when normalized_address_type = 'SECONDARY' then nullif(btrim(requested_description), '') else null end,
    btrim(requested_address_line_1),
    nullif(btrim(requested_address_line_2), ''),
    nullif(btrim(requested_street), ''),
    nullif(btrim(requested_house_number), ''),
    nullif(btrim(requested_house_number_addition), ''),
    nullif(btrim(requested_postal_code), ''),
    btrim(requested_city),
    nullif(btrim(requested_region), ''),
    upper(btrim(requested_country_code)),
    requested_source,
    nullif(btrim(requested_source_reference), ''),
    requested_valid_from,
    case when normalized_address_type = 'SECONDARY' then requested_valid_until else null end
  ) returning id into created_address_id;

  if coalesce(cardinality(requested_reminder_roles), 0) = 0 then
    return created_address_id;
  end if;

  if not internal_security.tenant_module_enabled(requested_tenant_id, 'REMINDERS') then
    raise exception 'ADDRESS_REMINDER_MODULE_DISABLED' using errcode = 'P0001';
  end if;

  for selected_role in
    select distinct role_code
    from unnest(requested_reminder_roles) as role_code
  loop
    reminder_description := format(
      'Medewerker: %s (%s)%s%sNieuw adres: %s%s%s%sGeldig vanaf: %s',
      coalesce((select employee.first_name || ' ' || employee.birth_name from public.employees employee where employee.id = requested_employee_id), 'Onbekende medewerker'),
      coalesce((select employee.employee_number from public.employees employee where employee.id = requested_employee_id), ''),
      chr(10),
      case when normalized_address_type = 'SECONDARY' then 'Adresomschrijving: ' || btrim(requested_description) || chr(10) else '' end,
      requested_address_line_1,
      case when requested_address_line_2 is null or btrim(requested_address_line_2) = '' then '' else chr(10) || requested_address_line_2 end,
      case when requested_postal_code is null or requested_city is null then '' else chr(10) || btrim(requested_postal_code) || ' ' || btrim(requested_city) end,
      case when requested_country_code is null or upper(requested_country_code) = 'NL' then '' else chr(10) || upper(requested_country_code) end,
      to_char(requested_valid_from, 'DD-MM-YYYY')
    );

    if selected_role = 'HR_ADMIN' then
      reminder_description := reminder_description || chr(10) || chr(10) || 'Controleer reiskosten etc.';
    end if;

    insert into public.reminders (
      tenant_id,
      administration_id,
      created_by_user_id,
      reminder_type,
      target_type,
      title,
      description,
      remind_at,
      status,
      published_at
    ) values (
      requested_tenant_id,
      requested_administration_id,
      created_by,
      'HR',
      'EMPLOYEES',
      'Adres wijziging',
      reminder_description,
      timezone('utc', now()),
      'PUBLISHED',
      timezone('utc', now())
    ) returning id into created_reminder_id;

    if selected_role = 'HR_ADMIN' then
      insert into public.reminder_targets (tenant_id, administration_id, reminder_id, employee_id)
      select requested_tenant_id, requested_administration_id, created_reminder_id, employee.id
      from public.user_access access
      join public.management_roles role on role.id = access.management_role_id
      join public.employees employee on employee.auth_user_id = access.user_id and employee.tenant_id = requested_tenant_id and employee.deleted_at is null
      where access.tenant_id = requested_tenant_id
        and access.is_active
        and role.code in ('TENANT_ADMIN', 'HR_ADMIN')
        and employee.auth_user_id is not null
        and (access.administration_id is null or access.administration_id = requested_administration_id)
      on conflict do nothing;
    elsif selected_role = 'MANAGER' then
      insert into public.reminder_targets (tenant_id, administration_id, reminder_id, employee_id)
      select distinct requested_tenant_id, requested_administration_id, created_reminder_id, manager.id
      from public.employee_organizations placement
      join public.employees manager on manager.id = placement.direct_manager_id and manager.tenant_id = requested_tenant_id and manager.deleted_at is null
      where placement.tenant_id = requested_tenant_id
        and placement.employee_id = requested_employee_id
        and placement.effective_from <= current_date
        and (placement.effective_to is null or placement.effective_to >= current_date)
        and (requested_administration_id is null or placement.administration_id = requested_administration_id)
        and manager.auth_user_id is not null
      on conflict do nothing;
    elsif selected_role = 'EMPLOYEE' then
      insert into public.reminder_targets (tenant_id, administration_id, reminder_id, employee_id)
      select requested_tenant_id, requested_administration_id, created_reminder_id, employee.id
      from public.employees employee
      where employee.id = requested_employee_id
        and employee.tenant_id = requested_tenant_id
        and employee.deleted_at is null
        and employee.auth_user_id is not null
      on conflict do nothing;
    end if;

    get diagnostics recipient_count = row_count;
    if recipient_count = 0 then
      delete from public.reminders where id = created_reminder_id;
      continue;
    end if;

    insert into public.reminder_recipients (
      tenant_id,
      reminder_id,
      user_id,
      employee_id,
      effective_remind_at
    )
    select distinct
      requested_tenant_id,
      created_reminder_id,
      employee.auth_user_id,
      employee.id,
      (select reminder.remind_at from public.reminders reminder where reminder.id = created_reminder_id)
    from public.reminder_targets target
    join public.employees employee on employee.id = target.employee_id
    where target.reminder_id = created_reminder_id
      and employee.auth_user_id is not null
    on conflict (reminder_id, user_id) do nothing;
  end loop;

  return created_address_id;
end;
$$;

revoke all on function public.create_employee_address_with_reminders(uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, date, date, text, text, text[]) from public, anon;
grant execute on function public.create_employee_address_with_reminders(uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, date, date, text, text, text[]) to authenticated;

revoke all on function internal_security.guard_employee_address_record() from public, anon, authenticated;
