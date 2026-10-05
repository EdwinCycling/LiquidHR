-- CONTROL02 phase 1: authenticated staging clients may update workflow state,
-- but cannot rewrite the batch's source identity or authorization scope.
begin;

create function internal_security.prevent_payroll_import_batch_provenance_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    if new.source_type = 'LOONAANGIFTE_XML' then
      raise exception using
        errcode = '23514',
        message = 'REAL_XML_STAGING_PENDING';
    end if;

    return new;
  end if;

  if row(
    old.tenant_id,
    old.hr_group_id,
    old.administration_id,
    old.source_type,
    old.source_filename,
    old.source_hash,
    old.tax_year,
    old.period_start,
    old.period_end,
    old.payroll_tax_number,
    old.idempotency_key,
    old.created_by_user_id
  ) is distinct from row(
    new.tenant_id,
    new.hr_group_id,
    new.administration_id,
    new.source_type,
    new.source_filename,
    new.source_hash,
    new.tax_year,
    new.period_start,
    new.period_end,
    new.payroll_tax_number,
    new.idempotency_key,
    new.created_by_user_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'PAYROLL_IMPORT_PROVENANCE_IMMUTABLE';
  end if;

  return new;
end;
$$;

revoke all on function internal_security.prevent_payroll_import_batch_provenance_change() from public;
grant execute on function internal_security.prevent_payroll_import_batch_provenance_change() to service_role;

create trigger prevent_payroll_import_batch_provenance_change
before insert or update on public.payroll_import_batches
for each row execute function internal_security.prevent_payroll_import_batch_provenance_change();

comment on function internal_security.prevent_payroll_import_batch_provenance_change() is
  'Rejects XML staging and keeps payroll import source identity, fiscal period and HR scope immutable.';

-- Staging writes are server-owned. The API checks the signed-in user's
-- payroll-import permission and tenant context before using the service role.
drop policy if exists payroll_import_batches_insert_group on public.payroll_import_batches;
drop policy if exists payroll_import_batches_update_group on public.payroll_import_batches;
drop policy if exists payroll_import_persons_insert_group on public.payroll_import_persons;
drop policy if exists payroll_import_persons_update_group on public.payroll_import_persons;
drop policy if exists payroll_import_income_relationships_insert_group on public.payroll_import_income_relationships;
drop policy if exists payroll_import_income_relationships_update_group on public.payroll_import_income_relationships;

revoke all on table public.payroll_import_batches from public, anon, authenticated;
revoke all on table public.payroll_import_persons from public, anon, authenticated;
revoke all on table public.payroll_import_income_relationships from public, anon, authenticated;
grant select on table public.payroll_import_batches to authenticated;
grant select on table public.payroll_import_persons to authenticated;
grant select on table public.payroll_import_income_relationships to authenticated;
grant select, insert, update on table public.payroll_import_batches to service_role;
grant select, insert, update on table public.payroll_import_persons to service_role;
grant select, insert, update on table public.payroll_import_income_relationships to service_role;

create function internal_security.enforce_payroll_import_income_batch_scope()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if not exists (
    select 1
    from public.payroll_import_batches as batch
    where batch.id = new.batch_id
      and batch.tenant_id = new.tenant_id
      and batch.hr_group_id = new.hr_group_id
      and batch.administration_id = new.administration_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'PAYROLL_IMPORT_INCOME_ADMINISTRATION_SCOPE_MISMATCH';
  end if;

  return new;
end;
$$;

revoke all on function internal_security.enforce_payroll_import_income_batch_scope() from public;
grant execute on function internal_security.enforce_payroll_import_income_batch_scope() to service_role;

create trigger enforce_payroll_import_income_batch_scope
before insert or update on public.payroll_import_income_relationships
for each row execute function internal_security.enforce_payroll_import_income_batch_scope();

commit;
