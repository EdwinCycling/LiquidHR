create or replace function public.manage_employment_contract(
  requested_employment_id uuid,
  requested_contract_id uuid,
  requested_payload jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  employment_row public.employments%rowtype;
  current_contract public.employment_contracts%rowtype;
  previous_contract public.employment_contracts%rowtype;
  next_contract public.employment_contracts%rowtype;
  latest_contract public.employment_contracts%rowtype;
  requested_starts_on date := (requested_payload ->> 'startsOn')::date;
  requested_ends_on date := nullif(requested_payload ->> 'endsOn', '')::date;
  labor_condition_name text;
  resulting_contract_id uuid;
  resulting_sequence smallint;
begin
  select employment.* into employment_row
  from public.employments employment
  where employment.id = requested_employment_id
    and employment.deleted_at is null
  for update;
  if employment_row.id is null then raise exception 'EMPLOYMENT_NOT_FOUND'; end if;
  if not internal_security.current_user_has_permission(
    employment_row.tenant_id, employment_row.administration_id, 'contract:write'
  ) then raise exception 'FORBIDDEN'; end if;

  select condition_set.name into labor_condition_name
  from public.labor_condition_sets condition_set
  where condition_set.tenant_id = employment_row.tenant_id
    and condition_set.administration_id = employment_row.administration_id
    and condition_set.id = (requested_payload ->> 'laborConditionSetId')::uuid
    and condition_set.is_active;
  if labor_condition_name is null then raise exception 'LABOR_CONDITION_SET_NOT_FOUND'; end if;

  if requested_payload ->> 'workerType' = 'TEMPORARY_AGENCY' then
    if not exists (
      select 1 from public.flex_phases phase
      where phase.tenant_id = employment_row.tenant_id
        and phase.administration_id = employment_row.administration_id
        and phase.id = (requested_payload ->> 'flexPhaseId')::uuid
        and phase.is_active
    ) then raise exception 'FLEX_PHASE_NOT_FOUND'; end if;
  end if;

  if requested_contract_id is null then
    select contract.* into latest_contract
    from public.employment_contracts contract
    where contract.employment_id = requested_employment_id
    order by contract.sequence_number desc
    limit 1
    for update;
    if latest_contract.id is null then raise exception 'CONTRACT_CHAIN_EMPTY'; end if;
    if latest_contract.ends_on is null then raise exception 'OPEN_CONTRACT_MUST_END_FIRST'; end if;
    if requested_starts_on <> latest_contract.ends_on + 1 then
      raise exception 'CONTRACT_CHAIN_GAP';
    end if;
    resulting_sequence := latest_contract.sequence_number + 1;

    insert into public.employment_contracts (
      tenant_id, administration_id, employee_id, employment_id, sequence_number,
      worker_type, flex_phase_id, labor_condition_set_id, duration_type,
      starts_on, ends_on, probation_applies, probation_ends_on
    ) values (
      employment_row.tenant_id, employment_row.administration_id,
      employment_row.employee_id, employment_row.id, resulting_sequence,
      (requested_payload ->> 'workerType')::public.employment_worker_type,
      nullif(requested_payload ->> 'flexPhaseId', '')::uuid,
      (requested_payload ->> 'laborConditionSetId')::uuid,
      (requested_payload ->> 'durationType')::public.contract_duration_type,
      requested_starts_on, requested_ends_on,
      (requested_payload ->> 'probationApplies')::boolean,
      nullif(requested_payload ->> 'probationEndsOn', '')::date
    ) returning id into resulting_contract_id;

    update public.employment_labor_conditions
    set valid_until = requested_starts_on
    where employment_contract_id = latest_contract.id;

    insert into public.employment_labor_conditions (
      tenant_id, administration_id, employee_id, employment_id,
      employment_contract_id, condition_group, valid_from, valid_until
    ) values (
      employment_row.tenant_id, employment_row.administration_id,
      employment_row.employee_id, employment_row.id, resulting_contract_id,
      labor_condition_name, requested_starts_on,
      case when requested_ends_on is null then null else requested_ends_on + 1 end
    );
  else
    select contract.* into current_contract
    from public.employment_contracts contract
    where contract.id = requested_contract_id
      and contract.employment_id = requested_employment_id
    for update;
    if current_contract.id is null then raise exception 'CONTRACT_NOT_FOUND'; end if;

    select contract.* into previous_contract
    from public.employment_contracts contract
    where contract.employment_id = requested_employment_id
      and contract.sequence_number = current_contract.sequence_number - 1;
    select contract.* into next_contract
    from public.employment_contracts contract
    where contract.employment_id = requested_employment_id
      and contract.sequence_number = current_contract.sequence_number + 1;

    if previous_contract.id is null and requested_starts_on <> employment_row.starts_on then
      raise exception 'FIRST_CONTRACT_START_IMMUTABLE';
    end if;
    if previous_contract.id is not null and requested_starts_on <> previous_contract.ends_on + 1 then
      raise exception 'CONTRACT_CHAIN_GAP';
    end if;
    if next_contract.id is not null and (
      requested_ends_on is null or next_contract.starts_on <> requested_ends_on + 1
    ) then raise exception 'CONTRACT_CHAIN_GAP'; end if;
    if requested_ends_on is not null and exists (
      select 1
      from public.employment_labor_conditions condition
      where condition.employment_contract_id = current_contract.id
        and condition.valid_from > requested_ends_on
    ) then raise exception 'CONTRACT_LABOR_PERIOD_AFTER_END'; end if;

    update public.employment_contracts
    set
      worker_type = (requested_payload ->> 'workerType')::public.employment_worker_type,
      flex_phase_id = nullif(requested_payload ->> 'flexPhaseId', '')::uuid,
      labor_condition_set_id = (requested_payload ->> 'laborConditionSetId')::uuid,
      duration_type = (requested_payload ->> 'durationType')::public.contract_duration_type,
      starts_on = requested_starts_on,
      ends_on = requested_ends_on,
      probation_applies = (requested_payload ->> 'probationApplies')::boolean,
      probation_ends_on = nullif(requested_payload ->> 'probationEndsOn', '')::date
    where id = current_contract.id;
    resulting_contract_id := current_contract.id;

    -- Arbeidsvoorwaarden hebben een eigen tijdlijn. Bewaar bestaande tussenperioden
    -- en begrens alleen de laatste periode op de nieuwe contracteinddatum.
    update public.employment_labor_conditions condition
    set
      condition_group = case
        when condition.valid_from = current_contract.starts_on then labor_condition_name
        else condition.condition_group
      end,
      valid_from = case
        when condition.valid_from = current_contract.starts_on then requested_starts_on
        else condition.valid_from
      end,
      valid_until = coalesce(
        (
          select min(next_condition.valid_from)
          from public.employment_labor_conditions next_condition
          where next_condition.employment_contract_id = current_contract.id
            and next_condition.valid_from > condition.valid_from
        ),
        case when requested_ends_on is null then null else requested_ends_on + 1 end
      )
    where condition.employment_contract_id = current_contract.id;
  end if;

  select contract.* into latest_contract
  from public.employment_contracts contract
  where contract.employment_id = requested_employment_id
  order by contract.sequence_number desc
  limit 1;

  update public.employments
  set
    ends_on = latest_contract.ends_on,
    employment_type = case latest_contract.worker_type
      when 'STUDENT_INTERN' then 'INTERN'::public.employment_type
      when 'EXTERNAL_NO_PAYROLL' then 'CONTRACTOR'::public.employment_type
      else 'EMPLOYEE'::public.employment_type
    end,
    contract_type = case latest_contract.worker_type
      when 'TEMPORARY_AGENCY' then 'TEMPORARY_AGENCY'::public.contract_type
      when 'EXTERNAL_NO_PAYROLL' then 'EXTERNAL'::public.contract_type
      else latest_contract.duration_type::text::public.contract_type
    end,
    probation_ends_on = latest_contract.probation_ends_on
  where id = requested_employment_id;

  return resulting_contract_id;
exception
  when exclusion_violation then raise exception 'CONTRACT_OVERLAP';
end;
$$;

revoke all on function public.manage_employment_contract(uuid, uuid, jsonb)
from public, anon;
grant execute on function public.manage_employment_contract(uuid, uuid, jsonb)
to authenticated;
