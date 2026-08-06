begin;

-- Step 7 operations use the HR-group as the catalog scope. Employment and
-- administration identifiers are retained only as technical metadata on
-- employment-scoped ledger/request rows.

create unique index if not exists overtime_type_exceptions_group_type_employee_key
  on public.overtime_type_exceptions (tenant_id, hr_group_id, work_hour_type_id, employee_id);

create or replace function public.create_group_leave_accrual_rule(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_leave_profile_id uuid,
  requested_leave_type_id uuid,
  requested_predecessor_rule_id uuid,
  requested_valid_from date,
  requested_valid_until date,
  requested_accrual_basis public.leave_accrual_basis,
  requested_accrual_frequency public.leave_accrual_frequency,
  requested_accrual_timing public.leave_accrual_timing,
  requested_accrual_amount numeric,
  requested_accrual_rate numeric,
  requested_expiration_months smallint,
  requested_work_hour_type_ids uuid[],
  requested_pause_leave_type_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, auth
as $$
declare
  actor_id uuid := auth.uid();
  created_rule_id uuid;
  predecessor_row public.leave_accrual_rules;
  work_hour_type_id uuid;
  pause_leave_type_id uuid;
begin
  if actor_id is null or not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'leave:write') then
    raise exception using errcode = '42501', message = 'LEAVE_PERMISSION_REQUIRED';
  end if;
  if not exists (
    select 1 from public.leave_profiles profile
    where profile.tenant_id = requested_tenant_id
      and profile.hr_group_id = requested_hr_group_id
      and profile.id = requested_leave_profile_id
      and profile.is_active
  ) then
    raise exception using errcode = '23503', message = 'LEAVE_PROFILE_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.leave_types type
    where type.tenant_id = requested_tenant_id
      and type.hr_group_id = requested_hr_group_id
      and type.id = requested_leave_type_id
      and type.is_active
      and type.entitlement_mode = 'ACCRUAL'
  ) then
    raise exception using errcode = '23503', message = 'LEAVE_ACCRUAL_TYPE_NOT_FOUND';
  end if;
  if requested_predecessor_rule_id is not null then
    select * into predecessor_row
    from public.leave_accrual_rules rule
    where rule.tenant_id = requested_tenant_id
      and rule.hr_group_id = requested_hr_group_id
      and rule.id = requested_predecessor_rule_id
    for update;
    if predecessor_row.id is null then
      raise exception using errcode = '23503', message = 'LEAVE_PREDECESSOR_NOT_FOUND';
    end if;
    if predecessor_row.leave_profile_id <> requested_leave_profile_id or predecessor_row.leave_type_id <> requested_leave_type_id then
      raise exception using errcode = '23514', message = 'LEAVE_PREDECESSOR_SCOPE_MISMATCH';
    end if;
    if requested_valid_from <= predecessor_row.valid_from then
      raise exception using errcode = '23514', message = 'LEAVE_SUCCESSOR_DATE_INVALID';
    end if;
    if predecessor_row.valid_until is null or predecessor_row.valid_until > requested_valid_from then
      update public.leave_accrual_rules
      set valid_until = requested_valid_from
      where id = requested_predecessor_rule_id;
    elsif predecessor_row.valid_until <> requested_valid_from then
      raise exception using errcode = '23514', message = 'LEAVE_SUCCESSOR_DATE_NOT_CONTIGUOUS';
    end if;
  end if;
  if exists (
    select 1
    from unnest(coalesce(requested_work_hour_type_ids, array[]::uuid[])) type_id
    where not exists (
      select 1 from public.work_hour_types type
      where type.tenant_id = requested_tenant_id
        and type.hr_group_id = requested_hr_group_id
        and type.id = type_id
        and type.is_active
    )
  ) or exists (
    select 1
    from unnest(coalesce(requested_pause_leave_type_ids, array[]::uuid[])) type_id
    where not exists (
      select 1 from public.leave_types type
      where type.tenant_id = requested_tenant_id
        and type.hr_group_id = requested_hr_group_id
        and type.id = type_id
        and type.is_active
    )
  ) then
    raise exception using errcode = '23503', message = 'LEAVE_RULE_REFERENCE_NOT_FOUND';
  end if;

  insert into public.leave_accrual_rules (
    tenant_id, hr_group_id, administration_id, leave_profile_id, leave_type_id, predecessor_rule_id,
    valid_from, valid_until, accrual_basis, accrual_frequency, accrual_timing,
    accrual_amount, accrual_rate, expiration_months, created_by
  ) values (
    requested_tenant_id, requested_hr_group_id, null, requested_leave_profile_id, requested_leave_type_id,
    requested_predecessor_rule_id, requested_valid_from, requested_valid_until, requested_accrual_basis,
    requested_accrual_frequency, requested_accrual_timing,
    case when requested_accrual_basis = 'CONTRACT_HOURS' then requested_accrual_amount else null end,
    case when requested_accrual_basis = 'WORKED_HOURS' then requested_accrual_rate else null end,
    requested_expiration_months, actor_id
  ) returning id into created_rule_id;

  foreach work_hour_type_id in array coalesce(requested_work_hour_type_ids, array[]::uuid[]) loop
    insert into public.leave_accrual_rule_work_hour_types (tenant_id, hr_group_id, administration_id, accrual_rule_id, work_hour_type_id)
    values (requested_tenant_id, requested_hr_group_id, null, created_rule_id, work_hour_type_id);
  end loop;
  foreach pause_leave_type_id in array coalesce(requested_pause_leave_type_ids, array[]::uuid[]) loop
    insert into public.leave_accrual_rule_pause_types (tenant_id, hr_group_id, administration_id, accrual_rule_id, pause_leave_type_id)
    values (requested_tenant_id, requested_hr_group_id, null, created_rule_id, pause_leave_type_id);
  end loop;
  return created_rule_id;
