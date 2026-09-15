-- Keep worked-hours leave accrual aligned with the canonical Actual Work family.
-- WORK, ADDITIONAL and OVERTIME are eligible; TRANSPARENT is informational only.

create or replace function internal_security.assert_leave_accrual_rule_input(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_accrual_basis public.leave_accrual_basis,
  requested_accrual_amount numeric,
  requested_accrual_rate numeric,
  requested_work_hour_type_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
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
        and type.family in ('WORK', 'ADDITIONAL', 'OVERTIME')
    )
  ) then
    raise exception using errcode = '23503', message = 'LEAVE_WORK_HOUR_TYPE_NOT_ELIGIBLE';
  end if;
end;
$$;

create or replace function internal_security.assert_leave_accrual_rule_configuration(requested_rule_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rule_row public.leave_accrual_rules;
  mapping_count integer;
begin
  select * into rule_row
  from public.leave_accrual_rules rule
  where rule.id = requested_rule_id;
  if not found then
    return;
  end if;

  if rule_row.accrual_basis = 'CONTRACT_HOURS' and (rule_row.accrual_amount is null or rule_row.accrual_amount < 0 or rule_row.accrual_rate is not null) then
    raise exception using errcode = '23514', message = 'LEAVE_ACCRUAL_AMOUNT_INVALID';
  end if;
  if rule_row.accrual_basis = 'WORKED_HOURS' and (rule_row.accrual_rate is null or rule_row.accrual_rate < 0 or rule_row.accrual_amount is not null) then
    raise exception using errcode = '23514', message = 'LEAVE_ACCRUAL_RATE_INVALID';
  end if;

  select count(*)::integer into mapping_count
  from public.leave_accrual_rule_work_hour_types mapping
  where mapping.tenant_id = rule_row.tenant_id
    and mapping.hr_group_id = rule_row.hr_group_id
    and mapping.accrual_rule_id = rule_row.id;
  if rule_row.accrual_basis = 'WORKED_HOURS' and mapping_count = 0 then
    raise exception using errcode = '23514', message = 'LEAVE_WORK_HOUR_TYPE_REQUIRED';
  end if;
  if rule_row.accrual_basis = 'CONTRACT_HOURS' and mapping_count > 0 then
    raise exception using errcode = '23514', message = 'LEAVE_WORK_HOUR_TYPES_NOT_ALLOWED';
  end if;
end;
$$;

create or replace function internal_security.validate_leave_accrual_rule_configuration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform internal_security.assert_leave_accrual_rule_configuration(new.id);
  return new;
end;
$$;

create or replace function internal_security.validate_leave_accrual_mapping_configuration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform internal_security.assert_leave_accrual_rule_configuration(case when tg_op = 'DELETE' then old.accrual_rule_id else new.accrual_rule_id end);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists actual_work_validate_leave_accrual_rule_configuration on public.leave_accrual_rules;
create constraint trigger actual_work_validate_leave_accrual_rule_configuration
after insert or update on public.leave_accrual_rules
deferrable initially deferred
for each row execute function internal_security.validate_leave_accrual_rule_configuration();

drop trigger if exists actual_work_validate_leave_accrual_mapping_configuration on public.leave_accrual_rule_work_hour_types;
create constraint trigger actual_work_validate_leave_accrual_mapping_configuration
after insert or update or delete on public.leave_accrual_rule_work_hour_types
deferrable initially deferred
for each row execute function internal_security.validate_leave_accrual_mapping_configuration();

create or replace function internal_security.validate_leave_rule_work_hour_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rule_basis public.leave_accrual_basis;
  type_family public.actual_work_type_family;
begin
  select accrual_basis into rule_basis
  from public.leave_accrual_rules
  where id = new.accrual_rule_id;
  select family into type_family
  from public.work_hour_types
  where id = new.work_hour_type_id;
  if rule_basis is distinct from 'WORKED_HOURS'
     or type_family is null
     or type_family not in ('WORK', 'ADDITIONAL', 'OVERTIME') then
    raise exception using errcode = '23514', message = 'LEAVE_WORK_HOUR_TYPE_NOT_ELIGIBLE';
  end if;
  return new;
end;
$$;

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
  perform internal_security.assert_leave_accrual_rule_input(
    requested_tenant_id,
    requested_hr_group_id,
    requested_accrual_basis,
    requested_accrual_amount,
    requested_accrual_rate,
    requested_work_hour_type_ids
  );
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
    select 1 from public.leave_types type
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
  perform internal_security.assert_leave_accrual_rule_input(
    requested_tenant_id,
    requested_hr_group_id,
    requested_accrual_basis,
    requested_accrual_amount,
    requested_accrual_rate,
    requested_work_hour_type_ids
  );
  if exists (
    select 1
    from unnest(coalesce(requested_pause_leave_type_ids, array[]::uuid[])) type_id
    where not exists (
      select 1 from public.leave_types type
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

revoke all on function internal_security.assert_leave_accrual_rule_input(uuid, uuid, public.leave_accrual_basis, numeric, numeric, uuid[]) from public, anon, authenticated;
revoke all on function internal_security.assert_leave_accrual_rule_configuration(uuid) from public, anon, authenticated;
revoke all on function internal_security.validate_leave_accrual_rule_configuration() from public, anon, authenticated;
revoke all on function internal_security.validate_leave_accrual_mapping_configuration() from public, anon, authenticated;
revoke all on function internal_security.validate_leave_rule_work_hour_type() from public, anon, authenticated;
revoke all on function public.create_group_leave_accrual_rule(uuid, uuid, uuid, uuid, uuid, date, date, public.leave_accrual_basis, public.leave_accrual_frequency, public.leave_accrual_timing, numeric, numeric, smallint, uuid[], uuid[]) from public, anon;
grant execute on function public.create_group_leave_accrual_rule(uuid, uuid, uuid, uuid, uuid, date, date, public.leave_accrual_basis, public.leave_accrual_frequency, public.leave_accrual_timing, numeric, numeric, smallint, uuid[], uuid[]) to authenticated;
revoke all on function public.update_group_leave_accrual_rule(uuid, uuid, uuid, uuid, uuid, public.leave_accrual_basis, public.leave_accrual_frequency, public.leave_accrual_timing, numeric, numeric, smallint, uuid[], uuid[]) from public, anon;
grant execute on function public.update_group_leave_accrual_rule(uuid, uuid, uuid, uuid, uuid, public.leave_accrual_basis, public.leave_accrual_frequency, public.leave_accrual_timing, numeric, numeric, smallint, uuid[], uuid[]) to authenticated;
