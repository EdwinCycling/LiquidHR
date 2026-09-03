begin;

-- Gerichte trigger/constraint-regressie voor de migratie
-- 20260812110000_probation_rule_warnings.
create temp table employment_contract_probation_probe (
  duration_type public.contract_duration_type not null,
  starts_on date not null,
  ends_on date,
  probation_applies boolean not null,
  probation_ends_on date,
  constraint probe_contract_dates_valid check (
    (duration_type in ('INDEFINITE', 'TEMPORARY_NO_END') and ends_on is null)
    or (duration_type = 'DEFINITE' and ends_on is not null and ends_on >= starts_on)
  ),
  constraint probe_probation_valid check (
    (not probation_applies and probation_ends_on is null)
    or (
      probation_applies
      and probation_ends_on is not null
      and probation_ends_on >= starts_on
      and (ends_on is null or probation_ends_on <= ends_on)
    )
  )
) on commit drop;

create trigger validate_employment_contract_probation
before insert or update of duration_type, starts_on, ends_on, probation_applies, probation_ends_on
on employment_contract_probation_probe
for each row execute function internal_security.validate_employment_contract_probation();

-- Niet-toegestane proeftijd is een waarschuwing en mag opslaan.
insert into employment_contract_probation_probe (
  duration_type, starts_on, ends_on, probation_applies, probation_ends_on
) values ('DEFINITE', date '2026-08-01', date '2026-10-01', true, date '2026-09-01');

-- Overschrijding van de wettelijke maximumduur is een waarschuwing en mag opslaan.
insert into employment_contract_probation_probe (
  duration_type, starts_on, ends_on, probation_applies, probation_ends_on
) values ('INDEFINITE', date '2026-08-01', null, true, date '2026-11-01');

do $$
declare
  probe_count integer;
begin
  select count(*) into probe_count from employment_contract_probation_probe;
  if probe_count <> 2 then
    raise exception 'PROBATION_WARNING_INSERT_COUNT_MISMATCH';
  end if;
end
$$;

-- Structurele fouten blijven hard geblokkeerd en behouden hun foutcodes.
do $$
begin
  begin
    insert into employment_contract_probation_probe values (
      'DEFINITE', date '2026-08-01', date '2026-12-31', true, null
    );
    raise exception 'EXPECTED_PROBATION_DATE_INVALID_NOT_RAISED';
  exception when others then
    if sqlerrm = 'EXPECTED_PROBATION_DATE_INVALID_NOT_RAISED'
       or sqlerrm <> 'PROBATION_DATE_INVALID' then
      raise;
    end if;
  end;

  begin
    insert into employment_contract_probation_probe values (
      'DEFINITE', date '2026-08-01', date '2026-12-31', false, date '2026-09-01'
    );
    raise exception 'EXPECTED_PROBATION_DATE_NOT_ALLOWED_NOT_RAISED';
  exception when others then
    if sqlerrm = 'EXPECTED_PROBATION_DATE_NOT_ALLOWED_NOT_RAISED'
       or sqlerrm <> 'PROBATION_DATE_NOT_ALLOWED' then
      raise;
    end if;
  end;

  begin
    insert into employment_contract_probation_probe values (
      'DEFINITE', date '2026-08-01', date '2026-10-01', true, date '2026-10-02'
    );
    raise exception 'EXPECTED_PROBATION_DATE_OUTSIDE_CONTRACT_NOT_RAISED';
  exception when others then
    if sqlerrm = 'EXPECTED_PROBATION_DATE_OUTSIDE_CONTRACT_NOT_RAISED'
       or sqlerrm <> 'PROBATION_DATE_OUTSIDE_CONTRACT' then
      raise;
    end if;
  end;

  begin
    insert into employment_contract_probation_probe values (
      'DEFINITE', date '2026-08-01', date '2026-07-31', false, null
    );
    raise exception 'EXPECTED_CONTRACT_DATE_CHECK_NOT_RAISED';
  exception when others then
    if sqlstate <> '23514' then
      raise;
    end if;
  end;
end
$$;

rollback;