end;
$$;

create or replace function public.create_group_leave_bonus_rule(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_leave_profile_id uuid,
  requested_leave_type_id uuid,
  requested_name text,
  requested_trigger_type public.leave_bonus_trigger_type,
  requested_award_timing public.leave_bonus_award_timing,
  requested_pro_rate_first_year boolean,
  requested_is_active boolean,
  requested_tiers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, auth
as $$
declare
  actor_id uuid := auth.uid();
  created_rule_id uuid;
  tier jsonb;
begin
  if actor_id is null or not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'leave:write') then
    raise exception using errcode = '42501', message = 'LEAVE_PERMISSION_REQUIRED';
  end if;
  if not exists (select 1 from public.leave_profiles profile where profile.tenant_id = requested_tenant_id and profile.hr_group_id = requested_hr_group_id and profile.id = requested_leave_profile_id and profile.is_active) then
    raise exception using errcode = '23503', message = 'LEAVE_PROFILE_NOT_FOUND';
  end if;
  if not exists (select 1 from public.leave_types type where type.tenant_id = requested_tenant_id and type.hr_group_id = requested_hr_group_id and type.id = requested_leave_type_id and type.is_active) then
    raise exception using errcode = '23503', message = 'LEAVE_TYPE_NOT_FOUND';
  end if;
  if jsonb_typeof(requested_tiers) <> 'array' or jsonb_array_length(requested_tiers) = 0 then
    raise exception using errcode = '23514', message = 'LEAVE_BONUS_RULE_REQUIRES_TIER';
  end if;
  insert into public.leave_bonus_rules (
    tenant_id, hr_group_id, administration_id, leave_profile_id, leave_type_id, name,
    trigger_type, award_timing, pro_rate_first_year, is_active, created_by
  ) values (
    requested_tenant_id, requested_hr_group_id, null, requested_leave_profile_id, requested_leave_type_id,
    requested_name, requested_trigger_type, requested_award_timing, requested_pro_rate_first_year,
    requested_is_active, actor_id
  ) returning id into created_rule_id;
  for tier in select value from jsonb_array_elements(requested_tiers) loop
    insert into public.leave_bonus_tiers (tenant_id, hr_group_id, administration_id, bonus_rule_id, threshold_years, bonus_amount)
    values (requested_tenant_id, requested_hr_group_id, null, created_rule_id, (tier->>'thresholdYears')::smallint, (tier->>'bonusAmount')::numeric);
  end loop;
  return created_rule_id;
end;
$$;

