begin;

-- Employee Focus uses the existing Actual Work service and RPC. The
-- permission is deliberately separate from leave:write so Employee cannot
-- inherit HR configuration rights through the self-service path.
insert into public.permissions (code, name, category, description)
values (
  'self:actual-work:write',
  'Eigen Actual Work registreren',
  'Uren',
  'Een medewerker mag eigen Actual Work-uren registreren en corrigeren.'
)
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission on permission.code = 'self:actual-work:write'
where role.code = 'EMPLOYEE'
  and role.tenant_id is null
on conflict do nothing;

-- Employees need the same group-scoped catalog and period metadata that the
-- canonical projection already reads. Their own entry and revision rows stay
-- limited by the employee identity in the RLS predicates below.
drop policy if exists work_hour_types_group_read on public.work_hour_types;
create policy work_hour_types_group_read
on public.work_hour_types for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'self:leave:read'))
);

drop policy if exists actual_work_type_limits_read on public.actual_work_type_limits;
create policy actual_work_type_limits_read
on public.actual_work_type_limits for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'self:leave:read'))
);

drop policy if exists actual_work_periods_read on public.actual_work_periods;
create policy actual_work_periods_read
on public.actual_work_periods for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'self:leave:read'))
);

drop policy if exists actual_work_revisions_read on public.actual_work_revisions;
create policy actual_work_revisions_read
on public.actual_work_revisions for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:read'))
  or (
    employee_id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
    and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'self:leave:read'))
  )
);

drop policy if exists actual_work_revisions_insert on public.actual_work_revisions;
create policy actual_work_revisions_insert
on public.actual_work_revisions for insert to authenticated
with check (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:write'))
  or (
    employee_id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
    and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'self:actual-work:write'))
  )
);

drop policy if exists employment_work_hour_entries_group_read on public.employment_work_hour_entries;
create policy employment_work_hour_entries_group_read
on public.employment_work_hour_entries for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:read'))
  or (
    employee_id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
    and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'self:leave:read'))
  )
);

drop policy if exists employment_work_hour_entries_group_insert on public.employment_work_hour_entries;
create policy employment_work_hour_entries_group_insert
on public.employment_work_hour_entries for insert to authenticated
with check (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:write'))
  or (
    employee_id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
    and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'self:actual-work:write'))
  )
);

drop policy if exists employment_work_hour_entries_group_update on public.employment_work_hour_entries;
create policy employment_work_hour_entries_group_update
on public.employment_work_hour_entries for update to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:write'))
  or (
    employee_id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
    and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'self:actual-work:write'))
  )
)
with check (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:write'))
  or (
    employee_id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
    and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'self:actual-work:write'))
  )
);

create or replace function public.save_actual_work_entry(
  requested_entry_id uuid,
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_work_hour_type_id uuid,
  requested_entry_granularity public.actual_work_entry_granularity,
  requested_subject_period_start date,
  requested_subject_period_end date,
  requested_posting_period_start date,
  requested_hours numeric,
  requested_status public.leave_work_hour_entry_status,
  requested_note text,
  requested_operation public.actual_work_revision_operation,
  requested_reason text default null
)
returns public.employment_work_hour_entries
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  hr_writer boolean := internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'leave:write');
  self_writer boolean := internal_security.current_employee_has_permission(requested_tenant_id, requested_hr_group_id, 'self:actual-work:write')
    and internal_security.current_employee_id(requested_tenant_id, requested_hr_group_id) = requested_employee_id;
  type_row public.work_hour_types%rowtype;
  employment_row public.employments%rowtype;
  old_entry public.employment_work_hour_entries%rowtype;
  saved_entry public.employment_work_hour_entries%rowtype;
  period_status public.actual_work_period_status;
  limit_row record;
  range_start date;
  range_end date;
  existing_hours numeric;
  target_id uuid := coalesce(requested_entry_id, gen_random_uuid());
  next_revision integer;
