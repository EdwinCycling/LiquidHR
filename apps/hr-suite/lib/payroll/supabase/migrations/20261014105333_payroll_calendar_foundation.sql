begin;

create table public.payroll_calendars (
  id uuid primary key default gen_random_uuid(),
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  processing_group_code text,
  calendar_code text not null check (calendar_code ~ '^[A-Z][A-Z0-9_-]{1,63}$'),
  display_name text not null check (length(trim(display_name)) > 0),
  periodicity text not null check (periodicity in ('MONTHLY', 'FOUR_WEEKLY', 'WEEKLY', 'BIWEEKLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL')),
  calendar_year smallint not null check (calendar_year between 2000 and 2200),
  version smallint not null default 1 check (version > 0),
  effective_from date not null,
  effective_to date not null,
  anchor_date date,
  year_assignment text check (year_assignment in ('PERIOD_START', 'PERIOD_END')),
  generation_rules jsonb not null default '{}'::jsonb check (jsonb_typeof(generation_rules) = 'object'),
  payment_date_rule jsonb check (payment_date_rule is null or jsonb_typeof(payment_date_rule) = 'object'),
  processing_deadline_rule jsonb check (processing_deadline_rule is null or jsonb_typeof(processing_deadline_rule) = 'object'),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'RETIRED')),
  created_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid,
  constraint payroll_calendars_effective_range check (effective_from <= effective_to),
  constraint payroll_calendars_anchor_policy check (
    (periodicity in ('FOUR_WEEKLY', 'WEEKLY', 'BIWEEKLY') and anchor_date is not null and year_assignment is not null)
    or (periodicity not in ('FOUR_WEEKLY', 'WEEKLY', 'BIWEEKLY') and anchor_date is null and year_assignment is null)
  ),
  constraint payroll_calendars_administration_scope_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_calendars_scoped_id_unique
    unique (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_calendars_scoped_periodicity_unique
    unique (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, periodicity),
  constraint payroll_calendars_version_unique
    unique (source_tenant_id, source_hr_group_id, source_administration_id, calendar_code, calendar_year, version)
);

comment on table public.payroll_calendars is 'Versioned calendar configuration for an administration; one row is one immutable version.';
comment on column public.payroll_calendars.processing_group_code is 'Optional administration-owned processing or pay-group reference.';
comment on column public.payroll_calendars.generation_rules is 'Explicit year-boundary and extra-period policy; never inferred from dates.';

create unique index payroll_calendars_one_active_version_per_year
  on public.payroll_calendars (source_tenant_id, source_hr_group_id, source_administration_id, calendar_code, calendar_year)
  where status = 'ACTIVE';

create function public.enforce_payroll_calendar_activation_range()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'ACTIVE' then
    return new;
  end if;

  perform 1
  from public.payroll_administrations as administration
  where administration.id = new.payroll_administration_id
    and administration.source_tenant_id = new.source_tenant_id
    and administration.source_hr_group_id = new.source_hr_group_id
    and administration.source_administration_id = new.source_administration_id
  for update;

  if not found then
    raise exception 'Payroll administration scope does not exist.' using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.payroll_calendars as active_calendar
    where active_calendar.id <> new.id
      and active_calendar.payroll_administration_id = new.payroll_administration_id
      and active_calendar.source_tenant_id = new.source_tenant_id
      and active_calendar.source_hr_group_id = new.source_hr_group_id
      and active_calendar.source_administration_id = new.source_administration_id
      and active_calendar.calendar_code = new.calendar_code
      and active_calendar.status = 'ACTIVE'
      and active_calendar.effective_from <= new.effective_to
      and active_calendar.effective_to >= new.effective_from
  ) then
    raise exception 'Active versions of a payroll calendar cannot have overlapping effective dates.' using errcode = '23P01';
  end if;

  return new;
end;
$$;

create trigger payroll_calendars_activation_range_guard
  before insert or update of status, effective_from, effective_to, calendar_code, calendar_year,
    payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id on public.payroll_calendars
  for each row execute function public.enforce_payroll_calendar_activation_range();

