begin;

alter table public.continuous_appraisal_attachments
  add constraint continuous_appraisal_attachments_storage_key_binding
  check (
    storage.foldername(storage_key) = array[tenant_id::text, item_id::text, id::text]
    and coalesce(storage.filename(storage_key), '') <> ''
  ) not valid;

drop policy if exists continuous_appraisal_objects_read on storage.objects;

create policy continuous_appraisal_objects_read
on storage.objects for select to authenticated
using (
  bucket_id = 'continuous-appraisal-attachments'
  and exists (
    select 1
    from public.continuous_appraisal_attachments attachment
    where attachment.storage_key = name
      and storage.foldername(name) = array[attachment.tenant_id::text, attachment.item_id::text, attachment.id::text]
      and coalesce(storage.filename(name), '') <> ''
  )
);

commit;
