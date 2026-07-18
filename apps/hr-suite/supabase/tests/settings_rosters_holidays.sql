begin;

do $$
begin
  if to_regclass('public.tenant_modules') is null then
    raise exception 'tenant_modules ontbreekt';
  end if;
  if to_regclass('public.employment_work_patterns') is null then
    raise exception 'employment_work_patterns ontbreekt';
  end if;
  if to_regclass('public.employment_work_pattern_days') is null then
    raise exception 'employment_work_pattern_days ontbreekt';
  end if;
  if to_regclass('public.holiday_calendars') is null then
    raise exception 'holiday_calendars ontbreekt';
  end if;
  if to_regclass('public.holidays') is null then
    raise exception 'holidays ontbreekt';
  end if;
  if to_regprocedure('public.publish_employment_work_pattern(uuid,jsonb)') is null then
    raise exception 'publish_employment_work_pattern ontbreekt';
  end if;
  if exists (
    select 1 from pg_proc
    where oid = 'public.publish_employment_work_pattern(uuid,jsonb)'::regprocedure
      and prosecdef
  ) then
    raise exception 'publish_employment_work_pattern mag geen security definer zijn';
  end if;
  if exists (
    select 1
    from (values
      ('tenant_modules'),
      ('employment_work_patterns'),
      ('employment_work_pattern_days'),
      ('holiday_calendars'),
      ('holidays')
    ) expected(table_name)
    where not exists (
      select 1 from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = expected.table_name
        and relation.relrowsecurity
    )
  ) then
    raise exception 'RLS ontbreekt op een nieuwe tabel';
  end if;
end $$;

rollback;
