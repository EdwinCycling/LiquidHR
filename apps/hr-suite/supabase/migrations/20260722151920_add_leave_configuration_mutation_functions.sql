create or replace function public.create_leave_accrual_rule(
  requested_tenant_id uuid,
  requested_administration_id uuid,
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
security invoker
set search_path = public, pg_catalog
as $$
declare
  created_rule_id uuid;
  predecessor_profile_id uuid;
  predecessor_type_id uuid;
  predecessor_valid_until date;
  work_hour_type_id uuid;
  pause_leave_type_id uuid;
begin
  if not internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, 'leave:write') then
    raise exception using errcode = '42501', message = 'LEAVE_PERMISSION_REQUIRED';
  end if;

  if requested_predecessor_rule_id is not null then
    select leave_profile_id, leave_type_id, valid_until
      into predecessor_profile_id, predecessor_type_id, predecessor_valid_until
      from public.leave_accrual_rules
     where tenant_id = requested_tenant_id
       and administration_id = requested_administration_id
       and id = requested_predecessor_rule_id
     for update;
    if predecessor_profile_id is null then
      raise exception using errcode = '23503', message = 'LEAVE_PREDECESSOR_NOT_FOUND';
    end if;
    if predecessor_profile_id <> requested_leave_profile_id or predecessor_type_id <> requested_leave_type_id then
      raise exception using errcode = '23514', message = 'LEAVE_PREDECESSOR_SCOPE_MISMATCH';
    end if;
    if requested_valid_from <= (select valid_from from public.leave_accrual_rules where id = requested_predecessor_rule_id) then
      raise exception using errcode = '23514', message = 'LEAVE_SUCCESSOR_DATE_INVALID';
    end if;
    if predecessor_valid_until is null or predecessor_valid_until > requested_valid_from then
      update public.leave_accrual_rules
         set valid_until = requested_valid_from
       where id = requested_predecessor_rule_id;
    elsif predecessor_valid_until <> requested_valid_from then
      raise exception using errcode = '23514', message = 'LEAVE_SUCCESSOR_DATE_NOT_CONTIGUOUS';
    end if;
  end if;

  insert into public.leave_accrual_rules (
    tenant_id, administration_id, leave_profile_id, leave_type_id, predecessor_rule_id,
    valid_from, valid_until, accrual_basis, accrual_frequency, accrual_timing,
    accrual_amount, accrual_rate, expiration_months, created_by
  ) values (
    requested_tenant_id, requested_administration_id, requested_leave_profile_id, requested_leave_type_id,
    requested_predecessor_rule_id, requested_valid_from, requested_valid_until, requested_accrual_basis,
    requested_accrual_frequency, requested_accrual_timing,
    case when requested_accrual_basis = 'CONTRACT_HOURS' then requested_accrual_amount else null end,
    case when requested_accrual_basis = 'WORKED_HOURS' then requested_accrual_rate else null end,
    requested_expiration_months, auth.uid()
  ) returning id into created_rule_id;

  foreach work_hour_type_id in array coalesce(requested_work_hour_type_ids, array[]::uuid[]) loop
    insert into public.leave_accrual_rule_work_hour_types (tenant_id, administration_id, accrual_rule_id, work_hour_type_id)
    values (requested_tenant_id, requested_administration_id, created_rule_id, work_hour_type_id);
  end loop;
  foreach pause_leave_type_id in array coalesce(requested_pause_leave_type_ids, array[]::uuid[]) loop
    insert into public.leave_accrual_rule_pause_types (tenant_id, administration_id, accrual_rule_id, pause_leave_type_id)
    values (requested_tenant_id, requested_administration_id, created_rule_id, pause_leave_type_id);
  end loop;
  return created_rule_id;
end;
$$;

create or replace function public.create_leave_bonus_rule(
  requested_tenant_id uuid,
  requested_administration_id uuid,
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
security invoker
set search_path = public, pg_catalog
as $$
declare
  created_rule_id uuid;
  tier jsonb;
begin
  if not internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, 'leave:write') then
    raise exception using errcode = '42501', message = 'LEAVE_PERMISSION_REQUIRED';
  end if;
  if jsonb_typeof(requested_tiers) <> 'array' or jsonb_array_length(requested_tiers) = 0 then
    raise exception using errcode = '23514', message = 'LEAVE_BONUS_RULE_REQUIRES_TIER';
  end if;
  insert into public.leave_bonus_rules (
    tenant_id, administration_id, leave_profile_id, leave_type_id, name,
    trigger_type, award_timing, pro_rate_first_year, is_active, created_by
  ) values (
    requested_tenant_id, requested_administration_id, requested_leave_profile_id, requested_leave_type_id,
    requested_name, requested_trigger_type, requested_award_timing, requested_pro_rate_first_year,
    requested_is_active, auth.uid()
  ) returning id into created_rule_id;
  for tier in select value from jsonb_array_elements(requested_tiers) loop
    insert into public.leave_bonus_tiers (tenant_id, administration_id, bonus_rule_id, threshold_years, bonus_amount)
    values (requested_tenant_id, requested_administration_id, created_rule_id, (tier->>'thresholdYears')::smallint, (tier->>'bonusAmount')::numeric);
  end loop;
  return created_rule_id;
end;
$$;

revoke all on function public.create_leave_accrual_rule(uuid, uuid, uuid, uuid, uuid, date, date, public.leave_accrual_basis, public.leave_accrual_frequency, public.leave_accrual_timing, numeric, numeric, smallint, uuid[], uuid[]) from public, anon;
grant execute on function public.create_leave_accrual_rule(uuid, uuid, uuid, uuid, uuid, date, date, public.leave_accrual_basis, public.leave_accrual_frequency, public.leave_accrual_timing, numeric, numeric, smallint, uuid[], uuid[]) to authenticated;
revoke all on function public.create_leave_bonus_rule(uuid, uuid, uuid, uuid, text, public.leave_bonus_trigger_type, public.leave_bonus_award_timing, boolean, boolean, jsonb) from public, anon;
grant execute on function public.create_leave_bonus_rule(uuid, uuid, uuid, uuid, text, public.leave_bonus_trigger_type, public.leave_bonus_award_timing, boolean, boolean, jsonb) to authenticated;
