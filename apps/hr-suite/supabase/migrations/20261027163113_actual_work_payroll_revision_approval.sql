begin;

-- Payroll approval is separate from the operational Actual Work status. Each
-- approval is immutable and identifies the exact entry revision and Payroll
-- calendar period that HR Admin reviewed.
create table public.actual_work_payroll_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_id uuid not null,
  entry_id uuid not null,
  reviewed_revision_number integer not null check (reviewed_revision_number > 0),
  entry_revision_number integer not null check (entry_revision_number > 0),
  payroll_period_id uuid not null,
  payroll_period_start date not null,
  payroll_period_end date not null,
  payroll_periodicity text not null check (payroll_periodicity in ('MONTHLY', 'FOUR_WEEKLY')),
  content_fingerprint text not null check (content_fingerprint ~ '^[0-9a-f]{64}$'),
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default pg_catalog.now(),
  constraint actual_work_payroll_approvals_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete restrict,
  constraint actual_work_payroll_approvals_employment_fkey
    foreign key (tenant_id, administration_id, employee_id, employment_id)
    references public.employments(tenant_id, administration_id, employee_id, id) on delete restrict,
  constraint actual_work_payroll_approvals_entry_fkey
    foreign key (tenant_id, hr_group_id, entry_id)
    references public.employment_work_hour_entries(tenant_id, hr_group_id, id) on delete restrict,
  constraint actual_work_payroll_approvals_reviewed_revision_fkey
    foreign key (entry_id, reviewed_revision_number)
    references public.actual_work_revisions(entry_id, revision_number) on delete restrict,
  constraint actual_work_payroll_approvals_revision_fkey
    foreign key (entry_id, entry_revision_number)
    references public.actual_work_revisions(entry_id, revision_number) on delete restrict,
  constraint actual_work_payroll_approvals_revision_step_check
    check (entry_revision_number >= reviewed_revision_number
      and entry_revision_number - reviewed_revision_number <= 1),
  constraint actual_work_payroll_approvals_period_check
    check (
      (payroll_periodicity = 'MONTHLY'
        and payroll_period_start = date_trunc('month', payroll_period_start)::date
        and payroll_period_end = (date_trunc('month', payroll_period_start) + interval '1 month - 1 day')::date)
      or (payroll_periodicity = 'FOUR_WEEKLY' and payroll_period_end - payroll_period_start = 27)
    ),
  constraint actual_work_payroll_approvals_entry_revision_unique
    unique (entry_id, entry_revision_number)
);

create index actual_work_payroll_approvals_scope_period_idx
  on public.actual_work_payroll_approvals
    (tenant_id, hr_group_id, administration_id, payroll_period_id, employee_id, employment_id);

alter table public.actual_work_payroll_approvals enable row level security;
create policy actual_work_payroll_approvals_read
on public.actual_work_payroll_approvals for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary:read'))
  and (select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:read'))
);
revoke all on table public.actual_work_payroll_approvals from public, anon, authenticated;
grant select on table public.actual_work_payroll_approvals to authenticated;

create trigger audit_actual_work_payroll_approvals
after insert on public.actual_work_payroll_approvals
for each row execute function internal_security.audit_configuration_change('actual_work_payroll_approvals');

create or replace function internal_security.reject_actual_work_payroll_approval_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using errcode = '55000', message = 'ACTUAL_WORK_PAYROLL_APPROVAL_IMMUTABLE';
end;
$$;

create trigger actual_work_payroll_approvals_immutable
before update or delete on public.actual_work_payroll_approvals
for each row execute function internal_security.reject_actual_work_payroll_approval_mutation();

create or replace function internal_security.actual_work_payroll_entry_fingerprint(
  p_entry public.employment_work_hour_entries,
  p_revision_number integer,
  p_payroll_period_id uuid,
  p_payroll_period_start date,
  p_payroll_period_end date,
  p_payroll_periodicity text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'entryId', (p_entry).id,
    'tenantId', (p_entry).tenant_id,
    'hrGroupId', (p_entry).hr_group_id,
    'administrationId', (p_entry).administration_id,
    'employeeId', (p_entry).employee_id,
    'employmentId', (p_entry).employment_id,
    'workHourTypeId', (p_entry).work_hour_type_id,
    'workDate', (p_entry).work_date,
    'granularity', (p_entry).entry_granularity,
    'subjectPeriodStart', (p_entry).subject_period_start,
    'subjectPeriodEnd', (p_entry).subject_period_end,
    'postingPeriodStart', (p_entry).posting_period_start,
    'hours', (p_entry).hours,
    'status', (p_entry).status,
    'note', (p_entry).note,
    'correctionReason', (p_entry).correction_reason,
    'approvedAt', pg_catalog.to_char((p_entry).approved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
    'updatedAt', pg_catalog.to_char((p_entry).updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
    'revisionNumber', p_revision_number,
    'payrollPeriodId', p_payroll_period_id,
    'payrollPeriodStart', p_payroll_period_start,
    'payrollPeriodEnd', p_payroll_period_end,
    'payrollPeriodicity', p_payroll_periodicity
  )::text, 'UTF8'), 'sha256'), 'hex')
