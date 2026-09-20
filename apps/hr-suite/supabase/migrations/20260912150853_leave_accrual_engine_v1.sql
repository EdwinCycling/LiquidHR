begin;

-- The service supplies a deterministic preview delta. This RPC is the sole
-- write boundary for automatic accrual: bucket and immutable transaction are
-- committed together, and a repeated source key is a no-op.
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
begin
  if actor_id is null or not internal_security.current_user_has_hr_group_permission(
    requested_tenant_id, requested_hr_group_id, 'leave:adjust'
  ) then
    raise exception using errcode = '42501', message = 'LEAVE_ACCRUAL_POST_PERMISSION_REQUIRED';
  end if;

  if requested_amount is null or requested_amount = 0
     or requested_source_key is null
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
  for update;

  if bucket.id is null then
    insert into public.leave_balance_buckets (
      tenant_id, hr_group_id, administration_id, employee_id, employment_id,
      leave_type_id, accrual_year, accrual_reference_date, expiration_date
    ) values (
      requested_tenant_id, requested_hr_group_id, employment_row.administration_id,
      requested_employee_id, requested_employment_id, requested_leave_type_id,
      requested_accrual_year, requested_period_start, requested_expiration_date
    )
    on conflict (tenant_id, hr_group_id, employment_id, leave_type_id, accrual_year) do nothing;

    select * into bucket
    from public.leave_balance_buckets candidate
    where candidate.tenant_id = requested_tenant_id
      and candidate.hr_group_id = requested_hr_group_id
      and candidate.employee_id = requested_employee_id
      and candidate.employment_id = requested_employment_id
      and candidate.leave_type_id = requested_leave_type_id
      and candidate.accrual_year = requested_accrual_year
    for update;
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

revoke all on function public.post_group_leave_accrual(
  uuid, uuid, uuid, uuid, uuid, smallint, date, date, date, date, numeric, text, text
) from public, anon;
grant execute on function public.post_group_leave_accrual(
  uuid, uuid, uuid, uuid, uuid, smallint, date, date, date, date, numeric, text, text
) to authenticated;

commit;

