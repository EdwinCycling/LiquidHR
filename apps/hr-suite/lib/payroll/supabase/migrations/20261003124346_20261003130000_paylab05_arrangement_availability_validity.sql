begin;

alter table public.payroll_arrangement_availability
  add column effective_from date not null default date '2026-09-01',
  add column effective_to date,
  add column updated_at timestamptz,
  add column updated_by_user_id uuid;

alter table public.payroll_arrangement_availability
  alter column effective_from drop default,
  add constraint payroll_arrangement_availability_effective_dates_valid
    check (effective_to is null or effective_to >= effective_from),
  add constraint payroll_arrangement_availability_update_audit_complete
    check ((updated_at is null) = (updated_by_user_id is null));

comment on column public.payroll_arrangement_availability.effective_from is
  'First date this reviewed package can be selected for the Payroll Lab administration.';
comment on column public.payroll_arrangement_availability.effective_to is
  'Inclusive last date this package can be selected; service-role updates may only shorten this interval.';

drop trigger payroll_arrangement_availability_immutable on public.payroll_arrangement_availability;

create function public.protect_payroll_arrangement_availability_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.payroll_administration_id is distinct from old.payroll_administration_id
    or new.source_tenant_id is distinct from old.source_tenant_id
    or new.source_hr_group_id is distinct from old.source_hr_group_id
    or new.source_administration_id is distinct from old.source_administration_id
    or new.package_id is distinct from old.package_id
    or new.effective_from is distinct from old.effective_from
    or new.created_at is distinct from old.created_at
    or new.created_by_user_id is distinct from old.created_by_user_id then
    raise exception using errcode = '23514', message = 'Payroll arrangement availability identity is immutable.';
  end if;

  if new.effective_to is null
    or (old.effective_to is not null and new.effective_to >= old.effective_to)
    or new.updated_at is null
    or new.updated_by_user_id is null then
    raise exception using errcode = '23514', message = 'Availability may only be ended once or shortened with an audit actor.';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_payroll_arrangement_availability_update() from public, anon, authenticated, service_role;

create trigger payroll_arrangement_availability_update_guard
  before update on public.payroll_arrangement_availability
  for each row execute function public.protect_payroll_arrangement_availability_update();
create trigger payroll_arrangement_availability_delete_guard
  before delete on public.payroll_arrangement_availability
  for each row execute function public.reject_payroll_arrangement_mutation();

revoke all on table public.payroll_arrangement_availability from public, anon, authenticated, service_role;
grant select, insert on table public.payroll_arrangement_availability to service_role;
grant update (effective_to, updated_at, updated_by_user_id)
  on table public.payroll_arrangement_availability to service_role;

commit;