alter table public.payroll_periods
  alter column period_month drop not null;

alter table public.payroll_periods
  add column calendar_id uuid,
  add column period_number smallint,
  add column periodicity text not null default 'MONTHLY'
    check (periodicity in ('MONTHLY', 'FOUR_WEEKLY', 'WEEKLY', 'BIWEEKLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'AD_HOC')),
  add column period_kind text not null default 'REGULAR'
    check (period_kind in ('REGULAR', 'ADDITIONAL', 'CORRECTION')),
  add column period_version smallint not null default 1 check (period_version > 0),
  add column planned_payment_date date,
  add column processing_deadline date,
  add column correction_of_period_id uuid,
  add column supersedes_period_id uuid,
  add column calendar_snapshot jsonb,
  add column calendar_hash text check (calendar_hash is null or calendar_hash ~ '^[0-9a-f]{64}$');

alter table public.payroll_periods
  drop constraint if exists payroll_periods_month_unique,
  add constraint payroll_periods_number_positive check (period_number is null or period_number > 0),
  add constraint payroll_periods_calendar_period_identity_check check (
    (calendar_id is null and period_kind = 'REGULAR' and periodicity = 'MONTHLY' and period_number is null and period_month is not null)
    or (
      calendar_id is not null and period_kind = 'REGULAR' and periodicity <> 'AD_HOC' and period_number is not null
      and calendar_snapshot is not null and calendar_hash is not null
      and ((periodicity = 'MONTHLY' and period_month is not null) or (periodicity <> 'MONTHLY' and period_month is null))
    )
    or (period_kind in ('ADDITIONAL', 'CORRECTION') and periodicity = 'AD_HOC' and period_number is not null and period_month is null)
  ),
  add constraint payroll_periods_correction_reference_check check (
    (period_kind = 'CORRECTION' and correction_of_period_id is not null and supersedes_period_id is not null)
    or (period_kind <> 'CORRECTION' and correction_of_period_id is null and supersedes_period_id is null)
  ),
  add constraint payroll_periods_calendar_snapshot_object_check check (
    calendar_snapshot is null or jsonb_typeof(calendar_snapshot) = 'object'
  ),
  add constraint payroll_periods_calendar_scope_fk
    foreign key (calendar_id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, periodicity)
    references public.payroll_calendars (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, periodicity),
  add constraint payroll_periods_scoped_payroll_administration_id_unique
    unique (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id),
  add constraint payroll_periods_correction_scope_fk
    foreign key (correction_of_period_id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_periods (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id),
  add constraint payroll_periods_supersedes_scope_fk
    foreign key (supersedes_period_id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_periods (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id);

comment on column public.payroll_periods.id is 'Canonical UUID for this immutable payroll-period revision; runs continue to reference it.';
comment on column public.payroll_periods.period_month is 'Legacy month locator for monthly processing; NULL for periods represented by cadence and actual date boundaries.';
comment on column public.payroll_periods.period_year is 'Calendar-year assignment selected by the linked calendar year-boundary policy.';
comment on column public.payroll_periods.calendar_snapshot is 'Immutable copy of the calendar rules and generated boundaries used for this period.';

create unique index payroll_periods_monthly_compatibility_unique
  on public.payroll_periods (source_tenant_id, source_hr_group_id, source_administration_id, period_year, period_month)
  where periodicity = 'MONTHLY' and period_kind = 'REGULAR';
create unique index payroll_periods_calendar_period_version_unique
  on public.payroll_periods (calendar_id, period_year, period_number, period_kind, period_version)
  where calendar_id is not null;
create unique index payroll_periods_ad_hoc_identity_unique
  on public.payroll_periods (
    payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id,
    period_year, period_kind, period_number, period_version
  )
  where periodicity = 'AD_HOC';
create unique index payroll_periods_correction_successor_unique
  on public.payroll_periods (supersedes_period_id)
  where period_kind = 'CORRECTION';
create index payroll_periods_calendar_scope_idx
  on public.payroll_periods (calendar_id, period_year, period_number)
  where calendar_id is not null;

create table public.payroll_calendar_events (
  id uuid primary key default gen_random_uuid(),
  payroll_calendar_id uuid not null,
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  event_type text not null check (event_type in ('CREATED', 'UPDATED', 'ACTIVATED', 'RETIRED')),
  event_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(event_payload) = 'object'),
  actor_user_id uuid,
  created_at timestamptz not null default now(),
  constraint payroll_calendar_events_calendar_scope_fk
    foreign key (payroll_calendar_id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_calendars (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
);

create table public.payroll_declaration_periods (
  id uuid primary key default gen_random_uuid(),
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  tax_registration_reference text not null check (length(trim(tax_registration_reference)) > 0),
  filing_frequency text not null check (filing_frequency in ('MONTHLY', 'FOUR_WEEKLY', 'WEEKLY', 'BIWEEKLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL')),
  starts_on date not null,
  ends_on date not null,
  statutory_period_code text not null check (length(trim(statutory_period_code)) > 0),
  filing_deadline date,
  payment_deadline date,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'OPEN', 'CLOSED')),
  created_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid,
  constraint payroll_declaration_periods_date_order check (starts_on <= ends_on),
  constraint payroll_declaration_periods_administration_scope_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_declaration_periods_scoped_id_unique
    unique (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_declaration_periods_identity_unique
    unique (payroll_administration_id, tax_registration_reference, filing_frequency, starts_on, ends_on)
);

comment on table public.payroll_declaration_periods is 'Aangifteperioden staan los van salarisperioden, betaaldatums en verwerkingsruns.';
comment on column public.payroll_declaration_periods.tax_registration_reference is 'Opaque reference to an authoritative tax registration; the tax number itself is not copied into this calendar foundation.';

create table public.payroll_declaration_period_payroll_periods (
  declaration_period_id uuid not null,
  payroll_period_id uuid not null,
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  created_at timestamptz not null default now(),
  created_by_user_id uuid,
  primary key (declaration_period_id, payroll_period_id),
  constraint payroll_declaration_period_period_scope_fk
    foreign key (declaration_period_id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_declaration_periods (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_declaration_period_payroll_period_scope_fk
    foreign key (payroll_period_id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_periods (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
);

create function public.validate_payroll_period_calendar_and_lineage()
returns trigger
language plpgsql
as $$
declare
  calendar public.payroll_calendars%rowtype;
  original_period public.payroll_periods%rowtype;
  superseded_period public.payroll_periods%rowtype;
  period_days integer;
  year_offset integer;
  first_period_index integer;
  assigned_date date;
  expected_starts_on date;
  expected_ends_on date;
  expected_rule_date date;
  rule jsonb;
  rule_kind text;
  rule_days integer;
  target_month date;
  target_month_end date;
  requested_day integer;
  expected_snapshot jsonb;
begin
  if tg_op = 'UPDATE' and row(
    new.payroll_administration_id, new.source_tenant_id, new.source_hr_group_id, new.source_administration_id,
    new.calendar_id, new.period_year, new.period_month, new.period_number, new.periodicity, new.period_kind,
    new.period_version, new.starts_on, new.ends_on, new.planned_payment_date, new.processing_deadline,
    new.correction_of_period_id, new.supersedes_period_id
  ) is distinct from row(
    old.payroll_administration_id, old.source_tenant_id, old.source_hr_group_id, old.source_administration_id,
    old.calendar_id, old.period_year, old.period_month, old.period_number, old.periodicity, old.period_kind,
    old.period_version, old.starts_on, old.ends_on, old.planned_payment_date, old.processing_deadline,
    old.correction_of_period_id, old.supersedes_period_id
  ) then
    raise exception 'A payroll period identity is immutable; create a new period revision.' using errcode = '55000';
  end if;

  if new.calendar_id is not null then
    select * into calendar
    from public.payroll_calendars as candidate
    where candidate.id = new.calendar_id;

    if not found then
      raise exception 'The payroll calendar does not exist.' using errcode = '23503';
    end if;
    if new.period_kind <> 'REGULAR'
      or new.periodicity <> calendar.periodicity
      or new.period_year <> calendar.calendar_year then
      raise exception 'A calendar period must match the linked regular calendar and year.' using errcode = '23514';
    end if;

    case calendar.periodicity
      when 'MONTHLY' then
        if new.period_number not between 1 and 12 then
          raise exception 'The monthly period number is outside the calendar.' using errcode = '23514';
        end if;
        expected_starts_on := make_date(calendar.calendar_year::integer, new.period_number::integer, 1);
        expected_ends_on := (expected_starts_on + interval '1 month' - interval '1 day')::date;
      when 'QUARTERLY' then
        if new.period_number not between 1 and 4 then
          raise exception 'The quarterly period number is outside the calendar.' using errcode = '23514';
        end if;
        expected_starts_on := make_date(calendar.calendar_year::integer, ((new.period_number - 1) * 3 + 1)::integer, 1);
        expected_ends_on := (expected_starts_on + interval '3 months' - interval '1 day')::date;
      when 'SEMI_ANNUAL' then
        if new.period_number not between 1 and 2 then
          raise exception 'The semi-annual period number is outside the calendar.' using errcode = '23514';
        end if;
        expected_starts_on := make_date(calendar.calendar_year::integer, ((new.period_number - 1) * 6 + 1)::integer, 1);
        expected_ends_on := (expected_starts_on + interval '6 months' - interval '1 day')::date;
      when 'ANNUAL' then
        if new.period_number <> 1 then
          raise exception 'The annual period number is outside the calendar.' using errcode = '23514';
        end if;
        expected_starts_on := make_date(calendar.calendar_year::integer, 1, 1);
        expected_ends_on := make_date(calendar.calendar_year::integer, 12, 31);
      when 'FOUR_WEEKLY', 'WEEKLY', 'BIWEEKLY' then
        period_days := case calendar.periodicity when 'FOUR_WEEKLY' then 28 when 'BIWEEKLY' then 14 else 7 end;
        year_offset := case calendar.year_assignment when 'PERIOD_END' then period_days - 1 else 0 end;
        first_period_index := ceil(
          ((make_date(calendar.calendar_year::integer, 1, 1) - calendar.anchor_date - year_offset)::numeric / period_days)
        )::integer;
        expected_starts_on := calendar.anchor_date + ((first_period_index + new.period_number - 1) * period_days);
        expected_ends_on := expected_starts_on + period_days - 1;
      else
        raise exception 'The payroll calendar periodicity is not supported.' using errcode = '23514';
    end case;

    assigned_date := case calendar.year_assignment when 'PERIOD_END' then expected_ends_on else expected_starts_on end;
    if assigned_date < make_date(calendar.calendar_year::integer, 1, 1)
      or assigned_date > make_date(calendar.calendar_year::integer, 12, 31)
      or assigned_date < calendar.effective_from
      or assigned_date > calendar.effective_to then
      raise exception 'The payroll period does not belong to the linked calendar year and effective range.' using errcode = '23514';
    end if;
    if new.starts_on is distinct from expected_starts_on or new.ends_on is distinct from expected_ends_on then
      raise exception 'The payroll period boundaries do not match the linked calendar.' using errcode = '23514';
    end if;
    if calendar.periodicity = 'MONTHLY' and new.period_month <> new.period_number then
      raise exception 'The legacy month must match the monthly calendar period number.' using errcode = '23514';
    end if;

    rule := calendar.payment_date_rule;
    expected_rule_date := null;
    if rule is not null then
      rule_kind := rule ->> 'kind';
      if rule_kind is null then
        raise exception 'The payroll calendar payment date rule has no kind.' using errcode = '23514';
      elsif rule_kind in ('PERIOD_START_OFFSET_DAYS', 'PERIOD_END_OFFSET_DAYS') then
        if rule -> 'days' is null or jsonb_typeof(rule -> 'days') <> 'number' then
          raise exception 'The payroll calendar payment date rule requires a numeric day offset.' using errcode = '23514';
        end if;
        rule_days := (rule ->> 'days')::integer;
        if rule_days is null or rule_days not between -31 and 90 then
          raise exception 'The payroll calendar payment date rule is outside the supported range.' using errcode = '23514';
        end if;
        expected_rule_date := (case when rule_kind = 'PERIOD_START_OFFSET_DAYS' then new.starts_on else new.ends_on end) + rule_days;
      elsif rule_kind = 'MONTH_DAY' then
        if rule -> 'monthsAfterPeriodEnd' is null or jsonb_typeof(rule -> 'monthsAfterPeriodEnd') <> 'number'
          or rule -> 'dayOfMonth' is null or jsonb_typeof(rule -> 'dayOfMonth') <> 'number'
          or rule ->> 'shortMonth' is null then
          raise exception 'The payroll calendar monthly payment date rule is incomplete.' using errcode = '23514';
        end if;
        rule_days := (rule ->> 'monthsAfterPeriodEnd')::integer;
        requested_day := (rule ->> 'dayOfMonth')::integer;
        if rule_days is null or requested_day is null
          or rule_days not between -1 and 2 or requested_day not between 1 and 31
          or rule ->> 'shortMonth' not in ('LAST_DAY', 'REJECT') then
          raise exception 'The payroll calendar monthly payment date rule is invalid.' using errcode = '23514';
        end if;
        target_month := (date_trunc('month', new.ends_on)::date + make_interval(months => rule_days));
        target_month_end := (target_month + interval '1 month' - interval '1 day')::date;
        if requested_day > extract(day from target_month_end)::integer and rule ->> 'shortMonth' = 'REJECT' then
          raise exception 'The payroll calendar payment date does not exist in the target month.' using errcode = '23514';
        end if;
        expected_rule_date := target_month + least(requested_day, extract(day from target_month_end)::integer) - 1;
      else
        raise exception 'The payroll calendar payment date rule is unsupported.' using errcode = '23514';
      end if;
    end if;
    if new.planned_payment_date is distinct from expected_rule_date then
      raise exception 'The planned payment date does not match the linked calendar rule.' using errcode = '23514';
    end if;

    rule := calendar.processing_deadline_rule;
    expected_rule_date := null;
    if rule is not null then
      rule_kind := rule ->> 'kind';
      if rule_kind is null or rule_kind not in ('PERIOD_START_OFFSET_DAYS', 'PERIOD_END_OFFSET_DAYS') then
        raise exception 'The payroll calendar processing deadline rule is unsupported.' using errcode = '23514';
      end if;
      if rule -> 'days' is null or jsonb_typeof(rule -> 'days') <> 'number' then
        raise exception 'The payroll calendar processing deadline rule requires a numeric day offset.' using errcode = '23514';
      end if;
      rule_days := (rule ->> 'days')::integer;
      if rule_days is null or rule_days not between -31 and 90 then
        raise exception 'The payroll calendar processing deadline rule is outside the supported range.' using errcode = '23514';
      end if;
      expected_rule_date := (case when rule_kind = 'PERIOD_START_OFFSET_DAYS' then new.starts_on else new.ends_on end) + rule_days;
    end if;
    if new.processing_deadline is distinct from expected_rule_date then
      raise exception 'The processing deadline does not match the linked calendar rule.' using errcode = '23514';
    end if;

    expected_snapshot := jsonb_build_object(
      'calendarId', calendar.id,
      'calendarCode', calendar.calendar_code,
      'calendarName', calendar.display_name,
      'calendarVersion', calendar.version,
      'processingGroupCode', calendar.processing_group_code,
      'periodicity', calendar.periodicity,
      'calendarYear', calendar.calendar_year,
      'effectiveFrom', calendar.effective_from,
      'effectiveTo', calendar.effective_to,
      'anchorDate', calendar.anchor_date,
      'yearAssignment', calendar.year_assignment,
      'generationRules', calendar.generation_rules,
      'paymentDateRule', calendar.payment_date_rule,
      'processingDeadlineRule', calendar.processing_deadline_rule,
      'periodYear', new.period_year,
      'periodNumber', new.period_number,
      'periodMonth', new.period_month,
      'periodKind', new.period_kind,
      'periodVersion', new.period_version,
      'startsOn', new.starts_on,
      'endsOn', new.ends_on,
      'plannedPaymentDate', new.planned_payment_date,
      'processingDeadline', new.processing_deadline
    );
    new.calendar_snapshot := expected_snapshot;
    new.calendar_hash := encode(extensions.digest(convert_to(expected_snapshot::text, 'UTF8'), 'sha256'), 'hex');
  elsif new.calendar_snapshot is not null or new.calendar_hash is not null then
    raise exception 'Only calendar-backed periods may carry a calendar snapshot and hash.' using errcode = '23514';
  end if;

  if new.period_kind = 'CORRECTION' then
    select * into original_period
    from public.payroll_periods as original
    where original.id = new.correction_of_period_id;
    if not found or original_period.period_kind <> 'REGULAR' then
      raise exception 'A correction must refer to an existing regular payroll period.' using errcode = '23503';
    end if;
    if new.correction_of_period_id = new.id then
      raise exception 'A correction cannot refer to itself.' using errcode = '23514';
    end if;

    select * into superseded_period
    from public.payroll_periods as superseded
    where superseded.id = new.supersedes_period_id;
    if not found or superseded_period.period_kind not in ('REGULAR', 'CORRECTION') then
      raise exception 'A correction may supersede only a regular period or an earlier correction.' using errcode = '23503';
    end if;
    if (superseded_period.period_kind = 'REGULAR' and superseded_period.id <> original_period.id)
      or (superseded_period.period_kind = 'CORRECTION' and superseded_period.correction_of_period_id <> original_period.id) then
      raise exception 'A correction must supersede a period in the same correction lineage.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create function public.prevent_payroll_calendar_config_rewrite_after_periods()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.payroll_periods where calendar_id = old.id)
    and row(
      new.payroll_administration_id, new.source_tenant_id, new.source_hr_group_id, new.source_administration_id,
      new.processing_group_code, new.calendar_code, new.display_name, new.periodicity, new.calendar_year,
      new.version, new.effective_from, new.effective_to, new.anchor_date, new.year_assignment,
      new.generation_rules, new.payment_date_rule, new.processing_deadline_rule
    ) is distinct from row(
      old.payroll_administration_id, old.source_tenant_id, old.source_hr_group_id, old.source_administration_id,
      old.processing_group_code, old.calendar_code, old.display_name, old.periodicity, old.calendar_year,
      old.version, old.effective_from, old.effective_to, old.anchor_date, old.year_assignment,
      old.generation_rules, old.payment_date_rule, old.processing_deadline_rule
    ) then
    raise exception 'A calendar version referenced by payroll periods cannot be changed; create a new version.' using errcode = '55000';
  end if;
  return new;
end;
$$;

create function public.prevent_payroll_period_rewrite_after_input()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.calculation_input_sets where payroll_period_id = old.id)
    and row(
      new.payroll_administration_id, new.source_tenant_id, new.source_hr_group_id, new.source_administration_id,
      new.calendar_id, new.period_year, new.period_month, new.period_number, new.periodicity, new.period_kind,
      new.period_version, new.starts_on, new.ends_on, new.planned_payment_date, new.processing_deadline,
      new.correction_of_period_id, new.supersedes_period_id, new.calendar_snapshot, new.calendar_hash
    ) is distinct from row(
      old.payroll_administration_id, old.source_tenant_id, old.source_hr_group_id, old.source_administration_id,
      old.calendar_id, old.period_year, old.period_month, old.period_number, old.periodicity, old.period_kind,
      old.period_version, old.starts_on, old.ends_on, old.planned_payment_date, old.processing_deadline,
      old.correction_of_period_id, old.supersedes_period_id, old.calendar_snapshot, old.calendar_hash
    ) then
    raise exception 'A payroll period referenced by an input set cannot be changed; create a new revision.' using errcode = '55000';
  end if;
  return new;
end;
$$;

create function public.record_payroll_calendar_event()
returns trigger
language plpgsql
as $$
declare
  recorded_event text;
begin
  if tg_op = 'INSERT' then
    recorded_event := 'CREATED';
  elsif old.status is distinct from new.status and new.status = 'ACTIVE' then
    recorded_event := 'ACTIVATED';
  elsif old.status is distinct from new.status and new.status = 'RETIRED' then
    recorded_event := 'RETIRED';
  else
    recorded_event := 'UPDATED';
  end if;

  insert into public.payroll_calendar_events (
    payroll_calendar_id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id,
    event_type, event_payload, actor_user_id
  ) values (
    new.id, new.payroll_administration_id, new.source_tenant_id, new.source_hr_group_id, new.source_administration_id,
    recorded_event,
    jsonb_build_object('calendarCode', new.calendar_code, 'calendarYear', new.calendar_year, 'version', new.version, 'status', new.status),
    coalesce(new.updated_by_user_id, new.created_by_user_id)
  );
  return new;
end;
$$;

create trigger payroll_calendars_config_immutable_after_periods
  before update on public.payroll_calendars
  for each row execute function public.prevent_payroll_calendar_config_rewrite_after_periods();
create trigger payroll_periods_immutable_after_input
  before update on public.payroll_periods
  for each row execute function public.prevent_payroll_period_rewrite_after_input();
create trigger payroll_periods_calendar_lineage_guard
  before insert or update on public.payroll_periods
  for each row execute function public.validate_payroll_period_calendar_and_lineage();
create trigger payroll_calendars_audit_event
  after insert or update on public.payroll_calendars
  for each row execute function public.record_payroll_calendar_event();

alter table public.payroll_calendars enable row level security;
alter table public.payroll_calendar_events enable row level security;
alter table public.payroll_declaration_periods enable row level security;
alter table public.payroll_declaration_period_payroll_periods enable row level security;

create policy payroll_calendars_service_role_only on public.payroll_calendars for all to service_role using (true) with check (true);
create policy payroll_calendar_events_service_role_only on public.payroll_calendar_events for all to service_role using (true) with check (true);
create policy payroll_declaration_periods_service_role_only on public.payroll_declaration_periods for all to service_role using (true) with check (true);
create policy payroll_declaration_period_periods_service_role_only on public.payroll_declaration_period_payroll_periods for all to service_role using (true) with check (true);

revoke all on function public.prevent_payroll_calendar_config_rewrite_after_periods() from public, anon, authenticated, service_role;
revoke all on function public.prevent_payroll_period_rewrite_after_input() from public, anon, authenticated, service_role;
revoke all on function public.record_payroll_calendar_event() from public, anon, authenticated, service_role;
revoke all on function public.enforce_payroll_calendar_activation_range() from public, anon, authenticated, service_role;
revoke all on function public.validate_payroll_period_calendar_and_lineage() from public, anon, authenticated, service_role;
revoke all on table public.payroll_calendars, public.payroll_calendar_events,
  public.payroll_declaration_periods, public.payroll_declaration_period_payroll_periods
  from public, anon, authenticated, service_role;

grant usage on schema public to service_role;
grant select, insert, update on table public.payroll_calendars to service_role;
grant select, insert on table public.payroll_calendar_events to service_role;
grant select, insert, update on table public.payroll_declaration_periods to service_role;
grant select, insert on table public.payroll_declaration_period_payroll_periods to service_role;
grant update (status, updated_at, updated_by_user_id) on table public.payroll_periods to service_role;

commit;
