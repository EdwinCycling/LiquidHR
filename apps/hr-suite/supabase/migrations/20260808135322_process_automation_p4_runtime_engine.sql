begin;

alter table public.process_instances
  add column if not exists idempotency_key text,
  add column if not exists correlation_id uuid;

alter table public.process_events
  add column if not exists correlation_id uuid;

alter table public.audit_logs
  add column if not exists correlation_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.process_instances'::regclass
      and conname = 'process_instances_idempotency_key_check'
  ) then
    alter table public.process_instances
      add constraint process_instances_idempotency_key_check
      check (idempotency_key is null or length(btrim(idempotency_key)) between 1 and 200);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.process_events'::regclass
      and conname = 'process_events_correlation_id_check'
  ) then
    alter table public.process_events
      add constraint process_events_correlation_id_check
      check (correlation_id is null or correlation_id <> '00000000-0000-0000-0000-000000000000'::uuid);
  end if;
end;
$$;

create unique index if not exists process_instances_scope_idempotency_key
  on public.process_instances (tenant_id, hr_group_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists process_instances_correlation_lookup_idx
  on public.process_instances (tenant_id, hr_group_id, correlation_id)
  where correlation_id is not null;
create index if not exists process_events_correlation_lookup_idx
  on public.process_events (tenant_id, hr_group_id, correlation_id, sequence_number)
  where correlation_id is not null;
create index if not exists audit_logs_correlation_lookup_idx
  on public.audit_logs (tenant_id, correlation_id, created_at desc)
  where correlation_id is not null;

create or replace function internal_security.process_definition_content(requested_definition jsonb)
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select case
    when pg_catalog.jsonb_typeof(requested_definition -> 'content') = 'object'
      then requested_definition -> 'content'
    else requested_definition
  end;
$$;

revoke all on function internal_security.process_definition_content(jsonb) from public, anon, authenticated;

create or replace function internal_security.process_condition_value(
  requested_operand jsonb,
  requested_fields jsonb,
  requested_subject jsonb
)
returns jsonb
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  operand_kind text;
  operand_key text;
  result_value jsonb;
begin
  if requested_operand is null or pg_catalog.jsonb_typeof(requested_operand) <> 'object' then
    return 'null'::jsonb;
  end if;

  operand_kind := requested_operand ->> 'kind';
  if operand_kind = 'LITERAL' then
    return coalesce(requested_operand -> 'value', 'null'::jsonb);
  end if;

  if operand_kind = 'FIELD' then
    operand_key := requested_operand ->> 'fieldKey';
    result_value := coalesce(requested_fields, '{}'::jsonb) -> operand_key;
    return coalesce(result_value, 'null'::jsonb);
  end if;

  if operand_kind = 'SUBJECT' then
    operand_key := requested_operand ->> 'subjectKey';
    result_value := coalesce(requested_subject, '{}'::jsonb) -> operand_key;
    return coalesce(result_value, 'null'::jsonb);
  end if;

  return 'null'::jsonb;
end;
$$;

revoke all on function internal_security.process_condition_value(jsonb, jsonb, jsonb) from public, anon, authenticated;

create or replace function internal_security.process_condition_matches(
  requested_condition jsonb,
  requested_fields jsonb,
  requested_subject jsonb
)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  operator_name text;
  left_value jsonb;
  right_value jsonb;
  child jsonb;
  result_value boolean;
begin
  if requested_condition is null then return true; end if;
  operator_name := requested_condition ->> 'operator';

  if operator_name in ('equals', 'notEquals') then
    left_value := internal_security.process_condition_value(requested_condition -> 'left', requested_fields, requested_subject);
    right_value := internal_security.process_condition_value(requested_condition -> 'right', requested_fields, requested_subject);
    if operator_name = 'equals' then return left_value is not distinct from right_value; end if;
    return left_value is distinct from right_value;
  end if;

  if operator_name in ('in', 'notIn') then
    left_value := internal_security.process_condition_value(requested_condition -> 'left', requested_fields, requested_subject);
    result_value := exists (
      select 1 from pg_catalog.jsonb_array_elements(coalesce(requested_condition -> 'values', '[]'::jsonb)) candidate
      where candidate is not distinct from left_value
    );
    if operator_name = 'in' then return result_value; end if;
    return not result_value;
  end if;

  if operator_name in ('isEmpty', 'isNotEmpty') then
    left_value := internal_security.process_condition_value(requested_condition -> 'operand', requested_fields, requested_subject);
    result_value := left_value is null
      or left_value = 'null'::jsonb
      or (pg_catalog.jsonb_typeof(left_value) = 'string' and pg_catalog.btrim(left_value #>> '{}') = '')
      or (pg_catalog.jsonb_typeof(left_value) = 'array' and pg_catalog.jsonb_array_length(left_value) = 0);
    if operator_name = 'isEmpty' then return result_value; end if;
    return not result_value;
  end if;

  if operator_name in ('greaterThan', 'lessThan') then
    left_value := internal_security.process_condition_value(requested_condition -> 'left', requested_fields, requested_subject);
    right_value := internal_security.process_condition_value(requested_condition -> 'right', requested_fields, requested_subject);
    if left_value is null or right_value is null or left_value = 'null'::jsonb or right_value = 'null'::jsonb then
      return false;
    end if;
    if pg_catalog.jsonb_typeof(left_value) = 'number' and pg_catalog.jsonb_typeof(right_value) = 'number' then
      if operator_name = 'greaterThan' then
        return (left_value #>> '{}')::numeric > (right_value #>> '{}')::numeric;
      end if;
      return (left_value #>> '{}')::numeric < (right_value #>> '{}')::numeric;
    end if;
    if operator_name = 'greaterThan' then return (left_value #>> '{}') > (right_value #>> '{}'); end if;
    return (left_value #>> '{}') < (right_value #>> '{}');
  end if;

  if operator_name in ('and', 'or') then
    result_value := operator_name = 'and';
    for child in select value from pg_catalog.jsonb_array_elements(coalesce(requested_condition -> 'conditions', '[]'::jsonb)) value loop
      if operator_name = 'and' then
        result_value := result_value and internal_security.process_condition_matches(child, requested_fields, requested_subject);
        if not result_value then return false; end if;
      else
        result_value := result_value or internal_security.process_condition_matches(child, requested_fields, requested_subject);
        if result_value then return true; end if;
      end if;
    end loop;
    return result_value;
  end if;

  if operator_name = 'not' then
    return not internal_security.process_condition_matches(requested_condition -> 'condition', requested_fields, requested_subject);
  end if;

  raise exception 'INVALID_PROCESS_CONDITION' using errcode = 'P0001';
end;
$$;

revoke all on function internal_security.process_condition_matches(jsonb, jsonb, jsonb) from public, anon, authenticated;

create or replace function internal_security.process_assignment_date(
  requested_selector jsonb,
  requested_fields jsonb,
  requested_started_at timestamptz,
  requested_activated_at timestamptz,
  requested_business_date date
)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  policy_name text := requested_selector ->> 'resolutionDatePolicy';
  fixed_key text;
  fixed_value text;
begin
  case policy_name
    when 'STEP_ACTIVATED_AT' then return requested_activated_at::date;
    when 'PROCESS_STARTED_AT', 'SNAPSHOT_AT_START' then return requested_started_at::date;
    when 'BUSINESS_EFFECTIVE_DATE' then
      if requested_business_date is null then raise exception 'INVALID_BUSINESS_DATE' using errcode = 'P0001'; end if;
      return requested_business_date;
    when 'FIXED_DATE_FIELD' then
      fixed_key := requested_selector ->> 'fixedDateFieldKey';
      fixed_value := coalesce(
        coalesce(requested_fields, '{}'::jsonb) -> fixed_key ->> 'value',
        coalesce(requested_fields, '{}'::jsonb) ->> fixed_key
      );
      begin
        if fixed_value is null or fixed_value = '' then raise exception 'INVALID_BUSINESS_DATE'; end if;
        return fixed_value::date;
      exception when others then
        raise exception 'INVALID_BUSINESS_DATE' using errcode = 'P0001';
      end;
    else
      raise exception 'INVALID_ASSIGNMENT_SELECTOR' using errcode = 'P0001';
  end case;
end;
$$;

revoke all on function internal_security.process_assignment_date(jsonb, jsonb, timestamptz, timestamptz, date) from public, anon, authenticated;

create or replace function internal_security.process_assignment_candidate(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_as_of_date date,
  requested_employee_id uuid,
  requested_actor_employee_id uuid,
  requested_allow_self_assignment boolean,
  requested_management_role_id uuid,
  requested_management_role_code text,
  requested_source text,
  requested_source_department_id uuid,
  requested_ancestor_path jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  candidate_user_id uuid;
  candidate_active boolean;
  candidate_deleted_at timestamptz;
  in_administration boolean := true;
  rejection_code text;
begin
  select employee.auth_user_id, employee.is_active, employee.deleted_at
    into candidate_user_id, candidate_active, candidate_deleted_at
  from public.employees employee
  where employee.tenant_id = requested_tenant_id
    and employee.hr_group_id = requested_hr_group_id
    and employee.id = requested_employee_id;

  if not found then rejection_code := 'OUT_OF_SCOPE';
  elsif candidate_deleted_at is not null or not coalesce(candidate_active, false) then rejection_code := 'INACTIVE';
  elsif candidate_user_id is null then rejection_code := 'NO_AUTH_USER';
  elsif requested_administration_id is not null then
    select exists (
      select 1 from public.employments employment
      where employment.tenant_id = requested_tenant_id
        and employment.hr_group_id = requested_hr_group_id
        and employment.administration_id = requested_administration_id
        and employment.employee_id = requested_employee_id
        and employment.deleted_at is null
        and employment.starts_on <= requested_as_of_date
        and (employment.ends_on is null or employment.ends_on >= requested_as_of_date)
    ) into in_administration;
    if not in_administration then rejection_code := 'OUT_OF_SCOPE'; end if;
  end if;

  if rejection_code is null and requested_actor_employee_id = requested_employee_id and not requested_allow_self_assignment then
    rejection_code := 'SELF_ASSIGNMENT_FORBIDDEN';
  end if;

  if rejection_code is not null then
    return jsonb_build_object(
      'candidate', null,
      'rejection', jsonb_build_object(
        'employeeId', requested_employee_id,
        'reason', rejection_code,
        'tenantId', requested_tenant_id,
        'hrGroupId', requested_hr_group_id
      )
    );
  end if;

  return jsonb_build_object(
    'candidate', jsonb_build_object(
      'employeeId', requested_employee_id,
      'userId', candidate_user_id,
      'managementRoleId', requested_management_role_id,
      'managementRoleCode', requested_management_role_code,
      'source', requested_source,
      'sourceDepartmentId', requested_source_department_id,
      'ancestorPath', coalesce(requested_ancestor_path, '[]'::jsonb)
    ),
    'rejection', null
  );
end;
$$;

revoke all on function internal_security.process_assignment_candidate(uuid, uuid, uuid, date, uuid, uuid, boolean, uuid, text, text, uuid, jsonb)
  from public, anon, authenticated;

create or replace function internal_security.resolve_process_assignment(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_scope_type public.access_scope_type,
  requested_administration_id uuid,
  requested_process_instance_id uuid,
  requested_process_version_id uuid,
  requested_participant jsonb,
  requested_subject_employee_id uuid,
  requested_initiator_employee_id uuid,
  requested_business_date date,
  requested_started_at timestamptz,
  requested_activated_at timestamptz,
  requested_fields jsonb,
  requested_actor_employee_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  selector jsonb := requested_participant -> 'selector';
  mode_name text := requested_participant ->> 'assignmentMode';
  policy_name text := selector ->> 'resolutionDatePolicy';
  as_of_date date;
  candidate_result jsonb;
  candidate jsonb;
  rejection jsonb;
  candidates jsonb := '[]'::jsonb;
  rejections jsonb := '[]'::jsonb;
  employee_id uuid;
  department_id uuid;
  direct_manager_id uuid;
  direct_manager_count integer;
  selected_value jsonb;
  role_depth integer;
  role_management_id uuid;
  role_code_value text;
  role_department_id uuid;
  resolve_department_id uuid;
  department_count integer;
  candidate_row record;
  source_name text := selector ->> 'type';
begin
  as_of_date := internal_security.process_assignment_date(
    selector, requested_fields, requested_started_at, requested_activated_at, requested_business_date
  );

  if selector ->> 'type' in ('EXPLICIT_PERSON', 'FORM_FIELD_PERSON') then
    selected_value := coalesce(requested_fields, '{}'::jsonb) -> (selector ->> 'personFieldKey');
    employee_id := coalesce(selected_value ->> 'id', selected_value #>> '{}')::uuid;
    candidate_result := internal_security.process_assignment_candidate(
      requested_tenant_id, requested_hr_group_id, requested_administration_id, as_of_date,
      employee_id, requested_actor_employee_id,
      (requested_participant ->> 'permission') like 'self:%',
      null, null, source_name, null, '[]'::jsonb
    );
    candidate := candidate_result -> 'candidate';
    rejection := candidate_result -> 'rejection';
    if candidate is not null and candidate <> 'null'::jsonb then candidates := candidates || jsonb_build_array(candidate); end if;
    if rejection is not null and rejection <> 'null'::jsonb then rejections := rejections || jsonb_build_array(rejection); end if;
  elsif selector ->> 'type' = 'INITIATOR' then
    candidate_result := internal_security.process_assignment_candidate(
      requested_tenant_id, requested_hr_group_id, requested_administration_id, as_of_date,
      requested_initiator_employee_id, requested_actor_employee_id,
      (requested_participant ->> 'permission') like 'self:%',
      null, null, source_name, null, '[]'::jsonb
    );
    candidate := candidate_result -> 'candidate'; rejection := candidate_result -> 'rejection';
    if candidate is not null and candidate <> 'null'::jsonb then candidates := candidates || jsonb_build_array(candidate); end if;
    if rejection is not null and rejection <> 'null'::jsonb then rejections := rejections || jsonb_build_array(rejection); end if;
  elsif selector ->> 'type' = 'SUBJECT_EMPLOYEE' then
    candidate_result := internal_security.process_assignment_candidate(
      requested_tenant_id, requested_hr_group_id, requested_administration_id, as_of_date,
      requested_subject_employee_id, requested_actor_employee_id,
      (requested_participant ->> 'permission') like 'self:%',
      null, null, source_name, null, '[]'::jsonb
    );
    candidate := candidate_result -> 'candidate'; rejection := candidate_result -> 'rejection';
    if candidate is not null and candidate <> 'null'::jsonb then candidates := candidates || jsonb_build_array(candidate); end if;
    if rejection is not null and rejection <> 'null'::jsonb then rejections := rejections || jsonb_build_array(rejection); end if;
  elsif selector ->> 'type' = 'DIRECT_MANAGER_OF_SUBJECT' then
    select count(*), (array_agg(organization.direct_manager_id order by organization.direct_manager_id::text))[1]
      into direct_manager_count, direct_manager_id
    from public.employee_organizations organization
    where organization.tenant_id = requested_tenant_id
      and organization.hr_group_id = requested_hr_group_id
      and organization.employee_id = requested_subject_employee_id
      and organization.effective_from <= as_of_date
      and (organization.effective_to is null or organization.effective_to >= as_of_date);
    if direct_manager_count > 1 then raise exception 'AMBIGUOUS_ASSIGNEE' using errcode = 'P0001'; end if;
    if direct_manager_id is not null then
      candidate_result := internal_security.process_assignment_candidate(
        requested_tenant_id, requested_hr_group_id, requested_administration_id, as_of_date,
        direct_manager_id, requested_actor_employee_id, false,
        null, null, 'direct-manager', null, '[]'::jsonb
      );
      candidate := candidate_result -> 'candidate'; rejection := candidate_result -> 'rejection';
      if candidate is not null and candidate <> 'null'::jsonb then candidates := candidates || jsonb_build_array(candidate); end if;
      if rejection is not null and rejection <> 'null'::jsonb then rejections := rejections || jsonb_build_array(rejection); end if;
    end if;
  elsif selector ->> 'type' in ('MANAGEMENT_ROLE_ON_SUBJECT_DEPARTMENT', 'MANAGEMENT_ROLE_ON_SELECTED_DEPARTMENT', 'MANAGEMENT_ROLE_ON_PROCESS_DEPARTMENT') then
    if selector ->> 'type' = 'MANAGEMENT_ROLE_ON_SUBJECT_DEPARTMENT' then
      select count(*), (array_agg(organization.department_id order by organization.department_id::text))[1]
        into direct_manager_count, department_id
      from public.employee_organizations organization
      where organization.tenant_id = requested_tenant_id
        and organization.hr_group_id = requested_hr_group_id
        and organization.employee_id = requested_subject_employee_id
        and organization.effective_from <= as_of_date
        and (organization.effective_to is null or organization.effective_to >= as_of_date);
      if direct_manager_count > 1 then raise exception 'AMBIGUOUS_ASSIGNEE' using errcode = 'P0001'; end if;
    elsif selector ->> 'type' = 'MANAGEMENT_ROLE_ON_SELECTED_DEPARTMENT' then
      selected_value := coalesce(requested_fields, '{}'::jsonb) -> (selector ->> 'departmentFieldKey');
      department_id := coalesce(selected_value ->> 'id', selected_value #>> '{}')::uuid;
    else
      selected_value := coalesce(requested_fields, '{}'::jsonb) -> 'processDepartmentId';
      department_id := coalesce(selected_value ->> 'id', selected_value #>> '{}')::uuid;
      if department_id is null then
        select count(*), (array_agg(organization.department_id order by organization.department_id::text))[1]
          into department_count, department_id
        from public.employee_organizations organization
        where organization.tenant_id = requested_tenant_id
          and organization.hr_group_id = requested_hr_group_id
          and organization.employee_id = requested_subject_employee_id
          and organization.effective_from <= as_of_date
          and (organization.effective_to is null or organization.effective_to >= as_of_date);
        if department_count > 1 then raise exception 'AMBIGUOUS_SUBJECT_DEPARTMENT' using errcode = 'P0001'; end if;
      end if;
    end if;

    resolve_department_id := department_id;
    if resolve_department_id is not null then
      with recursive department_chain as (
        select department.id, department.parent_id, 0 as depth, array[department.id] as path
        from public.departments department
        where department.tenant_id = requested_tenant_id
          and department.hr_group_id = requested_hr_group_id
          and department.id = resolve_department_id
          and department.is_active
        union all
        select parent.id, parent.parent_id, child.depth + 1, child.path || parent.id
        from department_chain child
        join public.departments parent
          on parent.tenant_id = requested_tenant_id
         and parent.hr_group_id = requested_hr_group_id
         and parent.id = child.parent_id
         and parent.is_active
        where not parent.id = any(child.path)
      )
      select min(department_chain.depth) into role_depth
      from department_chain
      join public.department_management management on management.department_id = department_chain.id
      join public.management_roles role on role.id = management.management_role_id
      where role.code = selector ->> 'roleCode'
        and role.is_active
        and management.effective_from <= as_of_date
        and (management.effective_to is null or management.effective_to >= as_of_date);

      if role_depth is not null then
        for candidate_row in
          select resolved.employee_id, resolved.management_role_id, resolved.role_code, resolved.department_id
          from (
            with recursive department_chain as (
              select department.id, department.parent_id, 0 as depth, array[department.id] as path
              from public.departments department
              where department.tenant_id = requested_tenant_id
                and department.hr_group_id = requested_hr_group_id
                and department.id = resolve_department_id
                and department.is_active
              union all
              select parent.id, parent.parent_id, child.depth + 1, child.path || parent.id
              from department_chain child
              join public.departments parent
                on parent.tenant_id = requested_tenant_id
               and parent.hr_group_id = requested_hr_group_id
               and parent.id = child.parent_id
               and parent.is_active
              where not parent.id = any(child.path)
            )
            select distinct management.employee_id, management.management_role_id,
              role.code as role_code, department_chain.id as department_id
            from department_chain
            join public.department_management management on management.department_id = department_chain.id
            join public.management_roles role on role.id = management.management_role_id
            where department_chain.depth = role_depth
              and role.code = selector ->> 'roleCode'
              and role.is_active
              and management.effective_from <= as_of_date
              and (management.effective_to is null or management.effective_to >= as_of_date)
          ) resolved
        loop
          candidate_result := internal_security.process_assignment_candidate(
            requested_tenant_id, requested_hr_group_id, requested_administration_id, as_of_date,
            candidate_row.employee_id, requested_actor_employee_id, false,
            candidate_row.management_role_id, candidate_row.role_code, 'management-role', candidate_row.department_id, '[]'::jsonb
          );
          candidate := candidate_result -> 'candidate'; rejection := candidate_result -> 'rejection';
          if candidate is not null and candidate <> 'null'::jsonb and not exists (
            select 1 from pg_catalog.jsonb_array_elements(candidates) item where item ->> 'employeeId' = candidate ->> 'employeeId'
          ) then candidates := candidates || jsonb_build_array(candidate); end if;
          if rejection is not null and rejection <> 'null'::jsonb then rejections := rejections || jsonb_build_array(rejection); end if;
        end loop;
      end if;
    end if;
  elsif selector ->> 'type' = 'PERMISSION_WORK_QUEUE' then
    for employee_id in
      select distinct employee.id
      from public.employees employee
      where employee.tenant_id = requested_tenant_id
        and employee.hr_group_id = requested_hr_group_id
        and employee.deleted_at is null
        and employee.is_active
        and employee.auth_user_id is not null
        and (
          exists (
            select 1
            from public.user_hr_group_access access
            join public.role_permissions role_permission on role_permission.management_role_id = access.management_role_id
            join public.permissions permission on permission.id = role_permission.permission_id
            where access.user_id = employee.auth_user_id
              and access.tenant_id = requested_tenant_id
              and access.hr_group_id = requested_hr_group_id
              and access.is_active
              and permission.code = selector ->> 'permission'
          )
          or exists (
            select 1
            from public.user_access access
            join public.role_permissions role_permission on role_permission.management_role_id = access.management_role_id
            join public.permissions permission on permission.id = role_permission.permission_id
            where access.user_id = employee.auth_user_id
              and access.tenant_id = requested_tenant_id
              and access.hr_group_id = requested_hr_group_id
              and access.is_active
              and access.scope_type = requested_scope_type
              and (requested_scope_type = 'TENANT'::public.access_scope_type or access.administration_id = requested_administration_id)
              and permission.code = selector ->> 'permission'
          )
        )
    loop
      candidate_result := internal_security.process_assignment_candidate(
        requested_tenant_id, requested_hr_group_id, requested_administration_id, as_of_date,
        employee_id, requested_actor_employee_id, false,
        null, null, 'queue:' || (selector ->> 'queueKey'), null, '[]'::jsonb
      );
      candidate := candidate_result -> 'candidate'; rejection := candidate_result -> 'rejection';
      if candidate is not null and candidate <> 'null'::jsonb then candidates := candidates || jsonb_build_array(candidate); end if;
      if rejection is not null and rejection <> 'null'::jsonb then rejections := rejections || jsonb_build_array(rejection); end if;
    end loop;
  elsif selector ->> 'type' = 'PROCESS_OWNER_QUEUE' then
    for employee_id in
      select distinct employee.id
      from public.employees employee
      where employee.tenant_id = requested_tenant_id
        and employee.hr_group_id = requested_hr_group_id
        and employee.deleted_at is null
        and employee.is_active
        and employee.auth_user_id is not null
        and exists (
          select 1
          from public.user_hr_group_access access
          join public.role_permissions role_permission on role_permission.management_role_id = access.management_role_id
          join public.permissions permission on permission.id = role_permission.permission_id
          where access.user_id = employee.auth_user_id
            and access.tenant_id = requested_tenant_id
            and access.hr_group_id = requested_hr_group_id
            and access.is_active
            and permission.code = 'process-operations:read'
        )
    loop
      candidate_result := internal_security.process_assignment_candidate(
        requested_tenant_id, requested_hr_group_id, requested_administration_id, as_of_date,
        employee_id, requested_actor_employee_id, false,
        null, null, 'process-owner-queue:' || (selector ->> 'queueKey'), null, '[]'::jsonb
      );
      candidate := candidate_result -> 'candidate'; rejection := candidate_result -> 'rejection';
      if candidate is not null and candidate <> 'null'::jsonb then candidates := candidates || jsonb_build_array(candidate); end if;
      if rejection is not null and rejection <> 'null'::jsonb then rejections := rejections || jsonb_build_array(rejection); end if;
    end loop;
  else
    raise exception 'INVALID_ASSIGNMENT_SELECTOR' using errcode = 'P0001';
  end if;

  if mode_name = 'EXACTLY_ONE' and pg_catalog.jsonb_array_length(candidates) <> 1 then
    if pg_catalog.jsonb_array_length(candidates) = 0 then raise exception 'NO_ASSIGNEE' using errcode = 'P0001'; end if;
    raise exception 'AMBIGUOUS_ASSIGNEE' using errcode = 'P0001';
  end if;
  if mode_name in ('ANY_ONE', 'ALL') and pg_catalog.jsonb_array_length(candidates) = 0 then
    raise exception 'NO_ASSIGNEE' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'assignmentMode', mode_name,
    'resolutionDatePolicy', policy_name,
    'asOfDate', as_of_date,
    'source', source_name,
    'candidateEmployeeIds', coalesce((select jsonb_agg(item -> 'employeeId') from pg_catalog.jsonb_array_elements(candidates) item), '[]'::jsonb),
    'candidates', candidates,
    'rejectedCandidates', rejections,
    'processVersionId', requested_process_version_id,
    'instanceId', requested_process_instance_id
  );
end;
$$;

revoke all on function internal_security.resolve_process_assignment(uuid, uuid, public.access_scope_type, uuid, uuid, uuid, jsonb, uuid, uuid, date, timestamptz, timestamptz, jsonb, uuid)
  from public, anon, authenticated;

create or replace function internal_security.append_process_runtime_event(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_process_instance_id uuid,
  requested_work_item_id uuid,
  requested_event_type text,
  requested_payload jsonb,
  requested_actor_user_id uuid,
  requested_actor_employee_id uuid,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_event_id uuid;
  next_sequence bigint;
  event_id uuid;
begin
  perform 1 from public.process_instances instance
  where instance.tenant_id = requested_tenant_id
    and instance.hr_group_id = requested_hr_group_id
    and instance.id = requested_process_instance_id
  for update;
  if not found then raise exception 'PROCESS_INSTANCE_NOT_FOUND' using errcode = 'P0002'; end if;

  if requested_idempotency_key is not null then
    select event.id into existing_event_id
    from public.process_events event
    where event.tenant_id = requested_tenant_id
      and event.hr_group_id = requested_hr_group_id
      and event.process_instance_id = requested_process_instance_id
      and event.idempotency_key = requested_idempotency_key;
    if existing_event_id is not null then return existing_event_id; end if;
  end if;

  select coalesce(max(event.sequence_number), 0) + 1 into next_sequence
  from public.process_events event
  where event.tenant_id = requested_tenant_id
    and event.hr_group_id = requested_hr_group_id
    and event.process_instance_id = requested_process_instance_id;

  insert into public.process_events (
    tenant_id, hr_group_id, process_instance_id, work_item_id, sequence_number,
    event_type, actor_user_id, actor_employee_id, idempotency_key, correlation_id, payload
  ) values (
    requested_tenant_id, requested_hr_group_id, requested_process_instance_id, requested_work_item_id,
    next_sequence, requested_event_type, requested_actor_user_id, requested_actor_employee_id,
    requested_idempotency_key, requested_correlation_id, coalesce(requested_payload, '{}'::jsonb)
  ) returning id into event_id;
  return event_id;
end;
$$;

revoke all on function internal_security.append_process_runtime_event(uuid, uuid, uuid, uuid, text, jsonb, uuid, uuid, text, uuid)
  from public, anon, authenticated;

create or replace function internal_security.process_subject_context(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_process_instance_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  subject_employee_id uuid;
  subject_employment_id uuid;
  subject_department_id uuid;
  effective_date date;
begin
  select subject.employee_id into subject_employee_id
  from public.process_employee_subjects subject
  where subject.tenant_id = requested_tenant_id
    and subject.hr_group_id = requested_hr_group_id
    and subject.process_instance_id = requested_process_instance_id;
  select subject.employment_id into subject_employment_id
  from public.process_employment_subjects subject
  where subject.tenant_id = requested_tenant_id
    and subject.hr_group_id = requested_hr_group_id
    and subject.process_instance_id = requested_process_instance_id;
  select instance.business_effective_date into effective_date
  from public.process_instances instance
  where instance.tenant_id = requested_tenant_id
    and instance.hr_group_id = requested_hr_group_id
    and instance.id = requested_process_instance_id;
  if subject_employee_id is not null then
    select count(*), (array_agg(organization.department_id order by organization.department_id::text))[1]
      into department_count, subject_department_id
    from public.employee_organizations organization
    where organization.tenant_id = requested_tenant_id
      and organization.hr_group_id = requested_hr_group_id
      and organization.employee_id = subject_employee_id
      and organization.effective_from <= coalesce(effective_date, current_date)
      and (organization.effective_to is null or organization.effective_to >= coalesce(effective_date, current_date));
    if department_count > 1 then raise exception 'AMBIGUOUS_SUBJECT_DEPARTMENT' using errcode = 'P0001'; end if;
  end if;
  return jsonb_build_object(
    'employeeId', subject_employee_id,
    'employmentId', subject_employment_id,
    'departmentId', subject_department_id,
    'effectiveDate', effective_date
  );
end;
$$;

revoke all on function internal_security.process_subject_context(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function internal_security.select_process_transition(
  requested_definition jsonb,
  requested_from_step_key text,
  requested_action text,
  requested_fields jsonb,
  requested_subject jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  transition jsonb;
  selected_transition jsonb;
  match_count integer := 0;
begin
  for transition in
    select value from pg_catalog.jsonb_array_elements(coalesce(requested_definition -> 'transitions', '[]'::jsonb)) value
    where value ->> 'fromStepKey' = requested_from_step_key
      and value ->> 'action' = requested_action
  loop
    if internal_security.process_condition_matches(transition -> 'condition', requested_fields, requested_subject) then
      match_count := match_count + 1;
      selected_transition := transition;
    end if;
  end loop;
  if match_count = 0 then raise exception 'TRANSITION_NOT_FOUND' using errcode = 'P0001'; end if;
  if match_count > 1 then raise exception 'AMBIGUOUS_TRANSITION' using errcode = 'P0001'; end if;
  return selected_transition;
end;
$$;

revoke all on function internal_security.select_process_transition(jsonb, text, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function internal_security.materialize_process_step(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_scope_type public.access_scope_type,
  requested_administration_id uuid,
  requested_process_instance_id uuid,
  requested_step_instance_id uuid,
  requested_process_version_id uuid,
  requested_step jsonb,
  requested_definition jsonb,
  requested_subject_employee_id uuid,
  requested_initiator_employee_id uuid,
  requested_business_date date,
  requested_started_at timestamptz,
  requested_activated_at timestamptz,
  requested_instance_version bigint,
  requested_actor_employee_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant jsonb;
  resolution jsonb;
  candidate jsonb;
  work_item_id uuid;
  mode_name text;
  allow_self boolean;
  fields jsonb;
  snapshot jsonb;
  participant_key text := requested_step ->> 'participantKey';
begin
  select instance.metadata -> 'fields' into fields
  from public.process_instances instance
  where instance.tenant_id = requested_tenant_id
    and instance.hr_group_id = requested_hr_group_id
    and instance.id = requested_process_instance_id;
  select value into participant
  from pg_catalog.jsonb_array_elements(coalesce(requested_definition -> 'participants', '[]'::jsonb)) value
  where value ->> 'key' = participant_key;
  if participant is null then raise exception 'PARTICIPANT_NOT_FOUND' using errcode = 'P0001'; end if;

  resolution := internal_security.resolve_process_assignment(
    requested_tenant_id, requested_hr_group_id, requested_scope_type, requested_administration_id,
    requested_process_instance_id, requested_process_version_id, participant,
    requested_subject_employee_id, requested_initiator_employee_id, requested_business_date,
    requested_started_at, requested_activated_at, coalesce(fields, '{}'::jsonb), requested_actor_employee_id
  );
  mode_name := resolution ->> 'assignmentMode';
  allow_self := (participant ->> 'permission') like 'self:%';

  if mode_name = 'ALL' then
    for candidate in select value from pg_catalog.jsonb_array_elements(resolution -> 'candidates') value loop
      snapshot := jsonb_build_object('resolution', resolution - 'candidates' - 'rejectedCandidates', 'candidate', candidate);
      insert into public.process_work_items (
        tenant_id, hr_group_id, process_instance_id, step_instance_id, process_version_id,
        step_key, participant_key, assignment_mode, status, assignee_employee_id,
        allow_self_assignment, assignment_snapshot
      ) values (
        requested_tenant_id, requested_hr_group_id, requested_process_instance_id, requested_step_instance_id,
        requested_process_version_id, requested_step ->> 'key', participant_key, 'ALL'::public.process_assignment_mode,
        'OPEN'::public.process_work_item_status, (candidate ->> 'employeeId')::uuid,
        allow_self, snapshot
      ) returning id into work_item_id;
      insert into public.process_work_item_candidates (
        tenant_id, hr_group_id, work_item_id, employee_id, candidate_user_id,
        management_role_id, management_role_code, resolution_policy, resolution_date,
        resolution_source, source_department_id, ancestor_path, is_eligible, evidence
      ) values (
        requested_tenant_id, requested_hr_group_id, work_item_id, (candidate ->> 'employeeId')::uuid,
        (candidate ->> 'userId')::uuid, nullif(candidate ->> 'managementRoleId', '')::uuid,
        candidate ->> 'managementRoleCode', resolution ->> 'resolutionDatePolicy', (resolution ->> 'asOfDate')::date,
        candidate ->> 'source', nullif(candidate ->> 'sourceDepartmentId', '')::uuid,
        coalesce(candidate -> 'ancestorPath', '[]'::jsonb), true, jsonb_build_object('resolution', resolution - 'candidates' - 'rejectedCandidates', 'candidate', candidate)
      );
    end loop;
  else
    snapshot := jsonb_build_object('resolution', resolution - 'candidates' - 'rejectedCandidates');
    insert into public.process_work_items (
      tenant_id, hr_group_id, process_instance_id, step_instance_id, process_version_id,
      step_key, participant_key, assignment_mode, status, assignee_employee_id,
      allow_self_assignment, assignment_snapshot
    ) values (
      requested_tenant_id, requested_hr_group_id, requested_process_instance_id, requested_step_instance_id,
      requested_process_version_id, requested_step ->> 'key', participant_key, mode_name::public.process_assignment_mode,
      'OPEN'::public.process_work_item_status,
      case when mode_name = 'EXACTLY_ONE' then (resolution -> 'candidates' -> 0 ->> 'employeeId')::uuid else null end,
      allow_self, snapshot
    ) returning id into work_item_id;
    for candidate in select value from pg_catalog.jsonb_array_elements(resolution -> 'candidates') value loop
      insert into public.process_work_item_candidates (
        tenant_id, hr_group_id, work_item_id, employee_id, candidate_user_id,
        management_role_id, management_role_code, resolution_policy, resolution_date,
        resolution_source, source_department_id, ancestor_path, is_eligible, evidence
      ) values (
        requested_tenant_id, requested_hr_group_id, work_item_id, (candidate ->> 'employeeId')::uuid,
        (candidate ->> 'userId')::uuid, nullif(candidate ->> 'managementRoleId', '')::uuid,
        candidate ->> 'managementRoleCode', resolution ->> 'resolutionDatePolicy', (resolution ->> 'asOfDate')::date,
        candidate ->> 'source', nullif(candidate ->> 'sourceDepartmentId', '')::uuid,
        coalesce(candidate -> 'ancestorPath', '[]'::jsonb), true, jsonb_build_object('resolution', resolution - 'candidates' - 'rejectedCandidates', 'candidate', candidate)
      );
    end loop;
  end if;
end;
$$;

revoke all on function internal_security.materialize_process_step(uuid, uuid, public.access_scope_type, uuid, uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, date, timestamptz, timestamptz, bigint, uuid)
  from public, anon, authenticated;

create or replace function internal_security.activate_process_step(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_process_instance_id uuid,
  requested_scope_type public.access_scope_type,
  requested_administration_id uuid,
  requested_process_version_id uuid,
  requested_definition jsonb,
  requested_step_key text,
  requested_correlation_id uuid,
  requested_actor_user_id uuid,
  requested_actor_employee_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  instance_row public.process_instances%rowtype;
  subject jsonb;
  fields jsonb;
  step jsonb;
  step_instance_id uuid;
  activation_number integer;
  step_type text;
  terminal_outcome text;
  incoming_count integer;
  completed_incoming_count integer;
  transition jsonb;
  transition_target text;
begin
  select instance.* into instance_row
  from public.process_instances instance
  where instance.tenant_id = requested_tenant_id
    and instance.hr_group_id = requested_hr_group_id
    and instance.id = requested_process_instance_id
  for update;
  if instance_row.id is null then raise exception 'PROCESS_INSTANCE_NOT_FOUND' using errcode = 'P0002'; end if;

  subject := internal_security.process_subject_context(requested_tenant_id, requested_hr_group_id, requested_process_instance_id);
  fields := coalesce(instance_row.metadata -> 'fields', '{}'::jsonb);
  select value into step
  from pg_catalog.jsonb_array_elements(coalesce(requested_definition -> 'steps', '[]'::jsonb)) value
  where value ->> 'key' = requested_step_key;
  if step is null then raise exception 'STEP_NOT_FOUND' using errcode = 'P0001'; end if;
  step_type := step ->> 'type';

  if step_type = 'PARALLEL_JOIN' then
    select count(*) into incoming_count
    from pg_catalog.jsonb_array_elements(coalesce(requested_definition -> 'transitions', '[]'::jsonb)) value
    where value ->> 'toStepKey' = requested_step_key;
    select count(*) into completed_incoming_count
    from public.process_step_instances step_instance
    where step_instance.tenant_id = requested_tenant_id
      and step_instance.hr_group_id = requested_hr_group_id
      and step_instance.process_instance_id = requested_process_instance_id
      and step_instance.status = 'COMPLETED'::public.process_step_instance_status
      and step_instance.step_key in (
        select value ->> 'fromStepKey'
        from pg_catalog.jsonb_array_elements(coalesce(requested_definition -> 'transitions', '[]'::jsonb)) value
        where value ->> 'toStepKey' = requested_step_key
      );
    if incoming_count > 0 and completed_incoming_count < incoming_count then
      return jsonb_build_object('deferred', true, 'stepKey', requested_step_key);
    end if;
  end if;

  select coalesce(max(step_instance.activation_number), 0) + 1 into activation_number
  from public.process_step_instances step_instance
  where step_instance.tenant_id = requested_tenant_id
    and step_instance.hr_group_id = requested_hr_group_id
    and step_instance.process_instance_id = requested_process_instance_id
    and step_instance.step_key = requested_step_key;

  insert into public.process_step_instances (
    tenant_id, hr_group_id, process_instance_id, process_version_id, step_key,
    activation_number, status, activated_at
  ) values (
    requested_tenant_id, requested_hr_group_id, requested_process_instance_id, requested_process_version_id,
    requested_step_key, activation_number, 'ACTIVE'::public.process_step_instance_status, timezone('utc', now())
  ) returning id into step_instance_id;

  update public.process_instances
  set current_step_key = requested_step_key,
      status = 'RUNNING'::public.process_instance_status,
      instance_version = instance_version + 1
  where tenant_id = requested_tenant_id and hr_group_id = requested_hr_group_id and id = requested_process_instance_id;

  perform internal_security.append_process_runtime_event(
    requested_tenant_id, requested_hr_group_id, requested_process_instance_id, null,
    'PROCESS_STEP_ACTIVATED', jsonb_build_object('stepKey', requested_step_key, 'activationNumber', activation_number),
    requested_actor_user_id, requested_actor_employee_id, null, requested_correlation_id
  );

  if step_type = 'END' then
    terminal_outcome := step ->> 'terminalOutcome';
    update public.process_step_instances
    set status = case terminal_outcome
      when 'COMPLETED' then 'COMPLETED'::public.process_step_instance_status
      when 'REJECTED' then 'REJECTED'::public.process_step_instance_status
      else 'CANCELLED'::public.process_step_instance_status
    end,
        completed_at = timezone('utc', now()),
        expected_version = expected_version + 1
    where id = step_instance_id;
    update public.process_instances
    set status = case terminal_outcome
      when 'COMPLETED' then 'COMPLETED'::public.process_instance_status
      when 'REJECTED' then 'REJECTED'::public.process_instance_status
      else 'CANCELLED'::public.process_instance_status
    end,
        completed_at = timezone('utc', now()),
        instance_version = instance_version + 1
    where tenant_id = requested_tenant_id and hr_group_id = requested_hr_group_id and id = requested_process_instance_id;
    perform internal_security.append_process_runtime_event(
      requested_tenant_id, requested_hr_group_id, requested_process_instance_id, null,
      'PROCESS_TERMINAL', jsonb_build_object('stepKey', requested_step_key, 'outcome', terminal_outcome),
      requested_actor_user_id, requested_actor_employee_id, null, requested_correlation_id
    );
    return jsonb_build_object('stepKey', requested_step_key, 'terminalOutcome', terminal_outcome);
  end if;

  if step_type in ('FORM', 'DECISION', 'ACKNOWLEDGEMENT') then
    if step ->> 'participantKey' is null then raise exception 'PARTICIPANT_NOT_FOUND' using errcode = 'P0001'; end if;
    perform internal_security.materialize_process_step(
      requested_tenant_id, requested_hr_group_id, requested_scope_type, requested_administration_id,
      requested_process_instance_id, step_instance_id, requested_process_version_id, step, requested_definition,
      (subject ->> 'employeeId')::uuid, instance_row.initiator_employee_id, instance_row.business_effective_date,
      instance_row.started_at, timezone('utc', now()), instance_row.instance_version, requested_actor_employee_id
    );
    return jsonb_build_object('stepKey', requested_step_key, 'stepInstanceId', step_instance_id);
  end if;

  if step_type = 'PARALLEL_FORK' then
    update public.process_step_instances
    set status = 'COMPLETED'::public.process_step_instance_status,
        completed_at = timezone('utc', now()), expected_version = expected_version + 1
    where id = step_instance_id;
    for transition in
      select value from pg_catalog.jsonb_array_elements(coalesce(requested_definition -> 'transitions', '[]'::jsonb)) value
      where value ->> 'fromStepKey' = requested_step_key and value ->> 'action' = 'COMPLETE'
    loop
      if internal_security.process_condition_matches(transition -> 'condition', fields, subject) then
        perform internal_security.activate_process_step(
          requested_tenant_id, requested_hr_group_id, requested_process_instance_id,
          requested_scope_type, requested_administration_id, requested_process_version_id, requested_definition,
          transition ->> 'toStepKey', requested_correlation_id, requested_actor_user_id, requested_actor_employee_id
        );
      end if;
    end loop;
    return jsonb_build_object('stepKey', requested_step_key, 'parallel', true);
  end if;

  update public.process_step_instances
  set status = 'COMPLETED'::public.process_step_instance_status,
      completed_at = timezone('utc', now()), expected_version = expected_version + 1
  where id = step_instance_id;
  transition := internal_security.select_process_transition(requested_definition, requested_step_key, 'COMPLETE', fields, subject);
  transition_target := transition ->> 'toStepKey';
  perform internal_security.activate_process_step(
    requested_tenant_id, requested_hr_group_id, requested_process_instance_id,
    requested_scope_type, requested_administration_id, requested_process_version_id, requested_definition,
    transition_target, requested_correlation_id, requested_actor_user_id, requested_actor_employee_id
  );
  return jsonb_build_object('stepKey', requested_step_key, 'automatic', true);
end;
$$;

revoke all on function internal_security.activate_process_step(uuid, uuid, uuid, public.access_scope_type, uuid, uuid, jsonb, text, uuid, uuid, uuid)
  from public, anon, authenticated;

create or replace function internal_security.process_runtime_result(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_process_instance_id uuid,
  requested_event_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'processInstanceId', instance.id,
    'status', instance.status,
    'currentStepKey', instance.current_step_key,
    'instanceVersion', instance.instance_version,
    'correlationId', instance.correlation_id,
    'eventId', requested_event_id
  )
  from public.process_instances instance
  where instance.tenant_id = requested_tenant_id
    and instance.hr_group_id = requested_hr_group_id
    and instance.id = requested_process_instance_id;
$$;

revoke all on function internal_security.process_runtime_result(uuid, uuid, uuid, uuid) from public, anon, authenticated;

create or replace function internal_security.start_process(
  requested_process_definition_id uuid,
  requested_subject_employee_id uuid,
  requested_employment_id uuid,
  requested_business_effective_date date,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  definition_row public.process_definitions%rowtype;
  version_row public.process_versions%rowtype;
  existing_instance public.process_instances%rowtype;
  instance_id uuid;
  actor_employee_id uuid;
  actor_user_id uuid := auth.uid();
  employment_id uuid := requested_employment_id;
  correlation_id uuid := coalesce(requested_correlation_id, extensions.gen_random_uuid());
  event_id uuid;
  definition_content jsonb;
begin
  if actor_user_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if requested_idempotency_key is null or pg_catalog.btrim(requested_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001';
  end if;

  select definition.* into definition_row
  from public.process_definitions definition
  where definition.id = requested_process_definition_id
    and definition.status = 'PUBLISHED'::public.process_definition_status
  for update;
  if definition_row.id is null then raise exception 'PROCESS_DEFINITION_NOT_PUBLISHED' using errcode = 'P0001'; end if;

  actor_employee_id := internal_security.current_employee_id(definition_row.tenant_id, definition_row.hr_group_id);
  if not internal_security.process_scope_has_permission(
    definition_row.tenant_id, definition_row.hr_group_id, definition_row.scope_type, definition_row.administration_id, 'process-instance:start'
  ) and not (
    actor_employee_id = requested_subject_employee_id
    and internal_security.process_scope_has_permission(
      definition_row.tenant_id, definition_row.hr_group_id, definition_row.scope_type, definition_row.administration_id, 'self:process-instance:start'
    )
  ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  if not exists (
    select 1 from public.employees employee
    where employee.tenant_id = definition_row.tenant_id
      and employee.hr_group_id = definition_row.hr_group_id
      and employee.id = requested_subject_employee_id
      and employee.deleted_at is null and employee.is_active
  ) then raise exception 'SUBJECT_EMPLOYEE_NOT_FOUND' using errcode = 'P0002'; end if;

  if definition_row.administration_id is not null then
    if employment_id is null then
      select employment.id into employment_id
      from public.employments employment
      where employment.tenant_id = definition_row.tenant_id
        and employment.hr_group_id = definition_row.hr_group_id
        and employment.administration_id = definition_row.administration_id
        and employment.employee_id = requested_subject_employee_id
        and employment.deleted_at is null
        and employment.starts_on <= coalesce(requested_business_effective_date, current_date)
        and (employment.ends_on is null or employment.ends_on >= coalesce(requested_business_effective_date, current_date))
      order by employment.is_primary desc, employment.starts_on desc, employment.id
      limit 1;
    end if;
    if employment_id is null or not exists (
      select 1 from public.employments employment
      where employment.tenant_id = definition_row.tenant_id
        and employment.hr_group_id = definition_row.hr_group_id
        and employment.administration_id = definition_row.administration_id
        and employment.id = employment_id
        and employment.employee_id = requested_subject_employee_id
    ) then raise exception 'SUBJECT_EMPLOYMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  end if;

  select instance.* into existing_instance
  from public.process_instances instance
  where instance.tenant_id = definition_row.tenant_id
    and instance.hr_group_id = definition_row.hr_group_id
    and instance.idempotency_key = pg_catalog.btrim(requested_idempotency_key)
  for update;
  if existing_instance.id is not null then
    if existing_instance.initiator_user_id <> actor_user_id then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = 'P0001'; end if;
    select event.id into event_id
    from public.process_events event
    where event.process_instance_id = existing_instance.id
      and event.idempotency_key = pg_catalog.btrim(requested_idempotency_key);
    return internal_security.process_runtime_result(existing_instance.tenant_id, existing_instance.hr_group_id, existing_instance.id, event_id);
  end if;

  select version.* into version_row
  from public.process_versions version
  where version.tenant_id = definition_row.tenant_id
    and version.hr_group_id = definition_row.hr_group_id
    and version.process_definition_id = definition_row.id
  order by version.version_number desc
  limit 1;
  if version_row.id is null then raise exception 'PROCESS_VERSION_NOT_FOUND' using errcode = 'P0002'; end if;
  definition_content := internal_security.process_definition_content(version_row.definition_json);

  insert into public.process_instances (
    tenant_id, hr_group_id, scope_type, administration_id, process_definition_id,
    process_version_id, status, initiator_user_id, initiator_employee_id,
    business_effective_date, current_step_key, instance_version, started_at,
    metadata, idempotency_key, correlation_id
  ) values (
    definition_row.tenant_id, definition_row.hr_group_id, definition_row.scope_type, definition_row.administration_id,
    definition_row.id, version_row.id, 'RUNNING'::public.process_instance_status, actor_user_id, actor_employee_id,
    requested_business_effective_date, definition_content ->> 'startStepKey', 1, timezone('utc', now()),
    jsonb_build_object('fields', '{}'::jsonb), pg_catalog.btrim(requested_idempotency_key), correlation_id
  ) returning id into instance_id;

  insert into public.process_employee_subjects (process_instance_id, tenant_id, hr_group_id, employee_id)
  values (instance_id, definition_row.tenant_id, definition_row.hr_group_id, requested_subject_employee_id);
  if employment_id is not null then
    insert into public.process_employment_subjects (
      process_instance_id, tenant_id, hr_group_id, administration_id, employment_id
    ) values (
      instance_id, definition_row.tenant_id, definition_row.hr_group_id, definition_row.administration_id, employment_id
    );
  end if;

  event_id := internal_security.append_process_runtime_event(
    definition_row.tenant_id, definition_row.hr_group_id, instance_id, null,
    'PROCESS_STARTED', jsonb_build_object('processDefinitionId', definition_row.id, 'processVersionId', version_row.id),
    actor_user_id, actor_employee_id, pg_catalog.btrim(requested_idempotency_key), correlation_id
  );
  perform internal_security.activate_process_step(
    definition_row.tenant_id, definition_row.hr_group_id, instance_id, definition_row.scope_type,
    definition_row.administration_id, version_row.id, definition_content, definition_content ->> 'startStepKey',
    correlation_id, actor_user_id, actor_employee_id
  );
  return internal_security.process_runtime_result(definition_row.tenant_id, definition_row.hr_group_id, instance_id, event_id);
end;
$$;

revoke all on function internal_security.start_process(uuid, uuid, uuid, date, text, uuid) from public, anon, authenticated;

create or replace function public.start_process(
  requested_process_definition_id uuid,
  requested_subject_employee_id uuid,
  requested_employment_id uuid,
  requested_business_effective_date date,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.start_process(
    requested_process_definition_id, requested_subject_employee_id, requested_employment_id,
    requested_business_effective_date, requested_idempotency_key, requested_correlation_id
  );
$$;

revoke all on function public.start_process(uuid, uuid, uuid, date, text, uuid) from public, anon;
grant execute on function public.start_process(uuid, uuid, uuid, date, text, uuid) to authenticated;

create or replace function internal_security.perform_process_work_item_action(
  requested_work_item_id uuid,
  requested_action text,
  requested_expected_version bigint,
  requested_step_expected_version bigint,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  step_row public.process_step_instances%rowtype;
  version_row public.process_versions%rowtype;
  actor_user_id uuid := auth.uid();
  actor_employee_id uuid;
  existing_event_id uuid;
  existing_actor_user_id uuid;
  event_id uuid;
  transition jsonb;
  definition_content jsonb;
  step_definition jsonb;
  subject jsonb;
  fields jsonb;
  allowed boolean;
  has_scope_permission boolean;
  candidate_ok boolean;
  remaining_all integer;
begin
  if actor_user_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if requested_idempotency_key is null or pg_catalog.btrim(requested_idempotency_key) = '' then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001'; end if;

  select instance.* into instance_row
  from public.process_instances instance
  join public.process_work_items item
    on item.tenant_id = instance.tenant_id
   and item.hr_group_id = instance.hr_group_id
   and item.process_instance_id = instance.id
   and item.id = requested_work_item_id
  for update of instance;
  if instance_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;

  select event.id, event.actor_user_id into existing_event_id, existing_actor_user_id
  from public.process_events event
  where event.tenant_id = instance_row.tenant_id
    and event.hr_group_id = instance_row.hr_group_id
    and event.process_instance_id = instance_row.id
    and event.idempotency_key = pg_catalog.btrim(requested_idempotency_key);
  if existing_event_id is not null then
    if existing_actor_user_id is distinct from auth.uid() then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = 'P0001'; end if;
    return internal_security.process_runtime_result(instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, existing_event_id);
  end if;
  actor_user_id := auth.uid();

  select item.* into item_row
  from public.process_work_items item
  where item.tenant_id = instance_row.tenant_id
    and item.hr_group_id = instance_row.hr_group_id
    and item.id = requested_work_item_id
  for update;
  select step.* into step_row
  from public.process_step_instances step
  where step.tenant_id = item_row.tenant_id
    and step.hr_group_id = item_row.hr_group_id
    and step.process_instance_id = item_row.process_instance_id
    and step.id = item_row.step_instance_id
  for update;
  if item_row.id is null or step_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if instance_row.status not in ('RUNNING'::public.process_instance_status, 'BLOCKED'::public.process_instance_status) then
    raise exception 'PROCESS_INSTANCE_NOT_ACTIVE' using errcode = 'P0001';
  end if;
  if step_row.status <> 'ACTIVE'::public.process_step_instance_status then raise exception 'STEP_NOT_ACTIVE' using errcode = 'P0001'; end if;
  if item_row.status not in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status) then
    raise exception 'WORK_ITEM_NOT_OPEN' using errcode = 'P0001';
  end if;
  if item_row.expected_version <> requested_expected_version then raise exception 'STALE_STATE' using errcode = 'P0001'; end if;
  if requested_step_expected_version is not null and step_row.expected_version <> requested_step_expected_version then
    raise exception 'STALE_STATE' using errcode = 'P0001';
  end if;

  actor_employee_id := internal_security.current_employee_id(instance_row.tenant_id, instance_row.hr_group_id);
  if actor_employee_id is null then raise exception 'ACTOR_EMPLOYEE_NOT_FOUND' using errcode = '42501'; end if;
  has_scope_permission := internal_security.process_scope_has_permission(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type, instance_row.administration_id, 'process-task:act'
  );
  select exists (
    select 1 from public.process_work_item_candidates candidate
    where candidate.tenant_id = item_row.tenant_id
      and candidate.hr_group_id = item_row.hr_group_id
      and candidate.work_item_id = item_row.id
      and candidate.employee_id = actor_employee_id
      and candidate.candidate_user_id = actor_user_id
      and candidate.is_eligible
      and candidate.resolution_revision = (
        select max(latest.resolution_revision)
        from public.process_work_item_candidates latest
        where latest.tenant_id = item_row.tenant_id and latest.hr_group_id = item_row.hr_group_id and latest.work_item_id = item_row.id
      )
  ) into candidate_ok;
  if not has_scope_permission and not candidate_ok then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if item_row.status = 'CLAIMED' and item_row.claimed_by_user_id <> actor_user_id then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select version.* into version_row from public.process_versions version where version.id = instance_row.process_version_id;
  definition_content := internal_security.process_definition_content(version_row.definition_json);
  select value into step_definition
  from pg_catalog.jsonb_array_elements(coalesce(definition_content -> 'steps', '[]'::jsonb)) value
  where value ->> 'key' = item_row.step_key;
  if step_definition is null then raise exception 'STEP_NOT_FOUND' using errcode = 'P0001'; end if;
  if not exists (
    select 1 from pg_catalog.jsonb_array_elements(coalesce(step_definition -> 'allowedActions', '[]'::jsonb)) action
    where action #>> '{}' = requested_action
  ) then raise exception 'FORBIDDEN_ACTION' using errcode = '42501'; end if;

  subject := internal_security.process_subject_context(instance_row.tenant_id, instance_row.hr_group_id, instance_row.id);
  fields := coalesce(instance_row.metadata -> 'fields', '{}'::jsonb);
  transition := internal_security.select_process_transition(definition_content, item_row.step_key, requested_action, fields, subject);

  update public.process_work_items
  set status = 'COMPLETED'::public.process_work_item_status,
      expected_version = expected_version + 1
  where id = item_row.id;

  if item_row.assignment_mode = 'ALL'::public.process_assignment_mode then
    select count(*) into remaining_all
    from public.process_work_items sibling
    where sibling.tenant_id = item_row.tenant_id
      and sibling.hr_group_id = item_row.hr_group_id
      and sibling.step_instance_id = item_row.step_instance_id
      and sibling.status <> 'COMPLETED'::public.process_work_item_status
      and sibling.status <> 'CANCELLED'::public.process_work_item_status;
    if remaining_all > 0 then
      update public.process_step_instances
      set expected_version = expected_version + 1
      where id = step_row.id;
      update public.process_instances
      set instance_version = instance_version + 1
      where id = instance_row.id;
      event_id := internal_security.append_process_runtime_event(
        item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, item_row.id,
        'PROCESS_WORK_ITEM_ACTIONED', jsonb_build_object('action', requested_action, 'stepKey', item_row.step_key, 'remainingParallelItems', remaining_all),
        actor_user_id, actor_employee_id, pg_catalog.btrim(requested_idempotency_key), coalesce(requested_correlation_id, instance_row.correlation_id)
      );
      return internal_security.process_runtime_result(item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, event_id);
    end if;
  end if;

  update public.process_step_instances
  set status = case requested_action
    when 'REJECT' then 'REJECTED'::public.process_step_instance_status
    when 'CANCEL' then 'CANCELLED'::public.process_step_instance_status
    else 'COMPLETED'::public.process_step_instance_status
  end,
      completed_at = timezone('utc', now()), expected_version = expected_version + 1
  where id = step_row.id;
  update public.process_instances
  set instance_version = instance_version + 1,
      current_step_key = null
  where id = instance_row.id;
  perform internal_security.activate_process_step(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id,
    instance_row.scope_type, instance_row.administration_id, instance_row.process_version_id,
    definition_content, transition ->> 'toStepKey', coalesce(requested_correlation_id, instance_row.correlation_id),
    actor_user_id, actor_employee_id
  );
  event_id := internal_security.append_process_runtime_event(
    item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, item_row.id,
    'PROCESS_WORK_ITEM_ACTIONED', jsonb_build_object('action', requested_action, 'stepKey', item_row.step_key, 'transitionKey', transition ->> 'key'),
    actor_user_id, actor_employee_id, pg_catalog.btrim(requested_idempotency_key), coalesce(requested_correlation_id, instance_row.correlation_id)
  );
  return internal_security.process_runtime_result(item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, event_id);
end;
$$;

revoke all on function internal_security.perform_process_work_item_action(uuid, text, bigint, bigint, text, uuid) from public, anon, authenticated;

create or replace function public.perform_process_work_item_action(
  requested_work_item_id uuid,
  requested_action text,
  requested_expected_version bigint,
  requested_step_expected_version bigint,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.perform_process_work_item_action(
    requested_work_item_id, requested_action, requested_expected_version,
    requested_step_expected_version, requested_idempotency_key, requested_correlation_id
  );
$$;

revoke all on function public.perform_process_work_item_action(uuid, text, bigint, bigint, text, uuid) from public, anon;
grant execute on function public.perform_process_work_item_action(uuid, text, bigint, bigint, text, uuid) to authenticated;

create or replace function internal_security.get_process_instance_projection(requested_process_instance_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  instance_row public.process_instances%rowtype;
  step_projection jsonb;
  work_item_projection jsonb;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  select instance.* into instance_row
  from public.process_instances instance
  where instance.id = requested_process_instance_id
  for share;
  if instance_row.id is null then raise exception 'PROCESS_INSTANCE_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.process_instance_can_read(instance_row.tenant_id, instance_row.hr_group_id, instance_row.id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', step.id, 'stepKey', step.step_key, 'activationNumber', step.activation_number,
    'status', step.status, 'expectedVersion', step.expected_version,
    'activatedAt', step.activated_at, 'completedAt', step.completed_at, 'deadlineAt', step.deadline_at
  ) order by step.created_at, step.step_key), '[]'::jsonb) into step_projection
  from public.process_step_instances step
  where step.tenant_id = instance_row.tenant_id and step.hr_group_id = instance_row.hr_group_id and step.process_instance_id = instance_row.id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', item.id, 'stepKey', item.step_key, 'participantKey', item.participant_key,
    'assignmentMode', item.assignment_mode, 'status', item.status, 'expectedVersion', item.expected_version,
    'availableAt', item.available_at, 'deadlineAt', item.deadline_at
  ) order by item.created_at, item.id), '[]'::jsonb) into work_item_projection
  from public.process_work_items item
  where item.tenant_id = instance_row.tenant_id and item.hr_group_id = instance_row.hr_group_id and item.process_instance_id = instance_row.id;
  return jsonb_build_object(
    'processInstanceId', instance_row.id, 'status', instance_row.status,
    'currentStepKey', instance_row.current_step_key, 'instanceVersion', instance_row.instance_version,
    'startedAt', instance_row.started_at, 'completedAt', instance_row.completed_at,
    'correlationId', instance_row.correlation_id, 'steps', step_projection, 'workItems', work_item_projection
  );
end;
$$;

revoke all on function internal_security.get_process_instance_projection(uuid) from public, anon, authenticated;

create or replace function public.get_process_instance_projection(requested_process_instance_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select internal_security.get_process_instance_projection(requested_process_instance_id); $$;

revoke all on function public.get_process_instance_projection(uuid) from public, anon;
grant execute on function public.get_process_instance_projection(uuid) to authenticated;

create or replace function internal_security.audit_process_runtime_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_id_value uuid;
  administration_id_value uuid;
  process_instance_id_value uuid;
  correlation_id_value uuid;
  actor_user_id_value uuid;
  action_value text;
  entity_id_value uuid;
  changes_value jsonb;
begin
  if TG_TABLE_NAME = 'process_instances' then
    tenant_id_value := coalesce(NEW.tenant_id, OLD.tenant_id);
    administration_id_value := coalesce(NEW.administration_id, OLD.administration_id);
    process_instance_id_value := coalesce(NEW.id, OLD.id);
    correlation_id_value := coalesce(NEW.correlation_id, OLD.correlation_id);
    actor_user_id_value := coalesce(auth.uid(), NEW.initiator_user_id, OLD.initiator_user_id);
    entity_id_value := process_instance_id_value;
    action_value := case when TG_OP = 'INSERT' then 'PROCESS_INSTANCE_CREATED' else 'PROCESS_INSTANCE_UPDATED' end;
    changes_value := jsonb_build_object(
      'status', coalesce(NEW.status, OLD.status),
      'currentStepKey', coalesce(NEW.current_step_key, OLD.current_step_key),
      'instanceVersion', coalesce(NEW.instance_version, OLD.instance_version),
      'correlationId', correlation_id_value
    );
  elsif TG_TABLE_NAME = 'process_step_instances' then
    select instance.tenant_id, instance.administration_id, instance.id, instance.correlation_id
      into tenant_id_value, administration_id_value, process_instance_id_value, correlation_id_value
    from public.process_instances instance
    where instance.id = coalesce(NEW.process_instance_id, OLD.process_instance_id);
    actor_user_id_value := auth.uid();
    entity_id_value := coalesce(NEW.id, OLD.id);
    action_value := 'PROCESS_STEP_' || case when coalesce(NEW.status::text, OLD.status::text) = 'ACTIVE' then 'ACTIVATED' else 'UPDATED' end;
    changes_value := jsonb_build_object(
      'stepKey', coalesce(NEW.step_key, OLD.step_key),
      'status', coalesce(NEW.status, OLD.status),
      'expectedVersion', coalesce(NEW.expected_version, OLD.expected_version),
      'correlationId', correlation_id_value
    );
  elsif TG_TABLE_NAME = 'process_work_items' then
    select instance.tenant_id, instance.administration_id, instance.id, instance.correlation_id
      into tenant_id_value, administration_id_value, process_instance_id_value, correlation_id_value
    from public.process_instances instance
    where instance.id = coalesce(NEW.process_instance_id, OLD.process_instance_id);
    actor_user_id_value := coalesce(auth.uid(), NEW.claimed_by_user_id, OLD.claimed_by_user_id);
    entity_id_value := coalesce(NEW.id, OLD.id);
    action_value := 'PROCESS_WORK_ITEM_' || case when TG_OP = 'INSERT' then 'CREATED' else 'UPDATED' end;
    changes_value := jsonb_build_object(
      'stepKey', coalesce(NEW.step_key, OLD.step_key),
      'status', coalesce(NEW.status, OLD.status),
      'assignmentMode', coalesce(NEW.assignment_mode, OLD.assignment_mode),
      'expectedVersion', coalesce(NEW.expected_version, OLD.expected_version),
      'correlationId', correlation_id_value
    );
  elsif TG_TABLE_NAME = 'process_events' then
    select instance.administration_id into administration_id_value
    from public.process_instances instance where instance.id = NEW.process_instance_id;
    tenant_id_value := NEW.tenant_id;
    process_instance_id_value := NEW.process_instance_id;
    correlation_id_value := NEW.correlation_id;
    actor_user_id_value := coalesce(NEW.actor_user_id, auth.uid());
    entity_id_value := NEW.id;
    action_value := NEW.event_type;
    changes_value := jsonb_build_object(
      'sequenceNumber', NEW.sequence_number,
      'eventType', NEW.event_type,
      'correlationId', correlation_id_value
    );
  else
    return NEW;
  end if;

  insert into public.audit_logs (
    tenant_id, administration_id, entity_name, entity_id, actor_user_id, action,
    changes, correlation_id
  ) values (
    tenant_id_value, administration_id_value, replace(TG_TABLE_NAME, 'process_', 'process_'),
    entity_id_value, actor_user_id_value, action_value, changes_value, correlation_id_value
  );
  return NEW;
end;
$$;

revoke all on function internal_security.audit_process_runtime_change() from public, anon, authenticated;

drop trigger if exists audit_process_instances_runtime on public.process_instances;
create trigger audit_process_instances_runtime
after insert or update on public.process_instances
for each row execute function internal_security.audit_process_runtime_change();
drop trigger if exists audit_process_step_instances_runtime on public.process_step_instances;
create trigger audit_process_step_instances_runtime
after insert or update on public.process_step_instances
for each row execute function internal_security.audit_process_runtime_change();
drop trigger if exists audit_process_work_items_runtime on public.process_work_items;
create trigger audit_process_work_items_runtime
after insert or update on public.process_work_items
for each row execute function internal_security.audit_process_runtime_change();
drop trigger if exists audit_process_events_runtime on public.process_events;
create trigger audit_process_events_runtime
after insert on public.process_events
for each row execute function internal_security.audit_process_runtime_change();

commit;