$$;

create or replace function public.approve_actual_work_entry_for_payroll_period(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_payroll_period_id uuid,
  requested_payroll_period_start date,
  requested_payroll_period_end date,
  requested_payroll_periodicity text,
  requested_entries jsonb
)
returns setof public.actual_work_payroll_approvals
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  item jsonb;
  entry_id_value uuid;
  requested_revision_number integer;
  current_revision_number integer;
  entry_row public.employment_work_hour_entries%rowtype;
  saved_entry public.employment_work_hour_entries%rowtype;
  saved_approval public.actual_work_payroll_approvals%rowtype;
  current_fingerprint text;
begin
  if actor_id is null
    or not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'salary:write')
    or not internal_security.current_user_has_audience_role(requested_tenant_id, array['HR_ADMIN', 'TENANT_ADMIN']) then
    raise exception using errcode = '42501', message = 'ACTUAL_WORK_PAYROLL_APPROVAL_NOT_AUTHORIZED';
  end if;
  if requested_payroll_period_id is null
    or requested_payroll_period_start is null or requested_payroll_period_end is null
    or requested_payroll_period_start > requested_payroll_period_end
    or requested_payroll_periodicity is null
    or requested_payroll_periodicity not in ('MONTHLY', 'FOUR_WEEKLY')
    or (requested_payroll_periodicity = 'MONTHLY' and (
      requested_payroll_period_start <> date_trunc('month', requested_payroll_period_start)::date
      or requested_payroll_period_end <> (date_trunc('month', requested_payroll_period_start) + interval '1 month - 1 day')::date
    ))
    or (requested_payroll_periodicity = 'FOUR_WEEKLY'
      and requested_payroll_period_end - requested_payroll_period_start <> 27)
    or requested_entries is null or jsonb_typeof(requested_entries) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'ACTUAL_WORK_PAYROLL_APPROVAL_INPUT_INVALID';
  end if;
  if jsonb_array_length(requested_entries) not between 1 and 250 then
    raise exception using errcode = '22023', message = 'ACTUAL_WORK_PAYROLL_APPROVAL_INPUT_INVALID';
  end if;
  if (select count(*) from jsonb_array_elements(requested_entries))
      <> (select count(distinct value ->> 'entryId') from jsonb_array_elements(requested_entries)) then
    raise exception using errcode = '22023', message = 'ACTUAL_WORK_PAYROLL_APPROVAL_DUPLICATE_ENTRY';
  end if;

  for item in select value from jsonb_array_elements(requested_entries)
  loop
    entry_id_value := (item ->> 'entryId')::uuid;
    requested_revision_number := (item ->> 'revisionNumber')::integer;
    if requested_revision_number is null or requested_revision_number <= 0 then
      raise exception using errcode = '22023', message = 'ACTUAL_WORK_PAYROLL_APPROVAL_INPUT_INVALID';
    end if;

    select entry.* into entry_row
    from public.employment_work_hour_entries entry
    where entry.id = entry_id_value
      and entry.tenant_id = requested_tenant_id
      and entry.hr_group_id = requested_hr_group_id
      and entry.administration_id = requested_administration_id
      and entry.status in ('PENDING', 'APPROVED')
    for update;
    if not found then raise exception using errcode = '23503', message = 'ACTUAL_WORK_PAYROLL_ENTRY_NOT_APPROVABLE'; end if;
    if entry_row.subject_period_start < requested_payroll_period_start
      or entry_row.subject_period_end > requested_payroll_period_end + 1 then
      raise exception using errcode = '23514', message = 'ACTUAL_WORK_PAYROLL_ENTRY_PERIOD_MISMATCH';
    end if;

    select max(revision.revision_number) into current_revision_number
    from public.actual_work_revisions revision
    where revision.tenant_id = requested_tenant_id and revision.hr_group_id = requested_hr_group_id
      and revision.entry_id = entry_row.id;
    if current_revision_number is null then
      raise exception using errcode = '23503', message = 'ACTUAL_WORK_PAYROLL_APPROVAL_REVISION_INVALID';
    end if;

    select approval.* into saved_approval
    from public.actual_work_payroll_approvals approval
    where approval.entry_id = entry_row.id
      and approval.entry_revision_number = current_revision_number
    for update;
    if found then
      current_fingerprint := internal_security.actual_work_payroll_entry_fingerprint(
        entry_row, current_revision_number, requested_payroll_period_id,
        requested_payroll_period_start, requested_payroll_period_end, requested_payroll_periodicity
      );
      if saved_approval.reviewed_revision_number in (requested_revision_number, current_revision_number)
        and saved_approval.payroll_period_id = requested_payroll_period_id
        and saved_approval.payroll_period_start = requested_payroll_period_start
        and saved_approval.payroll_period_end = requested_payroll_period_end
        and saved_approval.payroll_periodicity = requested_payroll_periodicity
        and saved_approval.content_fingerprint = current_fingerprint then
        return next saved_approval;
        continue;
      end if;
      raise exception using errcode = '40001', message = 'ACTUAL_WORK_PAYROLL_APPROVAL_PERIOD_CONFLICT';
    end if;

    if entry_row.status = 'PENDING' then
      if current_revision_number <> requested_revision_number then
        raise exception using errcode = '40001', message = 'ACTUAL_WORK_PAYROLL_APPROVAL_REVISION_STALE';
      end if;
      saved_entry := public.save_actual_work_entry(
        entry_row.id, entry_row.tenant_id, entry_row.hr_group_id, entry_row.administration_id,
        entry_row.employee_id, entry_row.employment_id, entry_row.work_hour_type_id,
        entry_row.entry_granularity, entry_row.subject_period_start, entry_row.subject_period_end,
        entry_row.posting_period_start, entry_row.hours, 'APPROVED'::public.leave_work_hour_entry_status,
        entry_row.note, 'EDIT'::public.actual_work_revision_operation, null
      );
      entry_row := saved_entry;
      select max(revision.revision_number) into current_revision_number
      from public.actual_work_revisions revision
      where revision.tenant_id = requested_tenant_id and revision.hr_group_id = requested_hr_group_id
        and revision.entry_id = entry_row.id;
      if current_revision_number <> requested_revision_number + 1 then
        raise exception using errcode = '40001', message = 'ACTUAL_WORK_PAYROLL_APPROVAL_REVISION_STALE';
      end if;
    elsif current_revision_number <> requested_revision_number or entry_row.approved_at is null then
      raise exception using errcode = '40001', message = 'ACTUAL_WORK_PAYROLL_APPROVAL_REVISION_STALE';
    end if;

    current_fingerprint := internal_security.actual_work_payroll_entry_fingerprint(
      entry_row, current_revision_number, requested_payroll_period_id,
      requested_payroll_period_start, requested_payroll_period_end, requested_payroll_periodicity
    );
    insert into public.actual_work_payroll_approvals (
      tenant_id, hr_group_id, administration_id, employee_id, employment_id, entry_id,
      reviewed_revision_number, entry_revision_number, payroll_period_id,
      payroll_period_start, payroll_period_end, payroll_periodicity,
      content_fingerprint, approved_by
    ) values (
      requested_tenant_id, requested_hr_group_id, requested_administration_id,
      entry_row.employee_id, entry_row.employment_id, entry_row.id,
      requested_revision_number, current_revision_number, requested_payroll_period_id,
      requested_payroll_period_start, requested_payroll_period_end, requested_payroll_periodicity,
      current_fingerprint, actor_id
    ) on conflict (entry_id, entry_revision_number) do nothing
    returning * into saved_approval;

    if not found then
      select approval.* into saved_approval
      from public.actual_work_payroll_approvals approval
      where approval.entry_id = entry_row.id and approval.entry_revision_number = current_revision_number;
      if saved_approval.reviewed_revision_number not in (requested_revision_number, current_revision_number)
        or saved_approval.payroll_period_id <> requested_payroll_period_id
        or saved_approval.content_fingerprint <> current_fingerprint then
        raise exception using errcode = '40001', message = 'ACTUAL_WORK_PAYROLL_APPROVAL_PERIOD_CONFLICT';
      end if;
    end if;

    if exists (
      select 1
      from public.leave_type_overtime_work_hours link
      join public.leave_types leave_type
        on leave_type.tenant_id = link.tenant_id and leave_type.hr_group_id = link.hr_group_id
        and leave_type.id = link.leave_type_id
      where link.tenant_id = requested_tenant_id and link.hr_group_id = requested_hr_group_id
        and link.work_hour_type_id = entry_row.work_hour_type_id
        and (link.administration_id is null or link.administration_id = requested_administration_id)
        and leave_type.is_active and leave_type.entitlement_mode = 'OVERTIME_HOURS'
    ) then
      perform public.post_actual_work_tvt_for_revision(
        requested_tenant_id, requested_hr_group_id, requested_administration_id,
        entry_row.id, current_revision_number
      );
    end if;
    return next saved_approval;
  end loop;
