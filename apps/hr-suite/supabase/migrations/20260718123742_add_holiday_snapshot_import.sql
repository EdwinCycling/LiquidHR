create or replace function public.import_holiday_snapshot(
  requested_administration_id uuid,
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
  select administration.tenant_id into requested_tenant_id
  from public.administrations administration
  where administration.id = requested_administration_id and administration.is_active;

  if requested_tenant_id is null then
    raise exception using errcode = 'P0002', message = 'HOLIDAY_ADMINISTRATION_NOT_FOUND';
  end if;
  if not internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, 'holidays:write') then
    raise exception using errcode = '42501', message = 'HOLIDAY_FORBIDDEN';
  end if;
  if requested_calendar_year not between 2000 and 2200 or requested_country_code !~ '^[A-Z]{2}$'
     or jsonb_typeof(requested_holidays) <> 'array' or jsonb_array_length(requested_holidays) > 400 then
    raise exception using errcode = '22023', message = 'HOLIDAY_IMPORT_INVALID';
  end if;

  insert into public.holiday_calendars(tenant_id, administration_id, calendar_year, country_code, imported_at, imported_by)
  values(requested_tenant_id, requested_administration_id, requested_calendar_year, requested_country_code, timezone('utc',now()), auth.uid())
  on conflict(tenant_id, administration_id, calendar_year, country_code)
  do update set imported_at=excluded.imported_at, imported_by=excluded.imported_by
  returning id into calendar_id;

  update public.holidays holiday
  set is_active=false, updated_by=auth.uid()
  where holiday.holiday_calendar_id=calendar_id and holiday.source='API'
    and not exists (
      select 1 from jsonb_array_elements(requested_holidays) item
      where item ->> 'external_key' = holiday.external_key
    );

  insert into public.holidays(
    tenant_id, administration_id, holiday_calendar_id, holiday_date, provider_name,
    display_name, source, external_key, holiday_types, subdivision_codes, created_by, updated_by
  )
  select requested_tenant_id, requested_administration_id, calendar_id,
    item.holiday_date, item.provider_name, item.display_name, 'API', item.external_key,
    coalesce(item.holiday_types,'{}'), coalesce(item.subdivision_codes,'{}'), auth.uid(), auth.uid()
  from jsonb_to_recordset(requested_holidays) item(
    holiday_date date,
    provider_name text,
    display_name text,
    external_key text,
    holiday_types text[],
    subdivision_codes text[]
  )
  on conflict(holiday_calendar_id,external_key) where external_key is not null
  do update set holiday_date=excluded.holiday_date, provider_name=excluded.provider_name,
    display_name=excluded.display_name, holiday_types=excluded.holiday_types,
    subdivision_codes=excluded.subdivision_codes, updated_by=auth.uid();

  return calendar_id;
end;
$$;

revoke all on function public.import_holiday_snapshot(uuid,smallint,text,jsonb) from public,anon;
grant execute on function public.import_holiday_snapshot(uuid,smallint,text,jsonb) to authenticated;
