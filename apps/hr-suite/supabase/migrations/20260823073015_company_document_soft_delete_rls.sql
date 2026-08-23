-- A soft delete changes deleted_at from NULL to a value. Because the active
-- SELECT policy intentionally hides deleted rows, PostgreSQL rejects a direct
-- UPDATE with 42501 while checking the resulting row. Keep that read boundary
-- intact and perform the narrowly authorized state transition in a definer
-- function with an explicit caller permission check.
create or replace function public.soft_delete_company_document(
  requested_document_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  document_tenant_id uuid;
  document_hr_group_id uuid;
begin
  select document.tenant_id, document.hr_group_id
  into document_tenant_id, document_hr_group_id
  from public.company_documents document
  where document.id = requested_document_id
    and document.deleted_at is null
  for update;

  if not found then
    raise exception 'COMPANY_DOCUMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not internal_security.current_user_has_hr_group_permission(
    document_tenant_id,
    document_hr_group_id,
    'company-document:delete'
  ) then
    raise exception 'COMPANY_DOCUMENT_FORBIDDEN' using errcode = 'P0001';
  end if;

  update public.company_documents
  set deleted_at = pg_catalog.timezone('utc', pg_catalog.now())
  where id = requested_document_id
    and deleted_at is null;

  if not found then
    raise exception 'COMPANY_DOCUMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.soft_delete_company_document(uuid) from public, anon, authenticated;
grant execute on function public.soft_delete_company_document(uuid) to authenticated;