end;
$$;

-- A release row cannot be written unless its exact current revision and Payroll
-- period have an immutable HR Admin approval with a matching content hash.
create or replace function internal_security.require_actual_work_payroll_approval_for_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry_row public.employment_work_hour_entries%rowtype;
  approval_row public.actual_work_payroll_approvals%rowtype;
  current_revision_number integer;
  current_fingerprint text;
begin
  select entry.* into entry_row
  from public.employment_work_hour_entries entry
  where entry.id = new.entry_id and entry.tenant_id = new.tenant_id
    and entry.hr_group_id = new.hr_group_id and entry.administration_id = new.administration_id
  for update;
  if not found then raise exception using errcode = '23503', message = 'ACTUAL_WORK_PAYROLL_RELEASE_ENTRY_INVALID'; end if;

  select max(revision.revision_number) into current_revision_number
  from public.actual_work_revisions revision
  where revision.tenant_id = new.tenant_id and revision.hr_group_id = new.hr_group_id
    and revision.entry_id = new.entry_id;
  if current_revision_number is null or current_revision_number <> new.entry_revision_number then
    raise exception using errcode = '40001', message = 'ACTUAL_WORK_PAYROLL_RELEASE_REVISION_STALE';
  end if;

  select approval.* into approval_row
  from public.actual_work_payroll_approvals approval
  where approval.entry_id = new.entry_id
    and approval.tenant_id = new.tenant_id
    and approval.hr_group_id = new.hr_group_id
    and approval.administration_id = new.administration_id
    and approval.employee_id = new.employee_id
    and approval.employment_id = new.employment_id
    and approval.entry_revision_number = new.entry_revision_number
    and approval.payroll_period_id = new.payroll_period_id
    and approval.payroll_period_start = new.payroll_period_start
    and approval.payroll_period_end = new.payroll_period_end
    and approval.payroll_periodicity = new.payroll_periodicity;
  if not found then
    raise exception using errcode = '42501', message = 'ACTUAL_WORK_PAYROLL_APPROVAL_REQUIRED';
  end if;
  if entry_row.status <> 'APPROVED' or entry_row.approved_at is null then
    raise exception using errcode = '23514', message = 'ACTUAL_WORK_PAYROLL_RELEASE_ENTRY_NOT_APPROVED';
  end if;

  current_fingerprint := internal_security.actual_work_payroll_entry_fingerprint(
    entry_row, current_revision_number, new.payroll_period_id,
    new.payroll_period_start, new.payroll_period_end, new.payroll_periodicity
  );
  if approval_row.content_fingerprint <> current_fingerprint then
    raise exception using errcode = '40001', message = 'ACTUAL_WORK_PAYROLL_APPROVAL_FINGERPRINT_STALE';
  end if;
  return new;
end;
$$;

drop trigger if exists actual_work_payroll_release_requires_approval on public.actual_work_payroll_releases;
create trigger actual_work_payroll_release_requires_approval
before insert on public.actual_work_payroll_releases
for each row execute function internal_security.require_actual_work_payroll_approval_for_release();

revoke all on function internal_security.reject_actual_work_payroll_approval_mutation() from public, anon, authenticated;
revoke all on function internal_security.actual_work_payroll_entry_fingerprint(public.employment_work_hour_entries, integer, uuid, date, date, text) from public, anon, authenticated;
revoke all on function internal_security.require_actual_work_payroll_approval_for_release() from public, anon, authenticated;
revoke all on function public.approve_actual_work_entry_for_payroll_period(uuid, uuid, uuid, uuid, date, date, text, jsonb) from public, anon;
grant execute on function public.approve_actual_work_entry_for_payroll_period(uuid, uuid, uuid, uuid, date, date, text, jsonb) to authenticated;

commit;
