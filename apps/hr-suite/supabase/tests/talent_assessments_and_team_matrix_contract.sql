do $$
declare
  v_table_name text;
  table_names constant text[] := array[
    'talent_assessment_cycles', 'talent_assessment_items', 'talent_assessment_responses',
    'talent_assessment_answers', 'talent_assessment_private_notes'
  ];
begin
  foreach v_table_name in array table_names loop
    if not exists (
      select 1 from pg_class
      where oid = format('public.%I', v_table_name)::regclass
        and relrowsecurity
    ) then
      raise exception 'M23_TABLE_OR_RLS_MISSING:%', v_table_name;
    end if;
    if exists (
      select 1 from information_schema.role_table_grants
      where table_schema = 'public' and information_schema.role_table_grants.table_name = v_table_name
        and grantee in ('anon', 'public')
    ) then
      raise exception 'M23_PUBLIC_GRANT_PRESENT:%', v_table_name;
    end if;
    if not exists (
      select 1 from information_schema.role_table_grants
      where table_schema = 'public' and information_schema.role_table_grants.table_name = v_table_name
        and grantee = 'authenticated' and privilege_type = 'SELECT'
    ) then
      raise exception 'M23_AUTHENTICATED_SELECT_MISSING:%', v_table_name;
    end if;
  end loop;

  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'talent_assessment_responses_subject_status_idx') then raise exception 'M23_SUBJECT_INDEX_MISSING'; end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'talent_assessment_responses_assessor_status_idx') then raise exception 'M23_ASSESSOR_INDEX_MISSING'; end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'talent_assessment_answers_response_idx') then raise exception 'M23_ANSWER_INDEX_MISSING'; end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'talent_assessment_responses' and indexname like 'talent_assessment_responses_tenant_id_cycle_id_subject_empl%') then raise exception 'M23_RESPONSE_UNIQUE_MISSING'; end if;

  foreach v_table_name in array array['talent_assessment_cycles', 'talent_assessment_responses'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_table_name and policyname like v_table_name || '_select') then raise exception 'M23_SELECT_POLICY_MISSING:%', v_table_name; end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_table_name and policyname like v_table_name || '_insert') then raise exception 'M23_INSERT_POLICY_MISSING:%', v_table_name; end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_table_name and policyname like v_table_name || '_update') then raise exception 'M23_UPDATE_POLICY_MISSING:%', v_table_name; end if;
  end loop;

  if not exists (select 1 from pg_trigger where tgname = 'validate_talent_assessment_response') then raise exception 'M23_RESPONSE_GUARD_MISSING'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'audit_talent_assessment_responses') then raise exception 'M23_AUDIT_TRIGGER_MISSING'; end if;
  if not exists (select 1 from public.permissions where code in ('talent-assessment:manage', 'talent-assessment:read', 'talent-assessment:write', 'self:talent-assessment:read', 'self:talent-assessment:write', 'talent-team:read') group by category having count(*) = 6) then raise exception 'M23_PERMISSION_SEED_MISSING'; end if;
end;
$$;
