begin;

-- A bucket can contain either the normal engine cohort for a calendar year or
-- an independently expiring migration cohort. Existing rows are retained and
-- receive deterministic metadata; no bucket or transaction is deleted.
alter table public.leave_balance_buckets
  add column if not exists cohort_key text;
alter table public.leave_balance_buckets
  add column if not exists source_accrual_year smallint;

update public.leave_balance_buckets bucket
set cohort_key = coalesce(
      bucket.cohort_key,
      (
        select 'MIGRATION:' || coalesce(nullif(btrim(transaction.source_key), ''), transaction.id::text)
        from public.leave_accrual_transactions transaction
        where transaction.bucket_id = bucket.id
          and transaction.source_type = 'MIGRATION_START_BALANCE'
          and transaction.transaction_type = 'OPENING_BALANCE'
        order by transaction.transaction_date, transaction.created_at, transaction.id
        limit 1
      ),
      'LEAVE_ACCRUAL:' || bucket.accrual_year::text
    ),
    source_accrual_year = coalesce(
      bucket.source_accrual_year,
      (
        select extract(year from transaction.transaction_date)::smallint
        from public.leave_accrual_transactions transaction
        where transaction.bucket_id = bucket.id
          and transaction.source_type = 'MIGRATION_START_BALANCE'
          and transaction.transaction_type = 'OPENING_BALANCE'
        order by transaction.transaction_date, transaction.created_at, transaction.id
        limit 1
      ),
      bucket.accrual_year
    )
where bucket.cohort_key is null
   or bucket.source_accrual_year is null;

alter table public.leave_balance_buckets
  alter column cohort_key set not null;
alter table public.leave_balance_buckets
  alter column source_accrual_year set not null;
alter table public.leave_balance_buckets
  add constraint leave_balance_buckets_cohort_key_valid
  check (length(btrim(cohort_key)) >= 1);
alter table public.leave_balance_buckets
  add constraint leave_balance_buckets_source_accrual_year_check
  check (source_accrual_year between 2000 and 2200);

-- The former one-bucket-per-year constraint made independently expiring
-- migration cohorts impossible. This is a constraint-only change: all
-- existing identity/foreign-key constraints remain in place.
alter table public.leave_balance_buckets
  drop constraint if exists leave_balance_buckets_tenant_id_administration_id_employmen_key;
alter table public.leave_balance_buckets
  add constraint leave_balance_buckets_employment_type_year_cohort_key
  unique (tenant_id, hr_group_id, employment_id, leave_type_id, accrual_year, cohort_key);

create index if not exists leave_balance_buckets_migration_cohort_idx
  on public.leave_balance_buckets (tenant_id, hr_group_id, employment_id, leave_type_id, source_accrual_year, expiration_date);

