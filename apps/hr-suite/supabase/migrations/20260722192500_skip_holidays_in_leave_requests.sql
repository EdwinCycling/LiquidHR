-- Meerdaagse HR-admin-verlofaanvragen slaan actieve feestdagen over.
-- De bestaande booking-RPC blijft de enige atomische boekingsweg; deze
-- migration vervangt alleen de daglus met een tenant/administratiegebonden
-- feestdagcontrole.
do $$
declare
  function_sql text;
  old_fragment text := '    day_hours := case extract(isodow from selected_day)::integer';
  new_fragment text := '    if exists (' || chr(10)
    || '      select 1' || chr(10)
    || '        from public.holidays holiday' || chr(10)
    || '        join public.holiday_calendars holiday_calendar on holiday_calendar.id = holiday.holiday_calendar_id' || chr(10)
    || '       where holiday.tenant_id = requested_tenant_id' || chr(10)
    || '         and holiday.administration_id = requested_administration_id' || chr(10)
    || '         and holiday.holiday_date = selected_day' || chr(10)
    || '         and holiday.is_active' || chr(10)
    || '         and holiday_calendar.tenant_id = requested_tenant_id' || chr(10)
    || '         and holiday_calendar.administration_id = requested_administration_id' || chr(10)
    || '    ) then' || chr(10)
    || '      continue;' || chr(10)
    || '    end if;' || chr(10)
    || old_fragment;
begin
  select pg_get_functiondef(pg_proc.oid)
    into function_sql
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
   where pg_namespace.nspname = 'public'
     and pg_proc.proname = 'confirm_leave_request'
   limit 1;

  if function_sql is null then
    raise exception using message = 'LEAVE_REQUEST_FUNCTION_NOT_FOUND';
  end if;
  if position(old_fragment in function_sql) = 0 then
    raise exception using message = 'LEAVE_REQUEST_FUNCTION_FRAGMENT_NOT_FOUND';
  end if;

  execute replace(function_sql, old_fragment, new_fragment);
end;
$$;
