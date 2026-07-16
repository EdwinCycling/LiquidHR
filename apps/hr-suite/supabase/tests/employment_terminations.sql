begin;

do $$
declare
  tenant uuid := md5('tenant:liquid-hr-demo-holding')::uuid;
  administration uuid;
  employee uuid;
  employment_id uuid := md5('employment:termination-test')::uuid;
  termination_id uuid := md5('termination:test')::uuid;
  internal_reason_id uuid := md5('internal-end-reason:test')::uuid;
  actor uuid;
begin
  select id into administration from public.administrations where tenant_id = tenant order by code limit 1;
  select id into employee from public.employees where tenant_id = tenant order by employee_number limit 1;
  select id into actor from auth.users where lower(email) = 'edwin@editsolutions.nl' limit 1;

  insert into public.employments (
    id, tenant_id, administration_id, employee_id, employment_number,
    contract_type, starts_on, seniority_date, original_hire_date
  ) values (employment_id, tenant, administration, employee, 'TEST-END', 'INDEFINITE', '2026-01-01', '2026-01-01', '2026-01-01');
  insert into public.employment_end_reasons (
    id, tenant_id, administration_id, code, name_nl, name_en
  ) values (internal_reason_id, tenant, administration, 'TEST', 'Testreden', 'Test reason');
  insert into public.employment_terminations (
    id, tenant_id, administration_id, employee_id, employment_id,
    last_working_day, internal_reason_id, statutory_reason_id, initiator,
    created_by_user_id
  ) values (
    termination_id, tenant, administration, employee, employment_id,
    '2026-06-30', internal_reason_id, md5('termination-reason:20:2026')::uuid,
    'EMPLOYEE', actor
  );

  perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);
  perform public.confirm_employment_termination(termination_id);

  if (select ends_on from public.employments where id = employment_id) <> '2026-06-30'::date then
    raise exception 'Bevestiging heeft het dienstverband niet beëindigd.';
  end if;
  if (select workflow_status from public.employment_terminations where id = termination_id) <> 'CONFIRMED' then
    raise exception 'Bevestiging heeft de workflowstatus niet bijgewerkt.';
  end if;
end
$$;

rollback;
