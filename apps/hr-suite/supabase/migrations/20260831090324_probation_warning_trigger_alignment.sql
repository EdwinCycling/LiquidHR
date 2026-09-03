-- Breng de live proeftijdtrigger in lijn met het warning-only applicatiecontract.
-- De bestaande constraint employment_contracts_probation_valid blijft bewust ongewijzigd.
create or replace function internal_security.validate_employment_contract_probation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not new.probation_applies then
    if new.probation_ends_on is not null then
      raise exception 'PROBATION_DATE_NOT_ALLOWED' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.probation_ends_on is null or new.probation_ends_on < new.starts_on then
    raise exception 'PROBATION_DATE_INVALID' using errcode = 'P0001';
  end if;

  if new.ends_on is not null and new.probation_ends_on > new.ends_on then
    raise exception 'PROBATION_DATE_OUTSIDE_CONTRACT' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function internal_security.validate_employment_contract_probation() from public, anon, authenticated;
