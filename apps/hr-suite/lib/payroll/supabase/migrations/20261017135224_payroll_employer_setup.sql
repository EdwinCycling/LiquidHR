begin;

create table public.payroll_employer_configuration_versions (
  id uuid primary key default gen_random_uuid(),
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  configuration_version integer not null check (configuration_version > 0),
  effective_from date not null,
  effective_to date,
  configuration_json jsonb not null check (jsonb_typeof(configuration_json) = 'object'),
  configuration_hash text not null check (configuration_hash ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('DRAFT', 'ACTIVE')),
  source_reference text not null check (length(trim(source_reference)) > 0),
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null,
  constraint payroll_employer_configuration_dates_valid
    check (effective_to is null or effective_to >= effective_from),
  constraint payroll_employer_configuration_scope_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_employer_configuration_version_unique
    unique (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, configuration_version),
  constraint payroll_employer_configuration_scoped_id_unique
    unique (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
);

comment on table public.payroll_employer_configuration_versions is
  'Immutable, effective-dated customer Payroll configuration. Values are HR Admin input with explicit source provenance; this is not a synthetic Payroll Lab setup.';

alter table public.payroll_opening_cumulative_snapshots
  drop constraint if exists payroll_opening_cumulative_snapshots_provenance_status_check;
alter table public.payroll_opening_cumulative_snapshots
  add constraint payroll_opening_cumulative_snapshots_provenance_status_check
  check (provenance_status in ('TEST_OPENING_BALANCE', 'RECONSTRUCTED_PAYROLL', 'CUSTOMER_OPENING_BALANCE'));

create function public.reject_payroll_employer_configuration_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception using errcode = '23514', message = 'Payroll employer configuration versions are immutable.';
end;
$$;

create function public.guard_payroll_employer_configuration_version()
returns trigger
language plpgsql
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    new.payroll_administration_id::text || ':' || new.source_tenant_id::text || ':'
      || new.source_hr_group_id::text || ':' || new.source_administration_id::text,
    0
  ));

  if exists (
    select 1
    from public.payroll_employer_configuration_versions as existing
    where existing.payroll_administration_id = new.payroll_administration_id
      and existing.source_tenant_id = new.source_tenant_id
      and existing.source_hr_group_id = new.source_hr_group_id
      and existing.source_administration_id = new.source_administration_id
      and existing.effective_from <= coalesce(new.effective_to, 'infinity'::date)
      and coalesce(existing.effective_to, 'infinity'::date) >= new.effective_from
  ) then
    raise exception using errcode = '23514', message = 'Payroll employer configuration periods may not overlap.';
  end if;

  return new;
end;
$$;

alter function public.reject_payroll_employer_configuration_mutation()
  set search_path = '';
alter function public.guard_payroll_employer_configuration_version()
  set search_path = '';

create trigger payroll_employer_configuration_immutable
  before update or delete on public.payroll_employer_configuration_versions
  for each row execute function public.reject_payroll_employer_configuration_mutation();
create trigger payroll_employer_configuration_effective_version_guard
  before insert on public.payroll_employer_configuration_versions
  for each row execute function public.guard_payroll_employer_configuration_version();

alter table public.payroll_employer_configuration_versions enable row level security;
create policy payroll_employer_configuration_service_role_only
  on public.payroll_employer_configuration_versions
  for all to service_role using (true) with check (true);

revoke all on function public.reject_payroll_employer_configuration_mutation() from public, anon, authenticated, service_role;
revoke all on function public.guard_payroll_employer_configuration_version() from public, anon, authenticated, service_role;
revoke all on table public.payroll_employer_configuration_versions from public, anon, authenticated, service_role;
grant select, insert on table public.payroll_employer_configuration_versions to service_role;

commit;
