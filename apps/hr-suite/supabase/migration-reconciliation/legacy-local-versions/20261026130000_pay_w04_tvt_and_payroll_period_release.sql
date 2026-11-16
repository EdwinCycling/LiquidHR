begin;

-- TVT expiry is explicitly configured on the overtime rule or employee exception.
-- NULL means that accrual is blocked; it never selects an invented default.
alter table public.overtime_type_settings
  add column if not exists tvt_expiration_months smallint
    check (tvt_expiration_months between 1 and 120);
alter table public.overtime_type_exceptions
  add column if not exists tvt_expiration_months smallint
    check (tvt_expiration_months between 1 and 120);

-- Payroll Lab is a separate database. These fields are opaque, scoped evidence
-- from its period row; there is intentionally no cross-database foreign key.
alter table public.actual_work_payroll_releases
  add column payroll_period_id uuid,
  add column payroll_period_end date,
  add column payroll_periodicity text;
alter table public.actual_work_payroll_releases
  drop constraint actual_work_payroll_releases_period_check,
  add constraint actual_work_payroll_releases_period_check check (
    (payroll_period_id is null and payroll_period_end is null and payroll_periodicity is null
      and payroll_period_start = date_trunc('month', payroll_period_start)::date)
    or (payroll_period_id is not null and payroll_period_end is not null
      and payroll_periodicity is not null and payroll_periodicity in ('MONTHLY', 'FOUR_WEEKLY')
      and payroll_period_start <= payroll_period_end)
  );

create index actual_work_payroll_releases_payroll_period_idx
  on public.actual_work_payroll_releases
    (tenant_id, hr_group_id, administration_id, payroll_period_id, employee_id, employment_id);

-- The original month-only RPC remains in the historical migration, but new
-- releases must carry a Payroll Lab period identity. This wrapper validates
-- every entry against the exact payroll-calendar bounds and persists those
-- bounds in the immutable release fingerprint.
create or replace function public.release_actual_work_entries_for_payroll_period(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_payroll_period_id uuid,
  requested_payroll_period_start date,
  requested_payroll_period_end date,
  requested_payroll_periodicity text,
  requested_entries jsonb
)
returns setof public.actual_work_payroll_releases
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  item jsonb;
  entry_row public.employment_work_hour_entries%rowtype;
  type_row public.work_hour_types%rowtype;
  mapping_row public.actual_work_payroll_mappings%rowtype;
  revision_number integer;
  fingerprint text;
  prior_release_id uuid;
  release_class_value text;
  saved_release public.actual_work_payroll_releases%rowtype;
  period_end_exclusive date;
