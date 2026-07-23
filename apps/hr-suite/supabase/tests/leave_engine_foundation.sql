begin;

do $$
declare
  table_name text;
  required_tables constant text[] := array[
    'leave_year_controls', 'leave_types', 'work_hour_types', 'leave_profiles',
    'employment_leave_profiles', 'leave_accrual_rules', 'leave_accrual_rule_work_hour_types',
    'leave_accrual_rule_pause_types', 'leave_accrual_exceptions', 'leave_bonus_rules',
    'leave_bonus_tiers', 'leave_priority_rules', 'leave_priority_rule_items',
    'employment_work_hour_entries', 'leave_balance_buckets', 'leave_accrual_transactions',
    'leave_year_rollovers', 'leave_year_rollover_items'
  ];
begin
  foreach table_name in array required_tables loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'Verloftabel ontbreekt: %', table_name;
    end if;

    if not exists (
      select 1
      from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = table_name
        and relation.relrowsecurity
    ) then
      raise exception 'RLS ontbreekt op verloftabel: %', table_name;
    end if;

    if not exists (
      select 1
      from pg_policies policy
      where policy.schemaname = 'public'
        and policy.tablename = table_name
    ) then
      raise exception 'Policy ontbreekt op verloftabel: %', table_name;
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
      raise exception 'Audittrigger ontbreekt op verloftabel: %', table_name;
    end if;
  end loop;
end;
$$;

do $$
begin
  if not has_table_privilege('authenticated', 'public.leave_balance_buckets', 'SELECT')
     or has_table_privilege('authenticated', 'public.leave_balance_buckets', 'UPDATE')
     or has_table_privilege('authenticated', 'public.leave_balance_buckets', 'DELETE') then
    raise exception 'Bucket-grants zijn niet append-only/read-only voor authenticated.';
  end if;

  if not has_table_privilege('authenticated', 'public.leave_accrual_transactions', 'SELECT')
     or has_table_privilege('authenticated', 'public.leave_accrual_transactions', 'INSERT')
     or has_table_privilege('authenticated', 'public.leave_accrual_transactions', 'UPDATE')
     or has_table_privilege('authenticated', 'public.leave_accrual_transactions', 'DELETE') then
    raise exception 'Grootboek-grants zijn niet append-only/read-only voor authenticated.';
  end if;
end;
$$;

do $$
declare permission_code text;
begin
  foreach permission_code in array array[
    'leave:read', 'leave:write', 'leave:year-close', 'leave:adjust',
    'leave:audit-read', 'self:leave:read'
  ] loop
    if not exists (select 1 from public.permissions where code = permission_code) then
      raise exception 'Verlofpermissie ontbreekt: %', permission_code;
    end if;
  end loop;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employment_leave_profiles'::regclass
      and conname = 'employment_leave_profiles_no_overlap'
  ) then
    raise exception 'Overlapconstraint voor profieltoewijzingen ontbreekt.';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.leave_accrual_rules'::regclass
      and conname = 'leave_accrual_rules_no_overlap'
  ) then
    raise exception 'Overlapconstraint voor opbouwregelversies ontbreekt.';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.leave_accrual_exceptions'::regclass
      and conname = 'leave_accrual_exceptions_no_overlap'
  ) then
    raise exception 'Overlapconstraint voor uitzonderingen ontbreekt.';
  end if;
end;
$$;

do $$
declare trigger_name text;
begin
  foreach trigger_name in array array[
    'leave_accrual_rules_chain_check', 'leave_accrual_rules_locked_check',
    'leave_transactions_append_only', 'leave_transactions_locked_check',
    'leave_rollover_items_append_only',
    'leave_bonus_rules_tier_check', 'leave_bonus_tiers_rule_check'
  ] loop
    if not exists (select 1 from pg_trigger where tgname = trigger_name and not tgisinternal) then
      raise exception 'Kritieke verloftrigger ontbreekt: %', trigger_name;
    end if;
  end loop;
end;
$$;

rollback;