create or replace function public.create_group_leave_opening_balance(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_leave_type_id uuid,
  requested_amount numeric,
  requested_start_date date,
  requested_reason text,
  requested_source_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, auth
as $$
declare
  actor_id uuid := auth.uid();
  existing_bucket_id uuid;
  employment_row public.employments;
  leave_type_row public.leave_types;
  rule_expiration_months integer := 0;
  bucket_id uuid;
  accrual_year smallint := extract(year from requested_start_date)::smallint;
  expiration_date date;
begin
  if actor_id is null or not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'leave:adjust') then
    raise exception using errcode = '42501', message = 'LEAVE_ADJUST_PERMISSION_REQUIRED';
  end if;
  if requested_amount is null or requested_amount <= 0 or length(btrim(coalesce(requested_reason, ''))) = 0 or length(btrim(coalesce(requested_source_key, ''))) < 8 then
    raise exception using errcode = '23514', message = 'LEAVE_OPENING_BALANCE_INPUT_INVALID';
  end if;
  select transaction.bucket_id into existing_bucket_id
  from public.leave_accrual_transactions transaction
  where transaction.tenant_id = requested_tenant_id
    and transaction.hr_group_id = requested_hr_group_id
    and transaction.source_type = 'MIGRATION_START_BALANCE'
    and transaction.source_key = requested_source_key
  limit 1;
  if existing_bucket_id is not null then return existing_bucket_id; end if;

  select * into employment_row
  from public.employments employment
  where employment.tenant_id = requested_tenant_id
    and employment.hr_group_id = requested_hr_group_id
    and employment.employee_id = requested_employee_id
    and employment.id = requested_employment_id
    and employment.record_status = 'CONFIRMED'
    and employment.deleted_at is null
  for update;
  if employment_row.id is null then raise exception using errcode = '23503', message = 'LEAVE_EMPLOYMENT_NOT_FOUND'; end if;
  if requested_start_date < employment_row.starts_on or (employment_row.ends_on is not null and requested_start_date > employment_row.ends_on) then
    raise exception using errcode = '23514', message = 'LEAVE_EMPLOYMENT_DATE_INVALID';
  end if;
  select * into leave_type_row
  from public.leave_types type
  where type.tenant_id = requested_tenant_id
    and type.hr_group_id = requested_hr_group_id
    and type.id = requested_leave_type_id
    and type.is_active
    and type.entitlement_mode = 'ACCRUAL';
  if leave_type_row.id is null then raise exception using errcode = '23503', message = 'LEAVE_ACCRUAL_TYPE_NOT_FOUND'; end if;
  insert into public.leave_year_controls (tenant_id, hr_group_id, administration_id, year, status)
  values (requested_tenant_id, requested_hr_group_id, null, accrual_year, 'ACTIVE')
  on conflict (tenant_id, hr_group_id, year) do nothing;
  if exists (select 1 from public.leave_year_controls control where control.tenant_id = requested_tenant_id and control.hr_group_id = requested_hr_group_id and control.year = accrual_year and control.status = 'LOCKED') then
    raise exception using errcode = '55000', message = 'LEAVE_YEAR_LOCKED';
  end if;
  select coalesce(rule.expiration_months, 0) into rule_expiration_months
  from public.leave_accrual_rules rule
  where rule.tenant_id = requested_tenant_id
    and rule.hr_group_id = requested_hr_group_id
    and rule.leave_type_id = requested_leave_type_id
    and rule.valid_from <= requested_start_date
    and (rule.valid_until is null or rule.valid_until >= requested_start_date)
  order by rule.valid_from desc limit 1;
  expiration_date := (make_date(accrual_year::integer + 1, 1, 1) + make_interval(months => rule_expiration_months))::date;
  insert into public.leave_balance_buckets (
    tenant_id, hr_group_id, administration_id, employee_id, employment_id, leave_type_id, accrual_year,
    accrual_reference_date, total_accrued, expiration_date
  ) values (
    requested_tenant_id, requested_hr_group_id, employment_row.administration_id, requested_employee_id, requested_employment_id,
    requested_leave_type_id, accrual_year, requested_start_date, requested_amount, expiration_date
  ) returning id into bucket_id;
  insert into public.leave_accrual_transactions (
    tenant_id, hr_group_id, administration_id, employee_id, employment_id, leave_type_id, bucket_id,
    transaction_type, amount, reason, actor_user_id, source_type, source_key, transaction_date
  ) values (
    requested_tenant_id, requested_hr_group_id, employment_row.administration_id, requested_employee_id, requested_employment_id,
    requested_leave_type_id, bucket_id, 'OPENING_BALANCE', requested_amount, requested_reason, actor_id,
    'MIGRATION_START_BALANCE', requested_source_key, requested_start_date
  );
  return bucket_id;
