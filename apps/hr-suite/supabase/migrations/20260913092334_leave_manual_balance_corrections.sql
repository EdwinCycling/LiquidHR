begin;

-- Keep the user id as the canonical audit identity and store the actor name as
-- an immutable display snapshot for readers without access to the actor row.
alter table public.leave_accrual_transactions
  add column if not exists actor_display_name text;

-- One implementation serves both the new explicit-date overload and the
-- legacy year-based wrapper. The year argument remains separate so old RPC
-- callers retain their original bucket-selection contract.
create or replace function internal_security.apply_group_leave_manual_adjustment_core(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_leave_type_id uuid,
  requested_accrual_year smallint,
  requested_amount numeric,
  requested_reason text,
  requested_source_key text,
  requested_effective_date date
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, auth
as $$
declare
  actor_id uuid := auth.uid();
  target_employment public.employments%rowtype;
  bucket public.leave_balance_buckets%rowtype;
  existing_transaction public.leave_accrual_transactions%rowtype;
  actor_display_name text;
  normalized_reason text := nullif(btrim(coalesce(requested_reason, '')), '');
  normalized_source_key text := btrim(coalesce(requested_source_key, ''));
  available numeric;
  transaction_id uuid;
begin
  if actor_id is null
     or not internal_security.current_user_has_hr_group_permission(
       requested_tenant_id,
       requested_hr_group_id,
       'leave:adjust'
     ) then
    raise exception using errcode = '42501', message = 'LEAVE_ADJUST_PERMISSION_REQUIRED';
  end if;

   if requested_accrual_year is null
      or requested_effective_date is null
      or requested_amount is null
      or requested_amount = 0
      or length(btrim(coalesce(requested_reason, ''))) not between 1 and 500
      or length(btrim(coalesce(requested_source_key, ''))) not between 8 and 160 then
    raise exception using errcode = '23514', message = 'LEAVE_MANUAL_ADJUSTMENT_INPUT_INVALID';
  end if;

  select employment.*
    into target_employment
  from public.employments employment
  where employment.tenant_id = requested_tenant_id
    and employment.hr_group_id = requested_hr_group_id
    and employment.id = requested_employment_id
    and employment.employee_id = requested_employee_id
    and employment.record_status = 'CONFIRMED'
    and employment.deleted_at is null;

  if not found then
    raise exception using errcode = '23503', message = 'LEAVE_EMPLOYMENT_NOT_FOUND';
  end if;

  if requested_effective_date < target_employment.starts_on
     or (target_employment.ends_on is not null and requested_effective_date > target_employment.ends_on) then
    raise exception using errcode = '23514', message = 'LEAVE_EMPLOYMENT_DATE_INVALID';
  end if;

  -- A replay of the same scoped correction is a no-op. A different source
  -- key remains available for a compensating append-only correction.
  select transaction.*
    into existing_transaction
  from public.leave_accrual_transactions transaction
  where transaction.tenant_id = requested_tenant_id
    and transaction.hr_group_id = requested_hr_group_id
    and transaction.employee_id = requested_employee_id
    and transaction.employment_id = requested_employment_id
    and transaction.leave_type_id = requested_leave_type_id
    and transaction.transaction_type = 'MANUAL_ADJUSTMENT'
    and transaction.source_type = 'HR_MANUAL_ADJUSTMENT'
    and transaction.source_key = normalized_source_key
  order by transaction.created_at, transaction.id
  limit 1;

  if found then
    return existing_transaction.id;
  end if;

  select candidate.*
    into bucket
  from public.leave_balance_buckets candidate
  where candidate.tenant_id = requested_tenant_id
    and candidate.hr_group_id = requested_hr_group_id
    and candidate.employee_id = requested_employee_id
    and candidate.employment_id = requested_employment_id
    and candidate.leave_type_id = requested_leave_type_id
    and candidate.accrual_year = requested_accrual_year
  order by case
             when candidate.cohort_key = 'LEAVE_ACCRUAL:' || requested_accrual_year::text then 0
             else 1
           end,
           candidate.expiration_date,
           candidate.id
  limit 1
  for update;

  if not found then
    raise exception using errcode = '23503', message = 'LEAVE_BUCKET_NOT_FOUND';
  end if;

  -- Locking the selected bucket serializes the check and the balance update.
  -- Re-check after the lock closes the duplicate-submit race.
  select transaction.*
    into existing_transaction
  from public.leave_accrual_transactions transaction
  where transaction.bucket_id = bucket.id
    and transaction.source_key = normalized_source_key
  order by transaction.created_at, transaction.id
  limit 1;

  if found then
    if existing_transaction.transaction_type = 'MANUAL_ADJUSTMENT'
       and existing_transaction.source_type = 'HR_MANUAL_ADJUSTMENT' then
      return existing_transaction.id;
    end if;
    raise exception using errcode = '23505', message = 'LEAVE_SOURCE_KEY_CONFLICT';
  end if;

  if exists (
    select 1
    from public.leave_year_controls control
    where control.tenant_id = requested_tenant_id
      and control.hr_group_id = requested_hr_group_id
      and control.year = requested_accrual_year
      and control.status = 'LOCKED'
  ) then
    raise exception using errcode = '55000', message = 'LEAVE_YEAR_LOCKED';
  end if;

  available := bucket.total_accrued - bucket.total_taken - bucket.total_expired;
  if requested_amount < 0 and available + requested_amount < 0 then
    raise exception using errcode = '23514', message = 'LEAVE_INSUFFICIENT_BALANCE';
  end if;

  select nullif(trim(concat_ws(' ', actor_employee.first_name, actor_employee.birth_name_prefix, actor_employee.birth_name)), '')
    into actor_display_name
  from public.employees actor_employee
  where actor_employee.tenant_id = requested_tenant_id
    and actor_employee.hr_group_id = requested_hr_group_id
    and actor_employee.auth_user_id = actor_id
    and actor_employee.deleted_at is null
  order by actor_employee.is_active desc, actor_employee.id
  limit 1;

  insert into public.leave_accrual_transactions (
    tenant_id,
    hr_group_id,
    administration_id,
    employee_id,
    employment_id,
    leave_type_id,
    bucket_id,
    transaction_type,
    amount,
    reason,
    actor_user_id,
    actor_display_name,
    source_type,
    source_key,
    transaction_date
  ) values (
    requested_tenant_id,
    requested_hr_group_id,
    bucket.administration_id,
    requested_employee_id,
    requested_employment_id,
    requested_leave_type_id,
    bucket.id,
    'MANUAL_ADJUSTMENT',
    requested_amount,
    normalized_reason,
    actor_id,
    actor_display_name,
     'HR_MANUAL_ADJUSTMENT',
     normalized_source_key,
     requested_effective_date
   )
   on conflict (bucket_id, source_key) do nothing
   returning id into transaction_id;

   if transaction_id is null then
     select transaction.*
       into existing_transaction
     from public.leave_accrual_transactions transaction
     where transaction.bucket_id = bucket.id
       and transaction.source_key = normalized_source_key
     order by transaction.created_at, transaction.id
     limit 1;

     if found
        and existing_transaction.transaction_type = 'MANUAL_ADJUSTMENT'
        and existing_transaction.source_type = 'HR_MANUAL_ADJUSTMENT' then
       return existing_transaction.id;
     end if;

     raise exception using errcode = '23505', message = 'LEAVE_SOURCE_KEY_CONFLICT';
   end if;

  -- Positive and negative corrections both change accrued entitlement. A
  -- negative correction is deliberately not a TAKEN transaction and never
  -- increments total_taken. This follows the insert so an ON CONFLICT replay
  -- cannot increment the bucket twice.
  update public.leave_balance_buckets
  set total_accrued = total_accrued + requested_amount,
      updated_at = timezone('utc', now())
  where id = bucket.id;

  return transaction_id;
end;
$$;

-- New callers use the date as the source of truth for the correction year.
create or replace function public.apply_group_leave_manual_adjustment(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_leave_type_id uuid,
  requested_effective_date date,
  requested_amount numeric,
  requested_reason text,
  requested_source_key text
)
returns uuid
language sql
security definer
set search_path = public, internal_security, auth
as $$
  select internal_security.apply_group_leave_manual_adjustment_core(
    requested_tenant_id,
    requested_hr_group_id,
    requested_employee_id,
    requested_employment_id,
    requested_leave_type_id,
    extract(year from requested_effective_date)::smallint,
    requested_amount,
    requested_reason,
    requested_source_key,
    requested_effective_date
  );
$$;

-- Preserve the existing RPC signature for older callers. Its historical
-- transaction date remains current_date while the requested year still picks
-- the corresponding bucket and lock state.
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
language sql
security definer
set search_path = public, internal_security, auth
as $$
  select internal_security.apply_group_leave_manual_adjustment_core(
    requested_tenant_id,
    requested_hr_group_id,
    requested_employee_id,
    requested_employment_id,
    requested_leave_type_id,
    requested_accrual_year,
    requested_amount,
    requested_reason,
    requested_source_key,
    current_date
  );
$$;

revoke all on function internal_security.apply_group_leave_manual_adjustment_core(
  uuid, uuid, uuid, uuid, uuid, smallint, numeric, text, text, date
) from public, anon, authenticated;

revoke all on function public.apply_group_leave_manual_adjustment(
  uuid, uuid, uuid, uuid, uuid, date, numeric, text, text
) from public, anon;
grant execute on function public.apply_group_leave_manual_adjustment(
  uuid, uuid, uuid, uuid, uuid, date, numeric, text, text
) to authenticated;

revoke all on function public.apply_group_leave_manual_adjustment(
  uuid, uuid, uuid, uuid, uuid, smallint, numeric, text, text
) from public, anon;
grant execute on function public.apply_group_leave_manual_adjustment(
  uuid, uuid, uuid, uuid, uuid, smallint, numeric, text, text
) to authenticated;

-- Direct managers may read only data attached to employees in their existing
-- employee:read management scope. Their old group-wide leave:read grant is
-- removed; HR roles retain the group-wide permission.
drop policy if exists leave_types_group_read on public.leave_types;
create policy leave_types_group_read
on public.leave_types for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'employee:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'self:leave:read'))
);

