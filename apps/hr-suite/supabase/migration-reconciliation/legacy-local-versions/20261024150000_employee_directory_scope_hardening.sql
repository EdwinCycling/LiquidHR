-- Keep Employee-directory reads inside the actor's active HR group and administration.
-- This narrows existing safe projections; it does not change role grants or table RLS.
do $migration$
declare
  detail_definition text;
  overview_definition text;
  detail_employee_anchor constant text := $anchor$
  where employee.tenant_id = requested_tenant_id
    and employee.id = requested_employee_id
    and employee.deleted_at is null;$anchor$;
  detail_employment_anchor constant text := $anchor$
  order by employment.is_primary desc, employment.starts_on desc
  limit 1;

  select organization.job_title, department.name as department_name$anchor$;
  detail_employee_replacement constant text := $replacement$
  where employee.tenant_id = requested_tenant_id
    and employee.id = requested_employee_id
    and employee.hr_group_id = (
      select administration.hr_group_id
      from public.administrations administration
      where administration.tenant_id = requested_tenant_id
        and administration.id = requested_administration_id
        and administration.is_active
    )
    and employee.deleted_at is null;$replacement$;
  overview_employee_anchor constant text := $anchor$
      and employee.deleted_at is null
      and ($anchor$;
  overview_employee_replacement constant text := $replacement$
      and employee.deleted_at is null
      and (
        not v_directory_only
        or exists (
          select 1
          from public.employments directory_employment
          where directory_employment.tenant_id = requested_tenant_id
            and directory_employment.hr_group_id = requested_hr_group_id
            and directory_employment.administration_id = requested_administration_id
            and directory_employment.employee_id = employee.id
            and directory_employment.record_status = 'CONFIRMED'
            and directory_employment.deleted_at is null
            and directory_employment.starts_on <= v_as_of
            and (directory_employment.ends_on is null or directory_employment.ends_on >= v_as_of)
        )
      )
      and ($replacement$;
  overview_placement_anchor constant text := $anchor$
        and organization.employee_id = employee.id
        and organization.effective_from <= v_as_of$anchor$;
  overview_placement_replacement constant text := $replacement$
        and organization.employee_id = employee.id
        and (not v_directory_only or organization.administration_id = requested_administration_id)
        and organization.effective_from <= v_as_of$replacement$;
begin
  select pg_catalog.pg_get_functiondef(
    'public.get_employee_directory_detail(uuid,uuid,uuid,date)'::regprocedure
  ) into detail_definition;

  if pg_catalog.strpos(detail_definition, 'employee.hr_group_id = (') = 0 then
    if (length(detail_definition) - length(pg_catalog.replace(detail_definition, detail_employee_anchor, '')))
       / length(detail_employee_anchor) <> 1 then
      raise exception 'employee directory detail scope anchor is missing or ambiguous';
    end if;
    detail_definition := pg_catalog.replace(
      detail_definition,
      detail_employee_anchor,
      detail_employee_replacement
    );
  end if;

  if pg_catalog.strpos(detail_definition, 'if employment_row.id is null then') = 0 then
    if (length(detail_definition) - length(pg_catalog.replace(detail_definition, detail_employment_anchor, '')))
       / length(detail_employment_anchor) <> 1 then
      raise exception 'employee directory employment scope anchor is missing or ambiguous';
    end if;
    detail_definition := pg_catalog.replace(
      detail_definition,
      detail_employment_anchor,
      $replacement$
  order by employment.is_primary desc, employment.starts_on desc
  limit 1;
  if employment_row.id is null then
    raise exception 'employee not found' using errcode = 'P0002';
  end if;

  select organization.job_title, department.name as department_name$replacement$
    );
  end if;

  execute detail_definition;

  select pg_catalog.pg_get_functiondef(
    'public.list_employee_overviews_page(uuid,uuid,uuid,text,text,text,text,text,integer)'::regprocedure
  ) into overview_definition;

  if pg_catalog.strpos(overview_definition, 'directory_employment.administration_id = requested_administration_id') = 0 then
    if (length(overview_definition) - length(pg_catalog.replace(overview_definition, overview_employee_anchor, '')))
       / length(overview_employee_anchor) <> 1 then
      raise exception 'employee overview directory scope anchor is missing or ambiguous';
    end if;
    overview_definition := pg_catalog.replace(
      overview_definition,
      overview_employee_anchor,
      overview_employee_replacement
    );
  end if;

  if pg_catalog.strpos(overview_definition, 'not v_directory_only or organization.administration_id = requested_administration_id') = 0 then
    if (length(overview_definition) - length(pg_catalog.replace(overview_definition, overview_placement_anchor, '')))
       / length(overview_placement_anchor) <> 1 then
      raise exception 'employee overview placement scope anchor is missing or ambiguous';
    end if;
    overview_definition := pg_catalog.replace(
      overview_definition,
      overview_placement_anchor,
      overview_placement_replacement
    );
  end if;

  execute overview_definition;
end;
$migration$;
