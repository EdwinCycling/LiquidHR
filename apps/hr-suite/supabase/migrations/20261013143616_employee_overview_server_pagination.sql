-- Match the existing Intl.Collator('nl', { sensitivity: 'base' }) ordering before paging.
create collation internal_security.liquidhr_employee_name_nl_base (
  provider = icu,
  locale = 'nl-u-ks-level1',
  deterministic = false
);
-- Paged employee overview read model. The legacy list_employee_overviews RPC remains unchanged.
-- This SECURITY DEFINER function repeats the legacy HR-group authorization boundary because it
-- aggregates employment state and the scoped overview in one set-based query before pagination.
create or replace function public.list_employee_overviews_page(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_archive_filter text,
  requested_status_filter text,
  requested_search text,
  requested_sort text,
  requested_scope text,
  requested_page integer
)
returns table(
  total_count bigint,
  employees jsonb,
  directory_visibility jsonb,
  directory_access boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, internal_security, auth
as $function$
declare
  v_actor_employee_id uuid;
  v_as_of date;
  v_has_employee_read boolean := false;
  v_is_manager boolean := false;
  v_is_tenant_admin boolean := false;
  v_limited_manager boolean := false;
  v_directory_only boolean := false;
  v_directory_access boolean := true;
  v_directory_visibility jsonb;
  v_show_job_department boolean := true;
  v_show_work_email boolean := true;
  v_archive_filter text;
  v_status_filter text;
  v_search text;
  v_active_administration_count bigint := 0;
begin
  v_as_of := (statement_timestamp() at time zone 'UTC')::date;

  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if requested_tenant_id is null
     or requested_hr_group_id is null
     or requested_administration_id is null
     or v_as_of is null
     or requested_page is null
     or requested_page < 1
     or requested_page > 1000000
     or requested_archive_filter is null
     or requested_status_filter is null
     or requested_sort is null
     or requested_scope is null
     or requested_archive_filter not in ('active', 'archived', 'all')
     or requested_status_filter not in ('all', 'ACTIVE_FUTURE_EXTERNAL', 'ACTIVE_EMPLOYEE', 'FUTURE_EMPLOYEE', 'FORMER_EMPLOYEE', 'NEVER_EMPLOYED')
     or requested_sort not in ('first-name', 'last-name')
     or requested_scope not in ('all', 'team') then
    raise exception 'invalid employee overview page request' using errcode = '22023';
  end if;

  if not (
    internal_security.current_user_has_hr_group_permission(
      requested_tenant_id, requested_hr_group_id, 'employee:read'
    )
    or internal_security.current_user_has_hr_group_permission(
      requested_tenant_id, requested_hr_group_id, 'employee-directory:read'
    )
  ) then
    raise exception 'insufficient employee directory permission' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.administrations administration
    where administration.id = requested_administration_id
      and administration.tenant_id = requested_tenant_id
      and administration.hr_group_id = requested_hr_group_id
  ) or not internal_security.has_administration_access(
    requested_tenant_id, requested_administration_id
  ) then
    raise exception 'administration outside current access scope' using errcode = '42501';
  end if;

  if not (
    internal_security.current_user_has_permission(
      requested_tenant_id, requested_administration_id, 'employee:read'
    )
    or internal_security.current_user_has_permission(
      requested_tenant_id, requested_administration_id, 'employee-directory:read'
    )
  ) then
    raise exception 'insufficient administration employee permission' using errcode = '42501';
  end if;

  select employee.id
    into v_actor_employee_id
  from public.employees employee
  where employee.auth_user_id = auth.uid()
    and employee.tenant_id = requested_tenant_id
    and employee.hr_group_id = requested_hr_group_id
    and employee.deleted_at is null
  order by employee.id
  limit 1;

  with assigned_roles as (
    select access.management_role_id
    from public.user_hr_group_access access
    where access.user_id = auth.uid()
      and access.tenant_id = requested_tenant_id
      and access.hr_group_id = requested_hr_group_id
      and access.is_active

    union

    select assignment.management_role_id
    from public.department_management assignment
    where assignment.employee_id = v_actor_employee_id
      and assignment.tenant_id = requested_tenant_id
      and assignment.hr_group_id = requested_hr_group_id
      and assignment.effective_from <= v_as_of
      and (assignment.effective_to is null or assignment.effective_to >= v_as_of)
  )
  select
    coalesce(bool_or(role.code = 'DIRECT_MANAGER'), false),
    coalesce(bool_or(role.code = 'TENANT_ADMIN'), false)
    into v_is_manager, v_is_tenant_admin
  from assigned_roles assigned
  join public.management_roles role on role.id = assigned.management_role_id
  where role.tenant_id is null or role.tenant_id = requested_tenant_id;

  if requested_scope = 'team' and not v_is_manager then
    raise exception 'team scope is not available to this user' using errcode = '42501';
  end if;

  with assigned_roles as (
    select access.management_role_id
    from public.user_hr_group_access access
    where access.user_id = auth.uid()
      and access.tenant_id = requested_tenant_id
      and access.hr_group_id = requested_hr_group_id
      and access.is_active

    union

    select assignment.management_role_id
    from public.department_management assignment
    where assignment.employee_id = v_actor_employee_id
      and assignment.tenant_id = requested_tenant_id
      and assignment.hr_group_id = requested_hr_group_id
      and assignment.effective_from <= v_as_of
      and (assignment.effective_to is null or assignment.effective_to >= v_as_of)
  ),
  effective_roles as (
    select coalesce(tenant_override.id, role.id) as management_role_id
    from assigned_roles assigned
    join public.management_roles role on role.id = assigned.management_role_id
    left join lateral (
      select override_role.id
      from public.management_roles override_role
      where role.tenant_id is null
        and override_role.tenant_id = requested_tenant_id
        and override_role.code = role.code
        and override_role.is_active
      order by override_role.id
      limit 1
    ) tenant_override on true
    where role.tenant_id is null or role.tenant_id = requested_tenant_id
  )
  select
    coalesce(
      internal_security.current_user_has_hr_group_permission(
        requested_tenant_id, requested_hr_group_id, 'employee:read'
      )
      or internal_security.current_user_has_permission(
        requested_tenant_id, requested_administration_id, 'employee:read'
      )
      or exists (
        select 1
        from effective_roles effective
        join public.role_permissions role_permission
          on role_permission.management_role_id = effective.management_role_id
        join public.permissions permission
          on permission.id = role_permission.permission_id
        where permission.code = 'employee:read'
      ),
      false
    )
    into v_has_employee_read;

  v_directory_only := not v_has_employee_read;
  v_limited_manager := v_is_manager and not v_is_tenant_admin;

  v_directory_visibility := public.get_employee_directory_visibility(
    requested_tenant_id, requested_administration_id
  );
  v_show_job_department := coalesce(
    (v_directory_visibility ->> 'showJobDepartment')::boolean,
    true
  );
  v_show_work_email := coalesce(
    (v_directory_visibility ->> 'showWorkEmail')::boolean,
    true
  );

  if v_directory_only then
    v_directory_access := public.get_employee_directory_access(
      requested_tenant_id, requested_administration_id
    );
    if not v_directory_access then
      return query
        select 0::bigint, '[]'::jsonb, v_directory_visibility, false;
      return;
    end if;
  end if;

  v_archive_filter := case when v_directory_only then 'active' else requested_archive_filter end;
  v_status_filter := case when v_directory_only then 'ACTIVE_EMPLOYEE' else requested_status_filter end;
  v_search := lower(btrim(coalesce(requested_search, '')) collate "nl-NL-x-icu");

  if v_has_employee_read then
    select count(*)
      into v_active_administration_count
    from public.administrations administration
    where administration.tenant_id = requested_tenant_id
      and administration.hr_group_id = requested_hr_group_id
      and administration.is_active;
  end if;

  return query
  with direct_team as materialized (
    select distinct organization.employee_id
    from public.employee_organizations organization
    where organization.tenant_id = requested_tenant_id
      and organization.hr_group_id = requested_hr_group_id
      and organization.administration_id = requested_administration_id
      and organization.direct_manager_id = v_actor_employee_id
      and organization.employee_id <> v_actor_employee_id
      and organization.effective_from <= v_as_of
      and (organization.effective_to is null or organization.effective_to >= v_as_of)
  ),
  employment_state as materialized (
    select
      employment.employee_id,
      bool_or(
        employment.record_status <> 'CANCELLED'
        and employment.starts_on <= v_as_of
        and (employment.ends_on is null or employment.ends_on >= v_as_of)
      ) as has_active_employment,
      bool_or(
        employment.record_status <> 'CANCELLED'
        and employment.starts_on > v_as_of
      ) as has_future_employment,
      bool_or(employment.record_status <> 'CANCELLED') as has_non_cancelled_employment
    from public.employments employment
    where employment.tenant_id = requested_tenant_id
      and employment.hr_group_id = requested_hr_group_id
      and employment.deleted_at is null
    group by employment.employee_id
  ),
  base_employees as materialized (
    select
      employee.id,
      case
        when not v_directory_only
         and (not v_limited_manager or employee.id = v_actor_employee_id or team.employee_id is not null)
          then employee.employee_number
        else null
      end as employee_number,
      employee.first_name,
      employee.birth_name_prefix,
      employee.birth_name,
      case when v_show_work_email then employee.work_email else null end as work_email,
      employee.avatar_url,
      employee.is_archived,
      coalesce(state.has_active_employment, false) as has_active_employment,
      coalesce(state.has_future_employment, false) as has_future_employment,
      coalesce(state.has_non_cancelled_employment, false) as has_non_cancelled_employment,
      case when v_show_job_department then placement.department_name else null end as department_name,
      case when v_show_job_department then placement.job_title else null end as job_title,
      (team.employee_id is not null) as is_direct_team_member
    from public.employees employee
    left join employment_state state on state.employee_id = employee.id
    left join direct_team team on team.employee_id = employee.id
    left join lateral (
      select department.name as department_name, organization.job_title
      from public.employee_organizations organization
      left join public.departments department
        on department.tenant_id = organization.tenant_id
       and department.hr_group_id = organization.hr_group_id
       and department.id = organization.department_id
      where organization.tenant_id = requested_tenant_id
        and organization.hr_group_id = requested_hr_group_id
        and organization.employee_id = employee.id
        and organization.effective_from <= v_as_of
        and (organization.effective_to is null or organization.effective_to >= v_as_of)
      order by organization.effective_from desc, organization.id
      limit 1
    ) placement on true
    where employee.tenant_id = requested_tenant_id
      and employee.hr_group_id = requested_hr_group_id
      and employee.deleted_at is null
      and (
        internal_security.current_user_has_hr_group_permission(
          requested_tenant_id, requested_hr_group_id, 'employee:read'
        )
        or internal_security.current_user_has_hr_group_permission(
          requested_tenant_id, requested_hr_group_id, 'employee-directory:read'
        )
        or internal_security.can_manage_employee(employee.id, 'employee:read')
      )
      and (
        v_archive_filter = 'all'
        or (v_archive_filter = 'archived' and employee.is_archived)
        or (v_archive_filter = 'active' and not employee.is_archived)
      )
      and (requested_scope = 'all' or team.employee_id is not null)
  ),
  classified_employees as materialized (
    select
      base.*,
      case
        when base.has_active_employment then 'ACTIVE_EMPLOYEE'
        when base.has_future_employment then 'FUTURE_EMPLOYEE'
        when base.has_non_cancelled_employment then 'FORMER_EMPLOYEE'
        else 'NEVER_EMPLOYED'
      end as employment_status
    from base_employees base
  ),
  filtered_employees as materialized (
    select filtered.*
    from classified_employees filtered
    where (
      v_status_filter = 'all'
      or (
        v_status_filter = 'ACTIVE_FUTURE_EXTERNAL'
        and filtered.employment_status in ('ACTIVE_EMPLOYEE', 'FUTURE_EMPLOYEE', 'NEVER_EMPLOYED')
      )
      or filtered.employment_status = v_status_filter
    )
      and (
        v_search = ''
        or position(
          v_search in lower(
            coalesce(filtered.first_name, '') || ' '
            || coalesce(filtered.birth_name_prefix, '') || ' '
            || coalesce(filtered.birth_name, '') || ' '
            || coalesce(filtered.employee_number, '') || ' '
            || coalesce(filtered.department_name, '') || ' '
            || coalesce(filtered.job_title, '') || ' '
            || coalesce(filtered.work_email, '')
            collate "nl-NL-x-icu"
          )
        ) > 0
      )
  ),
  page_rows as materialized (
    select filtered.*
    from filtered_employees filtered
    order by
      case when requested_sort = 'first-name' then filtered.first_name end collate internal_security.liquidhr_employee_name_nl_base,
      case when requested_sort = 'first-name' then filtered.birth_name end collate internal_security.liquidhr_employee_name_nl_base,
      case when requested_sort = 'last-name' then filtered.birth_name end collate internal_security.liquidhr_employee_name_nl_base,
      case when requested_sort = 'last-name' then filtered.first_name end collate internal_security.liquidhr_employee_name_nl_base,
      filtered.id
    limit 50
    offset ((requested_page::bigint - 1) * 50)
  ),
  page_payload as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', page.id,
          'employee_number', page.employee_number,
          'first_name', page.first_name,
          'birth_name_prefix', page.birth_name_prefix,
          'birth_name', page.birth_name,
          'work_email', page.work_email,
          'avatar_url', page.avatar_url,
          'is_archived', page.is_archived,
          'department_name', page.department_name,
          'job_title', page.job_title,
          'status', page.employment_status,
          'employment_count', coalesce(summary.employment_count, 0),
          'employment_type', case when v_has_employee_read then summary.employment_type else null end,
          'administration_names', case when v_has_employee_read then coalesce(summary.administration_names, '[]'::jsonb) else '[]'::jsonb end,
          'hr_group_administration_count', case when v_has_employee_read then v_active_administration_count else 0 end,
          'limited_detail', v_limited_manager
            and page.id <> v_actor_employee_id
            and not page.is_direct_team_member
        )
        order by
          case when requested_sort = 'first-name' then page.first_name end collate internal_security.liquidhr_employee_name_nl_base,
          case when requested_sort = 'first-name' then page.birth_name end collate internal_security.liquidhr_employee_name_nl_base,
          case when requested_sort = 'last-name' then page.birth_name end collate internal_security.liquidhr_employee_name_nl_base,
          case when requested_sort = 'last-name' then page.first_name end collate internal_security.liquidhr_employee_name_nl_base,
          page.id
      ),
      '[]'::jsonb
    ) as items
    from page_rows page
    left join lateral (
      select
        count(*) as employment_count,
        (
          select employment.employment_type
          from public.employments employment
          where employment.tenant_id = requested_tenant_id
            and employment.hr_group_id = requested_hr_group_id
            and employment.employee_id = page.id
            and employment.deleted_at is null
            and employment.record_status <> 'CANCELLED'
            and employment.employment_type is not null
          order by
            case
              when employment.starts_on <= v_as_of
                and (employment.ends_on is null or employment.ends_on >= v_as_of) then 0
              when employment.starts_on > v_as_of then 1
              else 2
            end,
            employment.starts_on desc,
            employment.id
          limit 1
        ) as employment_type,
        (
          select coalesce(jsonb_agg(names.name order by names.name), '[]'::jsonb)
          from (
            select distinct administration.name
            from public.employments employment
            join public.administrations administration
              on administration.tenant_id = employment.tenant_id
             and administration.hr_group_id = employment.hr_group_id
             and administration.id = employment.administration_id
             and administration.is_active
            where employment.tenant_id = requested_tenant_id
              and employment.hr_group_id = requested_hr_group_id
              and employment.employee_id = page.id
              and employment.deleted_at is null
              and employment.record_status <> 'CANCELLED'
          ) names
        ) as administration_names
      from public.employments employment
      where employment.tenant_id = requested_tenant_id
        and employment.hr_group_id = requested_hr_group_id
        and employment.employee_id = page.id
        and employment.deleted_at is null
    ) summary on true
  )
  select
    (select count(*) from filtered_employees),
    page_payload.items,
    v_directory_visibility,
    v_directory_access
  from page_payload;
end;
$function$;

revoke all on function public.list_employee_overviews_page(uuid, uuid, uuid, text, text, text, text, text, integer)
  from public, anon, service_role;
grant execute on function public.list_employee_overviews_page(uuid, uuid, uuid, text, text, text, text, text, integer)
  to authenticated;