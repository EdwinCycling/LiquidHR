insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'DIRECT_MANAGER' and role.tenant_id is null
  and permission.code = 'custom-field-values:write'
on conflict do nothing;

revoke select on public.employees from authenticated;
grant select (
  id, tenant_id, auth_user_id, employee_number, title, initials, first_name,
  birth_name_prefix, birth_name, partner_name_prefix, partner_name, name_usage,
  gender, pronouns, birth_date, birth_place, birth_country, nationality,
  marital_status, marital_status_date, education_level, preferred_language,
  private_email, private_phone, private_mobile, work_email, work_phone,
  work_phone_ext, work_mobile, avatar_url, original_hire_date, is_active,
  created_at, updated_at, deleted_at
) on public.employees to authenticated;

create function internal_security.employee_is_in_administration(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_employee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.employee_administration_assignments assignment
    where assignment.tenant_id = requested_tenant_id
      and assignment.administration_id = requested_administration_id
      and assignment.employee_id = requested_employee_id
  );
$$;

revoke all on function internal_security.employee_is_in_administration(uuid, uuid, uuid)
from public, anon, authenticated;

create function public.get_employee_custom_field_values(
  p_employee_id uuid,
  p_administration_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  employee_record public.employees%rowtype;
  administration_values jsonb;
  result_values jsonb := '{}'::jsonb;
  definition_record public.custom_field_definitions%rowtype;
  audience_access public.custom_field_audience_access;
  is_self boolean;
  is_hr boolean;
  is_manager boolean;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  select * into employee_record
  from public.employees
  where id = p_employee_id and deleted_at is null;

  if employee_record.id is null
    or not internal_security.employee_is_in_administration(
      employee_record.tenant_id, p_administration_id, p_employee_id
    ) then
    raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0002';
  end if;

  is_self := p_employee_id = internal_security.current_employee_id()
    and internal_security.current_employee_has_permission('self:custom-field-values:read');
  is_hr := internal_security.current_user_has_permission(
      employee_record.tenant_id, p_administration_id, 'employee:write'
    ) and internal_security.current_user_has_permission(
      employee_record.tenant_id, p_administration_id, 'custom-field-values:read'
    );
  is_manager := internal_security.can_manage_employee(p_employee_id, 'employee:read')
    and internal_security.current_user_has_permission(
      employee_record.tenant_id, p_administration_id, 'custom-field-values:read'
    );

  if not (is_self or is_hr or is_manager) then
    raise exception 'CUSTOM_FIELD_VALUE_FORBIDDEN' using errcode = '42501';
  end if;

  administration_values := coalesce(
    employee_record.custom_fields -> p_administration_id::text,
    '{}'::jsonb
  );

  for definition_record in
    select * from public.custom_field_definitions
    where tenant_id = employee_record.tenant_id
      and administration_id = p_administration_id
      and entity_type = 'EMPLOYEE'
      and is_active and deleted_at is null
  loop
    audience_access := case
      when is_hr then definition_record.hr_access
      when is_self then definition_record.employee_self_access
      else definition_record.manager_access
    end;
    if audience_access <> 'HIDDEN'
      and administration_values ? definition_record.key then
      result_values := result_values || jsonb_build_object(
        definition_record.key, administration_values -> definition_record.key
      );
    end if;
  end loop;

  return result_values;
end;
$$;

create function public.set_employee_custom_field_values(
  p_employee_id uuid,
  p_administration_id uuid,
  p_values jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  employee_record public.employees%rowtype;
  definition_record public.custom_field_definitions%rowtype;
  pair record;
  audience_access public.custom_field_audience_access;
  is_self boolean;
  is_hr boolean;
  is_manager boolean;
  resolved_value jsonb;
  current_values jsonb;
  reserved_value bigint;
begin
  if auth.uid() is null or jsonb_typeof(p_values) <> 'object' then
    raise exception 'CUSTOM_FIELD_VALUES_INVALID' using errcode = '22023';
  end if;

  select * into employee_record
  from public.employees
  where id = p_employee_id and deleted_at is null
  for update;

  if employee_record.id is null
    or not internal_security.employee_is_in_administration(
      employee_record.tenant_id, p_administration_id, p_employee_id
    ) then
    raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0002';
  end if;

  is_self := p_employee_id = internal_security.current_employee_id()
    and internal_security.current_employee_has_permission('self:custom-field-values:write');
  is_hr := internal_security.current_user_has_permission(
      employee_record.tenant_id, p_administration_id, 'employee:write'
    ) and internal_security.current_user_has_permission(
      employee_record.tenant_id, p_administration_id, 'custom-field-values:write'
    );
  is_manager := internal_security.can_manage_employee(p_employee_id, 'employee:read')
    and internal_security.current_user_has_permission(
      employee_record.tenant_id, p_administration_id, 'custom-field-values:write'
    );

  if not (is_self or is_hr or is_manager) then
    raise exception 'CUSTOM_FIELD_VALUE_FORBIDDEN' using errcode = '42501';
  end if;

  current_values := coalesce(
    employee_record.custom_fields -> p_administration_id::text,
    '{}'::jsonb
  );

  for pair in select key, value from jsonb_each(p_values)
  loop
    select * into definition_record
    from public.custom_field_definitions
    where tenant_id = employee_record.tenant_id
      and administration_id = p_administration_id
      and entity_type = 'EMPLOYEE'
      and key = pair.key and is_active and deleted_at is null;

    if definition_record.id is null then
      raise exception 'CUSTOM_FIELD_UNKNOWN: %', pair.key using errcode = '22023';
    end if;

    audience_access := case
      when is_hr then definition_record.hr_access
      when is_self then definition_record.employee_self_access
      else definition_record.manager_access
    end;
    if audience_access <> 'WRITE' then
      raise exception 'CUSTOM_FIELD_VALUE_FORBIDDEN: %', pair.key using errcode = '42501';
    end if;

    resolved_value := pair.value;
    if definition_record.field_type = 'AUTO_INCREMENT' then
      if current_values ? pair.key then
        raise exception 'CUSTOM_FIELD_AUTO_INCREMENT_IMMUTABLE' using errcode = '23514';
      end if;
      insert into public.custom_field_counters (
        definition_id, tenant_id, administration_id, next_value
      ) values (
        definition_record.id, definition_record.tenant_id,
        definition_record.administration_id, 2
      )
      on conflict (definition_id) do update
        set next_value = public.custom_field_counters.next_value + 1,
            updated_at = timezone('utc', now())
      returning next_value - 1 into reserved_value;
      resolved_value := to_jsonb(reserved_value);
    elsif resolved_value = 'null'::jsonb then
      if definition_record.is_required then
        raise exception 'CUSTOM_FIELD_REQUIRED: %', pair.key using errcode = '23514';
      end if;
    elsif definition_record.field_type in ('TEXT', 'TEXTAREA', 'DATE', 'SELECT')
      and jsonb_typeof(resolved_value) <> 'string' then
      raise exception 'CUSTOM_FIELD_TYPE_INVALID: %', pair.key using errcode = '22023';
    elsif definition_record.field_type = 'NUMBER'
      and jsonb_typeof(resolved_value) <> 'number' then
      raise exception 'CUSTOM_FIELD_TYPE_INVALID: %', pair.key using errcode = '22023';
    elsif definition_record.field_type = 'BOOLEAN'
      and jsonb_typeof(resolved_value) <> 'boolean' then
      raise exception 'CUSTOM_FIELD_TYPE_INVALID: %', pair.key using errcode = '22023';
    elsif definition_record.field_type = 'MULTI_SELECT'
      and jsonb_typeof(resolved_value) <> 'array' then
      raise exception 'CUSTOM_FIELD_TYPE_INVALID: %', pair.key using errcode = '22023';
    end if;

    if definition_record.field_type = 'DATE' and resolved_value <> 'null'::jsonb then
      perform (resolved_value #>> '{}')::date;
    elsif definition_record.field_type = 'SELECT' and resolved_value <> 'null'::jsonb
      and not exists (
        select 1 from public.custom_field_select_options option
        where option.definition_id = definition_record.id and option.is_active
          and option.value = resolved_value #>> '{}'
      ) then
      raise exception 'CUSTOM_FIELD_OPTION_INVALID: %', pair.key using errcode = '22023';
    elsif definition_record.field_type = 'MULTI_SELECT' and resolved_value <> 'null'::jsonb
      and exists (
        select 1 from jsonb_array_elements_text(resolved_value) selected(value)
        where not exists (
          select 1 from public.custom_field_select_options option
          where option.definition_id = definition_record.id and option.is_active
            and option.value = selected.value
        )
      ) then
      raise exception 'CUSTOM_FIELD_OPTION_INVALID: %', pair.key using errcode = '22023';
    end if;

    if resolved_value = 'null'::jsonb then
      current_values := current_values - pair.key;
    else
      current_values := current_values || jsonb_build_object(pair.key, resolved_value);
    end if;
  end loop;

  update public.employees
  set custom_fields = jsonb_set(
    custom_fields, array[p_administration_id::text], current_values, true
  )
  where id = p_employee_id;

  return public.get_employee_custom_field_values(p_employee_id, p_administration_id);
end;
$$;

revoke all on function public.get_employee_custom_field_values(uuid, uuid) from public, anon;
revoke all on function public.set_employee_custom_field_values(uuid, uuid, jsonb) from public, anon;
grant execute on function public.get_employee_custom_field_values(uuid, uuid) to authenticated, service_role;
grant execute on function public.set_employee_custom_field_values(uuid, uuid, jsonb) to authenticated, service_role;
