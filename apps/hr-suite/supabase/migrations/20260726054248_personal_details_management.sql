create or replace function internal_security.prevent_last_employee_address_archive()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    perform pg_advisory_xact_lock(hashtextextended(old.tenant_id::text || ':' || old.employee_id::text, 0));

    if not exists (
      select 1
      from public.employee_addresses address
      where address.tenant_id = old.tenant_id
        and address.employee_id = old.employee_id
        and address.deleted_at is null
        and address.id <> old.id
    ) then
      raise exception 'ADDRESS_LAST_CANNOT_ARCHIVE' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_last_employee_address_archive on public.employee_addresses;
create trigger prevent_last_employee_address_archive
before update of deleted_at on public.employee_addresses
for each row execute function internal_security.prevent_last_employee_address_archive();

create or replace function public.create_employee_address_with_reminders(
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

  if requested_reminder_roles is not null
    and not requested_reminder_roles <@ array['HR_ADMIN', 'MANAGER', 'EMPLOYEE']::text[] then
    raise exception 'ADDRESS_REMINDER_ROLE_INVALID' using errcode = '22023';
  end if;

  insert into public.employee_addresses (
    tenant_id,
    employee_id,
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
    requested_valid_until
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
      'Medewerker: %s (%s)%sNieuw adres: %s%s%s%sGeldig vanaf: %s',
      coalesce((select employee.first_name || ' ' || employee.birth_name from public.employees employee where employee.id = requested_employee_id), 'Onbekende medewerker'),
      coalesce((select employee.employee_number from public.employees employee where employee.id = requested_employee_id), ''),
      chr(10),
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

revoke all on function public.create_employee_address_with_reminders(uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, date, date, text[]) from public, anon;
grant execute on function public.create_employee_address_with_reminders(uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, date, date, text[]) to authenticated;
