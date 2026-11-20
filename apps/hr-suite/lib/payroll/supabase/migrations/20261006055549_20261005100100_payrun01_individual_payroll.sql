begin;

alter table public.calculation_runs
  drop constraint if exists calculation_runs_run_type_check;
alter table public.calculation_runs
  add constraint calculation_runs_run_type_check
  check (run_type in ('PREVIEW', 'RECALCULATION', 'GOLDEN_CASE', 'INDIVIDUAL_PAYROLL'));

create table public.payroll_individual_arrangement_assignment_versions (
  id uuid primary key default gen_random_uuid(),
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  assignment_id uuid not null,
  assignment_version integer not null check (assignment_version > 0),
  source_employment_id uuid not null,
  effective_from date not null,
  effective_to date,
  assignment_json jsonb not null check (jsonb_typeof(assignment_json) = 'object'),
  assignment_hash text not null check (assignment_hash ~ '^[0-9a-f]{64}$'),
  provenance_status text not null check (provenance_status in ('TEST_ONLY', 'PAYROLL_OWNED')),
  provenance_source text not null check (length(trim(provenance_source)) > 0),
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null,
  constraint payroll_individual_arrangement_assignment_dates_valid
    check (effective_to is null or effective_to >= effective_from),
  constraint payroll_individual_arrangement_assignment_scope_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_individual_arrangement_assignment_version_unique
    unique (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, assignment_id, assignment_version),
  constraint payroll_individual_arrangement_assignment_scoped_id_unique
    unique (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_individual_arrangement_assignment_scoped_employment_unique
    unique (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id)
);

comment on table public.payroll_individual_arrangement_assignment_versions is
  'Immutable, effective-dated Payroll arrangement versions keyed by opaque Core employment UUID; this is not a Core or CONTROL02 contract.';

create table public.payroll_individual_calculation_config_versions (
  id uuid primary key default gen_random_uuid(),
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  source_employment_id uuid not null,
  config_version integer not null check (config_version > 0),
  effective_from date not null,
  effective_to date,
  config_json jsonb not null check (jsonb_typeof(config_json) = 'object'),
  config_hash text not null check (config_hash ~ '^[0-9a-f]{64}$'),
  provenance_status text not null check (provenance_status in ('TEST_ONLY', 'PAYROLL_OWNED')),
  provenance_source text not null check (length(trim(provenance_source)) > 0),
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null,
  constraint payroll_individual_calculation_config_dates_valid
    check (effective_to is null or effective_to >= effective_from),
  constraint payroll_individual_calculation_config_scope_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_individual_calculation_config_version_unique
    unique (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id, config_version),
  constraint payroll_individual_calculation_config_scoped_id_unique
    unique (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_individual_calculation_config_scoped_employment_unique
    unique (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id)
);

comment on table public.payroll_individual_calculation_config_versions is
  'Versioned Payroll-owned test calculation inputs for a bounded slice, including explicit IKV/tax fallback; not canonical Core IncomeRelationship data.';

create table public.payroll_individual_arrangement_composition_snapshots (
  id uuid primary key default gen_random_uuid(),
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  assignment_version_id uuid not null,
  source_employment_id uuid not null,
  as_of_date date not null,
  snapshot_json jsonb not null check (jsonb_typeof(snapshot_json) = 'object'),
  snapshot_hash text not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null,
  constraint payroll_individual_arrangement_snapshot_scope_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_individual_arrangement_snapshot_assignment_fk
    foreign key (assignment_version_id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id)
    references public.payroll_individual_arrangement_assignment_versions (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id),
  constraint payroll_individual_arrangement_snapshot_replay_unique
    unique (assignment_version_id, as_of_date),
  constraint payroll_individual_arrangement_snapshot_scoped_id_unique
    unique (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id)
);

create table public.payroll_opening_cumulative_snapshots (
  id uuid primary key default gen_random_uuid(),
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  source_employment_id uuid not null,
  snapshot_version integer not null check (snapshot_version > 0),
  as_of_date date not null,
  opening_balance_json jsonb not null check (jsonb_typeof(opening_balance_json) = 'object'),
  snapshot_hash text not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  provenance_status text not null check (provenance_status in ('TEST_OPENING_BALANCE', 'RECONSTRUCTED_PAYROLL')),
  provenance_source text not null check (length(trim(provenance_source)) > 0),
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null,
  constraint payroll_opening_cumulative_scope_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_opening_cumulative_version_unique
    unique (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id, snapshot_version),
  constraint payroll_opening_cumulative_scoped_id_unique
    unique (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id)
);

create table public.individual_payroll_input_references (
  id uuid primary key default gen_random_uuid(),
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  calculation_input_set_id uuid not null,
  source_employment_id uuid not null,
  assignment_version_id uuid not null,
  arrangement_snapshot_id uuid not null,
  config_version_id uuid not null,
  opening_cumulative_snapshot_id uuid not null,
  input_provenance_json jsonb not null check (jsonb_typeof(input_provenance_json) = 'object'),
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null,
  constraint individual_payroll_input_refs_scope_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint individual_payroll_input_refs_input_set_fk
    foreign key (calculation_input_set_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.calculation_input_sets (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint individual_payroll_input_refs_assignment_fk
    foreign key (assignment_version_id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id)
    references public.payroll_individual_arrangement_assignment_versions (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id),
  constraint individual_payroll_input_refs_arrangement_fk
    foreign key (arrangement_snapshot_id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id)
    references public.payroll_individual_arrangement_composition_snapshots (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id),
  constraint individual_payroll_input_refs_config_fk
    foreign key (config_version_id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id)
    references public.payroll_individual_calculation_config_versions (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id),
  constraint individual_payroll_input_refs_opening_fk
    foreign key (opening_cumulative_snapshot_id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id)
    references public.payroll_opening_cumulative_snapshots (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id),
  constraint individual_payroll_input_refs_unique unique (calculation_input_set_id)
);

comment on table public.individual_payroll_input_references is
  'Pins every versioned assignment, composition, Payroll-owned config, opening cumulative, and its provenance into the hash-bound calculation input set.';

create table public.individual_payroll_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  payroll_period_id uuid not null,
  source_employment_id uuid not null,
  calculation_run_id uuid not null,
  revision integer not null check (revision > 0),
  event_sequence smallint not null check (event_sequence between 1 and 3),
  event_type text not null check (event_type in ('BLOCKED', 'CONCEPT', 'REVIEWED', 'FINALIZED')),
  event_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(event_payload) = 'object'),
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null,
  constraint individual_payroll_lifecycle_scope_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint individual_payroll_lifecycle_period_fk
    foreign key (payroll_period_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_periods (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint individual_payroll_lifecycle_run_fk
    foreign key (calculation_run_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.calculation_runs (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint individual_payroll_lifecycle_revision_sequence_unique
    unique (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, payroll_period_id, source_employment_id, revision, event_sequence)
);

create index individual_payroll_lifecycle_period_idx
  on public.individual_payroll_lifecycle_events (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, payroll_period_id, source_employment_id, revision desc, event_sequence desc);

create table public.payroll_individual_artifacts (
  id uuid primary key default gen_random_uuid(),
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  calculation_run_id uuid not null,
  artifact_type text not null check (artifact_type in ('PAYSLIP_PDF', 'TECHNICAL_JSON')),
  file_name text not null check (length(trim(file_name)) > 0),
  content_type text not null check (length(trim(content_type)) > 0),
  artifact_bytes bytea not null,
  artifact_hash text not null check (artifact_hash ~ '^[0-9a-f]{64}$'),
  provenance_json jsonb not null check (jsonb_typeof(provenance_json) = 'object'),
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null,
  constraint payroll_individual_artifacts_scope_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_individual_artifacts_run_fk
    foreign key (calculation_run_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.calculation_runs (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_individual_artifacts_unique unique (calculation_run_id, artifact_type)
);

create index payroll_individual_artifacts_run_idx
  on public.payroll_individual_artifacts (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, calculation_run_id);

create function public.reject_payroll_individual_immutable_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception using errcode = '23514', message = 'PAYRUN01 versioned inputs and artifacts are immutable.';
end;
$$;

create function public.lock_payrun01_run(p_calculation_run_id uuid)
returns void
language plpgsql
as $$
declare
  subject_lock_key text;
begin
  select run.payroll_administration_id::text || ':' || run.source_tenant_id::text || ':'
      || run.source_hr_group_id::text || ':' || run.source_administration_id::text || ':'
      || input_ref.source_employment_id::text
    into subject_lock_key
    from public.calculation_runs as run
    join public.individual_payroll_input_references as input_ref
      on input_ref.calculation_input_set_id = run.calculation_input_set_id
     and input_ref.payroll_administration_id = run.payroll_administration_id
     and input_ref.source_tenant_id = run.source_tenant_id
     and input_ref.source_hr_group_id = run.source_hr_group_id
     and input_ref.source_administration_id = run.source_administration_id
    where run.id = p_calculation_run_id
      and run.run_type = 'INDIVIDUAL_PAYROLL';

  if subject_lock_key is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('payrun01:subject:' || subject_lock_key, 0));
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('payrun01:run:' || p_calculation_run_id::text, 0));
end;
$$;

create function public.payrun01_mark_succeeded_with_concept(
  p_payroll_administration_id uuid,
  p_source_tenant_id uuid,
  p_source_hr_group_id uuid,
  p_source_administration_id uuid,
  p_calculation_run_id uuid,
  p_payroll_period_id uuid,
  p_source_employment_id uuid,
  p_actor_user_id uuid,
  p_finished_at timestamptz,
  p_result_hash text,
  p_event_payload jsonb
)
returns setof public.calculation_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_run public.calculation_runs%rowtype;
  next_revision integer;
begin
  perform public.lock_payrun01_run(p_calculation_run_id);

  select run.* into current_run
    from public.calculation_runs as run
    where run.id = p_calculation_run_id
      and run.payroll_administration_id = p_payroll_administration_id
      and run.source_tenant_id = p_source_tenant_id
      and run.source_hr_group_id = p_source_hr_group_id
      and run.source_administration_id = p_source_administration_id
      and run.run_type = 'INDIVIDUAL_PAYROLL'
      and run.status = 'RUNNING'
    for update;
  if not found
    or jsonb_typeof(p_event_payload) is distinct from 'object'
    or p_result_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '23514', message = 'PAYRUN01 concept completion requires a scoped running individual payroll and valid result payload.';
  end if;

  if not exists (
    select 1
      from public.individual_payroll_input_references as input_ref
      join public.calculation_input_sets as input_set
        on input_set.id = input_ref.calculation_input_set_id
       and input_set.source_tenant_id = input_ref.source_tenant_id
       and input_set.source_hr_group_id = input_ref.source_hr_group_id
       and input_set.source_administration_id = input_ref.source_administration_id
      where input_ref.calculation_input_set_id = current_run.calculation_input_set_id
        and input_ref.payroll_administration_id = p_payroll_administration_id
        and input_ref.source_tenant_id = p_source_tenant_id
        and input_ref.source_hr_group_id = p_source_hr_group_id
        and input_ref.source_administration_id = p_source_administration_id
        and input_ref.source_employment_id = p_source_employment_id
        and input_set.payroll_period_id = p_payroll_period_id
  ) then
    raise exception using errcode = '23514', message = 'PAYRUN01 concept completion input reference does not match its period and employment.';
  end if;

  update public.calculation_runs as run
    set status = 'SUCCEEDED',
        finished_at = p_finished_at,
        result_hash = p_result_hash,
        updated_at = now(),
        updated_by_user_id = p_actor_user_id
    where run.id = p_calculation_run_id
      and run.payroll_administration_id = p_payroll_administration_id
      and run.source_tenant_id = p_source_tenant_id
      and run.source_hr_group_id = p_source_hr_group_id
      and run.source_administration_id = p_source_administration_id;

  select coalesce(max(event.revision), 0) + 1 into next_revision
    from public.individual_payroll_lifecycle_events as event
    where event.payroll_administration_id = p_payroll_administration_id
      and event.source_tenant_id = p_source_tenant_id
      and event.source_hr_group_id = p_source_hr_group_id
      and event.source_administration_id = p_source_administration_id
      and event.payroll_period_id = p_payroll_period_id
      and event.source_employment_id = p_source_employment_id;

  insert into public.individual_payroll_lifecycle_events (
    payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id,
    payroll_period_id, source_employment_id, calculation_run_id, revision, event_sequence,
    event_type, event_payload, created_by_user_id
  ) values (
    p_payroll_administration_id, p_source_tenant_id, p_source_hr_group_id, p_source_administration_id,
    p_payroll_period_id, p_source_employment_id, p_calculation_run_id, next_revision, 1,
    'CONCEPT', p_event_payload, p_actor_user_id
  );

  return query
    select run.* from public.calculation_runs as run
    where run.id = p_calculation_run_id
      and run.payroll_administration_id = p_payroll_administration_id
      and run.source_tenant_id = p_source_tenant_id
      and run.source_hr_group_id = p_source_hr_group_id
      and run.source_administration_id = p_source_administration_id;
end;
$$;

create function public.guard_payroll_individual_effective_version()
returns trigger
language plpgsql
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    new.payroll_administration_id::text || ':' || new.source_employment_id::text || ':' || tg_table_name,
    0
  ));

  if exists (
    select 1
    from public.payroll_individual_arrangement_assignment_versions as existing
    where tg_table_name = 'payroll_individual_arrangement_assignment_versions'
      and existing.payroll_administration_id = new.payroll_administration_id
      and existing.source_tenant_id = new.source_tenant_id
      and existing.source_hr_group_id = new.source_hr_group_id
      and existing.source_administration_id = new.source_administration_id
      and existing.source_employment_id = new.source_employment_id
      and existing.effective_from <= coalesce(new.effective_to, 'infinity'::date)
      and coalesce(existing.effective_to, 'infinity'::date) >= new.effective_from
  ) or exists (
    select 1
    from public.payroll_individual_calculation_config_versions as existing
    where tg_table_name = 'payroll_individual_calculation_config_versions'
      and existing.payroll_administration_id = new.payroll_administration_id
      and existing.source_tenant_id = new.source_tenant_id
      and existing.source_hr_group_id = new.source_hr_group_id
      and existing.source_administration_id = new.source_administration_id
      and existing.source_employment_id = new.source_employment_id
      and existing.effective_from <= coalesce(new.effective_to, 'infinity'::date)
      and coalesce(existing.effective_to, 'infinity'::date) >= new.effective_from
  ) then
    raise exception using errcode = '23514', message = 'PAYRUN01 effective-dated versions may not overlap for one employment.';
  end if;
  return new;
end;
$$;

create function public.guard_individual_payroll_lifecycle_event()
returns trigger
language plpgsql
as $$
declare
  prior_event text;
  prior_run_id uuid;
  latest_revision integer;
  run_status text;
  run_type text;
  linked_employment_id uuid;
  linked_period_id uuid;
begin
  perform public.lock_payrun01_run(new.calculation_run_id);

  select run.status, run.run_type, input_ref.source_employment_id, input_set.payroll_period_id
    into run_status, run_type, linked_employment_id, linked_period_id
    from public.calculation_runs as run
    join public.individual_payroll_input_references as input_ref
      on input_ref.calculation_input_set_id = run.calculation_input_set_id
     and input_ref.source_tenant_id = run.source_tenant_id
     and input_ref.source_hr_group_id = run.source_hr_group_id
     and input_ref.source_administration_id = run.source_administration_id
    join public.calculation_input_sets as input_set
      on input_set.id = run.calculation_input_set_id
     and input_set.source_tenant_id = run.source_tenant_id
     and input_set.source_hr_group_id = run.source_hr_group_id
     and input_set.source_administration_id = run.source_administration_id
    where run.id = new.calculation_run_id
      and run.payroll_administration_id = new.payroll_administration_id
      and run.source_tenant_id = new.source_tenant_id
      and run.source_hr_group_id = new.source_hr_group_id
      and run.source_administration_id = new.source_administration_id;
  if not found or run_type <> 'INDIVIDUAL_PAYROLL'
    or linked_employment_id is distinct from new.source_employment_id
    or linked_period_id is distinct from new.payroll_period_id then
    raise exception using errcode = '23514', message = 'PAYRUN01 lifecycle requires an individual payroll run in the same scope.';
  end if;

  select max(event.revision)
    into latest_revision
    from public.individual_payroll_lifecycle_events as event
    where event.payroll_administration_id = new.payroll_administration_id
      and event.source_tenant_id = new.source_tenant_id
      and event.source_hr_group_id = new.source_hr_group_id
      and event.source_administration_id = new.source_administration_id
      and event.payroll_period_id = new.payroll_period_id
      and event.source_employment_id = new.source_employment_id;

  if (new.event_sequence = 1 and new.revision <> coalesce(latest_revision, 0) + 1)
    or (new.event_sequence > 1 and new.revision is distinct from latest_revision) then
    raise exception using errcode = '23514', message = 'PAYRUN01 lifecycle revisions must advance one at a time and transitions must use the latest revision.';
  end if;

  select event.event_type, event.calculation_run_id
    into prior_event, prior_run_id
    from public.individual_payroll_lifecycle_events as event
    where event.payroll_administration_id = new.payroll_administration_id
      and event.source_tenant_id = new.source_tenant_id
      and event.source_hr_group_id = new.source_hr_group_id
      and event.source_administration_id = new.source_administration_id
      and event.payroll_period_id = new.payroll_period_id
      and event.source_employment_id = new.source_employment_id
      and event.revision = new.revision
    order by event.event_sequence desc
    limit 1;

  if new.event_type = 'BLOCKED' then
    if new.event_sequence <> 1 or prior_event is not null or run_status not in ('FAILED', 'SUCCEEDED') then
      raise exception using errcode = '23514', message = 'A blocked PAYRUN01 revision requires a terminal run and no prior lifecycle event.';
    end if;
  elsif new.event_type = 'CONCEPT' then
    if new.event_sequence <> 1 or prior_event is not null or run_status <> 'SUCCEEDED' then
      raise exception using errcode = '23514', message = 'A PAYRUN01 concept requires a successful run and no prior lifecycle event.';
    end if;
  elsif new.event_type = 'REVIEWED' then
    if new.event_sequence <> 2
      or prior_event is distinct from 'CONCEPT'
      or prior_run_id is distinct from new.calculation_run_id
      or run_status <> 'SUCCEEDED' then
      raise exception using errcode = '23514', message = 'PAYRUN01 review must follow a successful concept.';
    end if;
    if exists (
      select 1 from public.payroll_controls as control
      where control.calculation_run_id = new.calculation_run_id
        and control.payroll_administration_id = new.payroll_administration_id
        and control.source_tenant_id = new.source_tenant_id
        and control.source_hr_group_id = new.source_hr_group_id
        and control.source_administration_id = new.source_administration_id
        and control.status = 'FAIL'
    ) then
      raise exception using errcode = '23514', message = 'PAYRUN01 cannot be reviewed while blocking controls fail.';
    end if;
  elsif new.event_type = 'FINALIZED' then
    if new.event_sequence <> 3
      or prior_event is distinct from 'REVIEWED'
      or prior_run_id is distinct from new.calculation_run_id
      or run_status <> 'SUCCEEDED' then
      raise exception using errcode = '23514', message = 'PAYRUN01 finalization must follow a successful review.';
    end if;
    if exists (
      select 1 from public.payroll_controls as control
      where control.calculation_run_id = new.calculation_run_id
        and control.payroll_administration_id = new.payroll_administration_id
        and control.source_tenant_id = new.source_tenant_id
        and control.source_hr_group_id = new.source_hr_group_id
        and control.source_administration_id = new.source_administration_id
        and control.status = 'FAIL'
    ) then
      raise exception using errcode = '23514', message = 'PAYRUN01 cannot be finalized while blocking controls fail.';
    end if;
  end if;
  return new;
end;
$$;

create function public.guard_individual_payroll_input_reference()
returns trigger
language plpgsql
as $$
declare
  assignment_employment_id uuid;
  config_employment_id uuid;
  opening_employment_id uuid;
  snapshot_assignment_version_id uuid;
  input_set_snapshot_id uuid;
  input_set_period_id uuid;
  source_employment_id uuid;
  source_period_reference date;
  period_start date;
  assignment_start date;
  assignment_end date;
  arrangement_snapshot_as_of date;
  config_start date;
  config_end date;
  opening_as_of date;
  period_end date;
begin
  select source_employment_id, effective_from, effective_to
    into assignment_employment_id, assignment_start, assignment_end
    from public.payroll_individual_arrangement_assignment_versions
    where id = new.assignment_version_id
      and payroll_administration_id = new.payroll_administration_id
      and source_tenant_id = new.source_tenant_id
      and source_hr_group_id = new.source_hr_group_id
      and source_administration_id = new.source_administration_id;
  select source_employment_id, effective_from, effective_to
    into config_employment_id, config_start, config_end
    from public.payroll_individual_calculation_config_versions
    where id = new.config_version_id
      and payroll_administration_id = new.payroll_administration_id
      and source_tenant_id = new.source_tenant_id
      and source_hr_group_id = new.source_hr_group_id
      and source_administration_id = new.source_administration_id;
  select source_employment_id, as_of_date
    into opening_employment_id, opening_as_of
    from public.payroll_opening_cumulative_snapshots
    where id = new.opening_cumulative_snapshot_id
      and payroll_administration_id = new.payroll_administration_id
      and source_tenant_id = new.source_tenant_id
      and source_hr_group_id = new.source_hr_group_id
      and source_administration_id = new.source_administration_id;
  select assignment_version_id, as_of_date
    into snapshot_assignment_version_id, arrangement_snapshot_as_of
    from public.payroll_individual_arrangement_composition_snapshots
    where id = new.arrangement_snapshot_id
      and payroll_administration_id = new.payroll_administration_id
      and source_tenant_id = new.source_tenant_id
      and source_hr_group_id = new.source_hr_group_id
      and source_administration_id = new.source_administration_id;
  select input_set.source_snapshot_id, input_set.payroll_period_id,
         source_snapshot.source_employment_id, source_snapshot.period_reference,
         payroll_period.starts_on, payroll_period.ends_on
    into input_set_snapshot_id, input_set_period_id, source_employment_id,
         source_period_reference, period_start, period_end
    from public.calculation_input_sets as input_set
    join public.source_snapshots as source_snapshot
      on source_snapshot.id = input_set.source_snapshot_id
     and source_snapshot.source_tenant_id = input_set.source_tenant_id
     and source_snapshot.source_hr_group_id = input_set.source_hr_group_id
     and source_snapshot.source_administration_id = input_set.source_administration_id
    join public.payroll_periods as payroll_period
      on payroll_period.id = input_set.payroll_period_id
     and payroll_period.source_tenant_id = input_set.source_tenant_id
     and payroll_period.source_hr_group_id = input_set.source_hr_group_id
     and payroll_period.source_administration_id = input_set.source_administration_id
    where input_set.id = new.calculation_input_set_id
      and input_set.payroll_administration_id = new.payroll_administration_id
      and input_set.source_tenant_id = new.source_tenant_id
      and input_set.source_hr_group_id = new.source_hr_group_id
      and input_set.source_administration_id = new.source_administration_id;

  if not found
    or assignment_employment_id is distinct from new.source_employment_id
    or config_employment_id is distinct from new.source_employment_id
    or opening_employment_id is distinct from new.source_employment_id
    or source_employment_id is distinct from new.source_employment_id
    or snapshot_assignment_version_id is distinct from new.assignment_version_id
    or input_set_snapshot_id is null
    or input_set_period_id is null
    or source_period_reference is distinct from period_start
    or arrangement_snapshot_as_of is distinct from period_start
    or assignment_start > period_start
    or (assignment_end is not null and assignment_end < period_end)
    or config_start > period_start
    or (config_end is not null and config_end < period_end)
    or opening_as_of <> (period_start - 1) then
    raise exception using errcode = '23514', message = 'PAYRUN01 input references must pin one employment, its effective versions, source snapshot, period, and prior opening balance.';
  end if;
  return new;
end;
$$;

create function public.require_finalized_individual_payroll_artifact()
returns trigger
language plpgsql
as $$
begin
  perform public.lock_payrun01_run(new.calculation_run_id);

  if not exists (
    select 1 from public.individual_payroll_lifecycle_events as event
    where event.calculation_run_id = new.calculation_run_id
      and event.payroll_administration_id = new.payroll_administration_id
      and event.source_tenant_id = new.source_tenant_id
      and event.source_hr_group_id = new.source_hr_group_id
      and event.source_administration_id = new.source_administration_id
      and event.event_type = 'FINALIZED'
  ) then
    raise exception using errcode = '23514', message = 'PAYRUN01 artifacts require a finalized persisted result.';
  end if;
  return new;
end;
$$;

create function public.reject_finalized_individual_payroll_mutation()
returns trigger
language plpgsql
as $$
declare
  target_run_ids uuid[] := array[]::uuid[];
  target_row_ids uuid[] := array[]::uuid[];
  target_run_id uuid;
begin
  if tg_table_name = 'calculation_runs' then
    if tg_op = 'DELETE' then
      target_run_ids := array[old.id];
    elsif tg_op = 'INSERT' then
      target_run_ids := array[new.id];
    else
      target_run_ids := array[old.id, new.id];
    end if;
  elsif tg_table_name = 'calculation_input_sets' then
    if tg_op = 'DELETE' then
      target_row_ids := array[old.id];
    elsif tg_op = 'INSERT' then
      target_row_ids := array[new.id];
    else
      target_row_ids := array[old.id, new.id];
    end if;
    select coalesce(array_agg(run.id), array[]::uuid[])
      into target_run_ids
      from public.calculation_runs as run
      where run.run_type = 'INDIVIDUAL_PAYROLL'
        and run.calculation_input_set_id = any(target_row_ids);
  elsif tg_table_name = 'source_snapshots' then
    if tg_op = 'DELETE' then
      target_row_ids := array[old.id];
    elsif tg_op = 'INSERT' then
      target_row_ids := array[new.id];
    else
      target_row_ids := array[old.id, new.id];
    end if;
    select coalesce(array_agg(run.id), array[]::uuid[])
      into target_run_ids
      from public.calculation_runs as run
      join public.calculation_input_sets as input_set
        on input_set.id = run.calculation_input_set_id
       and input_set.source_tenant_id = run.source_tenant_id
       and input_set.source_hr_group_id = run.source_hr_group_id
       and input_set.source_administration_id = run.source_administration_id
      where run.run_type = 'INDIVIDUAL_PAYROLL'
        and input_set.source_snapshot_id = any(target_row_ids);
  else
    if tg_op = 'DELETE' then
      target_run_ids := array[old.calculation_run_id];
    elsif tg_op = 'INSERT' then
      target_run_ids := array[new.calculation_run_id];
    else
      target_run_ids := array[old.calculation_run_id, new.calculation_run_id];
    end if;
  end if;

  for target_run_id in
    select distinct candidate.run_id
      from pg_catalog.unnest(target_run_ids) as candidate(run_id)
      where candidate.run_id is not null
      order by candidate.run_id
  loop
    perform public.lock_payrun01_run(target_run_id);
  end loop;

  if cardinality(target_run_ids) > 0 and exists (
    select 1
      from public.individual_payroll_lifecycle_events as event
      where event.calculation_run_id = any(target_run_ids)
        and event.event_type = 'FINALIZED'
  ) then
    raise exception using errcode = '23514', message = 'Finalized PAYRUN01 results and their source inputs are immutable.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

alter function public.reject_payroll_individual_immutable_mutation()
  set search_path = '';
alter function public.lock_payrun01_run(uuid)
  set search_path = '';
alter function public.payrun01_mark_succeeded_with_concept(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, text, jsonb)
  set search_path = '';
alter function public.guard_payroll_individual_effective_version()
  set search_path = '';
alter function public.guard_individual_payroll_lifecycle_event()
  set search_path = '';
alter function public.guard_individual_payroll_input_reference()
  set search_path = '';
alter function public.require_finalized_individual_payroll_artifact()
  set search_path = '';
alter function public.reject_finalized_individual_payroll_mutation()
  set search_path = '';

create trigger payroll_individual_assignment_immutable
  before update or delete on public.payroll_individual_arrangement_assignment_versions
  for each row execute function public.reject_payroll_individual_immutable_mutation();
create trigger payroll_individual_assignment_effective_version_guard
  before insert on public.payroll_individual_arrangement_assignment_versions
  for each row execute function public.guard_payroll_individual_effective_version();
create trigger payroll_individual_config_immutable
  before update or delete on public.payroll_individual_calculation_config_versions
  for each row execute function public.reject_payroll_individual_immutable_mutation();
create trigger payroll_individual_config_effective_version_guard
  before insert on public.payroll_individual_calculation_config_versions
  for each row execute function public.guard_payroll_individual_effective_version();
create trigger payroll_individual_composition_immutable
  before update or delete on public.payroll_individual_arrangement_composition_snapshots
  for each row execute function public.reject_payroll_individual_immutable_mutation();
create trigger payroll_opening_cumulative_immutable
  before update or delete on public.payroll_opening_cumulative_snapshots
  for each row execute function public.reject_payroll_individual_immutable_mutation();
create trigger individual_payroll_input_refs_immutable
  before update or delete on public.individual_payroll_input_references
  for each row execute function public.reject_payroll_individual_immutable_mutation();
create trigger individual_payroll_input_refs_guard
  before insert on public.individual_payroll_input_references
  for each row execute function public.guard_individual_payroll_input_reference();
create trigger individual_payroll_lifecycle_guard
  before insert on public.individual_payroll_lifecycle_events
  for each row execute function public.guard_individual_payroll_lifecycle_event();
create trigger individual_payroll_lifecycle_immutable
  before update or delete on public.individual_payroll_lifecycle_events
  for each row execute function public.reject_payroll_individual_immutable_mutation();
create trigger payroll_individual_artifacts_finalized_guard
  before insert on public.payroll_individual_artifacts
  for each row execute function public.require_finalized_individual_payroll_artifact();
create trigger payroll_individual_artifacts_immutable
  before update or delete on public.payroll_individual_artifacts
  for each row execute function public.reject_payroll_individual_immutable_mutation();
create trigger calculation_runs_finalized_immutable
  before update or delete on public.calculation_runs
  for each row execute function public.reject_finalized_individual_payroll_mutation();
create trigger calculation_input_sets_finalized_immutable
  before update or delete on public.calculation_input_sets
  for each row execute function public.reject_finalized_individual_payroll_mutation();
create trigger source_snapshots_finalized_immutable
  before update or delete on public.source_snapshots
  for each row execute function public.reject_finalized_individual_payroll_mutation();
create trigger component_results_finalized_immutable
  before insert or update or delete on public.component_results
  for each row execute function public.reject_finalized_individual_payroll_mutation();
create trigger calculation_traces_finalized_immutable
  before insert or update or delete on public.calculation_traces
  for each row execute function public.reject_finalized_individual_payroll_mutation();
create trigger payroll_controls_finalized_immutable
  before insert or update or delete on public.payroll_controls
  for each row execute function public.reject_finalized_individual_payroll_mutation();

alter table public.payroll_individual_arrangement_assignment_versions enable row level security;
alter table public.payroll_individual_calculation_config_versions enable row level security;
alter table public.payroll_individual_arrangement_composition_snapshots enable row level security;
alter table public.payroll_opening_cumulative_snapshots enable row level security;
alter table public.individual_payroll_input_references enable row level security;
alter table public.individual_payroll_lifecycle_events enable row level security;
alter table public.payroll_individual_artifacts enable row level security;

create policy payroll_individual_assignment_service_role_only on public.payroll_individual_arrangement_assignment_versions for all to service_role using (true) with check (true);
create policy payroll_individual_config_service_role_only on public.payroll_individual_calculation_config_versions for all to service_role using (true) with check (true);
create policy payroll_individual_composition_service_role_only on public.payroll_individual_arrangement_composition_snapshots for all to service_role using (true) with check (true);
create policy payroll_opening_cumulative_service_role_only on public.payroll_opening_cumulative_snapshots for all to service_role using (true) with check (true);
create policy individual_payroll_input_refs_service_role_only on public.individual_payroll_input_references for all to service_role using (true) with check (true);
create policy individual_payroll_lifecycle_service_role_only on public.individual_payroll_lifecycle_events for all to service_role using (true) with check (true);
create policy payroll_individual_artifacts_service_role_only on public.payroll_individual_artifacts for all to service_role using (true) with check (true);

revoke all on function public.reject_payroll_individual_immutable_mutation() from public, anon, authenticated, service_role;
revoke all on function public.lock_payrun01_run(uuid) from public, anon, authenticated;
grant execute on function public.lock_payrun01_run(uuid) to service_role;
revoke all on function public.payrun01_mark_succeeded_with_concept(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, text, jsonb) from public, anon, authenticated;
grant execute on function public.payrun01_mark_succeeded_with_concept(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, text, jsonb) to service_role;
revoke all on function public.guard_payroll_individual_effective_version() from public, anon, authenticated, service_role;
revoke all on function public.guard_individual_payroll_lifecycle_event() from public, anon, authenticated, service_role;
revoke all on function public.guard_individual_payroll_input_reference() from public, anon, authenticated, service_role;
revoke all on function public.require_finalized_individual_payroll_artifact() from public, anon, authenticated, service_role;
revoke all on function public.reject_finalized_individual_payroll_mutation() from public, anon, authenticated, service_role;
revoke all on table
  public.payroll_individual_arrangement_assignment_versions,
  public.payroll_individual_calculation_config_versions,
  public.payroll_individual_arrangement_composition_snapshots,
  public.payroll_opening_cumulative_snapshots,
  public.individual_payroll_input_references,
  public.individual_payroll_lifecycle_events,
  public.payroll_individual_artifacts
from public, anon, authenticated, service_role;
grant select, insert on table
  public.payroll_individual_arrangement_assignment_versions,
  public.payroll_individual_calculation_config_versions,
  public.payroll_individual_arrangement_composition_snapshots,
  public.payroll_opening_cumulative_snapshots,
  public.individual_payroll_input_references,
  public.individual_payroll_lifecycle_events,
  public.payroll_individual_artifacts
to service_role;

commit;
