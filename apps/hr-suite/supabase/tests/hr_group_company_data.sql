begin;

select plan(35);

select has_table('public', 'administration_company_data', 'Bedrijfsgegevens bestaan als groepsbrede tabel.');
select has_table('public', 'administration_locations', 'Locaties bestaan als groepsbrede tabel.');
select has_column('public', 'administration_company_data', 'hr_group_id', 'Bedrijfsgegevens dragen de HR-groep.');
select has_column('public', 'administration_locations', 'hr_group_id', 'Locaties dragen de HR-groep.');
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('administration_company_data', 'administration_locations')
      and column_name = 'administration_id'
  ),
  'Bedrijf en locaties hebben geen legacy administratie-eigenaarskolom meer.'
);

select ok((select relrowsecurity from pg_class where oid = 'public.administration_company_data'::regclass), 'RLS staat aan voor bedrijfsgegevens.');
select ok((select relrowsecurity from pg_class where oid = 'public.administration_locations'::regclass), 'RLS staat aan voor locaties.');
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.administration_company_data'::regclass
      and conname = 'administration_company_data_hr_group_fkey'
  ),
  'Bedrijfsgegevens hebben een tenant-naar-groep foreign key.'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.administration_locations'::regclass
      and conname = 'administration_locations_hr_group_fkey'
  ),
  'Locaties hebben een tenant-naar-groep foreign key.'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.administration_company_data'::regclass
      and conname = 'administration_company_data_scope_key'
  ),
  'Iedere HR-groep heeft maximaal één bedrijfsgegevensrij.'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.administration_locations'::regclass
      and conname = 'administration_locations_tenant_hr_group_id_key'
  ),
  'Locaties hebben een groepsgebonden unieke technische sleutel.'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.employee_organizations'::regclass
      and conname = 'employee_organizations_location_hr_group_scope_fkey'
  ),
  'Een employment-plaatsing kan alleen naar een locatie in dezelfde HR-groep wijzen.'
);
select has_column('public', 'administrations', 'administration_number', 'Administraties hebben een beheerbaar nummer.');

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'administration_company_data'
      and policyname = 'administration_company_data_read'
      and qual ilike '%current_user_has_hr_group_permission%'
  ),
  'Bedrijfsgegevens lezen gebruikt de HR-groepspermission.'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'administration_locations'
      and policyname = 'administration_locations_read'
      and qual ilike '%current_user_has_hr_group_permission%'
  ),
  'Locaties lezen gebruikt de HR-groepspermission.'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'administrations'
      and policyname = 'administrations_update_hr_group_manager'
  ),
  'Een HR-admin kan administratiegegevens binnen de eigen groep wijzigen.'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.administrations'::regclass
      and tgname = 'prevent_administration_identity_change'
      and not tgisinternal
  ),
  'Administratie-id, tenant, groep en code zijn database-side immutable.'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.administration_company_data'::regclass
      and tgname = 'audit_administration_company_data'
      and not tgisinternal
  ),
  'Wijzigingen aan bedrijfsgegevens worden geaudit.'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.administration_locations'::regclass
      and tgname = 'audit_administration_locations'
      and not tgisinternal
  ),
  'Wijzigingen aan locaties worden geaudit.'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.administrations'::regclass
      and tgname = 'audit_administrations'
      and not tgisinternal
  ),
  'Wijzigingen aan administratienaam en -nummer worden geaudit.'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.hr_groups'::regclass
      and tgname = 'ensure_hr_group_company_data_after_insert'
      and not tgisinternal
  ),
  'Een nieuwe HR-groep krijgt automatisch een bedrijfsgegevensrij.'
);

select has_function('public', 'manage_employment_company_location', ARRAY['uuid', 'uuid', 'date', 'uuid'], 'De employment-locatie-RPC bestaat.');
select has_function('public', 'manage_employment_organization_timeline', ARRAY['uuid', 'uuid', 'date', 'uuid', 'uuid'], 'De organisatie-timeline-RPC bestaat.');

