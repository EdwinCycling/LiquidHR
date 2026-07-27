begin;

do $$
declare
  address_function regprocedure := 'public.create_employee_address_with_reminders(uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, date, date, text[])'::regprocedure;
begin
  if has_function_privilege('anon', address_function, 'execute') then
    raise exception 'anon mag de adres-reminderfunctie niet uitvoeren';
  end if;

  if not has_function_privilege('authenticated', address_function, 'execute') then
    raise exception 'authenticated mist EXECUTE op de adres-reminderfunctie';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.employee_addresses'::regclass
      and tgname = 'prevent_last_employee_address_archive'
      and not tgisinternal
  ) then
    raise exception 'trigger voor laatste adres ontbreekt';
  end if;
end
$$;

rollback;
