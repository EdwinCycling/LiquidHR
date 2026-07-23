-- Central append-only operations for opening balances, HR corrections,
-- expiry and year close. All mutations remain employment-scoped.

create or replace function internal_security.prevent_locked_leave_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Expiry is a system event and must still be able to settle a bucket after
  -- the source year has been locked. Human and accrual writes remain blocked.
  if new.transaction_type <> 'EXPIRED_DEDUCTION'
     and exists (
       select 1 from public.leave_year_controls control
       where control.tenant_id = new.tenant_id
         and control.administration_id = new.administration_id
         and control.year = extract(year from new.transaction_date)::smallint
         and control.status = 'LOCKED'
     ) then
    raise exception using errcode = '55000', message = 'LEAVE_TRANSACTION_YEAR_LOCKED';
  end if;
  return new;
end;
$$;

create or replace function public.create_leave_opening_balance(
  requested_tenant_id uuid,
  requested_administration_id uuid,
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
set search_path = public, pg_catalog
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
  if actor_id is null or not internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, 'leave:adjust') then
    raise exception using errcode = '42501', message = 'LEAVE_ADJUST_PERMISSION_REQUIRED';
  end if;
  if requested_amount is null or requested_amount <= 0 or length(btrim(coalesce(requested_reason, ''))) = 0 or length(btrim(coalesce(requested_source_key, ''))) < 8 then
    raise exception using errcode = '23514', message = 'LEAVE_OPENING_BALANCE_INPUT_INVALID';
  end if;
  if exists (
    select 1 from public.leave_accrual_transactions transaction
    where transaction.tenant_id = requested_tenant_id
      and transaction.administration_id = requested_administration_id
      and transaction.source_type = 'MIGRATION_START_BALANCE'
      and transaction.source_key = requested_source_key
  ) then
    select bucket_id into existing_bucket_id
    from public.leave_accrual_transactions transaction
    where transaction.tenant_id = requested_tenant_id
      and transaction.administration_id = requested_administration_id
      and transaction.source_type = 'MIGRATION_START_BALANCE'
      and transaction.source_key = requested_source_key
    limit 1;
    return existing_bucket_id;
  end if;
  select * into employment_row from public.employments employment
  where employment.tenant_id = requested_tenant_id and employment.administration_id = requested_administration_id
    and employment.employee_id = requested_employee_id and employment.id = requested_employment_id
    and employment.record_status = 'CONFIRMED' for update;
  if employment_row.id is null then raise exception using errcode = '23503', message = 'LEAVE_EMPLOYMENT_NOT_FOUND'; end if;
  if requested_start_date < employment_row.starts_on or (employment_row.ends_on is not null and requested_start_date > employment_row.ends_on) then
    raise exception using errcode = '23514', message = 'LEAVE_EMPLOYMENT_DATE_INVALID';
  end if;
  select * into leave_type_row from public.leave_types type
  where type.tenant_id = requested_tenant_id and type.administration_id = requested_administration_id
    and type.id = requested_leave_type_id and type.is_active and type.entitlement_mode = 'ACCRUAL';
  if leave_type_row.id is null then raise exception using errcode = '23503', message = 'LEAVE_ACCRUAL_TYPE_NOT_FOUND'; end if;
  insert into public.leave_year_controls (tenant_id, administration_id, year, status)
  values (requested_tenant_id, requested_administration_id, accrual_year, 'ACTIVE')
  on conflict (tenant_id, administration_id, year) do nothing;
  if exists (select 1 from public.leave_year_controls control where control.tenant_id = requested_tenant_id and control.administration_id = requested_administration_id and control.year = accrual_year and control.status = 'LOCKED') then
    raise exception using errcode = '55000', message = 'LEAVE_YEAR_LOCKED';
  end if;
  select coalesce(rule.expiration_months, 0) into rule_expiration_months
  from public.leave_accrual_rules rule
  where rule.tenant_id = requested_tenant_id and rule.administration_id = requested_administration_id
    and rule.leave_type_id = requested_leave_type_id and rule.valid_from <= requested_start_date
    and (rule.valid_until is null or rule.valid_until >= requested_start_date)
  order by rule.valid_from desc limit 1;
  expiration_date := (make_date(accrual_year::integer + 1, 1, 1) + make_interval(months => rule_expiration_months))::date;
  insert into public.leave_balance_buckets (
    tenant_id, administration_id, employee_id, employment_id, leave_type_id, accrual_year,
    accrual_reference_date, total_accrued, expiration_date
  ) values (
    requested_tenant_id, requested_administration_id, requested_employee_id, requested_employment_id, requested_leave_type_id,
    accrual_year, requested_start_date, requested_amount, expiration_date
  ) returning id into bucket_id;
  insert into public.leave_accrual_transactions (
    tenant_id, administration_id, employee_id, employment_id, leave_type_id, bucket_id,
    transaction_type, amount, reason, actor_user_id, source_type, source_key, transaction_date
  ) values (
    requested_tenant_id, requested_administration_id, requested_employee_id, requested_employment_id, requested_leave_type_id, bucket_id,
    'OPENING_BALANCE', requested_amount, requested_reason, actor_id, 'MIGRATION_START_BALANCE', requested_source_key, requested_start_date
  );
  return bucket_id;
