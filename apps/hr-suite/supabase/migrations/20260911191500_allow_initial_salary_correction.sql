-- DEV-only forward correction for the salary timeline's initial row.
-- A same-day correction is allowed only for the original salary row created
-- with the employment. Other effective-date duplicates remain conflicts.
do $$
declare
  function_oid oid;
  function_definition text;
  updated_definition text;
  line_break text := chr(13) || chr(10);
  duplicate_block text;
  replacement_block text;
begin
  select 'public.apply_salary_application_change(uuid, date, jsonb, text, text[], jsonb)'::regprocedure
    into function_oid;
  select pg_get_functiondef(function_oid)
    into function_definition;

  if function_oid is null then
    raise exception 'SALARY_APPLICATION_RPC_NOT_FOUND';
  end if;

  if (select prosecdef from pg_proc where oid = function_oid) then
    raise exception 'SALARY_APPLICATION_RPC_MUST_REMAIN_SECURITY_INVOKER';
  end if;

  if position('existing_salary_id uuid' in function_definition) > 0 then
    raise exception 'SALARY_APPLICATION_INITIAL_CORRECTION_ALREADY_INSTALLED';
  end if;

  duplicate_block := concat(
    '  if exists (', line_break,
    '    select 1 from public.employment_salaries', line_break,
    '    where employment_id = employment.id and valid_from = requested_effective_on', line_break,
    '  ) then raise exception ''TIMELINE_EFFECTIVE_DATE_CONFLICT''; end if;'
  );

  if position(duplicate_block in function_definition) = 0 then
    raise exception 'SALARY_APPLICATION_DUPLICATE_BLOCK_NOT_FOUND';
  end if;

  replacement_block := concat(
    '  select salary.id', line_break,
    '    into existing_salary_id', line_break,
    '  from public.employment_salaries salary', line_break,
    '  where salary.employment_id = employment.id', line_break,
    '    and salary.valid_from = requested_effective_on', line_break,
    '    and salary.valid_from = employment.starts_on', line_break,
    '    and exists (', line_break,
    '      select 1 from public.employment_change_sets change_set', line_break,
    '      where change_set.id = salary.change_set_id', line_break,
    '        and change_set.reason = ''EMPLOYMENT_CREATED_SALARY''', line_break,
    '        and change_set.status = ''APPLIED''', line_break,
    '        and change_set.domains @> array[''SALARY'']', line_break,
    '    );', line_break,
    '  if existing_salary_id is null and exists (', line_break,
    '    select 1 from public.employment_salaries', line_break,
    '    where employment_id = employment.id and valid_from = requested_effective_on', line_break,
    '  ) then raise exception ''TIMELINE_EFFECTIVE_DATE_CONFLICT''; end if;'
  );

  updated_definition := replace(function_definition, duplicate_block, replacement_block);
  updated_definition := replace(
    updated_definition,
    '  settings public.administration_hr_settings%rowtype;' || line_break,
    '  settings public.administration_hr_settings%rowtype;' || line_break || '  existing_salary_id uuid;' || line_break
  );

  if updated_definition = function_definition then
    raise exception 'SALARY_APPLICATION_INITIAL_CORRECTION_DECLARATION_NOT_INSTALLED';
  end if;

  replacement_block := concat(
    '  if existing_salary_id is not null then', line_break,
    '    update public.employment_salaries', line_break,
    '    set', line_break,
    '      payment_type = coalesce((requested_payload ->> ''paymentType'')::public.salary_payment_type, ''PERIODIC_FIXED''),', line_break,
    '      payment_frequency = (requested_payload ->> ''paymentFrequency'')::public.salary_frequency,', line_break,
    '      salary_basis = case route', line_break,
    '        when ''SCALE_WITH_STEPS'' then ''CUSTOM_SCALE''::public.salary_basis', line_break,
    '        when ''MINIMUM_WAGE'' then ''MINIMUM_WAGE''::public.salary_basis', line_break,
    '        else ''MANUAL''::public.salary_basis', line_break,
    '      end,', line_break,
    '      fulltime_amount = nullif(requested_payload ->> ''fulltimeAmount'', '''')::numeric,', line_break,
    '      parttime_amount = nullif(requested_payload ->> ''parttimeAmount'', '''')::numeric,', line_break,
    '      hourly_rate = nullif(requested_payload ->> ''hourlyRate'', '''')::numeric,', line_break,
    '      currency_code = coalesce(requested_payload ->> ''currencyCode'', ''EUR''),', line_break,
    '      salary_scale_step_id = nullif(requested_payload ->> ''salaryScaleStepId'', '''')::uuid,', line_break,
    '      cao_scale_name = nullif(requested_payload ->> ''caoScaleName'', ''''),', line_break,
    '      cao_step_name = nullif(requested_payload ->> ''caoStepName'', ''''),', line_break,
    '      salary_route = route,', line_break,
    '      minimum_wage_scheme = scheme,', line_break,
    '      salary_structure_id = selected_structure_id,', line_break,
    '      salary_scale_id = selected_scale_id,', line_break,
    '      salary_step_code = nullif(requested_payload ->> ''salaryStepCode'', ''''),', line_break,
    '      salary_band_id = selected_band_id,', line_break,
    '      valid_until = coalesce(next_date, employment.ends_on),', line_break,
    '      change_set_id = change_id', line_break,
    '    where id = existing_salary_id;', line_break,
    '    salary_id := existing_salary_id;', line_break,
    '  else', line_break,
    '  insert into public.employment_salaries ('
  );

  if position('  insert into public.employment_salaries (' in updated_definition) = 0 then
    raise exception 'SALARY_APPLICATION_INSERT_BLOCK_NOT_FOUND';
  end if;

  updated_definition := replace(
    updated_definition,
    '  insert into public.employment_salaries (',
    replacement_block
  );
  updated_definition := replace(
    updated_definition,
    '  ) returning id into salary_id;' || line_break || line_break || '  update public.employment_change_sets',
    '  ) returning id into salary_id;' || line_break || '  end if;' || line_break || line_break || '  update public.employment_change_sets'
  );

  if updated_definition = function_definition
     or position('if existing_salary_id is not null then' in updated_definition) = 0
     or position('end if;' || line_break || line_break || '  update public.employment_change_sets' in updated_definition) = 0 then
    raise exception 'SALARY_APPLICATION_INITIAL_CORRECTION_BODY_NOT_INSTALLED';
  end if;

  execute updated_definition;

  select pg_get_functiondef(p.oid)
    into function_definition
  from pg_proc p
  where p.oid = function_oid;

  if (select prosecdef from pg_proc where oid = function_oid) then
    raise exception 'SALARY_APPLICATION_RPC_BECAME_SECURITY_DEFINER';
  end if;
  if position('existing_salary_id uuid' in function_definition) = 0
     or position('EMPLOYMENT_CREATED_SALARY' in function_definition) = 0
     or position('TIMELINE_EFFECTIVE_DATE_CONFLICT' in function_definition) = 0 then
    raise exception 'SALARY_APPLICATION_INITIAL_CORRECTION_READBACK_FAILED';
  end if;
end;
$$;

select pg_notify('pgrst', 'reload schema');