begin
  if actor_id is null
    or not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'salary:write')
    or not internal_security.current_user_has_audience_role(requested_tenant_id, array['HR_ADMIN', 'TENANT_ADMIN']) then
    raise exception using errcode = '42501', message = 'ACTUAL_WORK_PAYROLL_RELEASE_NOT_AUTHORIZED';
  end if;
  if requested_payroll_period_id is null
    or requested_payroll_period_start is null or requested_payroll_period_end is null
    or requested_payroll_period_start > requested_payroll_period_end
    or requested_payroll_periodicity is null or requested_payroll_periodicity not in ('MONTHLY', 'FOUR_WEEKLY')
    or (requested_payroll_periodicity = 'MONTHLY' and (
      requested_payroll_period_start <> date_trunc('month', requested_payroll_period_start)::date
      or requested_payroll_period_end <> (date_trunc('month', requested_payroll_period_start) + interval '1 month - 1 day')::date
    ))
    or (requested_payroll_periodicity = 'FOUR_WEEKLY'
      and requested_payroll_period_end - requested_payroll_period_start <> 27)
    or requested_entries is null or jsonb_typeof(requested_entries) <> 'array'
    or jsonb_array_length(requested_entries) not between 1 and 250 then
    raise exception using errcode = '22023', message = 'ACTUAL_WORK_PAYROLL_RELEASE_INPUT_INVALID';
  end if;
  if (select count(*) from jsonb_array_elements(requested_entries))
      <> (select count(distinct value ->> 'entryId') from jsonb_array_elements(requested_entries)) then
    raise exception using errcode = '22023', message = 'ACTUAL_WORK_PAYROLL_RELEASE_DUPLICATE_ENTRY';
  end if;
  period_end_exclusive := requested_payroll_period_end + 1;

  for item in select value from jsonb_array_elements(requested_entries)
  loop
    select entry.* into entry_row
    from public.employment_work_hour_entries entry
    where entry.id = (item ->> 'entryId')::uuid
      and entry.tenant_id = requested_tenant_id
      and entry.hr_group_id = requested_hr_group_id
      and entry.administration_id = requested_administration_id
      and entry.subject_period_start >= requested_payroll_period_start
      and entry.subject_period_end <= period_end_exclusive
      and entry.status = 'APPROVED' and entry.approved_at is not null
    for update;
    if not found then raise exception using errcode = '23503', message = 'ACTUAL_WORK_PAYROLL_RELEASE_ENTRY_INVALID'; end if;

    select type.* into type_row
    from public.work_hour_types type
    where type.id = entry_row.work_hour_type_id
      and type.tenant_id = requested_tenant_id and type.hr_group_id = requested_hr_group_id
      and type.is_active and (type.administration_id is null or type.administration_id = requested_administration_id);
    if not found or type_row.family = 'TRANSPARENT' then
      raise exception using errcode = '23514', message = 'ACTUAL_WORK_PAYROLL_RELEASE_TYPE_INVALID';
    end if;

    select revision.revision_number into revision_number
    from public.actual_work_revisions revision
    where revision.entry_id = entry_row.id
    order by revision.revision_number desc
    limit 1;
    if revision_number is null or revision_number <> (item ->> 'revisionNumber')::integer then
      raise exception using errcode = '40001', message = 'ACTUAL_WORK_PAYROLL_RELEASE_REVISION_STALE';
    end if;

    select mapping.* into mapping_row
    from public.actual_work_payroll_mappings mapping
    where mapping.id = (item ->> 'mappingId')::uuid
      and mapping.tenant_id = requested_tenant_id
      and mapping.hr_group_id = requested_hr_group_id
      and mapping.administration_id = requested_administration_id
      and mapping.work_hour_type_id = entry_row.work_hour_type_id
      and mapping.processing_target = 'PAYMENT'
      and mapping.valid_from <= entry_row.subject_period_start
      and (mapping.valid_until is null or mapping.valid_until >= entry_row.subject_period_end - 1);
    if not found then raise exception using errcode = '23503', message = 'ACTUAL_WORK_PAYROLL_MAPPING_REQUIRED'; end if;

    if type_row.family = 'OVERTIME' then
      raise exception using errcode = '23514', message = 'ACTUAL_WORK_PAYROLL_COMPONENT_SOURCE_GAP';
    end if;
    if exists (
      select 1 from public.leave_type_overtime_work_hours link
      join public.leave_types leave_type
        on leave_type.tenant_id = link.tenant_id and leave_type.hr_group_id = link.hr_group_id
        and leave_type.id = link.leave_type_id
      where link.tenant_id = requested_tenant_id and link.hr_group_id = requested_hr_group_id
        and link.work_hour_type_id = type_row.id
        and (link.administration_id is null or link.administration_id = requested_administration_id)
        and leave_type.entitlement_mode = 'OVERTIME_HOURS' and leave_type.is_active
    ) then
      raise exception using errcode = '23514', message = 'ACTUAL_WORK_PAYROLL_TVT_DOUBLE_PAYMENT';
    end if;

    select release.* into saved_release
    from public.actual_work_payroll_releases release
    where release.entry_id = entry_row.id
      and release.entry_revision_number = revision_number
      and release.payroll_period_id = requested_payroll_period_id
      and release.mapping_id = mapping_row.id
    for update;
    if found then
      prior_release_id := saved_release.supersedes_release_id;
      release_class_value := saved_release.release_class;
      if saved_release.payroll_period_start <> requested_payroll_period_start
        or saved_release.payroll_period_end <> requested_payroll_period_end
        or saved_release.payroll_periodicity <> requested_payroll_periodicity then
        raise exception using errcode = '40001', message = 'ACTUAL_WORK_PAYROLL_RELEASE_PERIOD_CONFLICT';
      end if;
    else
      if exists (
        select 1 from public.actual_work_payroll_releases prior
        where prior.entry_id = entry_row.id and prior.entry_revision_number = revision_number
          and prior.mapping_id = mapping_row.id
      ) then
        raise exception using errcode = '23505', message = 'ACTUAL_WORK_PAYROLL_RELEASE_PERIOD_ASSIGNMENT_CONFLICT';
      end if;
      select release.id into prior_release_id
      from public.actual_work_payroll_releases release
      where release.tenant_id = requested_tenant_id and release.hr_group_id = requested_hr_group_id
        and release.administration_id = requested_administration_id and release.entry_id = entry_row.id
      order by release.released_at desc, release.id desc
      limit 1;
      release_class_value := case when prior_release_id is null then 'INITIAL' else 'TWK_REQUIRED' end;
    end if;

    fingerprint := encode(extensions.digest(convert_to(jsonb_build_object(
      'entryId', entry_row.id,
      'employeeId', entry_row.employee_id,
      'employmentId', entry_row.employment_id,
      'workHourTypeId', entry_row.work_hour_type_id,
      'workDate', entry_row.work_date,
      'granularity', entry_row.entry_granularity,
      'subjectPeriodStart', entry_row.subject_period_start,
      'subjectPeriodEnd', entry_row.subject_period_end,
      'postingPeriodStart', entry_row.posting_period_start,
      'hours', entry_row.hours,
      'entryStatus', entry_row.status,
      'entryUpdatedAt', entry_row.updated_at,
      'revisionNumber', revision_number,
      'workHourTypeUpdatedAt', type_row.updated_at,
      'mappingId', mapping_row.id,
      'mappingVersion', mapping_row.version_number,
      'mappingComponentId', mapping_row.salary_component_id,
      'mappingComponentCode', mapping_row.salary_component_code,
      'mappingComponentVersion', mapping_row.salary_component_version,
      'mappingComponentOutput', mapping_row.salary_component_output,
      'mappingTarget', mapping_row.processing_target,
      'mappingRule', mapping_row.calculation_rule,
      'mappingFactor', mapping_row.factor,
      'mappingValidFrom', mapping_row.valid_from,
      'mappingValidUntil', mapping_row.valid_until,
      'payrollPeriodId', requested_payroll_period_id,
      'payrollPeriodStart', requested_payroll_period_start,
      'payrollPeriodEnd', requested_payroll_period_end,
      'payrollPeriodicity', requested_payroll_periodicity,
      'releaseClass', release_class_value,
      'supersedesReleaseId', prior_release_id
    )::text, 'UTF8'), 'sha256'), 'hex');

    insert into public.actual_work_payroll_releases (
      tenant_id, hr_group_id, administration_id, employee_id, employment_id,
      entry_id, entry_revision_number, payroll_period_start, mapping_id,
      release_class, supersedes_release_id, work_hour_type_updated_at,
      payroll_period_id, payroll_period_end, payroll_periodicity,
      content_fingerprint, released_by
    ) values (
      requested_tenant_id, requested_hr_group_id, requested_administration_id, entry_row.employee_id, entry_row.employment_id,
      entry_row.id, revision_number, requested_payroll_period_start, mapping_row.id,
      release_class_value, prior_release_id, type_row.updated_at,
      requested_payroll_period_id, requested_payroll_period_end, requested_payroll_periodicity,
      fingerprint, actor_id
    ) on conflict (entry_id, entry_revision_number, payroll_period_start, mapping_id) do nothing
    returning * into saved_release;

    if not found then
      select release.* into saved_release from public.actual_work_payroll_releases release
      where release.entry_id = entry_row.id and release.entry_revision_number = revision_number
        and release.payroll_period_start = requested_payroll_period_start and release.mapping_id = mapping_row.id;
      if saved_release.payroll_period_id is distinct from requested_payroll_period_id
        or saved_release.content_fingerprint <> fingerprint then
        raise exception using errcode = '40001', message = 'ACTUAL_WORK_PAYROLL_RELEASE_FINGERPRINT_CONFLICT';
      end if;
    end if;
    return next saved_release;
  end loop;
