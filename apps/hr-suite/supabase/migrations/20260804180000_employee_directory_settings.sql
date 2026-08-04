alter table public.administration_hr_settings
  add column if not exists employee_directory_enabled boolean not null default true,
  add column if not exists employee_directory_show_name boolean not null default true,
  add column if not exists employee_directory_show_job_department boolean not null default true,
  add column if not exists employee_directory_show_work_email boolean not null default true,
  add column if not exists employee_directory_show_work_phone boolean not null default true,
  add column if not exists employee_directory_show_presence boolean not null default true,
  add column if not exists employee_directory_show_schedule boolean not null default true;

create or replace function public.list_employee_overviews(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_as_of date default current_date,
  requested_archive_filter text default 'active'
)
returns table (
  id uuid,
  employee_number text,
  first_name text,
  birth_name_prefix text,
  birth_name text,
  work_email text,
  avatar_url text,
  is_archived boolean,
  employment_history jsonb,
  department_name text,
  job_title text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (
    internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, 'employee:read')
    or internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, 'employee-directory:read')
  ) then
    raise exception 'insufficient employee directory permission' using errcode = '42501';
  end if;

  return query
  with scoped_employees as (
    select distinct on (assignment.employee_id)
      assignment.employee_id
    from public.employee_administration_assignments assignment
    where assignment.tenant_id = requested_tenant_id
      and assignment.administration_id = requested_administration_id
      and assignment.effective_from <= requested_as_of
      and (assignment.effective_to is null or assignment.effective_to >= requested_as_of)
      and (
        internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, 'employee-directory:read')
        or internal_security.can_manage_employee(assignment.employee_id, 'employee:read')
      )
    order by assignment.employee_id, assignment.effective_from desc
  )
  select
    employee.id,
    employee.employee_number,
    employee.first_name,
    employee.birth_name_prefix,
    employee.birth_name,
    employee.work_email,
    employee.avatar_url,
    employee.is_archived,
    coalesce(employment_history.periods, '[]'::jsonb) as employment_history,
    placement.department_name,
    placement.job_title
  from scoped_employees scoped
  join public.employees employee
    on employee.tenant_id = requested_tenant_id
   and employee.id = scoped.employee_id
   and employee.deleted_at is null
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'starts_on', employment.starts_on,
        'ends_on', employment.ends_on,
        'record_status', employment.record_status
      )
      order by employment.starts_on
    ) as periods
    from public.employments employment
    where employment.tenant_id = requested_tenant_id
      and employment.employee_id = employee.id
      and employment.deleted_at is null
  ) employment_history on true
  left join lateral (
    select
      department.name as department_name,
      organization.job_title
    from public.employee_organizations organization
    left join public.departments department
      on department.tenant_id = organization.tenant_id
     and department.id = organization.department_id
    where organization.tenant_id = requested_tenant_id
      and organization.administration_id = requested_administration_id
      and organization.employee_id = employee.id
      and organization.effective_from <= requested_as_of
      and (organization.effective_to is null or organization.effective_to >= requested_as_of)
    order by organization.effective_from desc
    limit 1
  ) placement on true
  where requested_archive_filter = 'all'
     or (requested_archive_filter = 'archived' and employee.is_archived)
     or (requested_archive_filter = 'active' and not employee.is_archived)
  order by employee.birth_name, employee.first_name
  limit 500;
end;
$$;

