begin;

select plan(37);

select has_table('public', 'hr_groups', 'HR-groepen bestaan als primaire contextentiteit.');
select has_table('public', 'user_hr_group_access', 'Gebruikerstoegang per HR-groep bestaat.');
select has_column('public', 'administrations', 'hr_group_id', 'Administraties dragen een HR-groep.');
select has_column('public', 'employees', 'hr_group_id', 'Personen dragen een HR-groep.');
select has_column('public', 'employments', 'hr_group_id', 'Dienstverbanden dragen een HR-groep.');
select has_column('public', 'labor_condition_sets', 'hr_group_id', 'CAO-catalogi dragen een HR-groep.');
select has_column('public', 'employment_contracts', 'hr_group_id', 'Contracten dragen een HR-groep.');
select has_column('public', 'absence_cases', 'hr_group_id', 'Verzuimcasussen dragen een HR-groep.');

select ok((select relrowsecurity from pg_class where oid = 'public.hr_groups'::regclass), 'RLS staat aan voor HR-groepen.');
select ok((select relrowsecurity from pg_class where oid = 'public.user_hr_group_access'::regclass), 'RLS staat aan voor groeps-toegang.');
select ok((select relrowsecurity from pg_class where oid = 'public.administrations'::regclass), 'RLS staat aan voor administraties.');
select ok((select relrowsecurity from pg_class where oid = 'public.employments'::regclass), 'RLS staat aan voor dienstverbanden.');
select ok((select relrowsecurity from pg_class where oid = 'public.labor_condition_sets'::regclass), 'RLS staat aan voor CAO-catalogi.');
select ok((select relrowsecurity from pg_class where oid = 'public.employment_contracts'::regclass), 'RLS staat aan voor contracten.');
select ok((select relrowsecurity from pg_class where oid = 'public.absence_cases'::regclass), 'RLS staat aan voor verzuimcasussen.');

select ok(
  (select count(*) from public.hr_groups where code = 'DEFAULT') =
    (select count(*) from public.tenants),
  'Iedere bestaande tenant heeft exact één reproduceerbare DEFAULT-groep.'
);
select ok(
  not exists (
    select 1
    from public.administrations administration
    left join public.hr_groups group_row
      on group_row.tenant_id = administration.tenant_id
     and group_row.id = administration.hr_group_id
    where group_row.id is null
  ),
  'Iedere administratie wijst naar een HR-groep binnen dezelfde tenant.'
);
select ok(
  not exists (
    select 1
    from public.employments employment
    join public.administrations administration
      on administration.tenant_id = employment.tenant_id
     and administration.id = employment.administration_id
    where employment.hr_group_id <> administration.hr_group_id
  ),
  'Een dienstverband en zijn administratie zitten in dezelfde HR-groep.'
);
select ok(
  not exists (
    select 1
    from public.absence_cases absence_case
    join public.employments employment
      on employment.tenant_id = absence_case.tenant_id
     and employment.id = absence_case.employment_id
    where absence_case.hr_group_id <> employment.hr_group_id
  ),
  'Een verzuimcasus en zijn dienstverband zitten in dezelfde HR-groep.'
);
select ok(
  not exists (
    select 1
    from public.employments
    where hr_group_id is null
  ),
  'Bestaande dienstverbanden zijn volledig gemigreerd naar een HR-groep.'
);
select ok(
  not exists (
    select 1
    from public.absence_cases
    where hr_group_id is null
  ),
  'Bestaande verzuimcasussen zijn volledig gemigreerd naar een HR-groep.'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.employments'::regclass
      and conname = 'employments_administration_hr_group_fkey'
      and contype = 'f'
  ),
  'De administratie-dienstverbandrelatie bevat een HR-groep in de foreign key.'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.absence_cases'::regclass
      and conname = 'absence_cases_employment_hr_group_fkey'
      and contype = 'f'
  ),
  'De dienstverband-verzuimrelatie bevat een HR-groep in de foreign key.'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.labor_condition_sets'::regclass
      and conname = 'labor_condition_sets_administration_hr_group_fkey'
      and contype = 'f'
  ),
  'De CAO-catalogusrelatie bevat een HR-groep in de foreign key.'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.employment_contracts'::regclass
      and conname = 'employment_contracts_labor_condition_hr_group_fkey'
      and contype = 'f'
  ),
  'De contract-CAO-relatie bevat een HR-groep in de foreign key.'
);
select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'administrations'
      and policyname = 'administrations_hr_group_boundary'
      and permissive = 'RESTRICTIVE'
  ),
  'Administraties hebben een restrictive HR-groepgrens bovenop bestaande policies.'
);
select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'absence_cases'
      and policyname = 'absence_cases_hr_group_boundary'
      and permissive = 'RESTRICTIVE'
  ),
  'Verzuimcasussen hebben een restrictive HR-groepgrens.'
);
select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.administrations'::regclass
      and tgname = 'prevent_administration_hr_group_change'
      and not tgisinternal
  ),
  'Een bestaande administratie kan niet naar een andere HR-groep worden verplaatst.'
);
select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.administrations'::regclass
      and tgname = 'prevent_administration_delete'
      and not tgisinternal
  ),
  'Een bestaande administratie kan niet worden verwijderd.'
);
select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.labor_condition_sets'::regclass
      and tgname = 'enforce_labor_condition_set_limit'
      and not tgisinternal
  ),
  'De CAO-catalogus heeft een databasegrens van maximaal drie actieve sets.'
);
select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.employment_contracts'::regclass
      and tgname = 'prevent_employment_cao_change'
      and not tgisinternal
  ),
  'Een bestaand dienstverband heeft een immutable CAO-trigger.'
);

