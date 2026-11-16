-- Fix the cohort opening-balance RPC's PL/pgSQL variable/column ambiguity.
-- The function signature and business rules remain unchanged; only the local
-- calculated year variable is renamed so candidate.accrual_year is unambiguous.
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
  calculated_accrual_year smallint := extract(year from requested_start_date)::smallint;
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
  values (requested_tenant_id, requested_hr_group_id, null, calculated_accrual_year, 'ACTIVE')
  on conflict (tenant_id, hr_group_id, year) do nothing;
  if exists (
    select 1 from public.leave_year_controls control
    where control.tenant_id = requested_tenant_id
      and control.hr_group_id = requested_hr_group_id
      and control.year = calculated_accrual_year
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
    requested_employment_id, requested_leave_type_id, calculated_accrual_year, requested_start_date,
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
      and candidate.accrual_year = calculated_accrual_year
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

revoke all on function public.create_group_leave_opening_balance_cohort(
  uuid, uuid, uuid, uuid, uuid, numeric, date, text, text, smallint, date
) from public, anon;
grant execute on function public.create_group_leave_opening_balance_cohort(
  uuid, uuid, uuid, uuid, uuid, numeric, date, text, text, smallint, date
) to authenticated;
