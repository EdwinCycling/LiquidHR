-- Vul de canonieke employment-scope aan voordat de labor-condition-RLS wordt getoetst.
create or replace function internal_security.normalize_employment_labor_condition()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  expected_hr_group_id uuid;
begin
  select employment.hr_group_id
    into expected_hr_group_id
  from public.employments employment
  where employment.id = new.employment_id
    and employment.tenant_id = new.tenant_id
    and employment.administration_id = new.administration_id
    and employment.employee_id = new.employee_id
    and employment.deleted_at is null;

  if expected_hr_group_id is null then
    raise exception 'EMPLOYMENT_NOT_FOUND';
  end if;

  if new.hr_group_id is null then
    new.hr_group_id := expected_hr_group_id;
  elsif new.hr_group_id <> expected_hr_group_id then
    raise exception 'EMPLOYMENT_SCOPE_MISMATCH';
  end if;

  if new.employment_contract_id is null then
    select contract.id into new.employment_contract_id
    from public.employment_contracts contract
    where contract.employment_id = new.employment_id
      and contract.starts_on <= new.valid_from
      and (contract.ends_on is null or contract.ends_on >= new.valid_from)
    order by contract.starts_on desc
    limit 1;
  end if;

  if new.employment_contract_id is null then
    raise exception 'CONTRACT_NOT_FOUND';
  end if;

  return new;
end;
$$;
