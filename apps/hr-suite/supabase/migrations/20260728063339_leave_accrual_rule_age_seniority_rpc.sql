alter table public.leave_accrual_rules drop constraint if exists leave_accrual_rules_amount_valid;
alter table public.leave_accrual_rules
  add constraint leave_accrual_rules_amount_valid check (
    (accrual_basis = 'CONTRACT_HOURS' and accrual_amount is not null and accrual_amount >= 0 and accrual_rate is null)
    or (accrual_basis = 'WORKED_HOURS' and accrual_amount is null and accrual_rate is not null and accrual_rate >= 0)
    or (accrual_basis = 'AGE_SENIORITY' and accrual_amount is null and accrual_rate is null)
  );

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
  if requested_accrual_basis <> 'WORKED_HOURS' and coalesce(array_length(requested_work_hour_type_ids, 1), 0) > 0 then
    raise exception using errcode = '23514', message = 'LEAVE_WORK_HOUR_TYPE_NOT_ALLOWED';
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
      update public.leave_accrual_rules set valid_until = requested_valid_from where id = requested_predecessor_rule_id;
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