end;
$$;

create or replace function public.apply_group_leave_manual_adjustment(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_leave_type_id uuid,
  requested_accrual_year smallint,
  requested_amount numeric,
  requested_reason text,
  requested_source_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, auth
as $$
declare
  actor_id uuid := auth.uid();
  bucket public.leave_balance_buckets;
  transaction_id uuid;
  available numeric;
begin
  if actor_id is null or not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'leave:adjust') then
    raise exception using errcode = '42501', message = 'LEAVE_ADJUST_PERMISSION_REQUIRED';
  end if;
  if requested_amount is null or requested_amount = 0 or length(btrim(coalesce(requested_reason, ''))) = 0 or length(btrim(coalesce(requested_source_key, ''))) < 8 then
    raise exception using errcode = '23514', message = 'LEAVE_MANUAL_ADJUSTMENT_INPUT_INVALID';
  end if;
  select transaction.id into transaction_id
  from public.leave_accrual_transactions transaction
  where transaction.tenant_id = requested_tenant_id
    and transaction.hr_group_id = requested_hr_group_id
    and transaction.source_type = 'HR_MANUAL_ADJUSTMENT'
    and transaction.source_key = requested_source_key
  limit 1;
  if transaction_id is not null then return transaction_id; end if;
  select * into bucket
  from public.leave_balance_buckets candidate
  where candidate.tenant_id = requested_tenant_id
    and candidate.hr_group_id = requested_hr_group_id
    and candidate.employee_id = requested_employee_id
    and candidate.employment_id = requested_employment_id
    and candidate.leave_type_id = requested_leave_type_id
    and candidate.accrual_year = requested_accrual_year
  for update;
  if bucket.id is null then raise exception using errcode = '23503', message = 'LEAVE_BUCKET_NOT_FOUND'; end if;
  if exists (select 1 from public.leave_year_controls control where control.tenant_id = requested_tenant_id and control.hr_group_id = requested_hr_group_id and control.year = requested_accrual_year and control.status = 'LOCKED') then
    raise exception using errcode = '55000', message = 'LEAVE_YEAR_LOCKED';
  end if;
  available := bucket.total_accrued - bucket.total_taken - bucket.total_expired;
  if requested_amount < 0 and available + requested_amount < 0 then raise exception using errcode = '23514', message = 'LEAVE_INSUFFICIENT_BALANCE'; end if;
  if requested_amount > 0 then
    update public.leave_balance_buckets set total_accrued = total_accrued + requested_amount, updated_at = timezone('utc', now()) where id = bucket.id;
  else
    update public.leave_balance_buckets set total_taken = total_taken + abs(requested_amount), updated_at = timezone('utc', now()) where id = bucket.id;
  end if;
  insert into public.leave_accrual_transactions (
    tenant_id, hr_group_id, administration_id, employee_id, employment_id, leave_type_id, bucket_id,
    transaction_type, amount, reason, actor_user_id, source_type, source_key, transaction_date
  ) values (
    requested_tenant_id, requested_hr_group_id, bucket.administration_id, requested_employee_id, requested_employment_id,
    requested_leave_type_id, bucket.id, 'MANUAL_ADJUSTMENT', requested_amount, requested_reason, actor_id,
    'HR_MANUAL_ADJUSTMENT', requested_source_key, current_date
  ) returning id into transaction_id;
  return transaction_id;
end;
$$;

