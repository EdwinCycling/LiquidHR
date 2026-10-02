begin;

create table public.payroll_administrations (
  id uuid primary key default gen_random_uuid(),
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  display_name text not null check (length(trim(display_name)) > 0),
  capability_enabled boolean not null default false,
  status text not null default 'SUSPENDED' check (status in ('ACTIVE', 'SUSPENDED')),
  created_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid,
  constraint payroll_administrations_source_scope_unique
    unique (source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_administrations_scoped_id_unique
    unique (id, source_tenant_id, source_hr_group_id, source_administration_id)
);

comment on column public.payroll_administrations.source_tenant_id is 'Opaque LiquidHR-bron-ID; bewust zonder cross-database foreign key.';
comment on column public.payroll_administrations.source_hr_group_id is 'Opaque LiquidHR-bron-ID; bewust zonder cross-database foreign key.';
comment on column public.payroll_administrations.source_administration_id is 'Opaque actieve LiquidHR-administratiecontext; geen payroll- of IKV-mapping.';

create table public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  period_year smallint not null check (period_year between 2000 and 2200),
  period_month smallint not null check (period_month between 1 and 12),
  starts_on date not null,
  ends_on date not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'OPEN', 'CLOSED')),
  created_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid,
  constraint payroll_periods_date_order check (starts_on <= ends_on),
  constraint payroll_periods_administration_scope_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_periods_scoped_id_unique
    unique (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_periods_month_unique
    unique (source_tenant_id, source_hr_group_id, source_administration_id, period_year, period_month)
);

create table public.source_snapshots (
  id uuid primary key default gen_random_uuid(),
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  source_employee_id uuid not null,
  source_employment_id uuid not null,
  source_income_relationship_id uuid,
  period_reference date not null,
  source_payload jsonb not null check (jsonb_typeof(source_payload) = 'object'),
  source_version_vector jsonb not null check (jsonb_typeof(source_version_vector) = 'object'),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by_user_id uuid,
  constraint source_snapshots_administration_scope_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint source_snapshots_scoped_id_unique
    unique (id, source_tenant_id, source_hr_group_id, source_administration_id)
);

comment on column public.source_snapshots.source_employee_id is 'Opaque LiquidHR-bron-ID; bewust zonder cross-database foreign key.';
comment on column public.source_snapshots.source_employment_id is 'Opaque LiquidHR-bron-ID; bewust zonder cross-database foreign key.';
comment on column public.source_snapshots.source_income_relationship_id is 'Opaque LiquidHR-bron-ID; geen CONTROL02-contract of Core-relatie.';