select ok(
  not has_table_privilege('anon', 'public.hr_groups', 'select'),
  'Anon heeft geen directe leesrechten op HR-groepen.'
);
select ok(
  has_table_privilege('authenticated', 'public.hr_groups', 'select'),
  'Authenticated heeft het benodigde directe privilege voor HR-groepen.'
);

select lives_ok(
  $$
    insert into public.hr_groups (tenant_id, code, name)
    select tenant.id, 'TEST-OTHER', 'Test tweede HR-groep'
    from public.tenants tenant
    order by tenant.id
    limit 1
  $$,
  'Een tweede HR-groep kan naast de bestaande defaultgroep bestaan.'
);
select throws_ok(
  $$
    update public.administrations administration
    set hr_group_id = (
      select group_row.id
      from public.hr_groups group_row
      where group_row.tenant_id = administration.tenant_id
        and group_row.code = 'TEST-OTHER'
    )
    where administration.id = (
      select candidate.id
      from public.administrations candidate
      where candidate.tenant_id = administration.tenant_id
      order by candidate.id
      limit 1
    )
  $$,
  'P0001',
  'HR_GROUP_IMMUTABLE',
  'Een bestaande administratie kan niet cross-group worden gemuteerd.'
);

select lives_ok(
  $$
    insert into public.labor_condition_sets (
      tenant_id, administration_id, hr_group_id, code, name
    )
    select administration.tenant_id,
           administration.id,
           administration.hr_group_id,
           'TEST-CAO',
           'Test tweede CAO'
    from public.administrations administration
    where exists (
      select 1
      from public.employment_contracts contract
      where contract.administration_id = administration.id
    )
    order by administration.id
    limit 1
  $$,
  'Een tweede CAO kan binnen de actieve administratie worden ingericht.'
);
select throws_ok(
  $$
    update public.employment_contracts contract
    set labor_condition_set_id = (
      select condition_set.id
      from public.labor_condition_sets condition_set
      where condition_set.tenant_id = contract.tenant_id
        and condition_set.administration_id = contract.administration_id
        and condition_set.code = 'TEST-CAO'
    )
    where contract.id = (
      select candidate.id
      from public.employment_contracts candidate
      where candidate.administration_id = (
        select condition_set.administration_id
        from public.labor_condition_sets condition_set
        where condition_set.code = 'TEST-CAO'
        limit 1
      )
      order by candidate.id
      limit 1
    )
  $$,
  'P0001',
  'EMPLOYMENT_CAO_IMMUTABLE',
  'De CAO van een bestaand dienstverband kan niet worden gewijzigd.'
);

select * from finish();
rollback;
