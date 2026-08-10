begin;

-- Keep the published form projection/save RPCs unchanged. Binding-aware
-- callers use the private wrappers created below, so existing forms retain
-- their exact runtime contract while the new registry is rolled out.
create or replace function internal_security.process_form_binding_value(
  requested_field jsonb,
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_process_instance_id uuid,
  requested_subject jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  binding_kind text := requested_field -> 'binding' ->> 'kind';
  binding_key text := requested_field -> 'binding' ->> 'key';
  formula_key text := requested_field -> 'binding' ->> 'formulaKey';
  employee_id_value uuid;
  employment_id_value uuid;
  department_id_value uuid;
  effective_date date;
  employment_row public.employments%rowtype;
  placement_row public.employee_organizations%rowtype;
  employee_name text;
  employment_label text;
  department_label text;
  job_label text;
  manager_name text;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  employee_id_value := case
    when requested_subject ->> 'employeeId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (requested_subject ->> 'employeeId')::uuid
    else null
  end;
  employment_id_value := case
    when requested_subject ->> 'employmentId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (requested_subject ->> 'employmentId')::uuid
    else null
  end;
  department_id_value := case
    when requested_subject ->> 'departmentId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (requested_subject ->> 'departmentId')::uuid
    else null
  end;
  effective_date := case
    when requested_subject ->> 'effectiveDate' ~ '^\d{4}-\d{2}-\d{2}$'
    then (requested_subject ->> 'effectiveDate')::date
    else null
  end;

  if binding_kind = 'DOMAIN_READ' or binding_kind = 'COMPUTED' then
    if employee_id_value is not null then
      select concat_ws(' ', employee.first_name, employee.birth_name)
        into employee_name
      from public.employees employee
      where employee.id = employee_id_value
        and employee.tenant_id = requested_tenant_id
        and employee.hr_group_id = requested_hr_group_id
        and employee.deleted_at is null;
    end if;
    if employment_id_value is not null then
      select employment.*
        into employment_row
      from public.employments employment
      where employment.id = employment_id_value
        and employment.tenant_id = requested_tenant_id
        and employment.hr_group_id = requested_hr_group_id
        and employment.deleted_at is null;
    end if;
    if employee_id_value is not null then
      select organization.*
        into placement_row
      from public.employee_organizations organization
      where organization.tenant_id = requested_tenant_id
        and organization.hr_group_id = requested_hr_group_id
        and organization.employee_id = employee_id_value
        and (employment_id_value is null or organization.employment_id = employment_id_value)
        and organization.effective_from <= coalesce(effective_date, current_date)
        and (organization.effective_to is null or organization.effective_to >= coalesce(effective_date, current_date))
      order by organization.effective_from desc, organization.id
      limit 1;
    end if;
    if department_id_value is null then department_id_value := placement_row.department_id; end if;
    if placement_row.direct_manager_id is not null then
      select concat_ws(' ', manager.first_name, manager.birth_name)
        into manager_name
      from public.employees manager
      where manager.id = placement_row.direct_manager_id
        and manager.tenant_id = requested_tenant_id
        and manager.hr_group_id = requested_hr_group_id
        and manager.deleted_at is null;
    end if;
    if placement_row.department_id is not null then
      select department.name
        into department_label
      from public.departments department
      where department.id = placement_row.department_id
        and department.tenant_id = requested_tenant_id
        and department.hr_group_id = requested_hr_group_id;
    elsif department_id_value is not null then
      select department.name
        into department_label
      from public.departments department
      where department.id = department_id_value
        and department.tenant_id = requested_tenant_id
        and department.hr_group_id = requested_hr_group_id;
    end if;
    if placement_row.job_id is not null then
      select revision.name
        into job_label
      from public.job_revisions revision
      where revision.job_id = placement_row.job_id
        and revision.tenant_id = requested_tenant_id
        and revision.hr_group_id = requested_hr_group_id
        and revision.valid_from <= coalesce(effective_date, current_date)
        and (revision.valid_until is null or revision.valid_until > coalesce(effective_date, current_date))
      order by revision.valid_from desc
      limit 1;
    end if;
  end if;

  if binding_kind = 'DOMAIN_READ' then
    case binding_key
      when 'employee.current.employee' then
        if employee_id_value is null then return null; end if;
        return jsonb_build_object('id', employee_id_value, 'label', coalesce(employee_name, employee_id_value::text));
      when 'employee.current.employment' then
        if employment_row.id is null then return null; end if;
        employment_label := coalesce(employment_row.employment_number, employment_row.id::text);
        return jsonb_build_object('id', employment_row.id, 'label', employment_label);
      when 'employee.current.department' then
        if department_id_value is null then return null; end if;
        return jsonb_build_object('id', department_id_value, 'label', coalesce(department_label, department_id_value::text));
      when 'employee.current.job' then
        if placement_row.job_id is null then return null; end if;
        return jsonb_build_object('id', placement_row.job_id, 'label', coalesce(job_label, placement_row.job_id::text));
      when 'employee.current.manager' then
        if placement_row.direct_manager_id is null then return null; end if;
        return jsonb_build_object(
          'id', placement_row.direct_manager_id,
          'label', coalesce(manager_name, placement_row.direct_manager_id::text)
        );
      when 'employee.current.name' then
        if employee_name is null then return null; end if;
        return to_jsonb(employee_name);
      when 'employment.current.startsOn' then
        if employment_row.id is null then return null; end if;
        return to_jsonb(employment_row.starts_on);
      when 'employment.current.endsOn' then
        if employment_row.id is null or employment_row.ends_on is null then return null; end if;
        return to_jsonb(employment_row.ends_on);
      when 'employment.current.type' then
        if employment_row.id is null then return null; end if;
        return to_jsonb(employment_row.employment_type::text);
      when 'employment.current.contractType' then
        if employment_row.id is null then return null; end if;
        return to_jsonb(employment_row.contract_type::text);
      else
        -- employee.document is resolved by the existing document adapter.
        return null;
    end case;
  end if;

  if binding_kind = 'COMPUTED' then
    case formula_key
      when 'subject-has-employee' then return to_jsonb(employee_id_value is not null);
      when 'subject-has-employment' then return to_jsonb(employment_row.id is not null);
      when 'subject-has-department' then return to_jsonb(department_id_value is not null);
      when 'subject-display-name' then return to_jsonb(employee_name);
      when 'employment-tenure-years' then
        if employment_row.id is null or effective_date is null then return null; end if;
        return to_jsonb(round(((effective_date - coalesce(employment_row.seniority_date, employment_row.starts_on))::numeric / 365.25), 2));
      when 'process-business-effective-date' then return to_jsonb(effective_date);
      when 'employment-active-on-business-date' then
        return to_jsonb(
          employment_row.id is not null
          and effective_date is not null
          and employment_row.starts_on <= effective_date
          and (employment_row.ends_on is null or employment_row.ends_on >= effective_date)
          and employment_row.record_status::text = 'CONFIRMED'
        );
      else
        return null;
    end case;
  end if;

  return null;
end;
$$;

revoke all on function internal_security.process_form_binding_value(jsonb, uuid, uuid, uuid, jsonb) from public, anon, authenticated;

-- Create a binding-aware copy of the projection. The existing shared
-- projection remains untouched and keeps serving legacy form callers.
do $create_projection_wrapper$
declare
  function_definition text;
  declaration_fragment text := $fragment$  current_value jsonb;
  new_value jsonb;
  label_text text;$fragment$;
  declaration_replacement text := $fragment$  current_value jsonb;
  new_value jsonb;
  binding_value jsonb;
  label_text text;$fragment$;
  values_fragment text := $fragment$      current_value := coalesce(response_row.current_values, '{}'::jsonb) -> field_key;
      new_value := coalesce(response_row.new_values, '{}'::jsonb) -> field_key;$fragment$;
  values_replacement text := $fragment$      binding_value := internal_security.process_form_binding_value(
        field,
        instance_row.tenant_id,
        instance_row.hr_group_id,
        instance_row.id,
        subject
      );
      if field -> 'binding' ->> 'kind' = 'COMPUTED'
        or (field -> 'binding' ->> 'kind' = 'DOMAIN_READ' and field -> 'binding' ->> 'key' <> 'employee.document') then
        current_value := binding_value;
        new_value := current_value;
      else
        current_value := coalesce(response_row.current_values, '{}'::jsonb) -> field_key;
        new_value := coalesce(response_row.new_values, '{}'::jsonb) -> field_key;
      end if;$fragment$;
  conditions_fragment text := $fragment$  fields_for_conditions := coalesce(instance_row.metadata -> 'fields', '{}'::jsonb)
    || coalesce(response_row.current_values, '{}'::jsonb)
    || coalesce(response_row.new_values, '{}'::jsonb);$fragment$;
  conditions_replacement text := $fragment$  fields_for_conditions := coalesce(instance_row.metadata -> 'fields', '{}'::jsonb)
    || coalesce(response_row.current_values, '{}'::jsonb)
    || coalesce(response_row.new_values, '{}'::jsonb);
  for field in select field_item from internal_security.process_form_fields(form_definition) field_item loop
    binding_value := internal_security.process_form_binding_value(
      field,
      instance_row.tenant_id,
      instance_row.hr_group_id,
      instance_row.id,
      subject
    );
    if field -> 'binding' ->> 'kind' = 'COMPUTED'
      or (field -> 'binding' ->> 'kind' = 'DOMAIN_READ' and field -> 'binding' ->> 'key' <> 'employee.document') then
      fields_for_conditions := fields_for_conditions || jsonb_build_object(field ->> 'key', binding_value);
    end if;
  end loop;$fragment$;
begin
  select pg_catalog.pg_get_functiondef(
    'internal_security.get_process_form_projection(uuid, text)'::pg_catalog.regprocedure
  ) into function_definition;
  if position('internal_security.get_process_form_projection(' in function_definition) = 0
    or position(declaration_fragment in function_definition) = 0
    or position(values_fragment in function_definition) = 0
    or position(conditions_fragment in function_definition) = 0 then
    raise exception 'FORM_BINDING_PROJECTION_WRAPPER_TARGET_NOT_FOUND' using errcode = 'P0001';
  end if;
  function_definition := replace(function_definition, 'internal_security.get_process_form_projection(', 'internal_security.get_process_form_projection_with_bindings(');
  function_definition := replace(function_definition, declaration_fragment, declaration_replacement);
  function_definition := replace(function_definition, values_fragment, values_replacement);
  function_definition := replace(function_definition, conditions_fragment, conditions_replacement);
  execute function_definition;
end;
$create_projection_wrapper$;

-- Create a binding-aware copy of the save path. It rejects forged writes to
-- DOMAIN_READ/COMPUTED and evaluates conditions against server values.
do $create_save_wrapper$
declare
  function_definition text;
  declaration_fragment text := $fragment$  required boolean;$fragment$;
  declaration_replacement text := $fragment$  required boolean;
  binding_value jsonb;$fragment$;
  conditions_fragment text := $fragment$  merged_condition_values := coalesce(instance_row.metadata -> 'fields', '{}'::jsonb) || existing_current || existing_new || incoming_new;$fragment$;
  conditions_replacement text := $fragment$  merged_condition_values := coalesce(instance_row.metadata -> 'fields', '{}'::jsonb) || existing_current || existing_new || incoming_new;
  for field in select field_item from internal_security.process_form_fields(form_definition) field_item loop
    binding_value := internal_security.process_form_binding_value(
      field,
      instance_row.tenant_id,
      instance_row.hr_group_id,
      instance_row.id,
      subject
    );
    if field -> 'binding' ->> 'kind' = 'COMPUTED'
      or (field -> 'binding' ->> 'kind' = 'DOMAIN_READ' and field -> 'binding' ->> 'key' <> 'employee.document') then
      merged_condition_values := merged_condition_values || jsonb_build_object(field ->> 'key', binding_value);
    end if;
  end loop;$fragment$;
  writable_fragment text := $fragment$    if mode_name is null or mode_name = 'HIDDEN' then raise exception 'HIDDEN_FIELD_SUBMITTED' using errcode = 'P0001'; end if;
    if mode_name not in ('WRITE_OPTIONAL', 'WRITE_REQUIRED') then raise exception 'FIELD_NOT_WRITABLE' using errcode = 'P0001'; end if;$fragment$;
  writable_replacement text := $fragment$    if mode_name is null or mode_name = 'HIDDEN' then raise exception 'HIDDEN_FIELD_SUBMITTED' using errcode = 'P0001'; end if;
    if field -> 'binding' ->> 'kind' in ('DOMAIN_READ', 'COMPUTED') then
      raise exception 'FIELD_BINDING_NOT_WRITABLE' using errcode = 'P0001';
    end if;
    if mode_name not in ('WRITE_OPTIONAL', 'WRITE_REQUIRED') then raise exception 'FIELD_NOT_WRITABLE' using errcode = 'P0001'; end if;$fragment$;
  visibility_fragment text := $fragment$    if not internal_security.process_condition_matches(field -> 'visibilityCondition', coalesce(instance_row.metadata -> 'fields', '{}'::jsonb) || existing_current || merged_new, subject) then continue; end if;
    required := internal_security.process_form_field_required(field, item_row.participant_key, coalesce(instance_row.metadata -> 'fields', '{}'::jsonb) || existing_current || merged_new, subject);$fragment$;
  visibility_replacement text := $fragment$    if not internal_security.process_condition_matches(field -> 'visibilityCondition', merged_condition_values, subject) then continue; end if;
    required := internal_security.process_form_field_required(field, item_row.participant_key, merged_condition_values, subject);$fragment$;
begin
  select pg_catalog.pg_get_functiondef(
    'internal_security.save_process_form_response(uuid, bigint, bigint, jsonb, text, uuid, text)'::pg_catalog.regprocedure
  ) into function_definition;
  if position('internal_security.save_process_form_response(' in function_definition) = 0
    or position(declaration_fragment in function_definition) = 0
    or position(conditions_fragment in function_definition) = 0
    or position(writable_fragment in function_definition) = 0
    or position(visibility_fragment in function_definition) = 0 then
    raise exception 'FORM_BINDING_SAVE_WRAPPER_TARGET_NOT_FOUND' using errcode = 'P0001';
  end if;
  function_definition := replace(function_definition, 'internal_security.save_process_form_response(', 'internal_security.save_process_form_response_with_bindings(');
  function_definition := replace(function_definition, 'internal_security.get_process_form_projection(', 'internal_security.get_process_form_projection_with_bindings(');
  function_definition := replace(function_definition, declaration_fragment, declaration_replacement);
  function_definition := replace(function_definition, conditions_fragment, conditions_replacement);
  function_definition := replace(function_definition, writable_fragment, writable_replacement);
  function_definition := replace(function_definition, visibility_fragment, visibility_replacement);
  execute function_definition;
end;
$create_save_wrapper$;

revoke all on function internal_security.get_process_form_projection_with_bindings(uuid, text) from public, anon, authenticated;
revoke all on function internal_security.save_process_form_response_with_bindings(uuid, bigint, bigint, jsonb, text, uuid, text) from public, anon, authenticated;
grant execute on function internal_security.get_process_form_projection_with_bindings(uuid, text) to authenticated;
grant execute on function internal_security.save_process_form_response_with_bindings(uuid, bigint, bigint, jsonb, text, uuid, text) to authenticated;

create or replace function public.get_process_form_projection_with_bindings(
  requested_work_item_id uuid,
  requested_language text default 'nl'
)
returns jsonb
language sql
set search_path = ''
as $$
  select internal_security.get_process_form_projection_with_bindings(requested_work_item_id, requested_language);
$$;

create or replace function public.save_process_form_response_with_bindings(
  requested_work_item_id uuid,
  requested_expected_revision bigint,
  requested_expected_version bigint,
  requested_values jsonb,
  requested_idempotency_key text,
  requested_correlation_id uuid,
  requested_language text default 'nl'
)
returns jsonb
language sql
set search_path = ''
as $$
  select internal_security.save_process_form_response_with_bindings(
    requested_work_item_id, requested_expected_revision, requested_expected_version,
    requested_values, requested_idempotency_key, requested_correlation_id, requested_language
  );
$$;

revoke all on function public.get_process_form_projection_with_bindings(uuid, text) from public, anon, authenticated;
revoke all on function public.save_process_form_response_with_bindings(uuid, bigint, bigint, jsonb, text, uuid, text) from public, anon, authenticated;
grant execute on function public.get_process_form_projection_with_bindings(uuid, text) to authenticated;
grant execute on function public.save_process_form_response_with_bindings(uuid, bigint, bigint, jsonb, text, uuid, text) to authenticated;

commit;