create or replace function public.get_employee_directory_detail(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_employee_id uuid,
  requested_week_start date default (current_date - (extract(isodow from current_date)::integer - 1))
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  settings_row record;
  employee_row record;
  employment_row record;
  placement_row record;
  pattern_row record;
  result jsonb;
  week_end date := requested_week_start + 6;
begin
  if not internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, 'employee-directory:read') then
    raise exception 'insufficient employee directory permission' using errcode = '42501';
  end if;

  select
    settings.employee_directory_enabled,
    settings.employee_directory_show_name,
    settings.employee_directory_show_job_department,
    settings.employee_directory_show_work_email,
    settings.employee_directory_show_work_phone,
    settings.employee_directory_show_presence,
    settings.employee_directory_show_schedule
  into settings_row
  from public.administration_hr_settings settings
  where settings.tenant_id = requested_tenant_id
    and settings.administration_id = requested_administration_id;

  if settings_row.employee_directory_enabled is distinct from true then
    raise exception 'employee directory disabled' using errcode = '42501';
  end if;

  select employee.id, employee.first_name, employee.birth_name_prefix, employee.birth_name,
    employee.work_email, employee.work_phone, employee.work_mobile, employee.avatar_url
  into employee_row
  from public.employees employee
  where employee.tenant_id = requested_tenant_id
    and employee.id = requested_employee_id
    and employee.deleted_at is null;
  if employee_row.id is null then raise exception 'employee not found' using errcode = 'P0002'; end if;

  select employment.id
  into employment_row
  from public.employments employment
  where employment.tenant_id = requested_tenant_id
    and employment.administration_id = requested_administration_id
    and employment.employee_id = requested_employee_id
    and employment.record_status = 'CONFIRMED'
    and employment.deleted_at is null
    and employment.starts_on <= week_end
    and (employment.ends_on is null or employment.ends_on >= requested_week_start)
  order by employment.is_primary desc, employment.starts_on desc
  limit 1;

  select organization.job_title, department.name as department_name
  into placement_row
  from public.employee_organizations organization
  left join public.departments department
    on department.tenant_id = organization.tenant_id
   and department.id = organization.department_id
  where organization.tenant_id = requested_tenant_id
    and organization.administration_id = requested_administration_id
    and organization.employee_id = requested_employee_id
    and organization.effective_from <= current_date
    and (organization.effective_to is null or organization.effective_to >= current_date)
  order by organization.effective_from desc
  limit 1;

  if employment_row.id is not null then
    select pattern.*
    into pattern_row
    from public.employment_work_patterns pattern
    where pattern.tenant_id = requested_tenant_id
      and pattern.administration_id = requested_administration_id
      and pattern.employee_id = requested_employee_id
      and pattern.employment_id = employment_row.id
      and pattern.valid_from <= week_end
      and (pattern.valid_until is null or pattern.valid_until >= requested_week_start)
    order by pattern.valid_from desc
    limit 1;
  end if;

  result := jsonb_build_object(
    'employeeId', employee_row.id,
    'name', concat_ws(' ', employee_row.first_name, employee_row.birth_name_prefix, employee_row.birth_name),
    'avatarUrl', employee_row.avatar_url,
    'jobTitle', placement_row.job_title,
    'departmentName', placement_row.department_name,
    'workEmail', employee_row.work_email,
    'workPhone', coalesce(employee_row.work_phone, employee_row.work_mobile),
    'schedule', case when settings_row.employee_directory_show_schedule then case
      when pattern_row.id is not null then coalesce((
        select jsonb_agg(jsonb_build_object(
          'weekIndex', day.week_index, 'isoWeekday', day.iso_weekday,
          'isWorkingDay', day.is_working_day, 'startsAt', day.starts_at,
          'endsAt', day.ends_at, 'scheduledMinutes', day.scheduled_minutes
        ) order by day.week_index, day.iso_weekday)
        from public.employment_work_pattern_days day
        where day.tenant_id = requested_tenant_id and day.administration_id = requested_administration_id and day.work_pattern_id = pattern_row.id
      ), '[]'::jsonb)
      else coalesce((
        select jsonb_agg(jsonb_build_object(
          'weekIndex', 1, 'isoWeekday', weekly.iso_weekday,
          'isWorkingDay', coalesce(weekly.hours, 0) > 0, 'startsAt', null,
          'endsAt', null, 'scheduledMinutes', round(coalesce(weekly.hours, 0) * 60)::integer
        ) order by weekly.iso_weekday)
        from (
          select schedule.*
          from public.employment_schedules schedule
          where schedule.tenant_id = requested_tenant_id and schedule.administration_id = requested_administration_id
            and schedule.employee_id = requested_employee_id and schedule.employment_id = employment_row.id
            and schedule.valid_from <= week_end and (schedule.valid_until is null or schedule.valid_until >= requested_week_start)
          order by schedule.valid_from desc
          limit 1
        ) schedule
        cross join lateral (values
          (1, schedule.monday_hours), (2, schedule.tuesday_hours), (3, schedule.wednesday_hours),
          (4, schedule.thursday_hours), (5, schedule.friday_hours), (6, schedule.saturday_hours),
          (7, schedule.sunday_hours)
        ) weekly(iso_weekday, hours)
      ), '[]'::jsonb)
    end else '[]'::jsonb end,
    'presence', case when settings_row.employee_directory_show_presence then coalesce((
      select jsonb_agg(day_summary order by day_date)
      from (
        select day_date,
          jsonb_build_object(
            'date', day_date::date,
            'status', case
              when exists (
                select 1 from public.absence_cases absence
                where absence.tenant_id = requested_tenant_id and absence.administration_id = requested_administration_id
                  and absence.employee_id = requested_employee_id and absence.status = 'ACTIVE'
                  and absence.archived_at is null and absence.first_absence_on <= day_date
              ) then 'ABSENT'
              when exists (
                select 1 from public.leave_requests leave_request
                where leave_request.tenant_id = requested_tenant_id and leave_request.administration_id = requested_administration_id
                  and leave_request.employee_id = requested_employee_id and leave_request.status = 'APPROVED'
                  and leave_request.start_date <= day_date and leave_request.end_date >= day_date
              ) then 'OFF'
              when exists (
                select 1 from public.holidays holiday
                join public.holiday_calendars calendar on calendar.id = holiday.holiday_calendar_id
                where holiday.tenant_id = requested_tenant_id and holiday.administration_id = requested_administration_id
                  and calendar.tenant_id = requested_tenant_id and calendar.administration_id = requested_administration_id
                  and holiday.holiday_date = day_date and holiday.is_active
              ) then 'OFF'
              when pattern_row.id is not null and exists (
                select 1 from public.employment_work_pattern_days pattern_day
                where pattern_day.tenant_id = requested_tenant_id and pattern_day.administration_id = requested_administration_id
                  and pattern_day.work_pattern_id = pattern_row.id
                  and pattern_day.iso_weekday = extract(isodow from day_date)::smallint
                  and pattern_day.week_index = ((floor((day_date::date - pattern_row.anchor_date)::numeric / 7)::integer % pattern_row.cycle_weeks) + 1)
                  and pattern_day.is_working_day
              ) then 'WORKING'
              when pattern_row.id is null and exists (
                select 1
                from public.employment_schedules schedule
                cross join lateral (values
                  (1, schedule.monday_hours), (2, schedule.tuesday_hours), (3, schedule.wednesday_hours),
                  (4, schedule.thursday_hours), (5, schedule.friday_hours), (6, schedule.saturday_hours),
                  (7, schedule.sunday_hours)
                ) weekly(iso_weekday, hours)
                where schedule.tenant_id = requested_tenant_id and schedule.administration_id = requested_administration_id
                  and schedule.employee_id = requested_employee_id and schedule.employment_id = employment_row.id
                  and schedule.valid_from <= day_date and (schedule.valid_until is null or schedule.valid_until >= day_date)
                  and weekly.iso_weekday = extract(isodow from day_date)::smallint and coalesce(weekly.hours, 0) > 0
              ) then 'WORKING'
              else 'OFF'
            end
          ) as day_summary
        from generate_series(requested_week_start, week_end, interval '1 day') generated(day_date)
      ) days
    ), '[]'::jsonb) else '[]'::jsonb end
  );

  if settings_row.employee_directory_show_name is not true then result := result - 'name'; end if;
  if settings_row.employee_directory_show_job_department is not true then result := result - 'jobTitle' - 'departmentName'; end if;
  if settings_row.employee_directory_show_work_email is not true then result := result - 'workEmail'; end if;
  if settings_row.employee_directory_show_work_phone is not true then result := result - 'workPhone'; end if;
  if settings_row.employee_directory_show_presence is not true then result := result - 'presence'; end if;
  if settings_row.employee_directory_show_schedule is not true then result := result - 'schedule'; end if;
  return result;
end;
$$;

revoke all on function public.get_employee_directory_detail(uuid, uuid, uuid, date) from public, anon;
grant execute on function public.get_employee_directory_detail(uuid, uuid, uuid, date) to authenticated;
