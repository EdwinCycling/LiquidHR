begin;

create or replace function internal_security.prevent_payroll_import_batch_provenance_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    if new.source_type = 'LOONAANGIFTE_XML'
      and coalesce(auth.role(), '') <> 'service_role' then
      raise exception using
        errcode = '23514',
        message = 'XML_STAGING_SERVICE_ROLE_REQUIRED';
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

revoke all on function internal_security.prevent_payroll_import_batch_provenance_change() from public, anon, authenticated;
grant execute on function internal_security.prevent_payroll_import_batch_provenance_change() to service_role;

comment on function internal_security.prevent_payroll_import_batch_provenance_change() is
  'Houdt bronidentiteit en HR-scope onveranderlijk; XML-batches mogen alleen door service_role worden ingevoegd. De applicatiepoort beperkt deze kandidaat tot het geverifieerde lokale TEST-project.';

commit;