-- Keep the legacy administration-scoped entry valid for service-role and
-- historical callers after the cohort columns became mandatory.
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
  if requested_amount is null or requested_amount <= 0
     or requested_start_date is null
     or length(btrim(coalesce(requested_reason, ''))) = 0
     or length(btrim(coalesce(requested_source_key, ''))) < 8 then
    raise exception using errcode = '23514', message = 'LEAVE_OPENING_BALANCE_INPUT_INVALID';
  end if;
  select transaction.bucket_id into existing_bucket_id
  from public.leave_accrual_transactions transaction
  where transaction.tenant_id = requested_tenant_id
    and transaction.administration_id = requested_administration_id
    and transaction.source_type = 'MIGRATION_START_BALANCE'
    and transaction.source_key = requested_source_key
  limit 1;
  if existing_bucket_id is not null then return existing_bucket_id; end if;

  select * into employment_row
  from public.employments employment
  where employment.tenant_id = requested_tenant_id
    and employment.administration_id = requested_administration_id
    and employment.employee_id = requested_employee_id
    and employment.id = requested_employment_id
    and employment.record_status = 'CONFIRMED'
  for update;
  if employment_row.id is null then raise exception using errcode = '23503', message = 'LEAVE_EMPLOYMENT_NOT_FOUND'; end if;
  if requested_start_date < employment_row.starts_on or (employment_row.ends_on is not null and requested_start_date > employment_row.ends_on) then
    raise exception using errcode = '23514', message = 'LEAVE_EMPLOYMENT_DATE_INVALID';
  end if;
  select * into leave_type_row
  from public.leave_types type
  where type.tenant_id = requested_tenant_id
    and type.hr_group_id = employment_row.hr_group_id
    and type.id = requested_leave_type_id
    and type.is_active
    and type.entitlement_mode = 'ACCRUAL';
  if leave_type_row.id is null then raise exception using errcode = '23503', message = 'LEAVE_ACCRUAL_TYPE_NOT_FOUND'; end if;
  insert into public.leave_year_controls (tenant_id, hr_group_id, administration_id, year, status)
  values (requested_tenant_id, employment_row.hr_group_id, requested_administration_id, accrual_year, 'ACTIVE')
  on conflict (tenant_id, hr_group_id, year) do nothing;
  if exists (
    select 1 from public.leave_year_controls control
    where control.tenant_id = requested_tenant_id
      and control.hr_group_id = employment_row.hr_group_id
      and control.year = accrual_year
      and control.status = 'LOCKED'
  ) then
    raise exception using errcode = '55000', message = 'LEAVE_YEAR_LOCKED';
  end if;
  select coalesce(rule.expiration_months, 0) into rule_expiration_months
  from public.leave_accrual_rules rule
  where rule.tenant_id = requested_tenant_id
    and rule.hr_group_id = employment_row.hr_group_id
    and rule.leave_type_id = requested_leave_type_id
    and rule.valid_from <= requested_start_date
    and (rule.valid_until is null or rule.valid_until >= requested_start_date)
  order by rule.valid_from desc limit 1;
  expiration_date := (make_date(accrual_year::integer + 1, 1, 1) + make_interval(months => rule_expiration_months))::date;
  insert into public.leave_balance_buckets (
    tenant_id, hr_group_id, administration_id, employee_id, employment_id, leave_type_id,
    accrual_year, accrual_reference_date, source_accrual_year, total_accrued,
    expiration_date, cohort_key
  ) values (
    requested_tenant_id, employment_row.hr_group_id, requested_administration_id, requested_employee_id,
    requested_employment_id, requested_leave_type_id, accrual_year, requested_start_date, accrual_year,
    requested_amount, expiration_date, 'MIGRATION:' || requested_source_key
  ) returning id into bucket_id;
  insert into public.leave_accrual_transactions (
    tenant_id, hr_group_id, administration_id, employee_id, employment_id, leave_type_id, bucket_id,
    transaction_type, amount, reason, actor_user_id, source_type, source_key, transaction_date
  ) values (
    requested_tenant_id, employment_row.hr_group_id, requested_administration_id, requested_employee_id,
    requested_employment_id, requested_leave_type_id, bucket_id, 'OPENING_BALANCE', requested_amount,
    requested_reason, actor_id, 'MIGRATION_START_BALANCE', requested_source_key, requested_start_date
  );
  return bucket_id;
end;
$$;

