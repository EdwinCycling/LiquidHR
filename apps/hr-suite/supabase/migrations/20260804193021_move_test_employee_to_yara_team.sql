-- Koppel de bestaande medewerkersfixture aan Yara's actuele testteam.
do $$
declare
  v_yara_id uuid;
  v_test_employee_id uuid;
  v_tenant_id uuid;
  v_administration_id uuid;
  v_department_id uuid;
  v_job_id uuid;
  v_updated_count integer;
begin
  select employee.id, employee.tenant_id
    into v_yara_id, v_tenant_id
  from public.employees employee
  where employee.employee_number = 'DEMO-028'
    and employee.deleted_at is null;

  select employee.id
    into v_test_employee_id
  from public.employees employee
  where employee.employee_number = 'DEMO-035'
    and employee.deleted_at is null;

  if v_yara_id is null or v_test_employee_id is null then
    raise exception 'RICH_YARA_OR_TEST_EMPLOYEE_NOT_FOUND';
  end if;

  select organization.administration_id
    into v_administration_id
  from public.employee_organizations organization
  where organization.employee_id = v_yara_id
    and organization.effective_from <= current_date
    and (organization.effective_to is null or organization.effective_to >= current_date)
  order by organization.effective_from desc
  limit 1;

  select department.id
    into v_department_id
  from public.departments department
  where department.tenant_id = v_tenant_id
    and department.code = 'RICH-02'
    and department.is_active;

  select job.id
    into v_job_id
  from public.jobs job
  where job.tenant_id = v_tenant_id
    and job.code = 'RICH-FUN-02';

  if v_administration_id is null or v_department_id is null or v_job_id is null then
    raise exception 'RICH_YARA_TEST_EMPLOYEE_TARGET_NOT_FOUND';
  end if;

  update public.employee_organizations organization
  set department_id = v_department_id,
      direct_manager_id = v_yara_id,
      direct_manager_deputy_id = null,
      job_id = v_job_id,
      job_title = 'Operations specialist'
  where organization.employee_id = v_test_employee_id
    and organization.administration_id = v_administration_id
    and organization.effective_from <= current_date
    and (organization.effective_to is null or organization.effective_to >= current_date);

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception 'RICH_TEST_EMPLOYEE_PLACEMENT_NOT_UPDATED: expected 1, got %', v_updated_count;
  end if;
end;
$$;
