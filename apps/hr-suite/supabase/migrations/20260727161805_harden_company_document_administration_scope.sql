drop policy if exists company_documents_read on public.company_documents;
create policy company_documents_read on public.company_documents
  for select to authenticated
  using ((select internal_security.has_administration_access(tenant_id, administration_id)) and deleted_at is null);

drop policy if exists company_document_objects_read on storage.objects;
create policy company_document_objects_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'company-documents'
    and exists (
      select 1
      from public.company_documents document
      where document.storage_key = name
        and document.deleted_at is null
        and internal_security.has_administration_access(document.tenant_id, document.administration_id)
    )
  );
