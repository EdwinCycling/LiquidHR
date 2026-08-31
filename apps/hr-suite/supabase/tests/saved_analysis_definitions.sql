begin;

do $$
declare
  target_table_name text := 'saved_analysis_definitions';
begin
  if to_regclass('public.' || target_table_name) is null then
    raise exception 'SAVED_ANALYSIS_TABLE_MISSING';
  end if;

  if not exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = target_table_name
      and relation.relrowsecurity
  ) then
    raise exception 'SAVED_ANALYSIS_RLS_MISSING';
  end if;

  if not exists (
    select 1 from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = target_table_name
      and policy.policyname = 'saved_analysis_definitions_select_own_scope'
      and policy.roles = array['authenticated']::name[]
      and policy.qual like '%owner_user_id%auth.uid%'
      and policy.qual like '%has_hr_group_access%'
      and policy.qual like '%current_user_has_hr_group_permission%dashboard:read%'
  ) then
    raise exception 'SAVED_ANALYSIS_SELECT_POLICY_INVALID';
  end if;

  if not exists (
    select 1 from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = target_table_name
      and policy.policyname = 'saved_analysis_definitions_insert_own_scope'
      and policy.roles = array['authenticated']::name[]
      and policy.with_check like '%owner_user_id%auth.uid%'
      and policy.with_check like '%has_hr_group_access%'
      and policy.with_check like '%current_user_has_hr_group_permission%dashboard:read%'
  ) then
    raise exception 'SAVED_ANALYSIS_INSERT_POLICY_INVALID';
  end if;

  if not exists (
    select 1 from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = target_table_name
      and policy.policyname = 'saved_analysis_definitions_update_own_scope'
      and policy.roles = array['authenticated']::name[]
      and policy.qual like '%owner_user_id%auth.uid%'
      and policy.with_check like '%owner_user_id%auth.uid%'
      and policy.with_check like '%current_user_has_hr_group_permission%dashboard:read%'
  ) then
    raise exception 'SAVED_ANALYSIS_UPDATE_POLICY_INVALID';
  end if;

  if not exists (
    select 1 from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = target_table_name
      and policy.policyname = 'saved_analysis_definitions_delete_own_scope'
      and policy.roles = array['authenticated']::name[]
      and policy.qual like '%owner_user_id%auth.uid%'
      and policy.qual like '%has_hr_group_access%'
      and policy.qual like '%current_user_has_hr_group_permission%dashboard:read%'
  ) then
    raise exception 'SAVED_ANALYSIS_DELETE_POLICY_INVALID';
  end if;

  if has_table_privilege('anon', 'public.saved_analysis_definitions', 'select') then
    raise exception 'SAVED_ANALYSIS_ANON_GRANT_REMAINS';
  end if;
  if has_table_privilege('authenticated', 'public.saved_analysis_definitions', 'select') then
    raise exception 'SAVED_ANALYSIS_AUTHENTICATED_TABLE_GRANT_REMAINS';
  end if;
  if not has_table_privilege('service_role', 'public.saved_analysis_definitions', 'select,insert,update,delete') then
    raise exception 'SAVED_ANALYSIS_SERVICE_ROLE_GRANT_MISSING';
  end if;

  if not has_function_privilege('service_role', 'internal_security.is_valid_saved_analysis_spec(jsonb)', 'execute') then
    raise exception 'SAVED_ANALYSIS_SPEC_FUNCTION_GRANT_MISSING';
  end if;
  if not has_schema_privilege('service_role', 'internal_security', 'usage') then
    raise exception 'SAVED_ANALYSIS_INTERNAL_SCHEMA_GRANT_MISSING';
  end if;
  if not has_function_privilege('service_role', 'internal_security.prevent_saved_analysis_identity_change()', 'execute') then
    raise exception 'SAVED_ANALYSIS_IDENTITY_FUNCTION_GRANT_MISSING';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.saved_analysis_definitions'::regclass
      and constraint_row.conname = 'saved_analysis_definitions_spec_check'
      and pg_get_constraintdef(constraint_row.oid) like '%is_valid_saved_analysis_spec%'
  ) then
    raise exception 'SAVED_ANALYSIS_SPEC_CONSTRAINT_MISSING';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = target_table_name
      and indexdef like '%(tenant_id, hr_group_id, owner_user_id, updated_at DESC)%'
  ) then
    raise exception 'SAVED_ANALYSIS_OWNER_SCOPE_INDEX_MISSING';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.saved_analysis_definitions'::regclass
      and tgname = 'prevent_saved_analysis_identity_change'
  ) then
    raise exception 'SAVED_ANALYSIS_IDENTITY_TRIGGER_MISSING';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_proc function_row on function_row.oid = trigger_row.tgfoid
    where trigger_row.tgrelid = 'public.saved_analysis_definitions'::regclass
      and trigger_row.tgname = 'set_saved_analysis_definitions_updated_at'
      and function_row.proname = 'set_updated_at'
  ) then
    raise exception 'SAVED_ANALYSIS_UPDATED_AT_TRIGGER_MISSING';
  end if;

  if exists (
    select 1 from information_schema.columns column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = target_table_name
      and column_info.column_name in ('result', 'snapshot', 'widget', 'employee_id', 'employee_ids', 'rows')
  ) then
    raise exception 'SAVED_ANALYSIS_RESULT_DATA_COLUMN_PRESENT';
  end if;
end;
$$;

rollback;
