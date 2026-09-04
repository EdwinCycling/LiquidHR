-- P0 Verzuimcontract. Uitvoeren tegen een database waarop de additive
-- migration is toegepast; deze test muteert niets buiten de transactie.
begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'absence_capacity_changes'
      and column_name = 'scheduled_hours_per_week_snapshot'
  ) then raise exception 'P0_CAPACITY_SCHEDULED_HOURS_SNAPSHOT_MISSING'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'absence_capacity_changes'
      and column_name = 'absence_hours_per_week'
  ) then raise exception 'P0_CAPACITY_ABSENCE_HOURS_MISSING'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'absence_capacity_changes'
      and column_name = 'input_mode'
  ) then raise exception 'P0_CAPACITY_INPUT_MODE_MISSING'; end if;
  if to_regprocedure('public.change_absence_capacity_v2(uuid,date,numeric,numeric,text,date,text)') is null then
    raise exception 'P0_CAPACITY_RPC_MISSING';
  end if;
  if to_regprocedure('internal_security.calculate_absence_effective_clock_start(uuid,date)') is null then
    raise exception 'P0_CLOCK_ENGINE_MISSING';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'absence_cases_actual_date_guard') then
    raise exception 'P0_CASE_DATE_GUARD_MISSING';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'absence_spells_actual_date_guard') then
    raise exception 'P0_SPELL_DATE_GUARD_MISSING';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'absence_capacity_actual_date_guard') then
    raise exception 'P0_CAPACITY_DATE_GUARD_MISSING';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name like 'absence_%'
      and column_name in ('diagnosis', 'medical_cause', 'doctor_name', 'medical_note', 'specific_reason')
  ) then raise exception 'P0_MEDICAL_COLUMN_PRESENT'; end if;
end;
$$;

rollback;
