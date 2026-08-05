-- Synthetische roltest: Yara beheert een herkenbaar team in Test Operations.
-- De wijziging verwijdert alleen de bestaande actuele testmanagerkoppelingen
-- naar DEMO-028 en maakt daarna vier expliciete directe medewerkers aan.
do $$
declare
  v_yara_id uuid;
  v_tenant_id uuid;
  v_administration_id uuid;
  v_department_id uuid;
  v_direct_manager_role_id uuid;
  v_team_count integer;
begin
  select employee.id, employee.tenant_id
    into v_yara_id, v_tenant_id
  from public.employees employee
  where employee.employee_number = 'DEMO-028'
    and employee.deleted_at is null;

  if v_yara_id is null then
    raise exception 'RICH_YARA_NOT_FOUND';
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

  if v_administration_id is null or v_department_id is null then
    raise exception 'RICH_YARA_TARGET_SCOPE_NOT_FOUND';
  end if;

  select role.id
    into v_direct_manager_role_id
  from public.management_roles role
  where role.code = 'DIRECT_MANAGER'
    and role.tenant_id is null;

  if v_direct_manager_role_id is null then
    raise exception 'DIRECT_MANAGER_ROLE_NOT_FOUND';
  end if;

  -- Maak de bestaande synthetische managerrelatie naar Yara leeg.
  update public.employee_organizations organization
  set direct_manager_id = null,
      direct_manager_deputy_id = null
  where organization.direct_manager_id = v_yara_id;

  -- Yara en haar roltoewijzing staan in dezelfde afdeling.
  update public.employee_organizations organization
  set department_id = v_department_id,
      direct_manager_id = null,
      direct_manager_deputy_id = null,
      job_title = 'Operations team lead'
  where organization.employee_id = v_yara_id
    and organization.administration_id = v_administration_id
    and organization.effective_from <= current_date
    and (organization.effective_to is null or organization.effective_to >= current_date);

  update public.department_management assignment
  set department_id = v_department_id
  where assignment.employee_id = v_yara_id
    and assignment.administration_id = v_administration_id
    and assignment.management_role_id = v_direct_manager_role_id
    and assignment.effective_from <= current_date
    and (assignment.effective_to is null or assignment.effective_to >= current_date);

  -- Vier medewerkers blijven in Test Operations en rapporteren direct aan Yara.
  update public.employee_organizations organization
  set direct_manager_id = v_yara_id,
      direct_manager_deputy_id = null,
      department_id = v_department_id
  from public.employees employee
  where organization.employee_id = employee.id
    and employee.employee_number in ('DEMO-032', 'DEMO-037', 'DEMO-042', 'DEMO-047')
    and employee.tenant_id = v_tenant_id
    and organization.administration_id = v_administration_id
    and organization.effective_from <= current_date
    and (organization.effective_to is null or organization.effective_to >= current_date);

  select count(*)
    into v_team_count
  from public.employee_organizations organization
  where organization.direct_manager_id = v_yara_id
    and organization.administration_id = v_administration_id
    and organization.effective_from <= current_date
    and (organization.effective_to is null or organization.effective_to >= current_date);

  if v_team_count <> 4 then
    raise exception 'RICH_YARA_TEAM_COUNT_MISMATCH: expected 4, got %', v_team_count;
  end if;

  if not exists (
    select 1
    from public.employee_organizations organization
    where organization.employee_id = v_yara_id
      and organization.administration_id = v_administration_id
      and organization.department_id = v_department_id
      and organization.effective_from <= current_date
      and (organization.effective_to is null or organization.effective_to >= current_date)
  ) then
    raise exception 'RICH_YARA_PLACEMENT_NOT_UPDATED';
  end if;

  if not exists (
    select 1
    from public.department_management assignment
    where assignment.employee_id = v_yara_id
      and assignment.administration_id = v_administration_id
      and assignment.department_id = v_department_id
      and assignment.management_role_id = v_direct_manager_role_id
      and assignment.effective_from <= current_date
      and (assignment.effective_to is null or assignment.effective_to >= current_date)
  ) then
    raise exception 'RICH_YARA_ASSIGNMENT_NOT_UPDATED';
  end if;
end;
$$;