create table public.calculation_input_sets (
  id uuid primary key default gen_random_uuid(),
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  source_snapshot_id uuid not null,
  payroll_period_id uuid not null,
  rule_package_composition_id text not null check (length(trim(rule_package_composition_id)) > 0),
  engine_version text not null check (length(trim(engine_version)) > 0),
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by_user_id uuid,
  constraint calculation_input_sets_administration_scope_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint calculation_input_sets_snapshot_scope_fk
    foreign key (source_snapshot_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.source_snapshots (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint calculation_input_sets_period_scope_fk
    foreign key (payroll_period_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_periods (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint calculation_input_sets_scoped_id_unique
    unique (id, source_tenant_id, source_hr_group_id, source_administration_id)
);

create table public.calculation_runs (
  id uuid primary key default gen_random_uuid(),
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  calculation_input_set_id uuid not null,
  run_type text not null check (run_type in ('PREVIEW', 'RECALCULATION', 'GOLDEN_CASE')),
  status text not null default 'PENDING' check (status in ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')),
  started_at timestamptz,
  finished_at timestamptz,
  result_hash text check (result_hash is null or result_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid,
  constraint calculation_runs_administration_scope_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint calculation_runs_input_set_scope_fk
    foreign key (calculation_input_set_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.calculation_input_sets (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint calculation_runs_timestamp_order
    check (started_at is null or finished_at is null or finished_at >= started_at),
  constraint calculation_runs_scoped_id_unique
    unique (id, source_tenant_id, source_hr_group_id, source_administration_id)
);

create table public.component_results (
  id uuid primary key default gen_random_uuid(),
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  calculation_run_id uuid not null,
  component_key text not null check (length(trim(component_key)) > 0),
  amount numeric(20, 6),
  result_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(result_payload) = 'object'),
  created_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid,
  constraint component_results_administration_scope_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint component_results_run_scope_fk
    foreign key (calculation_run_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.calculation_runs (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint component_results_component_unique
    unique (calculation_run_id, component_key)
);

create table public.calculation_traces (
  id uuid primary key default gen_random_uuid(),
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  calculation_run_id uuid not null,
  trace_payload jsonb not null check (jsonb_typeof(trace_payload) = 'object'),
  created_at timestamptz not null default now(),
  created_by_user_id uuid,
  constraint calculation_traces_administration_scope_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint calculation_traces_run_scope_fk
    foreign key (calculation_run_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.calculation_runs (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint calculation_traces_run_unique unique (calculation_run_id)
);

create table public.payroll_controls (
  id uuid primary key default gen_random_uuid(),
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  calculation_run_id uuid not null,
  control_key text not null check (length(trim(control_key)) > 0),
  status text not null check (status in ('PASS', 'WARN', 'FAIL')),
  detail_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(detail_payload) = 'object'),
  created_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid,
  constraint payroll_controls_administration_scope_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_controls_run_scope_fk
    foreign key (calculation_run_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.calculation_runs (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_controls_run_control_unique unique (calculation_run_id, control_key)
);

create table public.golden_case_runs (
  id uuid primary key default gen_random_uuid(),
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  calculation_run_id uuid not null,
  case_key text not null check (length(trim(case_key)) > 0),
  expected_result_hash text check (expected_result_hash is null or expected_result_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by_user_id uuid,
  constraint golden_case_runs_administration_scope_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint golden_case_runs_run_scope_fk
    foreign key (calculation_run_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.calculation_runs (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint golden_case_runs_case_unique unique (calculation_run_id, case_key)
);

create index source_snapshots_scope_idx
  on public.source_snapshots (source_tenant_id, source_hr_group_id, source_administration_id, created_at desc);
create index calculation_input_sets_scope_idx
  on public.calculation_input_sets (source_tenant_id, source_hr_group_id, source_administration_id, created_at desc);
create index calculation_runs_scope_idx
  on public.calculation_runs (source_tenant_id, source_hr_group_id, source_administration_id, created_at desc);
create index component_results_run_scope_idx
  on public.component_results (source_tenant_id, source_hr_group_id, source_administration_id, calculation_run_id);
create index calculation_traces_run_scope_idx
  on public.calculation_traces (source_tenant_id, source_hr_group_id, source_administration_id, calculation_run_id);
create index payroll_controls_run_scope_idx
  on public.payroll_controls (source_tenant_id, source_hr_group_id, source_administration_id, calculation_run_id);
create index golden_case_runs_run_scope_idx
  on public.golden_case_runs (source_tenant_id, source_hr_group_id, source_administration_id, calculation_run_id);

create function public.guard_payroll_calculation_run_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'PENDING'
      or new.started_at is not null
      or new.finished_at is not null
      or new.result_hash is not null then
      raise exception using errcode = '23514', message = 'Payroll calculation runs must start in PENDING.';
    end if;
    return new;
  end if;

  if (old.id, old.payroll_administration_id, old.source_tenant_id, old.source_hr_group_id,
      old.source_administration_id, old.calculation_input_set_id, old.run_type, old.created_at,
      old.created_by_user_id)
     is distinct from
     (new.id, new.payroll_administration_id, new.source_tenant_id, new.source_hr_group_id,
      new.source_administration_id, new.calculation_input_set_id, new.run_type, new.created_at,
      new.created_by_user_id) then
    raise exception using errcode = '23514', message = 'Payroll calculation run identity is immutable.';
  end if;

  if old.status in ('SUCCEEDED', 'FAILED') then
    raise exception using errcode = '23514', message = 'Terminal Payroll calculation runs are immutable.';
  end if;

  if old.status = 'PENDING' and new.status = 'RUNNING' then
    if new.started_at is null or new.finished_at is not null or new.result_hash is not null then
      raise exception using errcode = '23514', message = 'Invalid Payroll calculation run start.';
    end if;
  elsif old.status = 'PENDING' and new.status = 'FAILED' then
    if new.started_at is not null or new.finished_at is null or new.result_hash is not null then
      raise exception using errcode = '23514', message = 'Invalid failed Payroll calculation run.';
    end if;
  elsif old.status = 'RUNNING' and new.status = 'SUCCEEDED' then
    if new.started_at is distinct from old.started_at or new.finished_at is null or new.result_hash is null then
      raise exception using errcode = '23514', message = 'Invalid successful Payroll calculation run.';
    end if;
  elsif old.status = 'RUNNING' and new.status = 'FAILED' then
    if new.started_at is distinct from old.started_at or new.finished_at is null or new.result_hash is not null then
      raise exception using errcode = '23514', message = 'Invalid failed Payroll calculation run.';
    end if;
  else
    raise exception using errcode = '23514', message = 'Invalid Payroll calculation run status transition.';
  end if;

  return new;
end;
$$;

create function public.require_running_payroll_calculation_run()
returns trigger
language plpgsql
as $$
declare
  locked_run_status text;
begin
  select run.status
    into locked_run_status
    from public.calculation_runs as run
    where run.id = new.calculation_run_id
      and run.source_tenant_id = new.source_tenant_id
      and run.source_hr_group_id = new.source_hr_group_id
      and run.source_administration_id = new.source_administration_id
    for update;

  if not found or locked_run_status <> 'RUNNING' then
    raise exception using errcode = '23514', message = 'Payroll calculation artifacts require a RUNNING run in the same scope.';
  end if;
  return new;
end;
$$;

create trigger payroll_calculation_runs_transition_guard
  before insert or update on public.calculation_runs
  for each row execute function public.guard_payroll_calculation_run_transition();
create trigger component_results_running_run_guard
  before insert on public.component_results
  for each row execute function public.require_running_payroll_calculation_run();
create trigger calculation_traces_running_run_guard
  before insert on public.calculation_traces
  for each row execute function public.require_running_payroll_calculation_run();
create trigger payroll_controls_running_run_guard
  before insert on public.payroll_controls
  for each row execute function public.require_running_payroll_calculation_run();
create trigger golden_case_runs_running_run_guard
  before insert on public.golden_case_runs
  for each row execute function public.require_running_payroll_calculation_run();

revoke all on function public.guard_payroll_calculation_run_transition() from public, anon, authenticated, service_role;
revoke all on function public.require_running_payroll_calculation_run() from public, anon, authenticated, service_role;

alter table public.payroll_administrations enable row level security;
alter table public.payroll_periods enable row level security;
alter table public.source_snapshots enable row level security;
alter table public.calculation_input_sets enable row level security;
alter table public.calculation_runs enable row level security;
alter table public.component_results enable row level security;
alter table public.calculation_traces enable row level security;
alter table public.payroll_controls enable row level security;
alter table public.golden_case_runs enable row level security;

create policy payroll_administrations_service_role_only on public.payroll_administrations for all to service_role using (true) with check (true);
create policy payroll_periods_service_role_only on public.payroll_periods for all to service_role using (true) with check (true);
create policy source_snapshots_service_role_only on public.source_snapshots for all to service_role using (true) with check (true);
create policy calculation_input_sets_service_role_only on public.calculation_input_sets for all to service_role using (true) with check (true);
create policy calculation_runs_service_role_only on public.calculation_runs for all to service_role using (true) with check (true);
create policy component_results_service_role_only on public.component_results for all to service_role using (true) with check (true);
create policy calculation_traces_service_role_only on public.calculation_traces for all to service_role using (true) with check (true);
create policy payroll_controls_service_role_only on public.payroll_controls for all to service_role using (true) with check (true);
create policy golden_case_runs_service_role_only on public.golden_case_runs for all to service_role using (true) with check (true);

revoke all on table public.payroll_administrations, public.payroll_periods, public.source_snapshots,
  public.calculation_input_sets, public.calculation_runs, public.component_results,
  public.calculation_traces, public.payroll_controls, public.golden_case_runs
  from public, anon, authenticated, service_role;
grant usage on schema public to service_role;
grant select, insert on table public.payroll_administrations to service_role;
grant update (display_name, capability_enabled, status, updated_at, updated_by_user_id)
  on table public.payroll_administrations to service_role;
grant select, insert on table public.payroll_periods to service_role;
grant update (status, updated_at, updated_by_user_id) on table public.payroll_periods to service_role;
grant select, insert on table public.calculation_input_sets, public.component_results,
  public.calculation_traces, public.payroll_controls, public.golden_case_runs to service_role;
grant select, insert on table public.calculation_runs to service_role;
grant update (status, started_at, finished_at, result_hash, updated_at, updated_by_user_id)
  on table public.calculation_runs to service_role;
grant select, insert on table public.source_snapshots to service_role;

commit;
