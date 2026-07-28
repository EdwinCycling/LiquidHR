begin;

do $$
begin
  if to_regclass('public.overtime_type_settings') is null
     or to_regclass('public.overtime_type_exceptions') is null then
    raise exception 'Overwerktabellen ontbreken.';
  end if;
  if not exists (
    select 1 from pg_type type
    join pg_namespace namespace on namespace.oid = type.typnamespace
    where namespace.nspname = 'public'
      and type.typname = 'overtime_limit_mode'
  ) then
    raise exception 'Overwerkbeperkingen-enum ontbreekt.';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'work_hour_types' and column_name = 'is_self_service'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'work_hour_types' and column_name = 'pin_in_calendar'
  ) then
    raise exception 'Werkurentype-instellingen ontbreken.';
  end if;
  if not exists (
    select 1 from public.work_hour_types type
    left join public.overtime_type_settings settings on settings.work_hour_type_id = type.id
      and settings.tenant_id = type.tenant_id
      and settings.administration_id = type.administration_id
    where settings.id is not null
  ) then
    raise exception 'Werkurentypen hebben geen gedeelde beperkingenset.';
  end if;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['overtime_type_settings', 'overtime_type_exceptions'] loop
    if not exists (
      select 1 from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = table_name
        and relation.relrowsecurity
    ) then
      raise exception 'RLS ontbreekt op overwerktabel: %', table_name;
    end if;
    if not exists (
      select 1 from pg_policies policy
      where policy.schemaname = 'public'
        and policy.tablename = table_name
    ) then
      raise exception 'Policy ontbreekt op overwerktabel: %', table_name;
    end if;
    if not exists (
      select 1
      from pg_trigger trigger
      join pg_class relation on relation.oid = trigger.tgrelid
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      join pg_proc audit_function on audit_function.oid = trigger.tgfoid
      where namespace.nspname = 'public'
        and relation.relname = table_name
        and audit_function.proname = 'audit_configuration_change'
        and not trigger.tgisinternal
    ) then
      raise exception 'Audittrigger ontbreekt op overwerktabel: %', table_name;
    end if;
  end loop;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'leave_types_identity_immutable' and not tgisinternal)
     or not exists (select 1 from pg_trigger where tgname = 'work_hour_types_identity_immutable' and not tgisinternal)
     or not exists (select 1 from pg_trigger where tgname = 'leave_accrual_rules_identity_immutable' and not tgisinternal) then
    raise exception 'Immutable catalogus- en regeltriggers ontbreken.';
  end if;
end;
$$;

do $$
begin
  if has_table_privilege('anon', 'public.overtime_type_settings', 'SELECT')
     or has_table_privilege('anon', 'public.overtime_type_exceptions', 'SELECT') then
    raise exception 'Anon mag overwerkconfiguratie niet lezen.';
  end if;
end;
$$;

rollback;
