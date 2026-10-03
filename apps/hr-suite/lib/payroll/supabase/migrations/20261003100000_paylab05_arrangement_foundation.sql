begin;

create table public.payroll_arrangement_availability (
  id uuid primary key default gen_random_uuid(),
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  package_id text not null check (length(trim(package_id)) > 0),
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null,
  constraint payroll_arrangement_availability_administration_scope_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_arrangement_availability_scoped_package_unique
    unique (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, package_id),
  constraint payroll_arrangement_availability_scoped_id_unique
    unique (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
);

comment on table public.payroll_arrangement_availability is
  'Append-only allowlist of reviewed arrangement catalog packages available to one Payroll Lab legal administration.';
comment on column public.payroll_arrangement_availability.package_id is
  'References a reviewed, versioned application catalog identity; package definitions and executable rules are not stored in this table.';

create table public.payroll_arrangement_assignments (
  id uuid primary key default gen_random_uuid(),
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  source_employment_id uuid not null,
  fixture_code text not null check (fixture_code in (
    'CAO-BENCH02-SCALE-STEP',
    'CAO-BENCH02-OPEN-BAND',
    'CAO-BENCH02-FREELY-NEGOTIATED'
  )),
  package_id text not null check (length(trim(package_id)) > 0),
  salary_strategy text not null check (salary_strategy in (
    'DISCRETE_SCALE_STEP',
    'OPEN_SALARY_BAND',
    'FREELY_NEGOTIATED'
  )),
  effective_from date not null,
  effective_to date,
  is_primary boolean not null default true check (is_primary),
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null,
  constraint payroll_arrangement_assignments_administration_scope_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_arrangement_assignments_available_package_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, package_id)
    references public.payroll_arrangement_availability (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, package_id),
  constraint payroll_arrangement_assignments_scoped_employment_unique
    unique (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id),
  constraint payroll_arrangement_assignments_scoped_fixture_unique
    unique (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, fixture_code),
  constraint payroll_arrangement_assignments_scoped_id_employment_unique
    unique (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id),
  constraint payroll_arrangement_assignments_effective_dates_valid
    check (effective_to is null or effective_to >= effective_from)
);

comment on table public.payroll_arrangement_assignments is
  'One immutable primary arrangement assignment per synthetic source employment in this phase; no Core employee or employment foreign key exists.';
comment on column public.payroll_arrangement_assignments.source_employment_id is
  'Deterministic synthetic fixture UUID in CAO-BENCH02 Phase 1. This is not a Core identifier lookup or cross-database relationship.';

create index payroll_arrangement_assignments_scope_package_idx
  on public.payroll_arrangement_assignments (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, package_id);

create table public.payroll_arrangement_composition_snapshots (
  id uuid primary key default gen_random_uuid(),
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  source_employment_id uuid not null,
  assignment_id uuid not null,
  as_of_date date not null,
  snapshot_json jsonb not null check (jsonb_typeof(snapshot_json) = 'object'),
  snapshot_hash text not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null,
  constraint payroll_arrangement_composition_snapshots_administration_scope_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_arrangement_composition_snapshots_assignment_scope_fk
    foreign key (assignment_id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id)
    references public.payroll_arrangement_assignments (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id),
  constraint payroll_arrangement_composition_snapshots_replay_unique
    unique (assignment_id, as_of_date, snapshot_hash)
);

comment on table public.payroll_arrangement_composition_snapshots is
  'Immutable, hash-pinned arrangement composition resolution. The snapshot records arrangement identity and versions but does not represent a payroll calculation.';
comment on column public.payroll_arrangement_composition_snapshots.snapshot_hash is
  'SHA-256 of canonical sorted-key snapshot_json; snapshot IDs and created_at are excluded.';

create index payroll_arrangement_composition_snapshots_scope_created_idx
  on public.payroll_arrangement_composition_snapshots (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, created_at desc);

create function public.reject_payroll_arrangement_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception using errcode = '23514', message = 'Payroll arrangement foundation records are immutable.';
  return null;
end;
$$;

revoke all on function public.reject_payroll_arrangement_mutation() from public, anon, authenticated, service_role;

create trigger payroll_arrangement_availability_immutable
  before update or delete on public.payroll_arrangement_availability
  for each row execute function public.reject_payroll_arrangement_mutation();
create trigger payroll_arrangement_assignments_immutable
  before update or delete on public.payroll_arrangement_assignments
  for each row execute function public.reject_payroll_arrangement_mutation();
create trigger payroll_arrangement_composition_snapshots_immutable
  before update or delete on public.payroll_arrangement_composition_snapshots
  for each row execute function public.reject_payroll_arrangement_mutation();

alter table public.payroll_arrangement_availability enable row level security;
alter table public.payroll_arrangement_assignments enable row level security;
alter table public.payroll_arrangement_composition_snapshots enable row level security;

create policy payroll_arrangement_availability_service_role_only
  on public.payroll_arrangement_availability for all to service_role using (true) with check (true);
create policy payroll_arrangement_assignments_service_role_only
  on public.payroll_arrangement_assignments for all to service_role using (true) with check (true);
create policy payroll_arrangement_composition_snapshots_service_role_only
  on public.payroll_arrangement_composition_snapshots for all to service_role using (true) with check (true);

revoke all on table
  public.payroll_arrangement_availability,
  public.payroll_arrangement_assignments,
  public.payroll_arrangement_composition_snapshots
from public, anon, authenticated, service_role;

grant select, insert on table
  public.payroll_arrangement_availability,
  public.payroll_arrangement_assignments,
  public.payroll_arrangement_composition_snapshots
to service_role;

commit;