begin
  if actor_id is null or not (hr_writer or self_writer) then
    raise exception using errcode = '42501', message = 'ACTUAL_WORK_NOT_AUTHORIZED';
  end if;
  if self_writer and requested_status <> 'APPROVED' then
    raise exception using errcode = '42501', message = 'ACTUAL_WORK_NOT_AUTHORIZED';
  end if;
  if requested_hours is null or requested_hours <= 0 or requested_hours <> round(requested_hours, 4) then
    raise exception using errcode = '22003', message = 'ACTUAL_WORK_HOURS_PRECISION_INVALID';
  end if;
  if requested_subject_period_start is null or requested_subject_period_end is null or requested_subject_period_end <= requested_subject_period_start then
    raise exception using errcode = '22007', message = 'ACTUAL_WORK_PERIOD_INVALID';
  end if;
  if requested_entry_granularity = 'DAY' and requested_subject_period_end <> requested_subject_period_start + 1 then
    raise exception using errcode = '22007', message = 'ACTUAL_WORK_DAY_RANGE_INVALID';
  end if;
  if requested_posting_period_start <> date_trunc('month', requested_posting_period_start)::date then
    raise exception using errcode = '22007', message = 'ACTUAL_WORK_POSTING_PERIOD_INVALID';
  end if;
  if requested_operation = 'CORRECTION' and length(btrim(coalesce(requested_reason, ''))) = 0 then
    raise exception using errcode = '22023', message = 'ACTUAL_WORK_CORRECTION_REASON_REQUIRED';
  end if;

  select * into employment_row
  from public.employments
  where tenant_id = requested_tenant_id and hr_group_id = requested_hr_group_id
    and administration_id = requested_administration_id and employee_id = requested_employee_id
    and id = requested_employment_id and record_status = 'CONFIRMED' and deleted_at is null
    and starts_on < requested_subject_period_end
    and (ends_on is null or ends_on >= requested_subject_period_start)
  limit 1;
  if not found then raise exception using errcode = '23503', message = 'ACTUAL_WORK_EMPLOYMENT_NOT_FOUND'; end if;

  select * into type_row
  from public.work_hour_types
  where tenant_id = requested_tenant_id and hr_group_id = requested_hr_group_id and id = requested_work_hour_type_id
    and is_active and valid_from <= requested_subject_period_start
    and (valid_until is null or valid_until > requested_subject_period_start);
  if not found then raise exception using errcode = '23503', message = 'ACTUAL_WORK_TYPE_NOT_ACTIVE'; end if;
  if type_row.entry_granularity = 'PERIOD' and requested_entry_granularity = 'DAY' then
    raise exception using errcode = '23514', message = 'ACTUAL_WORK_DAY_ENTRY_NOT_ALLOWED';
  end if;
  if type_row.entry_granularity = 'DAY' and requested_entry_granularity = 'PERIOD' then
    raise exception using errcode = '23514', message = 'ACTUAL_WORK_PERIOD_ENTRY_NOT_ALLOWED';
  end if;
  if type_row.comment_required and length(btrim(coalesce(requested_note, ''))) = 0 then
    raise exception using errcode = '22023', message = 'ACTUAL_WORK_COMMENT_REQUIRED';
  end if;
  if requested_subject_period_start > current_date and not type_row.future_entry_allowed then
    raise exception using errcode = '22007', message = 'ACTUAL_WORK_FUTURE_NOT_ALLOWED';
  end if;
  if type_row.family = 'ADDITIONAL' and not exists (
    select 1 from public.employment_schedules schedule
    where schedule.tenant_id = requested_tenant_id
      and schedule.administration_id = requested_administration_id and schedule.employment_id = requested_employment_id
      and schedule.valid_from <= requested_subject_period_start
      and (schedule.valid_until is null or schedule.valid_until > requested_subject_period_start)
      and schedule.part_time_factor < 1
  ) then
    raise exception using errcode = '23514', message = 'ACTUAL_WORK_ADDITIONAL_ONLY_PART_TIME';
  end if;

  -- Actual Work has no remaining-capacity model for a partial leave day. A
  -- canonical approved Leave request therefore blocks the overlapping day or
  -- period for every writer, including the employee self-service path.
  if exists (
    select 1
    from public.leave_requests leave_request
    where leave_request.tenant_id = requested_tenant_id
      and leave_request.hr_group_id = requested_hr_group_id
      and leave_request.employee_id = requested_employee_id
      and leave_request.employment_id = requested_employment_id
      and leave_request.status = 'APPROVED'
      and leave_request.start_date < requested_subject_period_end
      and leave_request.end_date >= requested_subject_period_start
  ) then
    raise exception using errcode = '23514', message = 'ACTUAL_WORK_LEAVE_OVERLAP';
  end if;

  select status into period_status
  from public.actual_work_periods
  where tenant_id = requested_tenant_id and hr_group_id = requested_hr_group_id
    and period_start = date_trunc('month', requested_subject_period_start)::date;
  if period_status = 'CLOSED' and requested_operation <> 'CORRECTION' then
    raise exception using errcode = '55000', message = 'ACTUAL_WORK_PERIOD_CLOSED';
  end if;

  if requested_entry_id is not null then
    select * into old_entry from public.employment_work_hour_entries where id = requested_entry_id for update;
    if not found or old_entry.tenant_id <> requested_tenant_id or old_entry.hr_group_id <> requested_hr_group_id then
      raise exception using errcode = '23503', message = 'ACTUAL_WORK_ENTRY_NOT_FOUND';
    end if;
    if self_writer and (old_entry.employee_id <> requested_employee_id or old_entry.employee_id <> internal_security.current_employee_id(requested_tenant_id, requested_hr_group_id)) then
      raise exception using errcode = '42501', message = 'ACTUAL_WORK_NOT_AUTHORIZED';
    end if;
    if requested_operation = 'CREATE' then raise exception using errcode = '22023', message = 'ACTUAL_WORK_ENTRY_ALREADY_EXISTS'; end if;
  elsif requested_operation <> 'CREATE' then
    raise exception using errcode = '22023', message = 'ACTUAL_WORK_ENTRY_REQUIRED';
  end if;

  if requested_entry_granularity = 'PERIOD' and exists (
    select 1 from public.actual_work_type_limits where tenant_id = requested_tenant_id and hr_group_id = requested_hr_group_id and work_hour_type_id = requested_work_hour_type_id
  ) then
    raise exception using errcode = '23514', message = 'ACTUAL_WORK_PERIOD_LIMIT_UNSUPPORTED';
  end if;
  if requested_entry_granularity = 'DAY' then
    for limit_row in
      select limit_scope, max_hours from public.actual_work_type_limits
      where tenant_id = requested_tenant_id and hr_group_id = requested_hr_group_id and work_hour_type_id = requested_work_hour_type_id
    loop
      if limit_row.limit_scope = 'DAY' then
        range_start := requested_subject_period_start; range_end := range_start + 1;
      elsif limit_row.limit_scope = 'WEEK' then
        range_start := date_trunc('week', requested_subject_period_start)::date; range_end := range_start + 7;
      else
        range_start := date_trunc('month', requested_subject_period_start)::date; range_end := (range_start + interval '1 month')::date;
      end if;
      select coalesce(sum(hours), 0) into existing_hours
      from public.employment_work_hour_entries entry
      where entry.tenant_id = requested_tenant_id and entry.hr_group_id = requested_hr_group_id
        and entry.employment_id = requested_employment_id and entry.work_hour_type_id = requested_work_hour_type_id
        and entry.entry_granularity = 'DAY' and entry.status <> 'REVOKED'
        and entry.work_date >= range_start and entry.work_date < range_end
        and (requested_entry_id is null or entry.id <> requested_entry_id);
      if existing_hours + requested_hours > limit_row.max_hours then
        raise exception using errcode = '22003', message = 'ACTUAL_WORK_LIMIT_EXCEEDED';
      end if;
    end loop;
  end if;

  if requested_entry_id is null then
    insert into public.employment_work_hour_entries (
      id, tenant_id, administration_id, employee_id, employment_id, hr_group_id, work_hour_type_id,
      work_date, entry_granularity, subject_period_start, subject_period_end, posting_period_start,
      hours, status, source_type, source_key, note, approved_at, approved_by, created_by
    ) values (
      target_id, requested_tenant_id, requested_administration_id, requested_employee_id, requested_employment_id, requested_hr_group_id, requested_work_hour_type_id,
      requested_subject_period_start, requested_entry_granularity, requested_subject_period_start, requested_subject_period_end, requested_posting_period_start,
      requested_hours, requested_status, 'ACTUAL_WORK', 'ACTUAL_WORK:' || target_id::text, requested_note,
      case when requested_status = 'APPROVED' then timezone('utc', now()) else null end,
      case when requested_status = 'APPROVED' then actor_id else null end, actor_id
    ) returning * into saved_entry;
  else
    update public.employment_work_hour_entries
    set administration_id = requested_administration_id,
        employee_id = requested_employee_id,
        employment_id = requested_employment_id,
        work_hour_type_id = requested_work_hour_type_id,
        work_date = requested_subject_period_start,
        entry_granularity = requested_entry_granularity,
        subject_period_start = requested_subject_period_start,
        subject_period_end = requested_subject_period_end,
        posting_period_start = requested_posting_period_start,
        hours = requested_hours,
        status = requested_status,
        note = requested_note,
        correction_reason = case when requested_operation = 'CORRECTION' then requested_reason else correction_reason end,
        approved_at = case when requested_status = 'APPROVED' then coalesce(approved_at, timezone('utc', now())) else null end,
        approved_by = case when requested_status = 'APPROVED' then coalesce(approved_by, actor_id) else null end,
        updated_at = timezone('utc', now())
    where id = requested_entry_id
    returning * into saved_entry;
  end if;

  select coalesce(max(revision_number), 0) + 1 into next_revision
  from public.actual_work_revisions where entry_id = saved_entry.id;
  insert into public.actual_work_revisions (
    tenant_id, hr_group_id, administration_id, employee_id, employment_id, entry_id, revision_number,
    operation, subject_period_start, subject_period_end, posting_period_start, previous_hours, current_hours, delta_hours, reason, actor_user_id
  ) values (
    saved_entry.tenant_id, saved_entry.hr_group_id, saved_entry.administration_id, saved_entry.employee_id, saved_entry.employment_id, saved_entry.id, next_revision,
    requested_operation, saved_entry.subject_period_start, saved_entry.subject_period_end, saved_entry.posting_period_start,
    case when requested_operation = 'CREATE' then null else old_entry.hours end,
    case when requested_operation = 'VOID' then null else saved_entry.hours end,
    case when requested_operation = 'VOID' then -old_entry.hours else saved_entry.hours - coalesce(old_entry.hours, 0) end,
    case when requested_operation = 'CORRECTION' then requested_reason else null end,
    actor_id
  );
  return saved_entry;
end;
$$;

revoke all on function public.save_actual_work_entry(uuid, uuid, uuid, uuid, uuid, uuid, uuid, public.actual_work_entry_granularity, date, date, date, numeric, public.leave_work_hour_entry_status, text, public.actual_work_revision_operation, text) from public, anon;
grant execute on function public.save_actual_work_entry(uuid, uuid, uuid, uuid, uuid, uuid, uuid, public.actual_work_entry_granularity, date, date, date, numeric, public.leave_work_hour_entry_status, text, public.actual_work_revision_operation, text) to authenticated;

commit;