create or replace function public.close_group_leave_year(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_year smallint
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, auth
as $$
declare
  actor_id uuid := auth.uid();
  rollover_id uuid;
  control public.leave_year_controls;
  bucket public.leave_balance_buckets;
  remaining numeric;
begin
  if actor_id is null or not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'leave:year-close') then
    raise exception using errcode = '42501', message = 'LEAVE_YEAR_CLOSE_PERMISSION_REQUIRED';
  end if;
  select * into control from public.leave_year_controls candidate
  where candidate.tenant_id = requested_tenant_id and candidate.hr_group_id = requested_hr_group_id and candidate.year = requested_year for update;
  if control.id is null then
    insert into public.leave_year_controls (tenant_id, hr_group_id, administration_id, year, status)
    values (requested_tenant_id, requested_hr_group_id, null, requested_year, 'ACTIVE') returning * into control;
  end if;
  select id into rollover_id from public.leave_year_rollovers rollover
  where rollover.tenant_id = requested_tenant_id and rollover.hr_group_id = requested_hr_group_id and rollover.from_year = requested_year;
  if rollover_id is not null then return rollover_id; end if;
  insert into public.leave_year_rollovers (tenant_id, hr_group_id, administration_id, from_year, to_year, completed_by)
  values (requested_tenant_id, requested_hr_group_id, null, requested_year, requested_year + 1, actor_id)
  returning id into rollover_id;
  for bucket in
    select * from public.leave_balance_buckets candidate
    where candidate.tenant_id = requested_tenant_id
      and candidate.hr_group_id = requested_hr_group_id
      and candidate.accrual_year = requested_year
    order by candidate.employment_id, candidate.leave_type_id, candidate.expiration_date
  loop
    remaining := bucket.total_accrued - bucket.total_taken - bucket.total_expired;
    if remaining > 0 then
      insert into public.leave_year_rollover_items (
        tenant_id, hr_group_id, administration_id, rollover_id, employment_id, leave_type_id, source_bucket_id, carried_hours, original_expiration_date
      ) values (
        requested_tenant_id, requested_hr_group_id, bucket.administration_id, rollover_id, bucket.employment_id, bucket.leave_type_id,
        bucket.id, remaining, bucket.expiration_date
      );
    end if;
  end loop;
  update public.leave_year_controls
  set status = 'LOCKED', locked_at = timezone('utc', now()), locked_by = actor_id, updated_at = timezone('utc', now())
  where id = control.id;
  insert into public.leave_year_controls (tenant_id, hr_group_id, administration_id, year, status)
  values (requested_tenant_id, requested_hr_group_id, null, requested_year + 1, 'ACTIVE')
  on conflict (tenant_id, hr_group_id, year) do nothing;
  return rollover_id;
end;
$$;