-- New callers can preserve the source accrual year and exact expiration date.
-- requested_start_date remains the authoritative balance/cutover date.
create or replace function public.create_group_leave_opening_balance_cohort(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_leave_type_id uuid,
  requested_amount numeric,
  requested_start_date date,
  requested_reason text,
  requested_source_key text,
  requested_source_accrual_year smallint,
  requested_expiration_date date
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
  bucket public.leave_balance_buckets;
  accrual_year smallint := extract(year from requested_start_date)::smallint;
  expiration_date date;
begin
  if actor_id is null or not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'leave:adjust') then
    raise exception using errcode = '42501', message = 'LEAVE_ADJUST_PERMISSION_REQUIRED';
  end if;
  if requested_amount is null or requested_amount <= 0
     or requested_start_date is null
     or requested_source_accrual_year is null
     or requested_source_accrual_year < 2000
     or requested_source_accrual_year > 2200
     or length(btrim(coalesce(requested_reason, ''))) = 0
     or length(btrim(coalesce(requested_source_key, ''))) < 8 then
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
  if exists (
    select 1 from public.leave_year_controls control
    where control.tenant_id = requested_tenant_id
      and control.hr_group_id = requested_hr_group_id
      and control.year = accrual_year
      and control.status = 'LOCKED'
  ) then
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
  expiration_date := coalesce(
    requested_expiration_date,
    (make_date(requested_source_accrual_year::integer + 1, 1, 1) + make_interval(months => rule_expiration_months))::date
  );

  insert into public.leave_balance_buckets (
    tenant_id, hr_group_id, administration_id, employee_id, employment_id, leave_type_id,
    accrual_year, accrual_reference_date, source_accrual_year, total_accrued,
    expiration_date, cohort_key
  ) values (
    requested_tenant_id, requested_hr_group_id, employment_row.administration_id, requested_employee_id,
    requested_employment_id, requested_leave_type_id, accrual_year, requested_start_date,
    requested_source_accrual_year, requested_amount, expiration_date, 'MIGRATION:' || requested_source_key
  )
  on conflict (tenant_id, hr_group_id, employment_id, leave_type_id, accrual_year, cohort_key) do nothing
  returning * into bucket;

  if bucket.id is null then
    select * into bucket
    from public.leave_balance_buckets candidate
    where candidate.tenant_id = requested_tenant_id
      and candidate.hr_group_id = requested_hr_group_id
      and candidate.employee_id = requested_employee_id
      and candidate.employment_id = requested_employment_id
      and candidate.leave_type_id = requested_leave_type_id
      and candidate.accrual_year = accrual_year
      and candidate.cohort_key = 'MIGRATION:' || requested_source_key
    for update;
  end if;
  if bucket.id is null then raise exception using errcode = '23503', message = 'LEAVE_OPENING_BALANCE_BUCKET_NOT_FOUND'; end if;
  if bucket.expiration_date <> expiration_date then
    raise exception using errcode = '23514', message = 'LEAVE_MIGRATION_COHORT_CONFLICT';
  end if;

  insert into public.leave_accrual_transactions (
    tenant_id, hr_group_id, administration_id, employee_id, employment_id, leave_type_id, bucket_id,
    transaction_type, amount, reason, actor_user_id, source_type, source_key, transaction_date
  ) values (
    requested_tenant_id, requested_hr_group_id, bucket.administration_id, requested_employee_id,
    requested_employment_id, requested_leave_type_id, bucket.id, 'OPENING_BALANCE', requested_amount,
    requested_reason, actor_id, 'MIGRATION_START_BALANCE', requested_source_key, requested_start_date
  ) on conflict (bucket_id, source_key) do nothing;
  return bucket.id;
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
begin
  return public.create_group_leave_opening_balance_cohort(
    requested_tenant_id,
    requested_hr_group_id,
    requested_employee_id,
    requested_employment_id,
    requested_leave_type_id,
    requested_amount,
    requested_start_date,
    requested_reason,
    requested_source_key,
    extract(year from requested_start_date)::smallint,
    null
  );
end;
$$;