select ok(
  not has_table_privilege('anon', 'public.administration_company_data', 'select'),
  'Anon heeft geen directe leesrechten op bedrijfsgegevens.'
);
select ok(
  not has_table_privilege('anon', 'public.administration_locations', 'select'),
  'Anon heeft geen directe leesrechten op locaties.'
);
select ok(
  has_table_privilege('authenticated', 'public.administration_company_data', 'select'),
  'Authenticated heeft leesrechten op bedrijfsgegevens, begrensd door RLS.'
);
select ok(
  has_table_privilege('authenticated', 'public.administration_locations', 'select'),
  'Authenticated heeft leesrechten op locaties, begrensd door RLS.'
);
select ok(
  has_column_privilege('authenticated', 'public.employees', 'hr_group_id', 'select')
    and has_column_privilege('authenticated', 'public.employees', 'hr_group_id', 'insert'),
  'De employees-groepskolom is leesbaar en bij aanmaken schrijfbaar, maar niet wijzigbaar.'
);
select ok(
  not exists (
    select 1
    from public.management_roles role
    where role.code = 'TENANT_ADMIN'
      and role.tenant_id is not null
      and not exists (
        select 1
        from public.role_permissions role_permission
        join public.permissions permission on permission.id = role_permission.permission_id
        where role_permission.management_role_id = role.id
          and permission.code in ('hr-group:read', 'hr-group:manage')
        group by role_permission.management_role_id
        having count(distinct permission.code) = 2
      )
  ),
  'Iedere tenant-specifieke HR-adminrol kan de inrichting van de eigen HR-groep beheren.'
);

select ok(
  not exists (
    select 1
    from (
      select group_row.tenant_id, group_row.id
      from public.hr_groups group_row
      left join public.administration_company_data company
        on company.tenant_id = group_row.tenant_id
       and company.hr_group_id = group_row.id
      group by group_row.tenant_id, group_row.id
      having count(company.id) <> 1
    ) invalid_groups
  ),
  'Iedere HR-groep heeft exact één bedrijfsgegevensrij.'
);
select ok(
  not exists (
    select 1
    from public.employee_organizations placement
    join public.administration_locations location
      on location.tenant_id = placement.tenant_id
     and location.id = placement.location_id
    where placement.location_id is not null
      and placement.hr_group_id <> location.hr_group_id
  ),
  'Geen enkele bestaande employment-plaatsing overschrijdt de groepsgrens.'
);

select ok(
  exists (select 1 from public.hr_groups where code = 'TEST-BOUNDARY'),
  'De gecontroleerde TEST-BOUNDARY HR-groep bestaat.'
);
select ok(
  exists (
    select 1
    from public.administrations administration
    join public.hr_groups group_row
      on group_row.tenant_id = administration.tenant_id
     and group_row.id = administration.hr_group_id
    where group_row.code = 'TEST-BOUNDARY'
      and administration.code = 'TEST-BOUNDARY-ADMIN'
  ),
  'De gecontroleerde testadministratie zit in TEST-BOUNDARY.'
);
select ok(
  exists (
    select 1
    from public.administration_locations location
    join public.hr_groups group_row
      on group_row.tenant_id = location.tenant_id
     and group_row.id = location.hr_group_id
    where group_row.code = 'TEST-BOUNDARY'
      and location.name = 'Testgroep B locatie'
  ),
  'De gecontroleerde testlocatie zit in TEST-BOUNDARY.'
);
select is(
  (
    select count(*)::integer
    from public.employees employee
    join public.hr_groups group_row
      on group_row.tenant_id = employee.tenant_id
     and group_row.id = employee.hr_group_id
    where group_row.code = 'TEST-BOUNDARY'
  ),
  0,
  'TEST-BOUNDARY bevat bewust geen medewerkers.'
);

select * from finish();
rollback;