create or replace function public.confirm_group_leave_request(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_mode public.leave_request_mode,
  requested_priority_rule_id uuid,
  requested_leave_type_id uuid,
  requested_start_date date,
  requested_end_date date,
  requested_time_mode public.leave_request_time_mode,
  requested_specific_start time,
  requested_specific_end time,
  requested_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, auth
as $$
declare
  actor_id uuid := auth.uid();
  existing_request_id uuid;
  request_id uuid;
  employment_row public.employments;
  schedule_row public.employment_schedules;
  leave_type_row public.leave_types;
  bucket_row public.leave_balance_buckets;
  selected_day date;
  day_hours numeric := 0;
  planned_minutes integer := 0;
  total_minutes integer := 0;
  half_day_minutes integer := 240;
  requested_hours numeric := 0;
  remaining_hours numeric := 0;
  available_hours numeric := 0;
  allocated_hours numeric := 0;
  used_hours numeric := 0;
  annual_limit numeric;
  allocation_order smallint := 0;
  type_id uuid;
  type_ids uuid[];
begin
  if actor_id is null then raise exception using errcode = '42501', message = 'LEAVE_AUTHENTICATION_REQUIRED'; end if;
  if not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'leave:request') then
    raise exception using errcode = '42501', message = 'LEAVE_REQUEST_PERMISSION_REQUIRED';
  end if;
  if requested_idempotency_key is null or length(btrim(requested_idempotency_key)) < 8 then raise exception using errcode = '23514', message = 'LEAVE_IDEMPOTENCY_KEY_REQUIRED'; end if;
  select id into existing_request_id from public.leave_requests request
  where request.tenant_id = requested_tenant_id and request.hr_group_id = requested_hr_group_id and request.idempotency_key = requested_idempotency_key;
  if existing_request_id is not null then return existing_request_id; end if;

  select * into employment_row from public.employments employment
  where employment.tenant_id = requested_tenant_id and employment.hr_group_id = requested_hr_group_id
    and employment.employee_id = requested_employee_id and employment.id = requested_employment_id
    and employment.record_status = 'CONFIRMED' and employment.deleted_at is null
  for update;
  if employment_row.id is null then raise exception using errcode = '23503', message = 'LEAVE_EMPLOYMENT_NOT_FOUND'; end if;
  if requested_start_date < employment_row.starts_on
     or (employment_row.ends_on is not null and requested_start_date > employment_row.ends_on)
     or requested_end_date < requested_start_date
     or (employment_row.ends_on is not null and requested_end_date > employment_row.ends_on) then
    raise exception using errcode = '23514', message = 'LEAVE_EMPLOYMENT_DATE_INVALID';
  end if;
  if requested_time_mode = 'SPECIFIC_HOURS' and (requested_start_date <> requested_end_date or requested_specific_start is null or requested_specific_end is null or requested_specific_end <= requested_specific_start) then
    raise exception using errcode = '23514', message = 'LEAVE_TIME_SELECTION_INVALID';
  end if;
  select coalesce(settings.half_day_minutes, 240) into half_day_minutes
  from public.leave_settings settings
  where settings.tenant_id = requested_tenant_id and settings.hr_group_id = requested_hr_group_id;
  half_day_minutes := coalesce(half_day_minutes, 240);
  for selected_day in select generate_series(requested_start_date, requested_end_date, interval '1 day')::date loop
    select * into schedule_row from public.employment_schedules schedule
    where schedule.tenant_id = requested_tenant_id and schedule.administration_id = employment_row.administration_id
      and schedule.employee_id = requested_employee_id and schedule.employment_id = requested_employment_id
      and schedule.valid_from <= selected_day and (schedule.valid_until is null or schedule.valid_until >= selected_day)
    order by schedule.valid_from desc limit 1;
    day_hours := case extract(isodow from selected_day)::integer
      when 1 then coalesce(schedule_row.monday_hours, 0) when 2 then coalesce(schedule_row.tuesday_hours, 0)
      when 3 then coalesce(schedule_row.wednesday_hours, 0) when 4 then coalesce(schedule_row.thursday_hours, 0)
      when 5 then coalesce(schedule_row.friday_hours, 0) when 6 then coalesce(schedule_row.saturday_hours, 0)
      when 7 then coalesce(schedule_row.sunday_hours, 0) else 0 end;
    planned_minutes := planned_minutes + round(day_hours * 60)::integer;
    if requested_time_mode = 'FULL_DAY' then total_minutes := total_minutes + round(day_hours * 60)::integer;
    elsif requested_time_mode in ('MORNING', 'AFTERNOON') then total_minutes := total_minutes + least(half_day_minutes, round(day_hours * 60)::integer);
    else total_minutes := round(extract(epoch from (requested_specific_end - requested_specific_start)) / 60)::integer;
    end if;
  end loop;
  if total_minutes <= 0 then raise exception using errcode = '23514', message = 'LEAVE_NO_SCHEDULED_TIME'; end if;
  requested_hours := round((total_minutes::numeric / 60)::numeric, 4);

  if requested_mode = 'PRIORITY' then
    if requested_priority_rule_id is null or not exists (
      select 1 from public.leave_priority_rules rule
      where rule.id = requested_priority_rule_id and rule.tenant_id = requested_tenant_id and rule.hr_group_id = requested_hr_group_id
        and rule.is_active and rule.valid_from <= requested_start_date and (rule.valid_until is null or rule.valid_until >= requested_start_date)
    ) then raise exception using errcode = '23503', message = 'LEAVE_PRIORITY_RULE_NOT_FOUND'; end if;
    select array_agg(item.leave_type_id order by item.sort_order) into type_ids
    from public.leave_priority_rule_items item
    where item.tenant_id = requested_tenant_id and item.hr_group_id = requested_hr_group_id and item.priority_rule_id = requested_priority_rule_id;
    if type_ids is null or cardinality(type_ids) = 0 then raise exception using errcode = '23514', message = 'LEAVE_PRIORITY_RULE_EMPTY'; end if;
  else
    if requested_leave_type_id is null then raise exception using errcode = '23514', message = 'LEAVE_TYPE_REQUIRED'; end if;
    type_ids := array[requested_leave_type_id];
  end if;

  insert into public.leave_requests (
    tenant_id, hr_group_id, administration_id, employee_id, employment_id, request_mode,
    priority_rule_id, leave_type_id, start_date, end_date, time_mode, specific_start, specific_end,
    requested_minutes, actor_user_id, idempotency_key
  ) values (
    requested_tenant_id, requested_hr_group_id, employment_row.administration_id, requested_employee_id, requested_employment_id,
    requested_mode, requested_priority_rule_id, requested_leave_type_id, requested_start_date, requested_end_date,
    requested_time_mode, requested_specific_start, requested_specific_end, total_minutes, actor_id, requested_idempotency_key
  ) returning id into request_id;

  remaining_hours := requested_hours;
  foreach type_id in array type_ids loop
    select * into leave_type_row from public.leave_types type
    where type.id = type_id and type.tenant_id = requested_tenant_id and type.hr_group_id = requested_hr_group_id and type.is_active;
    if leave_type_row.id is null then raise exception using errcode = '23503', message = 'LEAVE_TYPE_NOT_FOUND'; end if;
    if leave_type_row.entitlement_mode in ('ANNUAL_HOURS_CAP', 'WEEKLY_HOURS_FACTOR_CAP') then
      annual_limit := case when leave_type_row.entitlement_mode = 'ANNUAL_HOURS_CAP' then leave_type_row.annual_hours_cap else null end;
      if annual_limit is not null then
        select coalesce(sum(abs(transaction.amount)), 0) into used_hours
        from public.leave_accrual_transactions transaction
        where transaction.tenant_id = requested_tenant_id and transaction.hr_group_id = requested_hr_group_id
          and transaction.employment_id = requested_employment_id and transaction.leave_type_id = type_id
          and transaction.transaction_type = 'TAKEN'
          and transaction.transaction_date between make_date(extract(year from requested_start_date)::integer, 1, 1) and make_date(extract(year from requested_start_date)::integer, 12, 31);
        if used_hours + remaining_hours > annual_limit then raise exception using errcode = '23514', message = 'LEAVE_ANNUAL_LIMIT_EXCEEDED'; end if;
      end if;
    end if;
    if leave_type_row.entitlement_mode = 'UNLIMITED' then
      allocation_order := allocation_order + 1;
      insert into public.leave_request_allocations (tenant_id, hr_group_id, administration_id, request_id, employee_id, employment_id, leave_type_id, bucket_id, allocated_hours, sort_order)
      values (requested_tenant_id, requested_hr_group_id, employment_row.administration_id, request_id, requested_employee_id, requested_employment_id, type_id, null, remaining_hours, allocation_order);
      remaining_hours := 0;
      exit;
    end if;
    for bucket_row in
      select * from public.leave_balance_buckets bucket
      where bucket.tenant_id = requested_tenant_id and bucket.hr_group_id = requested_hr_group_id
        and bucket.employee_id = requested_employee_id and bucket.employment_id = requested_employment_id and bucket.leave_type_id = type_id
        and bucket.expiration_date > requested_start_date and bucket.total_accrued > bucket.total_taken + bucket.total_expired
      order by bucket.expiration_date, bucket.accrual_year, bucket.id for update
    loop
      available_hours := bucket_row.total_accrued - bucket_row.total_taken - bucket_row.total_expired;
      allocated_hours := least(remaining_hours, available_hours);
      if allocated_hours > 0 then
        allocation_order := allocation_order + 1;
        insert into public.leave_request_allocations (tenant_id, hr_group_id, administration_id, request_id, employee_id, employment_id, leave_type_id, bucket_id, allocated_hours, sort_order)
        values (requested_tenant_id, requested_hr_group_id, bucket_row.administration_id, request_id, requested_employee_id, requested_employment_id, type_id, bucket_row.id, allocated_hours, allocation_order);
        update public.leave_balance_buckets set total_taken = total_taken + allocated_hours, updated_at = timezone('utc', now()) where id = bucket_row.id;
        insert into public.leave_accrual_transactions (tenant_id, hr_group_id, administration_id, employee_id, employment_id, leave_type_id, bucket_id, transaction_type, amount, reason, actor_user_id, source_type, source_id, source_key, transaction_date)
        values (requested_tenant_id, requested_hr_group_id, bucket_row.administration_id, requested_employee_id, requested_employment_id, type_id, bucket_row.id, 'TAKEN', -allocated_hours, 'HR-admin verlofaanvraag', actor_id, 'HR_ADMIN_CALENDAR', request_id, request_id::text || ':' || bucket_row.id::text, requested_start_date);
        remaining_hours := remaining_hours - allocated_hours;
      end if;
      exit when remaining_hours <= 0;
    end loop;
    exit when remaining_hours <= 0;
  end loop;
  if remaining_hours > 0 then raise exception using errcode = '23514', message = 'LEAVE_INSUFFICIENT_BALANCE'; end if;
  return request_id;
