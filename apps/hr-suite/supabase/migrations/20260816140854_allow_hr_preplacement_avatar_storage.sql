-- A newly created employee can receive an avatar before the employment wizard
-- creates the first organisation placement. Keep the same tenant/HR-group
-- write scope used by the employee subresource policies.
drop policy if exists employee_avatar_objects_insert on storage.objects;
create policy employee_avatar_objects_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'employee-avatars'
  and internal_security.employee_subresource_can_write(
    ((storage.foldername(name))[1])::uuid,
    ((storage.foldername(name))[2])::uuid,
    'self:employee:write'
  )
);

drop policy if exists employee_avatar_objects_update on storage.objects;
create policy employee_avatar_objects_update
on storage.objects for update to authenticated
using (
  bucket_id = 'employee-avatars'
  and internal_security.employee_subresource_can_write(
    ((storage.foldername(name))[1])::uuid,
    ((storage.foldername(name))[2])::uuid,
    'self:employee:write'
  )
)
with check (
  bucket_id = 'employee-avatars'
  and internal_security.employee_subresource_can_write(
    ((storage.foldername(name))[1])::uuid,
    ((storage.foldername(name))[2])::uuid,
    'self:employee:write'
  )
);

drop policy if exists employee_avatar_objects_delete on storage.objects;
create policy employee_avatar_objects_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'employee-avatars'
  and internal_security.employee_subresource_can_write(
    ((storage.foldername(name))[1])::uuid,
    ((storage.foldername(name))[2])::uuid,
    'self:employee:write'
  )
);
