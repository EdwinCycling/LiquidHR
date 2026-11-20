begin;

create table public.payroll_arrangement_availability_history (
  id uuid primary key default gen_random_uuid(),
  availability_id uuid not null,
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  package_id text not null,
  previous_effective_from date not null,
  previous_effective_to date,
  new_effective_from date not null,
  new_effective_to date,
  changed_at timestamptz not null,
  changed_by_user_id uuid not null,
  change_kind text not null check (change_kind in ('START_EXTENDED', 'END_SHORTENED', 'START_EXTENDED_AND_END_SHORTENED')),
  constraint payroll_arrangement_availability_history_scope_fk
    foreign key (availability_id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_arrangement_availability (id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint payroll_arrangement_availability_history_dates_valid
    check (new_effective_to is null or new_effective_to >= new_effective_from)
);

comment on table public.payroll_arrangement_availability_history is
  'Append-only, scoped before/after audit of approved historical availability extensions and one-way end-date shortening.';

create index payroll_arrangement_availability_history_scope_changed_idx
  on public.payroll_arrangement_availability_history
    (availability_id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, changed_at desc);

create function public.protect_payroll_arrangement_availability_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '23514', message = 'Payroll arrangement availability history is immutable.';
  return null;
end;
$$;

revoke all on function public.protect_payroll_arrangement_availability_history() from public, anon, authenticated, service_role;

create trigger payroll_arrangement_availability_history_immutable
  before update or delete on public.payroll_arrangement_availability_history
  for each row execute function public.protect_payroll_arrangement_availability_history();

drop trigger payroll_arrangement_availability_update_guard on public.payroll_arrangement_availability;

alter function public.protect_payroll_arrangement_availability_update()
  rename to protect_payroll_arrangement_availability_update_v1;

create function public.protect_payroll_arrangement_availability_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  change_kind_value text;
begin
  if new.id is distinct from old.id
    or new.payroll_administration_id is distinct from old.payroll_administration_id
    or new.source_tenant_id is distinct from old.source_tenant_id
    or new.source_hr_group_id is distinct from old.source_hr_group_id
    or new.source_administration_id is distinct from old.source_administration_id
    or new.package_id is distinct from old.package_id
    or new.created_at is distinct from old.created_at
    or new.created_by_user_id is distinct from old.created_by_user_id then
    raise exception using errcode = '23514', message = 'Payroll arrangement availability identity is immutable.';
  end if;

  if new.effective_from > old.effective_from then
    raise exception using errcode = '23514', message = 'Availability start may only be extended earlier with an audit actor.';
  end if;

  if new.effective_to is distinct from old.effective_to
    and (new.effective_to is null or (old.effective_to is not null and new.effective_to >= old.effective_to)) then
    raise exception using errcode = '23514', message = 'Availability end may only be set once or shortened with an audit actor.';
  end if;

  if new.effective_from is not distinct from old.effective_from
    and new.effective_to is not distinct from old.effective_to then
    raise exception using errcode = '23514', message = 'Availability update must change an effective date.';
  end if;

  if new.updated_at is null or new.updated_by_user_id is null then
    raise exception using errcode = '23514', message = 'Availability changes require an audit timestamp and actor.';
  end if;

  change_kind_value := case
    when new.effective_from < old.effective_from and new.effective_to is distinct from old.effective_to
      then 'START_EXTENDED_AND_END_SHORTENED'
    when new.effective_from < old.effective_from then 'START_EXTENDED'
    else 'END_SHORTENED'
  end;

  insert into public.payroll_arrangement_availability_history (
    availability_id,
    payroll_administration_id,
    source_tenant_id,
    source_hr_group_id,
    source_administration_id,
    package_id,
    previous_effective_from,
    previous_effective_to,
    new_effective_from,
    new_effective_to,
    changed_at,
    changed_by_user_id,
    change_kind
  ) values (
    old.id,
    old.payroll_administration_id,
    old.source_tenant_id,
    old.source_hr_group_id,
    old.source_administration_id,
    old.package_id,
    old.effective_from,
    old.effective_to,
    new.effective_from,
    new.effective_to,
    new.updated_at,
    new.updated_by_user_id,
    change_kind_value
  );

  return new;
end;
$$;

revoke all on function public.protect_payroll_arrangement_availability_update() from public, anon, authenticated, service_role;

drop function public.protect_payroll_arrangement_availability_update_v1();

create trigger payroll_arrangement_availability_update_guard
  before update on public.payroll_arrangement_availability
  for each row execute function public.protect_payroll_arrangement_availability_update();

alter table public.payroll_arrangement_availability_history enable row level security;
create policy payroll_arrangement_availability_history_service_role_only
  on public.payroll_arrangement_availability_history for all to service_role using (true) with check (true);

revoke all on table public.payroll_arrangement_availability_history from public, anon, authenticated, service_role;
grant select on table public.payroll_arrangement_availability_history to service_role;

revoke all on table public.payroll_arrangement_availability from public, anon, authenticated, service_role;
grant select, insert on table public.payroll_arrangement_availability to service_role;
grant update (effective_from, effective_to, updated_at, updated_by_user_id)
  on table public.payroll_arrangement_availability to service_role;

commit;