drop policy if exists leave_year_rollovers_group_read on public.leave_year_rollovers;
create policy leave_year_rollovers_group_read
on public.leave_year_rollovers for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'employee:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'self:leave:read'))
);

drop policy if exists leave_balance_buckets_group_read on public.leave_balance_buckets;
create policy leave_balance_buckets_group_read
on public.leave_balance_buckets for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:read'))
  or (select internal_security.can_manage_employee(employee_id, 'employee:read'))
  or (
    employee_id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
    and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'self:leave:read'))
  )
);

drop policy if exists leave_accrual_transactions_group_read on public.leave_accrual_transactions;
create policy leave_accrual_transactions_group_read
on public.leave_accrual_transactions for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:read'))
  or (select internal_security.can_manage_employee(employee_id, 'employee:read'))
  or (
    employee_id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
    and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'self:leave:read'))
  )
);

drop policy if exists leave_year_rollover_items_group_read on public.leave_year_rollover_items;
create policy leave_year_rollover_items_group_read
on public.leave_year_rollover_items for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:read'))
  or exists (
    select 1
    from public.employments employment
    where employment.tenant_id = leave_year_rollover_items.tenant_id
      and employment.hr_group_id = leave_year_rollover_items.hr_group_id
      and employment.id = leave_year_rollover_items.employment_id
      and (select internal_security.can_manage_employee(employment.employee_id, 'employee:read'))
  )
  or exists (
    select 1
    from public.employments employment
    where employment.tenant_id = leave_year_rollover_items.tenant_id
      and employment.hr_group_id = leave_year_rollover_items.hr_group_id
      and employment.id = leave_year_rollover_items.employment_id
      and employment.employee_id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
      and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'self:leave:read'))
  )
);

-- The global DIRECT_MANAGER role must not turn a scoped employee permission
-- into group-wide leave access.
delete from public.role_permissions role_permission
using public.management_roles role,
      public.permissions permission
where role_permission.management_role_id = role.id
  and role_permission.permission_id = permission.id
  and role.tenant_id is null
  and role.code = 'DIRECT_MANAGER'
  and permission.code = 'leave:read';

commit;

