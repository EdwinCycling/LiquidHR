begin;

select plan(29);

do $$
declare
  owner_a uuid;
  owner_b uuid;
  owner_without_permission uuid;
  target_tenant_id uuid;
  target_hr_group_id uuid;
  definition_id uuid := md5('saved-analysis:rls:valid')::uuid;
  dimension_filter_sort_definition_id uuid := md5('saved-analysis:rls:dimension-filter-sort')::uuid;
  identity_probe_id uuid := md5('saved-analysis:rls:identity')::uuid;
  invalid_case record;
  definition_spec jsonb := jsonb_build_object(
    'version', 1,
    'source', 'workforce',
    'entity', 'employees',
    'measures', jsonb_build_array('headcount'),
    'dimensions', jsonb_build_array(),
    'filters', jsonb_build_array(),
    'sort', null,
    'limit', 25,
    'presentation', 'auto'
  );
  dimension_filter_sort_spec jsonb := jsonb_build_object(
    'version', 1,
    'source', 'workforce',
    'entity', 'employees',
    'measures', jsonb_build_array('headcount'),
    'dimensions', jsonb_build_array('department'),
    'filters', jsonb_build_array(jsonb_build_object(
      'dimension', 'department',
      'operator', 'eq',
      'value', 'Finance'
    )),
    'sort', jsonb_build_object('by', 'label', 'direction', 'asc'),
    'limit', 25,
    'presentation', 'table'
  );
  invalid_specs jsonb;
  changed_rows integer;
