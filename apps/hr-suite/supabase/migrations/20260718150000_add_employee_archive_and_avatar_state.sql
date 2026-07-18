alter table public.employees
  add column if not exists is_archived boolean not null default false;

create index if not exists employees_archive_name_idx
  on public.employees (tenant_id, is_archived, birth_name, first_name)
  where deleted_at is null;

alter table public.user_preferences
  add column if not exists ui_state jsonb not null default '{}'::jsonb;

alter table public.user_preferences
  drop constraint if exists user_preferences_ui_state_object;

alter table public.user_preferences
  add constraint user_preferences_ui_state_object
  check (jsonb_typeof(ui_state) = 'object');

grant select (is_archived) on table public.employees to authenticated;
grant update (is_archived) on table public.employees to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('employee-avatars', 'employee-avatars', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists employee_avatar_objects_insert on storage.objects;
create policy employee_avatar_objects_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'employee-avatars'
  and internal_security.can_manage_employee(((storage.foldername(name))[2])::uuid, 'employee:write')
);

drop policy if exists employee_avatar_objects_update on storage.objects;
create policy employee_avatar_objects_update
on storage.objects for update to authenticated
using (
  bucket_id = 'employee-avatars'
  and internal_security.can_manage_employee(((storage.foldername(name))[2])::uuid, 'employee:write')
)
with check (
  bucket_id = 'employee-avatars'
  and internal_security.can_manage_employee(((storage.foldername(name))[2])::uuid, 'employee:write')
);

drop policy if exists employee_avatar_objects_delete on storage.objects;
create policy employee_avatar_objects_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'employee-avatars'
  and internal_security.can_manage_employee(((storage.foldername(name))[2])::uuid, 'employee:write')
);

drop policy if exists employee_avatar_objects_read on storage.objects;
create policy employee_avatar_objects_read
on storage.objects for select to authenticated
using (
  bucket_id = 'employee-avatars'
  and (
    internal_security.can_manage_employee(((storage.foldername(name))[2])::uuid, 'employee:read')
    or internal_security.can_manage_employee(((storage.foldername(name))[2])::uuid, 'employee:write')
  )
);
