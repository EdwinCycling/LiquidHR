begin;

-- Runner-onafhankelijke Step 8-contracttest. De tijdelijke records worden
-- binnen deze transactie aangemaakt en door rollback nooit opgeslagen.
do $$
declare
  relation_name text;
  tenant uuid;
  default_group uuid;
  multigroup_group uuid;
  default_employee uuid;
  multigroup_employee uuid;
  employment_ids uuid[];
  employment_admin_ids uuid[];
  employment_one uuid;
  employment_two uuid;
  employment_other_group uuid;
  default_admin uuid;
  multigroup_admin uuid;
  case_one uuid := gen_random_uuid();
  case_two uuid := gen_random_uuid();
  overlap_case uuid := gen_random_uuid();
  other_group_case uuid := gen_random_uuid();
  spell_one uuid := gen_random_uuid();
  spell_two uuid := gen_random_uuid();
  overlap_spell uuid := gen_random_uuid();
  other_group_spell uuid := gen_random_uuid();
  exclusion_seen boolean := false;
begin
  foreach relation_name in array array[
    'absence_settings', 'absence_cases', 'absence_spells',
    'absence_capacity_changes', 'absence_mutations'
  ] loop
    if to_regclass('public.' || relation_name) is null then
      raise exception 'STEP8_TABLE_MISSING_%', relation_name;
    end if;
    if not exists (
      select 1
      from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = relation_name
        and relation.relrowsecurity
    ) then
      raise exception 'STEP8_RLS_MISSING_%', relation_name;
    end if;
    if not exists (
      select 1 from pg_policies policy
      where policy.schemaname = 'public'
        and policy.tablename = relation_name
    ) then
      raise exception 'STEP8_POLICY_MISSING_%', relation_name;
    end if;
  end loop;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'absence_settings_tenant_hr_group_unique'
  ) then
    raise exception 'STEP8_SETTINGS_GROUP_INDEX_MISSING';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.absence_spells'::regclass
      and conname = 'absence_spells_case_employment_hr_group_fkey'
  ) then
    raise exception 'STEP8_SPELL_EMPLOYMENT_FK_MISSING';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.absence_spells'::regclass
      and conname = 'absence_spells_no_employment_overlap'
  ) then
    raise exception 'STEP8_OVERLAP_CONSTRAINT_MISSING';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.absence_capacity_changes'::regclass
      and conname = 'absence_capacity_case_spell_hr_group_fkey'
  ) then
    raise exception 'STEP8_CAPACITY_SCOPE_FK_MISSING';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name in ('absence_settings', 'absence_cases', 'absence_spells', 'absence_capacity_changes', 'absence_mutations')
      and column_name ~* '(diagnos|behandel|medisch|medical|cause)'
  ) then
    raise exception 'STEP8_MEDICAL_CONTENT_COLUMN_PRESENT';
  end if;
  if (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'absence_spells' and column_name = 'employment_id') <> 'NO'
     or (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'absence_cases' and column_name = 'employment_id') <> 'NO' then
    raise exception 'STEP8_EMPLOYMENT_KEY_NOT_REQUIRED';
  end if;
  if (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'absence_settings' and column_name = 'administration_id') <> 'YES' then
    raise exception 'STEP8_SETTINGS_ADMIN_METADATA_NOT_NULLABLE';
  end if;

  if to_regprocedure('public.report_absence(uuid,uuid,uuid,uuid,date,numeric,date,boolean,boolean,boolean,text)') is null
     or to_regprocedure('public.recover_absence(uuid,date,text)') is null
     or to_regprocedure('public.change_absence_capacity(uuid,date,numeric,date,text)') is null then
    raise exception 'STEP8_REQUIRED_RPC_MISSING';
  end if;
  if not has_function_privilege('authenticated', to_regprocedure('public.report_absence(uuid,uuid,uuid,uuid,date,numeric,date,boolean,boolean,boolean,text)'), 'EXECUTE')
     or not has_function_privilege('authenticated', to_regprocedure('public.recover_absence(uuid,date,text)'), 'EXECUTE')
     or not has_function_privilege('authenticated', to_regprocedure('public.change_absence_capacity(uuid,date,numeric,date,text)'), 'EXECUTE') then
    raise exception 'STEP8_RPC_GRANT_MISSING';
  end if;
  if has_function_privilege('anon', to_regprocedure('public.report_absence(uuid,uuid,uuid,uuid,date,numeric,date,boolean,boolean,boolean,text)'), 'EXECUTE')
     or has_function_privilege('anon', to_regprocedure('public.recover_absence(uuid,date,text)'), 'EXECUTE')
     or has_function_privilege('anon', to_regprocedure('public.change_absence_capacity(uuid,date,numeric,date,text)'), 'EXECUTE') then
    raise exception 'STEP8_ANON_RPC_GRANT_REMAINS';
  end if;

  select id into tenant from public.tenants where slug = 'liquid-hr-demo-holding' limit 1;
  select id into default_group from public.hr_groups where tenant_id = tenant and code = 'DEFAULT' limit 1;
  select id into multigroup_group from public.hr_groups where tenant_id = tenant and code = 'TEST-MULTIGROUP' limit 1;

  select employment.employee_id,
         array_agg(employment.id order by employment.starts_on, employment.id),
         array_agg(employment.administration_id order by employment.starts_on, employment.id)
    into default_employee, employment_ids, employment_admin_ids
  from public.employments employment
  join public.employees employee
    on employee.tenant_id = employment.tenant_id
   and employee.hr_group_id = employment.hr_group_id
   and employee.id = employment.employee_id
  where employment.tenant_id = tenant
    and employment.hr_group_id = default_group
    and employment.record_status = 'CONFIRMED'
    and employment.deleted_at is null
    and employee.deleted_at is null
  group by employment.employee_id
  having count(*) >= 2
  order by employment.employee_id
  limit 1;

  employment_one := employment_ids[1];
  employment_two := employment_ids[2];
  default_admin := employment_admin_ids[1];

  select employment.employee_id, employment.id, employment.administration_id
    into multigroup_employee, employment_other_group, multigroup_admin
  from public.employments employment
  join public.employees employee
    on employee.tenant_id = employment.tenant_id
   and employee.hr_group_id = employment.hr_group_id
   and employee.id = employment.employee_id
  where employment.tenant_id = tenant
    and employment.hr_group_id = multigroup_group
    and employment.record_status = 'CONFIRMED'
    and employment.deleted_at is null
    and employee.deleted_at is null
  order by employment.starts_on, employment.id
  limit 1;

  if tenant is null or default_group is null or multigroup_group is null
     or default_employee is null or employment_one is null or employment_two is null
     or multigroup_employee is null or employment_other_group is null then
    raise exception 'STEP8_CONTROLLED_FIXTURE_CONTEXT_MISSING';
  end if;

  if not exists (
    select 1
    from public.hr_groups group_row
    left join public.absence_settings settings
      on settings.tenant_id = group_row.tenant_id
     and settings.hr_group_id = group_row.id
    where group_row.is_active
    group by group_row.tenant_id, group_row.id
    having count(settings.id) <> 1
  ) then
    null;
  else
    raise exception 'STEP8_GROUP_SETTINGS_COUNT_INVALID';
  end if;

  -- Twee employments van dezelfde persoon mogen op dezelfde dag parallel ziek zijn.
  insert into public.absence_cases (
    id, tenant_id, hr_group_id, administration_id, employee_id, employment_id,
    first_absence_on, effective_clock_start_on
  ) values (
    case_one, tenant, default_group, default_admin, default_employee, employment_one,
    date '2099-01-10', date '2099-01-10'
  );
  insert into public.absence_spells (
    id, tenant_id, hr_group_id, case_id, employment_id, started_on
  ) values (
    spell_one, tenant, default_group, case_one, employment_one, date '2099-01-10'
  );
  insert into public.absence_capacity_changes (
    tenant_id, hr_group_id, case_id, spell_id, effective_on, absence_percentage
  ) values (
    tenant, default_group, case_one, spell_one, date '2099-01-10', 50
  );

  insert into public.absence_cases (
    id, tenant_id, hr_group_id, administration_id, employee_id, employment_id,
    first_absence_on, effective_clock_start_on
  ) values (
    case_two, tenant, default_group, default_admin, default_employee, employment_two,
    date '2099-01-10', date '2099-01-10'
  );
  insert into public.absence_spells (
    id, tenant_id, hr_group_id, case_id, employment_id, started_on
  ) values (
    spell_two, tenant, default_group, case_two, employment_two, date '2099-01-10'
  );
  insert into public.absence_capacity_changes (
    tenant_id, hr_group_id, case_id, spell_id, effective_on, absence_percentage
  ) values (
    tenant, default_group, case_two, spell_two, date '2099-01-10', 50
  );

  -- Dezelfde datum op hetzelfde employment moet door de exclusion constraint falen.
  insert into public.absence_cases (
    id, tenant_id, hr_group_id, administration_id, employee_id, employment_id,
    first_absence_on, effective_clock_start_on, status, closed_at
  ) values (
    overlap_case, tenant, default_group, default_admin, default_employee, employment_one,
    date '2099-01-11', date '2099-01-11', 'CLOSED', timezone('utc', now())
  );
  begin
    insert into public.absence_spells (
      id, tenant_id, hr_group_id, case_id, employment_id, started_on
    ) values (
      overlap_spell, tenant, default_group, overlap_case, employment_one, date '2099-01-11'
    );
  exception when exclusion_violation then
    exclusion_seen := true;
  end;
  if not exclusion_seen then
    raise exception 'STEP8_SAME_EMPLOYMENT_OVERLAP_ACCEPTED';
  end if;

  -- Een andere HR-groep is een aparte scope en mag dezelfde datum gebruiken.
  insert into public.absence_cases (
    id, tenant_id, hr_group_id, administration_id, employee_id, employment_id,
    first_absence_on, effective_clock_start_on
  ) values (
    other_group_case, tenant, multigroup_group, multigroup_admin, multigroup_employee, employment_other_group,
    date '2099-01-10', date '2099-01-10'
  );
  insert into public.absence_spells (
    id, tenant_id, hr_group_id, case_id, employment_id, started_on
  ) values (
    other_group_spell, tenant, multigroup_group, other_group_case, employment_other_group, date '2099-01-10'
  );

  -- Herstel van employment 1 mag de parallelle spell op employment 2 niet raken.
  update public.absence_spells
  set recovered_on = date '2099-01-20'
  where id = spell_one;
  if exists (select 1 from public.absence_spells where id = spell_two and recovered_on is not null) then
    raise exception 'STEP8_RECOVERY_CROSSED_EMPLOYMENT_BOUNDARY';
  end if;
  if (select absence_percentage from public.absence_capacity_changes where spell_id = spell_two order by effective_on desc limit 1) <> 50 then
    raise exception 'STEP8_PARTIAL_CAPACITY_FIXTURE_INVALID';
  end if;
end;
$$;

rollback;