end;
$$;

revoke all on function public.create_leave_accrual_rule(uuid, uuid, uuid, uuid, uuid, date, date, public.leave_accrual_basis, public.leave_accrual_frequency, public.leave_accrual_timing, numeric, numeric, smallint, uuid[], uuid[]) from authenticated;
revoke all on function public.create_leave_bonus_rule(uuid, uuid, uuid, uuid, text, public.leave_bonus_trigger_type, public.leave_bonus_award_timing, boolean, boolean, jsonb) from authenticated;
revoke all on function public.create_leave_opening_balance(uuid, uuid, uuid, uuid, uuid, numeric, date, text, text) from authenticated;
revoke all on function public.apply_leave_manual_adjustment(uuid, uuid, uuid, uuid, uuid, smallint, numeric, text, text) from authenticated;
revoke all on function public.close_leave_year(uuid, uuid, smallint) from authenticated;
revoke all on function public.confirm_leave_request(uuid, uuid, uuid, uuid, public.leave_request_mode, uuid, uuid, date, date, public.leave_request_time_mode, time, time, text) from authenticated;

revoke all on function public.create_group_leave_accrual_rule(uuid, uuid, uuid, uuid, uuid, date, date, public.leave_accrual_basis, public.leave_accrual_frequency, public.leave_accrual_timing, numeric, numeric, smallint, uuid[], uuid[]) from public, anon;
revoke all on function public.create_group_leave_bonus_rule(uuid, uuid, uuid, uuid, text, public.leave_bonus_trigger_type, public.leave_bonus_award_timing, boolean, boolean, jsonb) from public, anon;
revoke all on function public.create_group_leave_opening_balance(uuid, uuid, uuid, uuid, uuid, numeric, date, text, text) from public, anon;
revoke all on function public.apply_group_leave_manual_adjustment(uuid, uuid, uuid, uuid, uuid, smallint, numeric, text, text) from public, anon;
revoke all on function public.close_group_leave_year(uuid, uuid, smallint) from public, anon;
revoke all on function public.confirm_group_leave_request(uuid, uuid, uuid, uuid, public.leave_request_mode, uuid, uuid, date, date, public.leave_request_time_mode, time, time, text) from public, anon;
grant execute on function public.create_group_leave_accrual_rule(uuid, uuid, uuid, uuid, uuid, date, date, public.leave_accrual_basis, public.leave_accrual_frequency, public.leave_accrual_timing, numeric, numeric, smallint, uuid[], uuid[]) to authenticated;
grant execute on function public.create_group_leave_bonus_rule(uuid, uuid, uuid, uuid, text, public.leave_bonus_trigger_type, public.leave_bonus_award_timing, boolean, boolean, jsonb) to authenticated;
grant execute on function public.create_group_leave_opening_balance(uuid, uuid, uuid, uuid, uuid, numeric, date, text, text) to authenticated;
grant execute on function public.apply_group_leave_manual_adjustment(uuid, uuid, uuid, uuid, uuid, smallint, numeric, text, text) to authenticated;
grant execute on function public.close_group_leave_year(uuid, uuid, smallint) to authenticated;
grant execute on function public.confirm_group_leave_request(uuid, uuid, uuid, uuid, public.leave_request_mode, uuid, uuid, date, date, public.leave_request_time_mode, time, time, text) to authenticated;

commit;