end;
$$;

create or replace function public.apply_leave_manual_adjustment(
  requested_tenant_id uuid,
  requested_administration_id uuid,
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
set search_path = public, pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  bucket public.leave_balance_buckets;
  transaction_id uuid;
  available numeric;
begin
  if actor_id is null or not internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, 'leave:adjust') then
    raise exception using errcode = '42501', message = 'LEAVE_ADJUST_PERMISSION_REQUIRED';
  end if;
  if requested_amount is null or requested_amount = 0 or length(btrim(coalesce(requested_reason, ''))) = 0 or length(btrim(coalesce(requested_source_key, ''))) < 8 then
    raise exception using errcode = '23514', message = 'LEAVE_MANUAL_ADJUSTMENT_INPUT_INVALID';
  end if;
  select transaction.id into transaction_id from public.leave_accrual_transactions transaction
  where transaction.tenant_id = requested_tenant_id and transaction.administration_id = requested_administration_id
    and transaction.source_type = 'HR_MANUAL_ADJUSTMENT' and transaction.source_key = requested_source_key limit 1;
  if transaction_id is not null then return transaction_id; end if;
  select * into bucket from public.leave_balance_buckets candidate
  where candidate.tenant_id = requested_tenant_id and candidate.administration_id = requested_administration_id
    and candidate.employee_id = requested_employee_id and candidate.employment_id = requested_employment_id
    and candidate.leave_type_id = requested_leave_type_id and candidate.accrual_year = requested_accrual_year
  for update;
  if bucket.id is null then raise exception using errcode = '23503', message = 'LEAVE_BUCKET_NOT_FOUND'; end if;
  if exists (select 1 from public.leave_year_controls control where control.tenant_id = requested_tenant_id and control.administration_id = requested_administration_id and control.year = requested_accrual_year and control.status = 'LOCKED') then
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
    tenant_id, administration_id, employee_id, employment_id, leave_type_id, bucket_id,
    transaction_type, amount, reason, actor_user_id, source_type, source_key, transaction_date
  ) values (
    requested_tenant_id, requested_administration_id, requested_employee_id, requested_employment_id, requested_leave_type_id, bucket.id,
    'MANUAL_ADJUSTMENT', requested_amount, requested_reason, actor_id, 'HR_MANUAL_ADJUSTMENT', requested_source_key, current_date
  ) returning id into transaction_id;
  return transaction_id;
end;
$$;

