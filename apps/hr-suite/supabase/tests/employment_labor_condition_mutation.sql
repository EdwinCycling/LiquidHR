begin;

select plan(14);

select has_function(
  'public',
  'apply_employment_timeline_mutation',
  array['uuid', 'text', 'date', 'jsonb', 'text', 'text[]', 'jsonb'],
  'De standalone employment-timeline-RPC bestaat.'
);

select has_function(
  'public',
  'apply_combined_employment_timeline_mutation',
  array['uuid', 'date', 'jsonb', 'text', 'text[]', 'jsonb'],
  'De gecombineerde employment-timeline-RPC bestaat.'
);

select ok(
  not (select prosecdef from pg_proc where oid = 'public.apply_employment_timeline_mutation(uuid,text,date,jsonb,text,text[],jsonb)'::regprocedure),
  'De standalone RPC blijft SECURITY INVOKER.'
);

select ok(
  has_function_privilege('authenticated', 'public.apply_employment_timeline_mutation(uuid,text,date,jsonb,text,text[],jsonb)', 'EXECUTE'),
  'Authenticated mag de standalone RPC uitvoeren.'
);

select ok(
  not has_function_privilege('anon', 'public.apply_employment_timeline_mutation(uuid,text,date,jsonb,text,text[],jsonb)', 'EXECUTE'),
  'Anon mag de standalone RPC niet uitvoeren.'
);

select ok(
  not (select prosecdef from pg_proc where oid = 'public.apply_combined_employment_timeline_mutation(uuid,date,jsonb,text,text[],jsonb)'::regprocedure),
  'De gecombineerde RPC blijft SECURITY INVOKER.'
);

select ok(
  has_function_privilege('authenticated', 'public.apply_combined_employment_timeline_mutation(uuid,date,jsonb,text,text[],jsonb)', 'EXECUTE'),
  'Authenticated mag de gecombineerde RPC uitvoeren.'
);

select ok(
  not has_function_privilege('anon', 'public.apply_combined_employment_timeline_mutation(uuid,date,jsonb,text,text[],jsonb)', 'EXECUTE'),
  'Anon mag de gecombineerde RPC niet uitvoeren.'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select id from auth.users where lower(email) = 'hradmin.fixture@liquidhr.test' limit 1),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

select lives_ok($$
declare
  target_employment uuid;
  target_effective_on date;
begin
  select employment.id, greatest(
    current_date + 1,
    coalesce(max(condition.valid_from) + 1, current_date + 1)
  )
  into target_employment, target_effective_on
  from public.employments employment
  left join public.employment_labor_conditions condition on condition.employment_id = employment.id
  join public.employees employee on employee.id = employment.employee_id
  where employee.employee_number = 'DEMO-035'
    and employment.deleted_at is null
  group by employment.id
  order by employment.starts_on
  limit 1;

  perform public.apply_employment_timeline_mutation(
    target_employment,
    'LABOR_CONDITIONS',
    target_effective_on,
    '{"conditionGroup":"pgTAP labor-condition mutation"}'::jsonb,
    'pgTAP labor-condition mutation',
    array[]::text[],
    '{}'::jsonb
  );
end
$$, 'HR kan een labor-condition-tijdlijnblok toevoegen zonder RLS-fout.');

select is(
  (select count(*)::integer
   from public.employment_labor_conditions condition
   join public.employments employment on employment.id = condition.employment_id
   join public.employees employee on employee.id = employment.employee_id
   where employee.employee_number = 'DEMO-035'
     and condition.condition_group = 'pgTAP labor-condition mutation'),
  1,
  'De labor-condition-row wordt exact één keer aangemaakt.'
);

select is(
  (select count(*)::integer
   from public.employment_labor_conditions condition
   join public.employments employment on employment.id = condition.employment_id
   join public.employees employee on employee.id = employment.employee_id
   where employee.employee_number = 'DEMO-035'
     and condition.condition_group = 'pgTAP labor-condition mutation'
     and condition.hr_group_id = employment.hr_group_id
     and condition.employment_contract_id is not null),
  1,
  'De aangemaakte row draagt de HR-groep- en contractscope.'
);

select lives_ok($$
declare
  target_employment uuid;
  target_effective_on date;
begin
  select employment.id, greatest(
    current_date + 2,
    coalesce(max(condition.valid_from) + 1, current_date + 2)
  )
  into target_employment, target_effective_on
  from public.employments employment
  left join public.employment_labor_conditions condition on condition.employment_id = employment.id
  join public.employees employee on employee.id = employment.employee_id
  where employee.employee_number = 'DEMO-035'
    and employment.deleted_at is null
  group by employment.id
  order by employment.starts_on
  limit 1;

  perform public.apply_combined_employment_timeline_mutation(
    target_employment,
    target_effective_on,
    '[
      {"timeline":"LABOR_CONDITIONS","payload":{"conditionGroup":"pgTAP combined labor-condition mutation"}}
    ]'::jsonb,
    'pgTAP combined labor-condition mutation',
    array[]::text[],
    '{}'::jsonb
  );
end
$$, 'HR kan ook de gecombineerde labor-condition-tijdlijn toepassen zonder RLS-fout.');

select is(
  (select count(*)::integer
   from public.employment_labor_conditions condition
   join public.employments employment on employment.id = condition.employment_id
   join public.employees employee on employee.id = employment.employee_id
   where employee.employee_number = 'DEMO-035'
     and condition.condition_group = 'pgTAP combined labor-condition mutation'),
  1,
  'De gecombineerde labor-condition-row wordt exact één keer aangemaakt.'
);

select is(
  (select count(*)::integer
   from public.employment_labor_conditions condition
   join public.employments employment on employment.id = condition.employment_id
   join public.employees employee on employee.id = employment.employee_id
   where employee.employee_number = 'DEMO-035'
     and condition.condition_group = 'pgTAP combined labor-condition mutation'
     and condition.hr_group_id = employment.hr_group_id
     and condition.employment_contract_id is not null),
  1,
  'De gecombineerde row draagt de HR-groep- en contractscope.'
);

select * from finish();
rollback;
