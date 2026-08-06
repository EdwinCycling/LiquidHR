begin;

select plan(23);

select has_column('public', 'user_access', 'hr_group_id', 'Bestaande user access kan een administratiegroep expliciet dragen.');
select has_column('public', 'administrations', 'administration_number', 'Administraties hebben een wijzigbare externe referentie.');
select has_function('public', 'get_platform_hr_groups', ARRAY['uuid'], 'Control Plane kan groepsinrichting veilig lezen.');
select has_function('public', 'create_platform_hr_group', ARRAY['uuid', 'text', 'text', 'text'], 'Control Plane kan groepen via een smalle RPC aanmaken.');

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hr_groups'
      and policyname = 'hr_groups_insert_authorized'
      and with_check ilike '%hr-group:create%'
  ),
  'Directe HR-groepaanmaak vereist de aparte create-permission.'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hr_groups'
      and policyname = 'hr_groups_update_authorized'
      and qual ilike '%current_user_has_hr_group_permission%'
  ),
  'Groepswijzigingen worden op de actieve groepsrelatie geautoriseerd.'
);
select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hr_groups'
      and cmd = 'DELETE'
  ),
  'HR-groepen hebben geen directe delete-policy.'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.hr_groups'::regclass
      and tgname = 'prevent_hr_group_delete'
      and not tgisinternal
  ),
  'HR-groepen kunnen ook via een omweg niet worden verwijderd.'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'administrations'
      and policyname = 'administrations_insert_hr_group_manager'
      and with_check ilike '%current_user_has_hr_group_permission%'
  ),
  'Een HR-admin kan alleen binnen de toegestane groep een administratie toevoegen.'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.hr_groups'::regclass
      and tgname = 'prevent_hr_group_identity_change'
      and not tgisinternal
  ),
  'De technische identiteit van een HR-groep is immutable.'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.administrations'::regclass
      and tgname = 'populate_administration_scope_defaults_before_insert'
      and not tgisinternal
  ),
  'Nieuwe administraties krijgen veilig een groep- en nummerdefault.'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.user_access'::regclass
      and tgname = 'sync_user_hr_group_access_after_user_access'
      and not tgisinternal
  ),
  'Nieuwe user access-relaties worden naar groepsaccess gesynchroniseerd.'
);
select ok(
  has_table_privilege('authenticated', 'public.administrations', 'insert'),
  'Authenticated heeft alleen het tabelprivilege dat de groepspolicy verder begrenst.'
);
select ok(
  not has_table_privilege('anon', 'public.hr_groups', 'insert'),
  'Anon kan geen HR-groepen aanmaken.'
);
select ok(
  not has_table_privilege('anon', 'public.administrations', 'insert'),
  'Anon kan geen administraties aanmaken.'
);
select ok(
  exists (
    select 1 from pg_proc
    where pronamespace = 'internal_security'::regnamespace
      and proname = 'get_platform_hr_groups'
      and prosecdef
  ),
  'De Control Plane-leesfunctie is security definer.'
);
select ok(
  exists (
    select 1 from pg_proc
    where pronamespace = 'internal_security'::regnamespace
      and proname = 'create_platform_hr_group'
      and prosecdef
  ),
  'De Control Plane-schrijffunctie controleert platformoperatoren server-side.'
);
select ok(
  exists (
    select 1 from pg_proc
    where pronamespace = 'internal_security'::regnamespace
      and proname = 'sync_user_hr_group_access'
      and prosecdef
  ),
  'De groepsaccess-synchronisatie draait niet op callerrechten.'
);
select ok(
  exists (
    select 1 from pg_proc
    where pronamespace = 'internal_security'::regnamespace
      and proname = 'populate_administration_scope_defaults'
      and prosecdef
  ),
  'De administratie-defaults worden database-side gezet.'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.administrations'::regclass
      and conname = 'administrations_hr_group_fkey'
  ),
  'Administraties hebben een tenant-naar-groep foreign key.'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.administrations'::regclass
      and conname = 'administrations_tenant_number_key'
  ),
  'Administratienummers blijven uniek binnen een tenant.'
);
select ok(
  exists (
    select 1 from public.permissions where code = 'hr-group:manage'
  ),
  'De HR-adminpermission voor groepsinrichting bestaat.'
);
select ok(
  exists (
    select 1 from public.permissions where code = 'hr-group:create'
  ),
  'De aparte create-permission bestaat voor Control Plane-autoriseerbaarheid.'
);

select * from finish();
rollback;
