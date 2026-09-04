begin;

-- P0 verzuimcorrecties zijn additive: bestaande cases en capacity-rijen blijven
-- leesbaar; nieuwe mutaties krijgen de uitgebreidere capaciteitssnapshot.
alter table public.absence_capacity_changes
  add column if not exists scheduled_hours_per_week_snapshot numeric(8,4),
  add column if not exists absence_hours_per_week numeric(8,4),
  add column if not exists input_mode text;

alter table public.absence_capacity_changes
  alter column absence_percentage type numeric(8,4)
  using absence_percentage;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.absence_capacity_changes'::regclass
      and conname = 'absence_capacity_changes_input_mode_check'
  ) then
    alter table public.absence_capacity_changes
      add constraint absence_capacity_changes_input_mode_check
      check (input_mode is null or input_mode in ('HOURS', 'PERCENTAGE'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.absence_capacity_changes'::regclass
      and conname = 'absence_capacity_changes_hours_check'
  ) then
    alter table public.absence_capacity_changes
      add constraint absence_capacity_changes_hours_check
      check (
        (scheduled_hours_per_week_snapshot is null and absence_hours_per_week is null)
        or (
          scheduled_hours_per_week_snapshot > 0
          and absence_hours_per_week > 0
          and absence_hours_per_week <= scheduled_hours_per_week_snapshot
          and absence_percentage > 0
          and absence_percentage <= 100
          and input_mode in ('HOURS', 'PERCENTAGE')
        )
      );
  end if;
end;
$$;

comment on column public.absence_capacity_changes.scheduled_hours_per_week_snapshot is
  'Werkuren per week volgens het dienstverband, geldig op effective_on.';
comment on column public.absence_capacity_changes.absence_hours_per_week is
  'Verzuimuren per week, afgeleid uit de snapshot en het geregistreerde percentage.';
comment on column public.absence_capacity_changes.input_mode is
  'Invoerwijze van HR: HOURS of PERCENTAGE; historische rijen mogen null blijven.';

create index if not exists absence_capacity_changes_spell_history_idx
  on public.absence_capacity_changes (tenant_id, hr_group_id, spell_id, effective_on desc, created_at desc);

create or replace function internal_security.resolve_absence_scheduled_hours(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_effective_on date
)
returns numeric
language plpgsql
stable
security definer
set search_path = public, internal_security, pg_temp
as $$
declare
  scheduled_hours numeric;
begin
  select schedule.average_hours_per_week
    into scheduled_hours
  from public.employment_schedules schedule
  where schedule.tenant_id = requested_tenant_id
    and schedule.administration_id = requested_administration_id
    and schedule.employee_id = requested_employee_id
    and schedule.employment_id = requested_employment_id
    and schedule.valid_from <= requested_effective_on
    and (schedule.valid_until is null or schedule.valid_until > requested_effective_on)
  order by schedule.valid_from desc
  limit 1;

  if scheduled_hours is null or scheduled_hours <= 0 then
    raise exception 'ABSENCE_SCHEDULE_NOT_FOUND' using errcode = '23514';
  end if;
  return scheduled_hours;
end;
$$;

-- Backfill alleen wanneer het rooster op de effectieve datum betrouwbaar
-- beschikbaar is. Historische rijen zonder zo'n rooster blijven bewust
-- nullable; actuele employment-uren worden nooit teruggeschreven over de
-- historische werkelijkheid heen.
update public.absence_capacity_changes capacity
set scheduled_hours_per_week_snapshot = schedule.average_hours_per_week,
    absence_hours_per_week = round(
      schedule.average_hours_per_week * capacity.absence_percentage / 100,
      4
    ),
    input_mode = 'PERCENTAGE'
from public.absence_cases absence_case
join public.absence_spells spell
  on spell.tenant_id = absence_case.tenant_id
 and spell.hr_group_id = absence_case.hr_group_id
 and spell.case_id = absence_case.id
join lateral (
  select employment_schedule.average_hours_per_week
  from public.employment_schedules employment_schedule
  where employment_schedule.tenant_id = absence_case.tenant_id
    and employment_schedule.administration_id = absence_case.administration_id
    and employment_schedule.employee_id = absence_case.employee_id
    and employment_schedule.employment_id = absence_case.employment_id
    and employment_schedule.valid_from <= capacity.effective_on
    and (
      employment_schedule.valid_until is null
      or employment_schedule.valid_until > capacity.effective_on
    )
    and employment_schedule.average_hours_per_week > 0
  order by employment_schedule.valid_from desc
  limit 1
) schedule on true
where capacity.tenant_id = absence_case.tenant_id
  and capacity.hr_group_id = absence_case.hr_group_id
  and capacity.case_id = absence_case.id
  and capacity.spell_id = spell.id
  and capacity.scheduled_hours_per_week_snapshot is null
  and capacity.absence_hours_per_week is null
  and capacity.input_mode is null;

create or replace function internal_security.fill_absence_capacity_values()
returns trigger
language plpgsql
security definer
set search_path = public, internal_security, pg_temp
as $$
declare
  case_tenant_id uuid;
  case_hr_group_id uuid;
  case_administration_id uuid;
  case_employee_id uuid;
  case_employment_id uuid;
  spell_employment_id uuid;
  mode text;
begin
  select absence_case.tenant_id,
         absence_case.hr_group_id,
         absence_case.administration_id,
         absence_case.employee_id,
         absence_case.employment_id,
         spell.employment_id
    into case_tenant_id,
         case_hr_group_id,
         case_administration_id,
         case_employee_id,
         case_employment_id,
         spell_employment_id
  from public.absence_cases absence_case
  join public.absence_spells spell
    on spell.tenant_id = absence_case.tenant_id
   and spell.hr_group_id = absence_case.hr_group_id
   and spell.case_id = absence_case.id
   and spell.id = new.spell_id
  where absence_case.id = new.case_id;

  if case_tenant_id is null
     or case_hr_group_id is null
     or case_employment_id is null
     or spell_employment_id is null
     or case_employment_id <> spell_employment_id then
    raise exception 'ABSENCE_CAPACITY_SCOPE_INVALID' using errcode = '23514';
  end if;

  if new.scheduled_hours_per_week_snapshot is null then
    new.scheduled_hours_per_week_snapshot := internal_security.resolve_absence_scheduled_hours(
      case_tenant_id,
      case_administration_id,
      case_employee_id,
      case_employment_id,
      new.effective_on
    );
  end if;

  mode := coalesce(new.input_mode, 'PERCENTAGE');
  if mode not in ('HOURS', 'PERCENTAGE') then
    raise exception 'ABSENCE_CAPACITY_INPUT_INVALID' using errcode = '22023';
  end if;
  new.input_mode := mode;

  if new.scheduled_hours_per_week_snapshot <= 0 then
    raise exception 'ABSENCE_CAPACITY_HOURS_INVALID' using errcode = '22023';
  end if;

  if mode = 'HOURS' then
    if new.absence_hours_per_week is null
       or new.absence_hours_per_week <= 0
       or new.absence_hours_per_week > new.scheduled_hours_per_week_snapshot then
      raise exception 'ABSENCE_CAPACITY_HOURS_INVALID' using errcode = '22023';
    end if;
    new.absence_percentage := round(
      new.absence_hours_per_week / new.scheduled_hours_per_week_snapshot * 100,
      4
    );
  else
    if new.absence_percentage is null
       or new.absence_percentage <= 0
       or new.absence_percentage > 100 then
      raise exception 'ABSENCE_PERCENTAGE_INVALID' using errcode = '22023';
    end if;
    new.absence_hours_per_week := round(
      new.scheduled_hours_per_week_snapshot * new.absence_percentage / 100,
      4
    );
  end if;

  if new.absence_percentage <= 0 or new.absence_percentage > 100 then
    raise exception 'ABSENCE_PERCENTAGE_INVALID' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists absence_capacity_values on public.absence_capacity_changes;
create trigger absence_capacity_values
before insert or update of effective_on, absence_percentage,
  scheduled_hours_per_week_snapshot, absence_hours_per_week, input_mode
on public.absence_capacity_changes
for each row execute function internal_security.fill_absence_capacity_values();

create or replace function internal_security.prevent_future_absence_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, internal_security, pg_temp
as $$
begin
  if tg_table_name = 'absence_cases'
     and (new.first_absence_on > current_date or new.effective_clock_start_on > current_date) then
    raise exception 'ABSENCE_DATE_IN_FUTURE' using errcode = '22023';
  end if;
  if tg_table_name = 'absence_spells'
     and (new.started_on > current_date or (new.recovered_on is not null and new.recovered_on > current_date)) then
    raise exception 'ABSENCE_DATE_IN_FUTURE' using errcode = '22023';
  end if;
  if tg_table_name = 'absence_capacity_changes'
     and new.effective_on > current_date then
    raise exception 'ABSENCE_DATE_IN_FUTURE' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists absence_cases_actual_date_guard on public.absence_cases;
create trigger absence_cases_actual_date_guard
before insert or update of first_absence_on, effective_clock_start_on
on public.absence_cases
for each row execute function internal_security.prevent_future_absence_mutation();

drop trigger if exists absence_spells_actual_date_guard on public.absence_spells;
create trigger absence_spells_actual_date_guard
before insert or update of started_on, recovered_on
on public.absence_spells
for each row execute function internal_security.prevent_future_absence_mutation();

drop trigger if exists absence_capacity_actual_date_guard on public.absence_capacity_changes;
create trigger absence_capacity_actual_date_guard
before insert or update of effective_on
on public.absence_capacity_changes
for each row execute function internal_security.prevent_future_absence_mutation();

create or replace function internal_security.calculate_absence_effective_clock_start(
  requested_case_id uuid,
  requested_next_started_on date
)
returns date
language plpgsql
stable
security definer
set search_path = public, internal_security, pg_temp
as $$
declare
  root_start_on date;
  latest_recovered_on date;
  recovery_gap_days integer := 0;
begin
  select absence_case.first_absence_on
    into root_start_on
  from public.absence_cases absence_case
  where absence_case.id = requested_case_id;
  if root_start_on is null then
    raise exception 'ABSENCE_CASE_NOT_FOUND' using errcode = '23514';
  end if;

  select coalesce(sum(greatest(next_started_on - recovered_on - 1, 0)), 0)::integer
    into recovery_gap_days
  from (
    select spell.recovered_on,
           lead(spell.started_on) over (order by spell.started_on, spell.id) as next_started_on
    from public.absence_spells spell
    where spell.case_id = requested_case_id
  ) gaps
  where recovered_on is not null
    and next_started_on is not null
    and next_started_on <= requested_next_started_on
    and next_started_on > recovered_on;

  select spell.recovered_on
    into latest_recovered_on
  from public.absence_spells spell
  where spell.case_id = requested_case_id
  order by spell.started_on desc, spell.id desc
  limit 1;

  -- Bij een herreport vóór de insert zit de nieuwe periode nog niet in de
  -- tabel. Alleen dan voegen we het laatste herstelgat hier toe.
  if latest_recovered_on is not null
     and requested_next_started_on > latest_recovered_on
     and not exists (
       select 1 from public.absence_spells spell
       where spell.case_id = requested_case_id
         and spell.started_on = requested_next_started_on
     ) then
    recovery_gap_days := recovery_gap_days
      + greatest(requested_next_started_on - latest_recovered_on - 1, 0);
  end if;

  return root_start_on + recovery_gap_days;
end;
$$;

create or replace function internal_security.recalculate_absence_clock_after_spell()
returns trigger
language plpgsql
security definer
set search_path = public, internal_security, pg_temp
as $$
begin
  update public.absence_cases absence_case
  set effective_clock_start_on = internal_security.calculate_absence_effective_clock_start(
        new.case_id,
        new.started_on
      ),
      updated_at = timezone('utc', now())
  where absence_case.id = new.case_id;
  return new;
end;
$$;

drop trigger if exists absence_spells_recalculate_clock on public.absence_spells;
create trigger absence_spells_recalculate_clock
after insert on public.absence_spells
for each row execute function internal_security.recalculate_absence_clock_after_spell();

-- Nieuwe capaciteit kan in uren of percentage worden ingevoerd. De bestaande
-- RPC blijft beschikbaar; deze v2-route gebruikt dezelfde autorisatie-,
-- idempotency- en spellregels en bewaart de volledige invoercontext.
create or replace function internal_security.change_absence_capacity_v2(
  requested_case_id uuid,
  requested_effective_on date,
  requested_absence_percentage numeric default null,
  requested_absence_hours_per_week numeric default null,
  requested_input_mode text default 'PERCENTAGE',
  requested_expected_next_review_on date default null,
  requested_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  case_record public.absence_cases%rowtype;
  existing_mutation public.absence_mutations%rowtype;
  spell_record public.absence_spells%rowtype;
  existing_capacity public.absence_capacity_changes%rowtype;
  scheduled_hours numeric;
  normalized_percentage numeric;
  normalized_hours numeric;
  mode text := coalesce(requested_input_mode, 'PERCENTAGE');
  result_case_id uuid;
begin
  select * into case_record
  from public.absence_cases absence_case
  where absence_case.id = requested_case_id
  for update;

  if actor_id is null or case_record.id is null
     or not internal_security.has_hr_group_access(case_record.tenant_id, case_record.hr_group_id)
     or not (
       internal_security.current_user_has_hr_group_permission(
         case_record.tenant_id, case_record.hr_group_id, 'absence:write'
       )
       or internal_security.can_manage_employee(case_record.employee_id, 'absence:write')
     ) then
    raise exception 'ABSENCE_FORBIDDEN' using errcode = '42501';
  end if;

  if mode not in ('HOURS', 'PERCENTAGE') then
    raise exception 'ABSENCE_CAPACITY_INPUT_INVALID' using errcode = '22023';
  end if;

  if requested_idempotency_key is not null then
    select * into existing_mutation
    from public.absence_mutations mutation
    where mutation.tenant_id = case_record.tenant_id
      and mutation.operation_key = requested_idempotency_key;
    if found then
      if existing_mutation.hr_group_id <> case_record.hr_group_id then
        raise exception 'ABSENCE_IDEMPOTENCY_CONFLICT' using errcode = '23505';
      end if;
      return existing_mutation.result_case_id;
    end if;
  end if;

  scheduled_hours := internal_security.resolve_absence_scheduled_hours(
    case_record.tenant_id,
    case_record.administration_id,
    case_record.employee_id,
    case_record.employment_id,
    requested_effective_on
  );

  if mode = 'HOURS' then
    if requested_absence_hours_per_week is null
       or requested_absence_hours_per_week <= 0
       or requested_absence_hours_per_week > scheduled_hours then
      raise exception 'ABSENCE_CAPACITY_HOURS_INVALID' using errcode = '22023';
    end if;
    normalized_hours := round(requested_absence_hours_per_week, 4);
    normalized_percentage := round(normalized_hours / scheduled_hours * 100, 4);
  else
    if requested_absence_percentage is null
       or requested_absence_percentage <= 0
       or requested_absence_percentage > 100 then
      raise exception 'ABSENCE_PERCENTAGE_INVALID' using errcode = '22023';
    end if;
    normalized_percentage := round(requested_absence_percentage, 4);
    normalized_hours := round(scheduled_hours * normalized_percentage / 100, 4);
  end if;

  select * into spell_record
  from public.absence_spells spell
  where spell.tenant_id = case_record.tenant_id
    and spell.hr_group_id = case_record.hr_group_id
    and spell.case_id = case_record.id
    and spell.recovered_on is null
  order by spell.started_on desc
  limit 1
  for update;

  if not found then
    raise exception 'ABSENCE_NO_OPEN_SPELL' using errcode = '23514';
  end if;
  if requested_effective_on < spell_record.started_on
     or (
       requested_expected_next_review_on is not null
       and requested_expected_next_review_on < requested_effective_on
     ) then
    raise exception 'ABSENCE_DATE_ORDER_INVALID' using errcode = '22023';
  end if;

  select * into existing_capacity
  from public.absence_capacity_changes capacity_change
  where capacity_change.tenant_id = case_record.tenant_id
    and capacity_change.hr_group_id = case_record.hr_group_id
    and capacity_change.case_id = case_record.id
    and capacity_change.spell_id = spell_record.id
    and capacity_change.effective_on = requested_effective_on
  for update;

  if found then
    update public.absence_capacity_changes
    set absence_percentage = normalized_percentage,
        expected_next_review_on = requested_expected_next_review_on,
        scheduled_hours_per_week_snapshot = scheduled_hours,
        absence_hours_per_week = normalized_hours,
        input_mode = mode,
        created_by_user_id = actor_id
    where id = existing_capacity.id;
  else
    insert into public.absence_capacity_changes (
      tenant_id, hr_group_id, case_id, spell_id, effective_on,
      absence_percentage, expected_next_review_on,
      scheduled_hours_per_week_snapshot, absence_hours_per_week,
      input_mode, created_by_user_id
    ) values (
      case_record.tenant_id, case_record.hr_group_id, case_record.id,
      spell_record.id, requested_effective_on, normalized_percentage,
      requested_expected_next_review_on, scheduled_hours, normalized_hours,
      mode, actor_id
    );
  end if;

  result_case_id := case_record.id;

  if requested_idempotency_key is not null then
    insert into public.absence_mutations (
      tenant_id, hr_group_id, operation_key, operation_type, result_case_id
    ) values (
      case_record.tenant_id, case_record.hr_group_id, requested_idempotency_key,
      'CAPACITY', result_case_id
    ) on conflict (tenant_id, operation_key) do nothing;
  end if;

  return result_case_id;
end;
$$;

create or replace function public.change_absence_capacity_v2(
  requested_case_id uuid,
  requested_effective_on date,
  requested_absence_percentage numeric default null,
  requested_absence_hours_per_week numeric default null,
  requested_input_mode text default 'PERCENTAGE',
  requested_expected_next_review_on date default null,
  requested_idempotency_key text default null
)
returns uuid
language sql
set search_path = public, internal_security, pg_temp
as $$
  select internal_security.change_absence_capacity_v2(
    requested_case_id,
    requested_effective_on,
    requested_absence_percentage,
    requested_absence_hours_per_week,
    requested_input_mode,
    requested_expected_next_review_on,
    requested_idempotency_key
  );
$$;

revoke all on function internal_security.resolve_absence_scheduled_hours(uuid, uuid, uuid, uuid, date) from public, anon, authenticated;
revoke all on function internal_security.fill_absence_capacity_values() from public, anon, authenticated;
revoke all on function internal_security.prevent_future_absence_mutation() from public, anon, authenticated;
revoke all on function internal_security.calculate_absence_effective_clock_start(uuid, date) from public, anon, authenticated;
revoke all on function internal_security.recalculate_absence_clock_after_spell() from public, anon, authenticated;
revoke all on function internal_security.change_absence_capacity_v2(uuid, date, numeric, numeric, text, date, text) from public, anon, authenticated;
grant execute on function internal_security.change_absence_capacity_v2(uuid, date, numeric, numeric, text, date, text) to authenticated;

revoke all on function public.change_absence_capacity_v2(uuid, date, numeric, numeric, text, date, text) from public, anon;
grant execute on function public.change_absence_capacity_v2(uuid, date, numeric, numeric, text, date, text) to authenticated;

commit;
