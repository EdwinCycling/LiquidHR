begin;

do $$
begin
  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'personal_dashboards' and rowsecurity) then
    raise exception 'personal_dashboards mist RLS.';
  end if;
  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'personal_dashboard_widgets' and rowsecurity) then
    raise exception 'personal_dashboard_widgets mist RLS.';
  end if;
end
$$;

rollback;
