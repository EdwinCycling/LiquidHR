-- Proeftijdregels over wel/niet toegestaan en maximale duur zijn waarschuwingen.
-- Alleen een ontbrekende of chronologisch ongeldige einddatum blokkeert de opslag.
create or replace function internal_security.validate_employment_contract_probation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not new.probation_applies then
    return new;
  end if;

  if new.probation_ends_on is null or new.probation_ends_on < new.starts_on then
    raise exception 'PROBATION_DATE_INVALID' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function internal_security.validate_employment_contract_probation() from public, anon, authenticated;

alter table public.employment_contracts
  drop constraint if exists employment_contracts_probation_valid;

alter table public.employment_contracts
  add constraint employment_contracts_probation_valid check (
    (not probation_applies and probation_ends_on is null)
    or (
      probation_applies
      and probation_ends_on is not null
      and probation_ends_on >= starts_on
    )
  );