begin
  perform ok(internal_security.is_valid_saved_analysis_spec(definition_spec), 'accepts canonical minimum AnalysisSpec V1');
  perform ok(internal_security.is_valid_saved_analysis_spec(jsonb_set(definition_spec, '{presentation}', '"kpi"'::jsonb)), 'accepts KPI presentation');
  perform ok(internal_security.is_valid_saved_analysis_spec(dimension_filter_sort_spec), 'accepts table presentation');
  perform ok(internal_security.is_valid_saved_analysis_spec(jsonb_set(definition_spec, '{dimensions}', '["job"]'::jsonb)), 'accepts one output dimension');
  perform ok(internal_security.is_valid_saved_analysis_spec(jsonb_set(definition_spec, '{filters}', jsonb_build_array(jsonb_build_object('dimension', 'department', 'operator', 'eq', 'value', 'Finance')))), 'accepts eq filter');
  perform ok(internal_security.is_valid_saved_analysis_spec(jsonb_set(definition_spec, '{filters}', jsonb_build_array(jsonb_build_object('dimension', 'employment_status', 'operator', 'in', 'value', jsonb_build_array('ACTIVE_EMPLOYEE', 'FORMER_EMPLOYEE'))))), 'accepts in filter');
  perform ok(internal_security.is_valid_saved_analysis_spec(jsonb_set(definition_spec, '{sort}', jsonb_build_object('by', 'value', 'direction', 'desc'))), 'accepts allowed sort');
  perform ok(internal_security.is_valid_saved_analysis_spec(jsonb_set(definition_spec, '{limit}', '100'::jsonb)), 'accepts boundary-valid limit');

  perform ok(not internal_security.is_valid_saved_analysis_spec(definition_spec || jsonb_build_object('unknown', true)), 'rejects unknown top-level key');
  perform ok(not internal_security.is_valid_saved_analysis_spec(definition_spec || jsonb_build_object('employeeId', 'employee-1')), 'rejects employeeId');
  perform ok(not internal_security.is_valid_saved_analysis_spec(definition_spec || jsonb_build_object('employeeName', 'Ada Lovelace')), 'rejects employeeName');
  perform ok(not internal_security.is_valid_saved_analysis_spec(definition_spec || jsonb_build_object('employees', jsonb_build_array(jsonb_build_object('id', 'employee-1')))), 'rejects employees');
  perform ok(not internal_security.is_valid_saved_analysis_spec(definition_spec || jsonb_build_object('result', jsonb_build_object('headcount', 3))), 'rejects result');
  perform ok(not internal_security.is_valid_saved_analysis_spec(definition_spec || jsonb_build_object('resultRows', jsonb_build_array(jsonb_build_object('headcount', 3)))), 'rejects resultRows');
  perform ok(not internal_security.is_valid_saved_analysis_spec(definition_spec || jsonb_build_object('metadata', jsonb_build_object('matchedRecordCount', 3), 'columns', jsonb_build_array('headcount'), 'summary', jsonb_build_object('headcount', 3))), 'rejects AnalysisResult-like payload');
  perform ok(not internal_security.is_valid_saved_analysis_spec(definition_spec || jsonb_build_object('metadata', jsonb_build_object('arbitrary', jsonb_build_object('nested', true)))), 'rejects arbitrary metadata');
  perform ok(not internal_security.is_valid_saved_analysis_spec(jsonb_set(definition_spec, '{filters}', jsonb_build_array(jsonb_build_object('dimension', 'department', 'operator', 'eq', 'value', jsonb_build_object('employeeId', 'employee-1'))))), 'rejects arbitrary nested object');
  perform ok(not internal_security.is_valid_saved_analysis_spec(jsonb_set(definition_spec, '{source}', '"payroll"'::jsonb)), 'rejects unsupported source');
  perform ok(not internal_security.is_valid_saved_analysis_spec(jsonb_set(definition_spec, '{entity}', '"projects"'::jsonb)), 'rejects unsupported entity');
  perform ok(not internal_security.is_valid_saved_analysis_spec(jsonb_set(definition_spec, '{measures}', '["salary"]'::jsonb)), 'rejects unsupported measure');
  perform ok(not internal_security.is_valid_saved_analysis_spec(jsonb_set(definition_spec, '{dimensions}', '["salary_band"]'::jsonb)), 'rejects unsupported dimension');
  perform ok(not internal_security.is_valid_saved_analysis_spec(jsonb_set(definition_spec, '{filters}', jsonb_build_array(jsonb_build_object('dimension', 'department', 'operator', 'eq')))), 'rejects malformed filter');
  perform ok(not internal_security.is_valid_saved_analysis_spec(jsonb_set(definition_spec, '{filters}', jsonb_build_array(jsonb_build_object('dimension', 'department', 'operator', 'contains', 'value', 'Finance')))), 'rejects unsupported filter operator');
  perform ok(not internal_security.is_valid_saved_analysis_spec(jsonb_set(definition_spec, '{filters}', (select jsonb_agg(jsonb_build_object('dimension', 'department', 'operator', 'eq', 'value', 'Finance')) from generate_series(1, 21)))), 'rejects excessive filter count');
  perform ok(not internal_security.is_valid_saved_analysis_spec(jsonb_set(definition_spec, '{sort}', jsonb_build_object('by', 'updated_at', 'direction', 'desc'))), 'rejects invalid sort');
  perform ok(not internal_security.is_valid_saved_analysis_spec(jsonb_set(definition_spec, '{limit}', '101'::jsonb)), 'rejects invalid limit');
  perform ok(not internal_security.is_valid_saved_analysis_spec(jsonb_set(definition_spec, '{version}', '2'::jsonb)), 'rejects unsupported version');

  select auth_user.id
  into owner_a
  from auth.users auth_user
  where lower(auth_user.email) = 'hradmin.fixture@liquidhr.test'
  limit 1;

  select access.tenant_id, access.hr_group_id
  into target_tenant_id, target_hr_group_id
  from public.user_hr_group_access access
  join public.management_roles management_role
    on management_role.id = access.management_role_id
  join public.role_permissions role_permission
    on role_permission.management_role_id = management_role.id
  join public.permissions permission
    on permission.id = role_permission.permission_id
  where access.user_id = owner_a
    and access.is_active
    and permission.code = 'dashboard:read'
  order by access.tenant_id, access.hr_group_id
  limit 1;

  select access.user_id
  into owner_b
  from public.user_hr_group_access access
  join public.management_roles management_role
    on management_role.id = access.management_role_id
  join public.role_permissions role_permission
    on role_permission.management_role_id = management_role.id
  join public.permissions permission
    on permission.id = role_permission.permission_id
  where access.tenant_id = target_tenant_id
    and access.hr_group_id = target_hr_group_id
    and access.user_id <> owner_a
    and access.is_active
    and permission.code = 'dashboard:read'
  order by access.user_id
  limit 1;

  select access.user_id
  into owner_without_permission
  from public.user_hr_group_access access
  where access.tenant_id = target_tenant_id
    and access.hr_group_id = target_hr_group_id
    and access.user_id not in (owner_a, owner_b)
    and access.is_active
    and not exists (
      select 1
      from public.user_hr_group_access candidate_access
      join public.management_roles candidate_role
        on candidate_role.id = candidate_access.management_role_id
      join public.role_permissions candidate_role_permission
        on candidate_role_permission.management_role_id = candidate_role.id
      join public.permissions candidate_permission
        on candidate_permission.id = candidate_role_permission.permission_id
      where candidate_access.user_id = access.user_id
        and candidate_access.tenant_id = target_tenant_id
        and candidate_access.hr_group_id = target_hr_group_id
        and candidate_access.is_active
        and candidate_permission.code = 'dashboard:read'
    )
  order by access.user_id
  limit 1;

  if owner_a is null or owner_b is null or target_tenant_id is null or target_hr_group_id is null then
    raise exception 'SAVED_ANALYSIS_RLS_FIXTURE_MISSING';
  end if;

  begin
    insert into public.saved_analysis_definitions (
      id, tenant_id, hr_group_id, owner_user_id, name, definition_version, analysis_spec
    ) values (
      md5('saved-analysis:definition-version')::uuid,
      target_tenant_id,
      target_hr_group_id,
      owner_a,
      'Ongeldige version',
      2,
      definition_spec
    );
    perform ok(false, 'definition_version=2 is rejected when AnalysisSpec.version=1');
  exception
    when check_violation then
      perform ok(true, 'definition_version=1 matches AnalysisSpec.version=1');
  end;

  insert into public.saved_analysis_definitions (
    id, tenant_id, hr_group_id, owner_user_id, name, definition_version, analysis_spec
  ) values (
    definition_id, target_tenant_id, target_hr_group_id, owner_a, 'Geldige definitie', 1, definition_spec
  );

  insert into public.saved_analysis_definitions (
    id, tenant_id, hr_group_id, owner_user_id, name, definition_version, analysis_spec
  ) values (
    dimension_filter_sort_definition_id,
    target_tenant_id,
    target_hr_group_id,
    owner_a,
    'Geldige dimensie-filter-sorteerdefinitie',
    1,
    dimension_filter_sort_spec
  );

  invalid_specs := jsonb_build_object(
    'unsupported-version', jsonb_set(definition_spec, '{version}', '2'::jsonb),
    'malformed-version', jsonb_set(definition_spec, '{version}', '"1"'::jsonb),
    'unknown-top-level', definition_spec || jsonb_build_object('unknown', true),
    'employee-id', definition_spec || jsonb_build_object('employeeId', 'emp-1'),
    'employee-name', definition_spec || jsonb_build_object('employeeName', 'Ada Lovelace'),
    'employees', definition_spec || jsonb_build_object('employees', jsonb_build_array(jsonb_build_object('id', 'emp-1'))),
    'result', definition_spec || jsonb_build_object('result', jsonb_build_object('headcount', 3)),
    'result-rows', definition_spec || jsonb_build_object('resultRows', jsonb_build_array(jsonb_build_object('headcount', 3))),
    'analysis-result-like', definition_spec || jsonb_build_object(
      'metadata', jsonb_build_object('matchedRecordCount', 3),
      'columns', jsonb_build_array('headcount'),
      'summary', jsonb_build_object('headcount', 3)
    ),
    'nested-business-payload', jsonb_set(
      definition_spec,
      '{filters}',
      jsonb_build_array(jsonb_build_object(
        'dimension', 'department',
        'operator', 'eq',
        'value', jsonb_build_object('employeeId', 'emp-1')
      ))
    ),
    'invalid-status', jsonb_set(
      definition_spec,
      '{filters}',
      jsonb_build_array(jsonb_build_object(
        'dimension', 'employment_status',
        'operator', 'eq',
        'value', 'UNKNOWN_STATUS'
      ))
    )
  );

  for invalid_case in
    select key, value from jsonb_each(invalid_specs)
  loop
    begin
      insert into public.saved_analysis_definitions (
        id, tenant_id, hr_group_id, owner_user_id, name, definition_version, analysis_spec
      ) values (
        md5('saved-analysis:invalid:' || invalid_case.key)::uuid,
        target_tenant_id,
        target_hr_group_id,
        owner_a,
        'Ongeldige definitie',
        1,
        invalid_case.value
      );
      raise exception 'SAVED_ANALYSIS_INVALID_CONTENT_ACCEPTED:%', invalid_case.key;
    exception
      when check_violation then null;
    end;
  end loop;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', owner_a, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  begin
    perform exists (select 1 from public.saved_analysis_definitions);
    raise exception 'SAVED_ANALYSIS_AUTHENTICATED_SELECT_BYPASS';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.saved_analysis_definitions (
      id, tenant_id, hr_group_id, owner_user_id, name, definition_version, analysis_spec
    ) values (
      md5('saved-analysis:authenticated-insert')::uuid,
      target_tenant_id,
      target_hr_group_id,
      owner_a,
      'Directe insert',
      1,
      definition_spec
    );
    raise exception 'SAVED_ANALYSIS_AUTHENTICATED_INSERT_BYPASS';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.saved_analysis_definitions
    set name = 'Directe update'
    where id = definition_id;
    raise exception 'SAVED_ANALYSIS_AUTHENTICATED_UPDATE_BYPASS';
  exception
    when insufficient_privilege then null;
  end;

  begin
    delete from public.saved_analysis_definitions
    where id = definition_id;
    raise exception 'SAVED_ANALYSIS_AUTHENTICATED_DELETE_BYPASS';
  exception
    when insufficient_privilege then null;
  end;

  if owner_without_permission is not null then
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', owner_without_permission, 'role', 'authenticated')::text,
      true
    );
    begin
      perform exists (select 1 from public.saved_analysis_definitions);
      raise exception 'SAVED_ANALYSIS_PERMISSION_BYPASS';
    exception
      when insufficient_privilege then null;
    end;
  end if;

  reset role;
  begin
    update public.saved_analysis_definitions
    set owner_user_id = owner_b
    where id = definition_id;
    raise exception 'SAVED_ANALYSIS_IDENTITY_UPDATE_ALLOWED';
  exception
    when sqlstate '42501' then
      if sqlerrm <> 'SAVED_ANALYSIS_IDENTITY_IMMUTABLE' then
        raise;
      end if;
  end;

  update public.saved_analysis_definitions
  set name = 'Geldige definitie bijgewerkt'
  where id = definition_id;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'SAVED_ANALYSIS_SERVICE_ROLE_UPDATE_FAILED';
  end if;

  insert into public.saved_analysis_definitions (
    id, tenant_id, hr_group_id, owner_user_id, name, definition_version, analysis_spec
  ) values (
    identity_probe_id, target_tenant_id, target_hr_group_id, owner_a, 'Identity probe', 1, definition_spec
  );
  delete from public.saved_analysis_definitions where id = identity_probe_id;
end;
$$;

select ok(true, 'Saved-analysis DB-boundary, RLS metadata, active-context write gate en identity trigger zijn gesloten.');
select * from finish();

rollback;