end;
$$;

revoke all on function public.release_actual_work_entries_for_payroll(uuid, uuid, uuid, date, jsonb) from public, anon, authenticated;
revoke all on function public.release_actual_work_entries_for_payroll_period(uuid, uuid, uuid, uuid, date, date, text, jsonb) from public, anon;
grant execute on function public.release_actual_work_entries_for_payroll_period(uuid, uuid, uuid, uuid, date, date, text, jsonb) to authenticated;

create or replace function public.post_actual_work_tvt_for_revision(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_entry_id uuid,
  requested_revision_number integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  entry_row public.employment_work_hour_entries%rowtype;
  type_row public.work_hour_types%rowtype;
  leave_type_id uuid;
  leave_type_count integer;
  configured_expiration_months smallint;
  expiration_on date;
  accrual_year smallint;
  cohort text;
  source_key text;
  bucket public.leave_balance_buckets%rowtype;
  previous_amount numeric(12,4);
  delta_amount numeric(12,4);
  transaction_id uuid;
  previous_leave_type_id uuid;
begin
  if actor_id is null
    or not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'salary:write')
    or not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'leave:write')
    or not internal_security.current_user_has_audience_role(requested_tenant_id, array['HR_ADMIN', 'TENANT_ADMIN']) then
    raise exception using errcode = '42501', message = 'ACTUAL_WORK_TVT_NOT_AUTHORIZED';
  end if;

  if requested_revision_number is null or requested_revision_number < 1 then
    raise exception using errcode = '22023', message = 'ACTUAL_WORK_TVT_REVISION_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    requested_tenant_id::text || ':' || requested_hr_group_id::text || ':' || requested_entry_id::text,
    0
  ));

  select entry.* into entry_row
  from public.employment_work_hour_entries entry
  where entry.tenant_id = requested_tenant_id
    and entry.hr_group_id = requested_hr_group_id
    and entry.administration_id = requested_administration_id
    and entry.id = requested_entry_id
    and entry.status = 'APPROVED'
    and entry.approved_at is not null
  for update;
  if not found then raise exception using errcode = '23503', message = 'ACTUAL_WORK_TVT_ENTRY_NOT_APPROVED'; end if;

  if not exists (
    select 1 from public.actual_work_revisions revision
    where revision.entry_id = entry_row.id
      and revision.revision_number = requested_revision_number
      and revision.revision_number = (
        select max(current_revision.revision_number)
        from public.actual_work_revisions current_revision
        where current_revision.entry_id = entry_row.id
      )
  ) then
    raise exception using errcode = '40001', message = 'ACTUAL_WORK_TVT_REVISION_STALE';
  end if;

  select type.* into type_row
  from public.work_hour_types type
  where type.tenant_id = requested_tenant_id and type.hr_group_id = requested_hr_group_id
    and type.id = entry_row.work_hour_type_id and type.is_active
    and type.family = 'OVERTIME'
    and (type.administration_id is null or type.administration_id = requested_administration_id);
  if not found then raise exception using errcode = '23514', message = 'ACTUAL_WORK_TVT_TYPE_INVALID'; end if;

  select count(distinct link.leave_type_id)
    into leave_type_count
  from public.leave_type_overtime_work_hours link
  join public.leave_types leave_type
    on leave_type.tenant_id = link.tenant_id and leave_type.hr_group_id = link.hr_group_id
    and leave_type.id = link.leave_type_id
  where link.tenant_id = requested_tenant_id and link.hr_group_id = requested_hr_group_id
    and link.work_hour_type_id = type_row.id
    and (link.administration_id is null or link.administration_id = requested_administration_id)
    and leave_type.is_active and leave_type.entitlement_mode = 'OVERTIME_HOURS';
  if coalesce(leave_type_count, 0) <> 1 then
    raise exception using errcode = '23514', message = 'ACTUAL_WORK_TVT_LEAVE_TYPE_AMBIGUOUS';
  end if;
  select link.leave_type_id into leave_type_id
  from public.leave_type_overtime_work_hours link
  join public.leave_types leave_type
    on leave_type.tenant_id = link.tenant_id and leave_type.hr_group_id = link.hr_group_id
    and leave_type.id = link.leave_type_id
  where link.tenant_id = requested_tenant_id and link.hr_group_id = requested_hr_group_id
    and link.work_hour_type_id = type_row.id
    and (link.administration_id is null or link.administration_id = requested_administration_id)
    and leave_type.is_active and leave_type.entitlement_mode = 'OVERTIME_HOURS'
  limit 1;

  accrual_year := extract(year from entry_row.subject_period_start)::smallint;
  cohort := 'ACTUAL_WORK_TVT:' || entry_row.id::text;
  source_key := cohort || ':' || requested_revision_number::text;

  select transaction.leave_type_id into previous_leave_type_id
  from public.leave_accrual_transactions transaction
  where transaction.tenant_id = requested_tenant_id
    and transaction.hr_group_id = requested_hr_group_id
    and transaction.source_type = 'ACTUAL_WORK_TVT'
    and transaction.source_id = entry_row.id
  order by transaction.created_at, transaction.id
  limit 1;
  if previous_leave_type_id is not null and previous_leave_type_id <> leave_type_id then
    raise exception using errcode = '23514', message = 'ACTUAL_WORK_TVT_RECLASSIFICATION_REVIEW_REQUIRED';
  end if;

  if exists (
    select 1 from public.leave_year_controls control
    where control.tenant_id = requested_tenant_id and control.hr_group_id = requested_hr_group_id
      and control.year = accrual_year and control.status = 'LOCKED'
      and (control.administration_id is null or control.administration_id = requested_administration_id)
  ) then
    raise exception using errcode = '55000', message = 'LEAVE_YEAR_LOCKED';
  end if;

  select candidate.* into bucket
  from public.leave_balance_buckets candidate
  where candidate.tenant_id = requested_tenant_id and candidate.hr_group_id = requested_hr_group_id
    and candidate.administration_id = requested_administration_id
    and candidate.employee_id = entry_row.employee_id and candidate.employment_id = entry_row.employment_id
    and candidate.leave_type_id = leave_type_id and candidate.accrual_year = accrual_year
    and candidate.cohort_key = cohort
  for update;

  if bucket.id is null then
    select exception_value.tvt_expiration_months
      into configured_expiration_months
    from public.overtime_type_exceptions exception_value
    where exception_value.tenant_id = requested_tenant_id
      and exception_value.hr_group_id = requested_hr_group_id
      and (exception_value.administration_id is null or exception_value.administration_id = requested_administration_id)
      and exception_value.employee_id = entry_row.employee_id
      and exception_value.work_hour_type_id = type_row.id
    order by (exception_value.administration_id = requested_administration_id) desc nulls last
    limit 1;
    if not found or configured_expiration_months is null then
      select settings.tvt_expiration_months
        into configured_expiration_months
      from public.overtime_type_settings settings
      where settings.tenant_id = requested_tenant_id
        and settings.hr_group_id = requested_hr_group_id
        and (settings.administration_id is null or settings.administration_id = requested_administration_id)
        and settings.work_hour_type_id = type_row.id
      order by (settings.administration_id = requested_administration_id) desc nulls last
      limit 1;
    end if;
    if configured_expiration_months is null then
      raise exception using errcode = '23514', message = 'ACTUAL_WORK_TVT_EXPIRATION_NOT_CONFIGURED';
    end if;
    expiration_on := (entry_row.subject_period_start + pg_catalog.make_interval(months => configured_expiration_months))::date;
  else
    -- Keep each accrued work entry on its original cohort expiry when policy
    -- settings later change; corrections reuse that same ledger bucket.
    expiration_on := bucket.expiration_date;
  end if;

  insert into public.leave_balance_buckets (
    tenant_id, hr_group_id, administration_id, employee_id, employment_id,
    leave_type_id, accrual_year, accrual_reference_date, expiration_date,
    cohort_key, source_accrual_year
  ) values (
    requested_tenant_id, requested_hr_group_id, requested_administration_id,
    entry_row.employee_id, entry_row.employment_id, leave_type_id, accrual_year,
    entry_row.subject_period_start, expiration_on, cohort, accrual_year
  ) on conflict (tenant_id, hr_group_id, employment_id, leave_type_id, accrual_year, cohort_key) do nothing;

  select candidate.* into bucket
  from public.leave_balance_buckets candidate
  where candidate.tenant_id = requested_tenant_id and candidate.hr_group_id = requested_hr_group_id
    and candidate.administration_id = requested_administration_id
    and candidate.employee_id = entry_row.employee_id and candidate.employment_id = entry_row.employment_id
    and candidate.leave_type_id = leave_type_id and candidate.accrual_year = accrual_year
    and candidate.cohort_key = cohort
  for update;
  if bucket.id is null then raise exception using errcode = '23503', message = 'ACTUAL_WORK_TVT_BUCKET_NOT_CREATED'; end if;
  if bucket.expiration_date <> expiration_on then raise exception using errcode = '23514', message = 'ACTUAL_WORK_TVT_EXPIRATION_CONFLICT'; end if;

  select coalesce(sum(transaction.amount), 0)::numeric(12,4) into previous_amount
  from public.leave_accrual_transactions transaction
  where transaction.bucket_id = bucket.id and transaction.source_type = 'ACTUAL_WORK_TVT'
    and transaction.source_id = entry_row.id;
  delta_amount := entry_row.hours - previous_amount;
  if delta_amount = 0 then
    select transaction.id into transaction_id
    from public.leave_accrual_transactions transaction
    where transaction.bucket_id = bucket.id and transaction.source_type = 'ACTUAL_WORK_TVT'
      and transaction.source_id = entry_row.id
    order by transaction.created_at desc, transaction.id desc limit 1;
    return transaction_id;
  end if;

  if delta_amount < 0 and bucket.total_accrued + delta_amount < bucket.total_taken + bucket.total_expired then
    raise exception using errcode = '23514', message = 'ACTUAL_WORK_TVT_CORRECTION_BALANCE_IN_USE';
  end if;
  if delta_amount > 0 then
    update public.leave_balance_buckets
      set total_accrued = total_accrued + delta_amount, updated_at = timezone('utc', now())
    where id = bucket.id;
    insert into public.leave_accrual_transactions (
      tenant_id, hr_group_id, administration_id, employee_id, employment_id, leave_type_id,
      bucket_id, transaction_type, amount, reason, actor_user_id, source_type, source_id, source_key, transaction_date
    ) values (
      requested_tenant_id, requested_hr_group_id, requested_administration_id, entry_row.employee_id,
      entry_row.employment_id, leave_type_id, bucket.id, 'ACCRUAL', delta_amount,
      'TVT-opbouw uit geaccordeerde Actual Work-registratie', actor_id,
      'ACTUAL_WORK_TVT', entry_row.id, source_key, entry_row.subject_period_start
    ) on conflict (bucket_id, source_key) do nothing returning id into transaction_id;
  else
    update public.leave_balance_buckets
      set total_accrued = total_accrued + delta_amount, updated_at = timezone('utc', now())
    where id = bucket.id;
    insert into public.leave_accrual_transactions (
      tenant_id, hr_group_id, administration_id, employee_id, employment_id, leave_type_id,
      bucket_id, transaction_type, amount, reason, actor_user_id, source_type, source_id, source_key, transaction_date
    ) values (
      requested_tenant_id, requested_hr_group_id, requested_administration_id, entry_row.employee_id,
      entry_row.employment_id, leave_type_id, bucket.id, 'MANUAL_ADJUSTMENT', delta_amount,
      'Correctie TVT-opbouw na Actual Work-revisie', actor_id,
      'ACTUAL_WORK_TVT', entry_row.id, source_key, entry_row.subject_period_start
    ) on conflict (bucket_id, source_key) do nothing returning id into transaction_id;
  end if;

  if transaction_id is null then
    select transaction.id into transaction_id
    from public.leave_accrual_transactions transaction
    where transaction.bucket_id = bucket.id and transaction.source_key = source_key;
  end if;
  if transaction_id is null then raise exception using errcode = '40001', message = 'ACTUAL_WORK_TVT_IDEMPOTENCY_CONFLICT'; end if;
  return transaction_id;
