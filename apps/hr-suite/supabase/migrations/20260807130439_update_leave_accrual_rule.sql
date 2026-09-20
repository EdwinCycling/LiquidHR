begin;

create or replace function public.update_group_leave_accrual_rule(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_rule_id uuid,
  requested_leave_profile_id uuid,
  requested_leave_type_id uuid,
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
  rule_row public.leave_accrual_rules;
  work_hour_type_id uuid;
  pause_leave_type_id uuid;
begin
  if actor_id is null or not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'leave:write') then
    raise exception using errcode = '42501', message = 'LEAVE_PERMISSION_REQUIRED';
  end if;

  select * into rule_row
  from public.leave_accrual_rules rule
  where rule.tenant_id = requested_tenant_id
    and rule.hr_group_id = requested_hr_group_id
    and rule.id = requested_rule_id
  for update;

  if rule_row.id is null then
    raise exception using errcode = '23503', message = 'LEAVE_RULE_NOT_FOUND';
  end if;
  if rule_row.leave_profile_id <> requested_leave_profile_id or rule_row.leave_type_id <> requested_leave_type_id then
    raise exception using errcode = '23514', message = 'LEAVE_RULE_SCOPE_MISMATCH';
  end if;
  if not exists (
    select 1
    from public.leave_types type
    where type.tenant_id = requested_tenant_id
      and type.hr_group_id = requested_hr_group_id
      and type.id = requested_leave_type_id
      and type.is_active
      and type.entitlement_mode = 'ACCRUAL'
  ) then
    raise exception using errcode = '23503', message = 'LEAVE_ACCRUAL_TYPE_NOT_FOUND';
  end if;
  if requested_expiration_months is null or requested_expiration_months < 0 or requested_expiration_months > 120 then
    raise exception using errcode = '23514', message = 'LEAVE_EXPIRATION_MONTHS_INVALID';
  end if;
  if requested_accrual_basis not in ('CONTRACT_HOURS', 'WORKED_HOURS') then
    raise exception using errcode = '23514', message = 'LEAVE_RULE_BASIS_NOT_ALLOWED';
  end if;
  if requested_accrual_basis = 'CONTRACT_HOURS' and (requested_accrual_amount is null or requested_accrual_amount < 0 or requested_accrual_rate is not null) then
    raise exception using errcode = '23514', message = 'LEAVE_ACCRUAL_AMOUNT_INVALID';
  end if;
  if requested_accrual_basis = 'WORKED_HOURS' and (requested_accrual_rate is null or requested_accrual_rate < 0 or requested_accrual_amount is not null) then
    raise exception using errcode = '23514', message = 'LEAVE_ACCRUAL_RATE_INVALID';
  end if;
  if requested_accrual_basis = 'WORKED_HOURS' and cardinality(coalesce(requested_work_hour_type_ids, array[]::uuid[])) = 0 then
    raise exception using errcode = '23514', message = 'LEAVE_WORK_HOUR_TYPE_REQUIRED';
  end if;
  if requested_accrual_basis = 'CONTRACT_HOURS' and cardinality(coalesce(requested_work_hour_type_ids, array[]::uuid[])) > 0 then
    raise exception using errcode = '23514', message = 'LEAVE_WORK_HOUR_TYPES_NOT_ALLOWED';
  end if;
  if exists (
    select 1
    from unnest(coalesce(requested_work_hour_type_ids, array[]::uuid[])) type_id
    where not exists (
      select 1
      from public.work_hour_types type
      where type.tenant_id = requested_tenant_id
        and type.hr_group_id = requested_hr_group_id
        and type.id = type_id
        and type.is_active
        and type.category <> 'INFORMATIONAL'
    )
  ) or exists (
    select 1
    from unnest(coalesce(requested_pause_leave_type_ids, array[]::uuid[])) type_id
    where not exists (
      select 1
      from public.leave_types type
      where type.tenant_id = requested_tenant_id
        and type.hr_group_id = requested_hr_group_id
        and type.id = type_id
        and type.is_active
        and type.id <> requested_leave_type_id
    )
  ) then
    raise exception using errcode = '23503', message = 'LEAVE_RULE_REFERENCE_NOT_FOUND';
  end if;

  update public.leave_accrual_rules
  set accrual_basis = requested_accrual_basis,
      accrual_frequency = requested_accrual_frequency,
      accrual_timing = requested_accrual_timing,
      accrual_amount = case when requested_accrual_basis = 'CONTRACT_HOURS' then requested_accrual_amount else null end,
      accrual_rate = case when requested_accrual_basis = 'WORKED_HOURS' then requested_accrual_rate else null end,
      expiration_months = requested_expiration_months,
      updated_at = timezone('utc', now())
  where tenant_id = requested_tenant_id
    and hr_group_id = requested_hr_group_id
    and id = requested_rule_id;

  delete from public.leave_accrual_rule_work_hour_types
  where tenant_id = requested_tenant_id
    and hr_group_id = requested_hr_group_id
    and accrual_rule_id = requested_rule_id;
  foreach work_hour_type_id in array coalesce(requested_work_hour_type_ids, array[]::uuid[]) loop
    insert into public.leave_accrual_rule_work_hour_types (tenant_id, hr_group_id, administration_id, accrual_rule_id, work_hour_type_id)
    values (requested_tenant_id, requested_hr_group_id, null, requested_rule_id, work_hour_type_id);
  end loop;

  delete from public.leave_accrual_rule_pause_types
  where tenant_id = requested_tenant_id
    and hr_group_id = requested_hr_group_id
    and accrual_rule_id = requested_rule_id;
  foreach pause_leave_type_id in array coalesce(requested_pause_leave_type_ids, array[]::uuid[]) loop
    insert into public.leave_accrual_rule_pause_types (tenant_id, hr_group_id, administration_id, accrual_rule_id, pause_leave_type_id)
    values (requested_tenant_id, requested_hr_group_id, null, requested_rule_id, pause_leave_type_id);
  end loop;

  return requested_rule_id;
end;
$$;

revoke all on function public.update_group_leave_accrual_rule(uuid, uuid, uuid, uuid, uuid, public.leave_accrual_basis, public.leave_accrual_frequency, public.leave_accrual_timing, numeric, numeric, smallint, uuid[], uuid[]) from public, anon;
grant execute on function public.update_group_leave_accrual_rule(uuid, uuid, uuid, uuid, uuid, public.leave_accrual_basis, public.leave_accrual_frequency, public.leave_accrual_timing, numeric, numeric, smallint, uuid[], uuid[]) to authenticated;

commit;