-- Automatic accrual owns a distinct cohort so it can coexist with imported
-- balances in the same cutover year.
create or replace function public.post_group_leave_accrual(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_leave_type_id uuid,
  requested_accrual_year smallint,
  requested_period_start date,
  requested_period_end date,
  requested_booking_date date,
  requested_expiration_date date,
  requested_amount numeric,
  requested_source_key text,
  requested_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, auth
as $$
declare
  actor_id uuid := auth.uid();
  employment_row public.employments;
  leave_type_row public.leave_types;
  bucket public.leave_balance_buckets;
  transaction_id uuid;
  available numeric;
  automatic_cohort_key text := 'LEAVE_ACCRUAL:' || requested_accrual_year::text;
begin
  if actor_id is null or not internal_security.current_user_has_hr_group_permission(
    requested_tenant_id, requested_hr_group_id, 'leave:adjust'
  ) then
    raise exception using errcode = '42501', message = 'LEAVE_ACCRUAL_POST_PERMISSION_REQUIRED';
  end if;

  if requested_amount is null or requested_amount = 0
     or requested_source_key is null
     or requested_period_start is null
     or requested_period_end is null
     or requested_booking_date is null
     or requested_expiration_date is null
     or length(btrim(requested_source_key)) < 16
     or requested_period_end <= requested_period_start
     or extract(year from requested_period_start)::smallint <> requested_accrual_year
     or requested_period_end > make_date(requested_accrual_year::integer + 1, 1, 1)
     or requested_booking_date < requested_period_start
     or requested_booking_date >= requested_period_end
     or requested_expiration_date < make_date(requested_accrual_year::integer + 1, 1, 1) then
    raise exception using errcode = '23514', message = 'LEAVE_ACCRUAL_POST_INPUT_INVALID';
  end if;

  select * into employment_row
  from public.employments employment
  where employment.tenant_id = requested_tenant_id
    and employment.hr_group_id = requested_hr_group_id
    and employment.employee_id = requested_employee_id
    and employment.id = requested_employment_id
    and employment.record_status = 'CONFIRMED'
    and employment.deleted_at is null
  for update;
  if employment_row.id is null then
    raise exception using errcode = '23503', message = 'LEAVE_EMPLOYMENT_NOT_FOUND';
  end if;

  select * into leave_type_row
  from public.leave_types type
  where type.tenant_id = requested_tenant_id
    and type.hr_group_id = requested_hr_group_id
    and type.id = requested_leave_type_id
    and type.is_active
    and type.entitlement_mode = 'ACCRUAL';
  if leave_type_row.id is null then
    raise exception using errcode = '23503', message = 'LEAVE_ACCRUAL_TYPE_NOT_FOUND';
  end if;

  insert into public.leave_year_controls (tenant_id, hr_group_id, administration_id, year, status)
  values (requested_tenant_id, requested_hr_group_id, null, requested_accrual_year, 'ACTIVE')
  on conflict (tenant_id, hr_group_id, year) do nothing;
  if exists (
    select 1 from public.leave_year_controls control
    where control.tenant_id = requested_tenant_id
      and control.hr_group_id = requested_hr_group_id
      and control.year = requested_accrual_year
      and control.status = 'LOCKED'
  ) then
    raise exception using errcode = '55000', message = 'LEAVE_YEAR_LOCKED';
  end if;

  select * into bucket
  from public.leave_balance_buckets candidate
  where candidate.tenant_id = requested_tenant_id
    and candidate.hr_group_id = requested_hr_group_id
    and candidate.employee_id = requested_employee_id
    and candidate.employment_id = requested_employment_id
    and candidate.leave_type_id = requested_leave_type_id
    and candidate.accrual_year = requested_accrual_year
    and candidate.cohort_key = automatic_cohort_key
  for update;

  if bucket.id is null then
    insert into public.leave_balance_buckets (
      tenant_id, hr_group_id, administration_id, employee_id, employment_id,
      leave_type_id, accrual_year, accrual_reference_date, source_accrual_year,
      expiration_date, cohort_key
    ) values (
      requested_tenant_id, requested_hr_group_id, employment_row.administration_id,
      requested_employee_id, requested_employment_id, requested_leave_type_id,
      requested_accrual_year, requested_period_start, requested_accrual_year,
      requested_expiration_date, automatic_cohort_key
    )
    on conflict (tenant_id, hr_group_id, employment_id, leave_type_id, accrual_year, cohort_key) do nothing;

    select * into bucket
    from public.leave_balance_buckets candidate
    where candidate.tenant_id = requested_tenant_id
      and candidate.hr_group_id = requested_hr_group_id
      and candidate.employee_id = requested_employee_id
      and candidate.employment_id = requested_employment_id
      and candidate.leave_type_id = requested_leave_type_id
      and candidate.accrual_year = requested_accrual_year
      and candidate.cohort_key = automatic_cohort_key
    for update;
  end if;

  if bucket.id is null then
    raise exception using errcode = '23503', message = 'LEAVE_ACCRUAL_BUCKET_NOT_FOUND';
  end if;
  if bucket.expiration_date <> requested_expiration_date then
    raise exception using errcode = '23514', message = 'LEAVE_ACCRUAL_EXPIRATION_CONFLICT';
  end if;

  available := bucket.total_accrued - bucket.total_taken - bucket.total_expired;
  if requested_amount < 0 and available + requested_amount < 0 then
    raise exception using errcode = '23514', message = 'LEAVE_INSUFFICIENT_BALANCE';
  end if;

  insert into public.leave_accrual_transactions (
    tenant_id, hr_group_id, administration_id, employee_id, employment_id,
    leave_type_id, bucket_id, transaction_type, amount, reason, actor_user_id,
    source_type, source_key, transaction_date
  ) values (
    requested_tenant_id, requested_hr_group_id, bucket.administration_id,
    requested_employee_id, requested_employment_id, requested_leave_type_id,
    bucket.id, 'ACCRUAL', requested_amount, nullif(btrim(requested_reason), ''),
    actor_id, 'LEAVE_ACCRUAL', requested_source_key, requested_booking_date
  )
  on conflict (bucket_id, source_key) do nothing
  returning id into transaction_id;

  if transaction_id is null then
    select transaction.id into transaction_id
    from public.leave_accrual_transactions transaction
    where transaction.bucket_id = bucket.id
      and transaction.source_key = requested_source_key;
    return transaction_id;
  end if;

  update public.leave_balance_buckets
  set total_accrued = total_accrued + requested_amount,
      updated_at = timezone('utc', now())
  where id = bucket.id;

  return transaction_id;
end;
$$;

-- Manual corrections remain a separate source and never establish a migration
-- boundary. Prefer the normal engine cohort when one exists; otherwise retain
-- the legacy behavior by selecting the only/oldest matching bucket.
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
  order by case when candidate.cohort_key = 'LEAVE_ACCRUAL:' || requested_accrual_year::text then 0 else 1 end,
            candidate.expiration_date, candidate.id
  limit 1
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
    requested_tenant_id, requested_hr_group_id, bucket.administration_id, requested_employee_id,
    requested_employment_id, requested_leave_type_id, bucket.id, 'MANUAL_ADJUSTMENT', requested_amount,
    requested_reason, actor_id, 'HR_MANUAL_ADJUSTMENT', requested_source_key, current_date
  ) returning id into transaction_id;
  return transaction_id;