end;
$$;

-- Approval and the corresponding TVT posting run in one transaction. If the
-- configured expiry or leave ledger rejects the accrual, the approval rolls
-- back as well and can be corrected without leaving an approved-but-unposted
-- TVT entry behind.
create or replace function public.approve_actual_work_entry_for_payroll(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_entry_id uuid
)
returns public.employment_work_hour_entries
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  entry_row public.employment_work_hour_entries%rowtype;
  saved_entry public.employment_work_hour_entries%rowtype;
  revision_number integer;
begin
  if actor_id is null
    or not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'salary:write')
    or not internal_security.current_user_has_audience_role(requested_tenant_id, array['HR_ADMIN', 'TENANT_ADMIN']) then
    raise exception using errcode = '42501', message = 'ACTUAL_WORK_PAYROLL_APPROVAL_NOT_AUTHORIZED';
  end if;

  select entry.* into entry_row
  from public.employment_work_hour_entries entry
  where entry.id = requested_entry_id
    and entry.tenant_id = requested_tenant_id
    and entry.hr_group_id = requested_hr_group_id
    and entry.administration_id = requested_administration_id
    and entry.status = 'PENDING'
  for update;
  if not found then raise exception using errcode = '23503', message = 'ACTUAL_WORK_PAYROLL_ENTRY_NOT_APPROVABLE'; end if;

  saved_entry := public.save_actual_work_entry(
    entry_row.id, entry_row.tenant_id, entry_row.hr_group_id, entry_row.administration_id,
    entry_row.employee_id, entry_row.employment_id, entry_row.work_hour_type_id,
    entry_row.entry_granularity, entry_row.subject_period_start, entry_row.subject_period_end,
    entry_row.posting_period_start, entry_row.hours, 'APPROVED'::public.leave_work_hour_entry_status,
    entry_row.note, 'EDIT'::public.actual_work_revision_operation, null
  );

  if exists (
    select 1 from public.leave_type_overtime_work_hours link
    join public.leave_types leave_type
      on leave_type.tenant_id = link.tenant_id and leave_type.hr_group_id = link.hr_group_id
      and leave_type.id = link.leave_type_id
    where link.tenant_id = requested_tenant_id and link.hr_group_id = requested_hr_group_id
      and link.work_hour_type_id = saved_entry.work_hour_type_id
      and (link.administration_id is null or link.administration_id = requested_administration_id)
      and leave_type.is_active and leave_type.entitlement_mode = 'OVERTIME_HOURS'
  ) then
    select max(revision.revision_number) into revision_number
    from public.actual_work_revisions revision where revision.entry_id = saved_entry.id;
    perform public.post_actual_work_tvt_for_revision(
      requested_tenant_id, requested_hr_group_id, requested_administration_id,
      saved_entry.id, revision_number
    );
  end if;

  return saved_entry;
