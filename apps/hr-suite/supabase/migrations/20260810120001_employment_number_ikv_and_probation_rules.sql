-- Reconcile legacy active IKV duplicates before enforcing the per-employee
-- uniqueness rule. Keep the earliest relationship as the historical record and
-- move later relationships to the first available positive integer.
do $$
declare
  duplicate_row record;
  candidate integer;
  first_candidate integer;
begin
  for duplicate_row in
    select ranked.id,
           ranked.tenant_id,
           ranked.employee_id,
           ranked.ikv_number,
           ranked.duplicate_rank
    from (
      select ir.id,
             ir.tenant_id,
             ir.employee_id,
             ir.ikv_number,
             row_number() over (
               partition by ir.tenant_id, ir.employee_id, ir.ikv_number
               order by ir.starts_on nulls last, ir.created_at, ir.id
             ) as duplicate_rank
      from public.income_relationships ir
      where ir.deleted_at is null
        and ir.ikv_number is not null
    ) as ranked
    where ranked.duplicate_rank > 1
    order by ranked.tenant_id, ranked.employee_id, ranked.ikv_number, ranked.duplicate_rank, ranked.id
  loop
    candidate := case
      when duplicate_row.ikv_number < 2147483647 then duplicate_row.ikv_number + 1
      else 1
    end;
    first_candidate := candidate;

    loop
      exit when not exists (
        select 1
        from public.income_relationships ir
        where ir.deleted_at is null
          and ir.tenant_id = duplicate_row.tenant_id
          and ir.employee_id = duplicate_row.employee_id
          and ir.ikv_number = candidate
      );

      candidate := case when candidate < 2147483647 then candidate + 1 else 1 end;
      if candidate = first_candidate then
        raise exception 'IKV_NUMBER_REPAIR_EXHAUSTED' using errcode = 'P0001';
      end if;
    end loop;

    update public.income_relationships
    set ikv_number = candidate,
        updated_at = now()
    where id = duplicate_row.id;
  end loop;
end;
$$;

drop index if exists public.employments_number_active_key;
create unique index employments_number_employee_active_key
  on public.employments (tenant_id, employee_id, employment_number)
  where deleted_at is null;

drop index if exists public.income_relationships_ikv_active_key;
create unique index income_relationships_ikv_employee_active_key
  on public.income_relationships (tenant_id, employee_id, ikv_number)
  where deleted_at is null;

create or replace function internal_security.validate_new_employment_number()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.employment_number !~ '^[0-9]+$' then
    raise exception 'EMPLOYMENT_NUMBER_INVALID' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function internal_security.validate_new_employment_number() from public, anon, authenticated;

drop trigger if exists validate_new_employment_number on public.employments;
create trigger validate_new_employment_number
before insert or update of employment_number on public.employments
for each row execute function internal_security.validate_new_employment_number();

alter table public.employment_contracts
  drop constraint employment_contracts_dates_valid;

alter table public.employment_contracts
  add constraint employment_contracts_dates_valid check (
    (duration_type in ('INDEFINITE', 'TEMPORARY_NO_END') and ends_on is null)
    or (duration_type = 'DEFINITE' and ends_on is not null and ends_on >= starts_on)
  );

create or replace function internal_security.validate_employment_contract_probation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  maximum_probation_end date;
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
    maximum_probation_end := (new.starts_on + interval '1 month')::date;
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

drop trigger if exists validate_employment_contract_probation on public.employment_contracts;
create trigger validate_employment_contract_probation
before insert or update of duration_type, starts_on, ends_on, probation_applies, probation_ends_on
on public.employment_contracts
for each row execute function internal_security.validate_employment_contract_probation();