create or replace function public.close_leave_year(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_year smallint
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  rollover_id uuid;
  control public.leave_year_controls;
  bucket public.leave_balance_buckets;
  remaining numeric;
begin
  if actor_id is null or not internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, 'leave:year-close') then
    raise exception using errcode = '42501', message = 'LEAVE_YEAR_CLOSE_PERMISSION_REQUIRED';
  end if;
  select * into control from public.leave_year_controls candidate
  where candidate.tenant_id = requested_tenant_id and candidate.administration_id = requested_administration_id and candidate.year = requested_year for update;
  if control.id is null then
    insert into public.leave_year_controls (tenant_id, administration_id, year, status)
    values (requested_tenant_id, requested_administration_id, requested_year, 'ACTIVE') returning * into control;
  end if;
  select id into rollover_id from public.leave_year_rollovers rollover
  where rollover.tenant_id = requested_tenant_id and rollover.administration_id = requested_administration_id and rollover.from_year = requested_year;
  if rollover_id is not null then return rollover_id; end if;
  insert into public.leave_year_rollovers (tenant_id, administration_id, from_year, to_year, completed_by)
  values (requested_tenant_id, requested_administration_id, requested_year, requested_year + 1, actor_id)
  returning id into rollover_id;
  for bucket in
    select * from public.leave_balance_buckets candidate
    where candidate.tenant_id = requested_tenant_id and candidate.administration_id = requested_administration_id and candidate.accrual_year = requested_year
    order by candidate.employment_id, candidate.leave_type_id, candidate.expiration_date
  loop
    remaining := bucket.total_accrued - bucket.total_taken - bucket.total_expired;
    if remaining > 0 then
      insert into public.leave_year_rollover_items (
        tenant_id, administration_id, rollover_id, employment_id, leave_type_id, source_bucket_id, carried_hours, original_expiration_date
      ) values (
        requested_tenant_id, requested_administration_id, rollover_id, bucket.employment_id, bucket.leave_type_id, bucket.id, remaining, bucket.expiration_date
      );
    end if;
  end loop;
  update public.leave_year_controls
  set status = 'LOCKED', locked_at = timezone('utc', now()), locked_by = actor_id, updated_at = timezone('utc', now())
  where id = control.id;
  insert into public.leave_year_controls (tenant_id, administration_id, year, status)
  values (requested_tenant_id, requested_administration_id, requested_year + 1, 'ACTIVE')
  on conflict (tenant_id, administration_id, year) do nothing;
  return rollover_id;
end;
$$;

create or replace function public.expire_leave_buckets(requested_as_of_date date)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  bucket public.leave_balance_buckets;
  remaining numeric;
  processed integer := 0;
begin
  for bucket in
    select * from public.leave_balance_buckets candidate
    where candidate.expiration_date <= requested_as_of_date
      and candidate.total_accrued > candidate.total_taken + candidate.total_expired
    order by candidate.expiration_date, candidate.id
    for update
  loop
    remaining := bucket.total_accrued - bucket.total_taken - bucket.total_expired;
    if remaining > 0 and not exists (
      select 1 from public.leave_accrual_transactions transaction
      where transaction.bucket_id = bucket.id and transaction.source_type = 'LEAVE_EXPIRY'
    ) then
      update public.leave_balance_buckets set total_expired = total_expired + remaining, updated_at = timezone('utc', now()) where id = bucket.id;
      insert into public.leave_accrual_transactions (
        tenant_id, administration_id, employee_id, employment_id, leave_type_id, bucket_id,
        transaction_type, amount, reason, source_type, source_key, transaction_date
      ) values (
        bucket.tenant_id, bucket.administration_id, bucket.employee_id, bucket.employment_id, bucket.leave_type_id, bucket.id,
        'EXPIRED_DEDUCTION', -remaining, 'Automatische vervaldatum', 'LEAVE_EXPIRY', 'EXPIRE:' || bucket.id::text, bucket.expiration_date
      );
      processed := processed + 1;
    end if;
  end loop;
  return processed;
end;
$$;

revoke all on function public.create_leave_opening_balance(uuid, uuid, uuid, uuid, uuid, numeric, date, text, text) from public, anon;
revoke all on function public.apply_leave_manual_adjustment(uuid, uuid, uuid, uuid, uuid, smallint, numeric, text, text) from public, anon;
revoke all on function public.close_leave_year(uuid, uuid, smallint) from public, anon;
revoke all on function public.expire_leave_buckets(date) from public, anon, authenticated;
grant execute on function public.create_leave_opening_balance(uuid, uuid, uuid, uuid, uuid, numeric, date, text, text) to authenticated;
grant execute on function public.apply_leave_manual_adjustment(uuid, uuid, uuid, uuid, uuid, smallint, numeric, text, text) to authenticated;
grant execute on function public.close_leave_year(uuid, uuid, smallint) to authenticated;