end;
$$;

-- Once a TVT claim exists, corrections may change hours and notes, but cannot
-- move the claim to another employee, administration, work type, or accrual
-- year. Those changes need an explicit TVT ledger review to avoid stranded or
-- duplicate balances.
create or replace function public.guard_actual_work_tvt_reclassification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.leave_accrual_transactions transaction
    where transaction.source_type = 'ACTUAL_WORK_TVT'
      and transaction.source_id = old.id
  ) and (
    new.tenant_id is distinct from old.tenant_id
    or new.hr_group_id is distinct from old.hr_group_id
    or new.administration_id is distinct from old.administration_id
    or new.employee_id is distinct from old.employee_id
    or new.employment_id is distinct from old.employment_id
    or new.work_hour_type_id is distinct from old.work_hour_type_id
    or extract(year from new.subject_period_start) is distinct from extract(year from old.subject_period_start)
  ) then
    raise exception using errcode = '23514', message = 'ACTUAL_WORK_TVT_RECLASSIFICATION_REVIEW_REQUIRED';
  end if;
  return new;
end;
$$;

drop trigger if exists actual_work_tvt_reclassification_guard on public.employment_work_hour_entries;
create trigger actual_work_tvt_reclassification_guard
  before update on public.employment_work_hour_entries
  for each row execute function public.guard_actual_work_tvt_reclassification();

revoke all on function public.post_actual_work_tvt_for_revision(uuid, uuid, uuid, uuid, integer) from public, anon;
grant execute on function public.post_actual_work_tvt_for_revision(uuid, uuid, uuid, uuid, integer) to authenticated;
revoke all on function public.approve_actual_work_entry_for_payroll(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.approve_actual_work_entry_for_payroll(uuid, uuid, uuid, uuid) to authenticated;
revoke all on function public.guard_actual_work_tvt_reclassification() from public, anon, authenticated;

commit;