end;
$$;

revoke all on function public.create_group_leave_opening_balance_cohort(
  uuid, uuid, uuid, uuid, uuid, numeric, date, text, text, smallint, date
) from public, anon;
grant execute on function public.create_group_leave_opening_balance_cohort(
  uuid, uuid, uuid, uuid, uuid, numeric, date, text, text, smallint, date
) to authenticated;

revoke all on function public.create_group_leave_opening_balance(
  uuid, uuid, uuid, uuid, uuid, numeric, date, text, text
) from public, anon;
grant execute on function public.create_group_leave_opening_balance(
  uuid, uuid, uuid, uuid, uuid, numeric, date, text, text
) to authenticated;

revoke all on function public.post_group_leave_accrual(
  uuid, uuid, uuid, uuid, uuid, smallint, date, date, date, date, numeric, text, text
) from public, anon;
grant execute on function public.post_group_leave_accrual(
  uuid, uuid, uuid, uuid, uuid, smallint, date, date, date, date, numeric, text, text
) to authenticated;

revoke all on function public.apply_group_leave_manual_adjustment(
  uuid, uuid, uuid, uuid, uuid, smallint, numeric, text, text
) from public, anon;
grant execute on function public.apply_group_leave_manual_adjustment(
  uuid, uuid, uuid, uuid, uuid, smallint, numeric, text, text
) to authenticated;

commit;
