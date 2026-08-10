alter table public.labor_condition_sets
  add column if not exists probation_maximum_months smallint not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.labor_condition_sets'::regclass
      and conname = 'labor_condition_sets_probation_maximum_months_check'
  ) then
    alter table public.labor_condition_sets
      add constraint labor_condition_sets_probation_maximum_months_check
      check (probation_maximum_months in (1, 2));
  end if;
end;
$$;

create or replace function internal_security.validate_employment_contract_probation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  maximum_probation_end date;
  cao_maximum_months smallint := 1;
begin
  if not new.probation_applies then
    return new;
  end if;

  if new.probation_ends_on is null or new.probation_ends_on < new.starts_on then
    raise exception 'PROBATION_DATE_INVALID' using errcode = 'P0001';
  end if;

  if new.duration_type = 'INDEFINITE' then
    maximum_probation_end := (new.starts_on + interval '2 months')::date;
  elsif new.duration_type = 'TEMPORARY_NO_END' then
    maximum_probation_end := (new.starts_on + interval '1 month')::date;
  elsif new.ends_on <= (new.starts_on + interval '6 months')::date then
    raise exception 'PROBATION_NOT_ALLOWED' using errcode = 'P0001';
  elsif new.ends_on < (new.starts_on + interval '24 months')::date then
    select condition_set.probation_maximum_months
      into cao_maximum_months
    from public.labor_condition_sets condition_set
    where condition_set.tenant_id = new.tenant_id
      and condition_set.administration_id = new.administration_id
      and condition_set.id = new.labor_condition_set_id;
    maximum_probation_end := (new.starts_on + make_interval(months => least(coalesce(cao_maximum_months, 1), 2)))::date;
  else
    maximum_probation_end := (new.starts_on + interval '2 months')::date;
  end if;

  if new.probation_ends_on > maximum_probation_end then
    raise exception 'PROBATION_MAXIMUM_EXCEEDED' using errcode = 'P0001';
  end if;
  if new.ends_on is not null and new.probation_ends_on > new.ends_on then
    raise exception 'PROBATION_DATE_OUTSIDE_CONTRACT' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function internal_security.validate_employment_contract_probation() from public, anon, authenticated;

create or replace function public.create_labor_condition_successor(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_predecessor_id uuid,
  requested_name text,
  requested_valid_from date,
  requested_standard_hours_per_week numeric
)
returns public.labor_condition_sets
language plpgsql
security invoker
set search_path = ''
as $$
declare
  predecessor public.labor_condition_sets;
  new_row public.labor_condition_sets;
  base_code text;
  candidate_code text;
  suffix integer := 1;
begin
  if not (select internal_security.current_user_has_permission(
    requested_tenant_id,
    requested_administration_id,
    'contract:write'
  )) then
    raise exception 'INSUFFICIENT_CONTRACT_PERMISSION' using errcode = '42501';
  end if;

  select * into predecessor
  from public.labor_condition_sets condition_set
  where condition_set.tenant_id = requested_tenant_id
    and condition_set.administration_id = requested_administration_id
    and condition_set.id = requested_predecessor_id;

  if predecessor.id is null then
    raise exception 'LABOR_CONDITION_PREDECESSOR_NOT_FOUND' using errcode = 'P0001';
  end if;

  if requested_valid_from <= predecessor.valid_from then
    raise exception 'LABOR_CONDITION_START_MUST_FOLLOW_PREDECESSOR' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.labor_condition_sets condition_set
    where condition_set.tenant_id = requested_tenant_id
      and condition_set.administration_id = requested_administration_id
      and condition_set.predecessor_id = requested_predecessor_id
  ) then
    raise exception 'LABOR_CONDITION_SUCCESSOR_EXISTS' using errcode = 'P0001';
  end if;

  base_code := left(regexp_replace(upper(predecessor.code), '[^A-Z0-9]+', '-', 'g'), 28);
  candidate_code := rtrim(base_code, '-') || '-' || to_char(requested_valid_from, 'YYYYMMDD');
  while exists (
    select 1 from public.labor_condition_sets condition_set
    where condition_set.tenant_id = requested_tenant_id
      and condition_set.administration_id = requested_administration_id
      and condition_set.code = candidate_code
  ) loop
    candidate_code := left(rtrim(base_code, '-'), 23) || '-' || to_char(requested_valid_from, 'YYYYMMDD') || '-' || suffix::text;
    suffix := suffix + 1;
  end loop;

  insert into public.labor_condition_sets (
    tenant_id,
    administration_id,
    hr_group_id,
    code,
    name,
    standard_hours_per_week,
    probation_maximum_months,
    is_active,
    valid_from,
    predecessor_id
  ) values (
    requested_tenant_id,
    requested_administration_id,
    predecessor.hr_group_id,
    candidate_code,
    trim(requested_name),
    requested_standard_hours_per_week,
    predecessor.probation_maximum_months,
    true,
    requested_valid_from,
    requested_predecessor_id
  )
  returning * into new_row;

  update public.labor_condition_sets
  set is_active = false
  where tenant_id = requested_tenant_id
    and administration_id = requested_administration_id
    and id = requested_predecessor_id;

  return new_row;
end;
$$;

revoke all on function public.create_labor_condition_successor(uuid, uuid, uuid, text, date, numeric) from public, anon;
grant execute on function public.create_labor_condition_successor(uuid, uuid, uuid, text, date, numeric) to authenticated;
