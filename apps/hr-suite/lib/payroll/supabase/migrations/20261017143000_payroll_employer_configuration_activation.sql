begin;

create or replace function public.reject_payroll_employer_configuration_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'DRAFT'
    and new.status = 'ACTIVE'
    and new.id = old.id
    and new.payroll_administration_id = old.payroll_administration_id
    and new.source_tenant_id = old.source_tenant_id
    and new.source_hr_group_id = old.source_hr_group_id
    and new.source_administration_id = old.source_administration_id
    and new.configuration_version = old.configuration_version
    and new.effective_from = old.effective_from
    and new.effective_to is not distinct from old.effective_to
    and new.configuration_json = old.configuration_json
    and new.configuration_hash = old.configuration_hash
    and new.source_reference = old.source_reference
    and new.created_at = old.created_at
    and new.created_by_user_id is not distinct from old.created_by_user_id
  then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      new.payroll_administration_id::text || ':' || new.source_tenant_id::text || ':'
        || new.source_hr_group_id::text || ':' || new.source_administration_id::text,
      0
    ));

    if exists (
      select 1
      from public.payroll_employer_configuration_versions as existing
      where existing.id <> new.id
        and existing.status = 'ACTIVE'
        and existing.payroll_administration_id = new.payroll_administration_id
        and existing.source_tenant_id = new.source_tenant_id
        and existing.source_hr_group_id = new.source_hr_group_id
        and existing.source_administration_id = new.source_administration_id
        and existing.effective_from <= coalesce(new.effective_to, 'infinity'::date)
        and coalesce(existing.effective_to, 'infinity'::date) >= new.effective_from
    ) then
      raise exception using errcode = '23514', message = 'Payroll employer configuration periods may not overlap.';
    end if;

    return new;
  end if;

  raise exception using errcode = '23514', message = 'Payroll employer configuration versions are immutable.';
end;
$$;

create or replace function public.guard_payroll_employer_configuration_version()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'ACTIVE' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      new.payroll_administration_id::text || ':' || new.source_tenant_id::text || ':'
        || new.source_hr_group_id::text || ':' || new.source_administration_id::text,
      0
    ));

    if exists (
      select 1
      from public.payroll_employer_configuration_versions as existing
      where existing.status = 'ACTIVE'
        and existing.payroll_administration_id = new.payroll_administration_id
        and existing.source_tenant_id = new.source_tenant_id
        and existing.source_hr_group_id = new.source_hr_group_id
        and existing.source_administration_id = new.source_administration_id
        and existing.effective_from <= coalesce(new.effective_to, 'infinity'::date)
        and coalesce(existing.effective_to, 'infinity'::date) >= new.effective_from
    ) then
      raise exception using errcode = '23514', message = 'Payroll employer configuration periods may not overlap.';
    end if;
  end if;

  return new;
end;
$$;

alter function public.reject_payroll_employer_configuration_mutation()
  set search_path = '';
alter function public.guard_payroll_employer_configuration_version()
  set search_path = '';

commit;
