create table public.administration_branding (
  tenant_id uuid not null,
  administration_id uuid not null,
  primary_color text not null default '#2f5bff',
  accent_color text not null default '#e8edff',
  sidebar_color text not null default '#14264a',
  logo_storage_path text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, administration_id),
  constraint administration_branding_administration_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id)
    on delete cascade,
  constraint administration_branding_primary_color_format
    check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint administration_branding_accent_color_format
    check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint administration_branding_sidebar_color_format
    check (sidebar_color ~ '^#[0-9A-Fa-f]{6}$')
);

create trigger set_administration_branding_updated_at
before update on public.administration_branding
for each row execute function internal_security.set_updated_at();

insert into public.permissions (code, name, description, category)
values (
  'settings:write',
  'HR-instellingen wijzigen',
  'Wijzigt centrale HR-admininstellingen binnen de eigen toegestane administratie.',
  'Organisatie & inrichting'
)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    category = 'Organisatie & inrichting';

insert into public.role_permissions (management_role_id, permission_id)
select management_role.id, permission.id
from public.management_roles management_role
cross join public.permissions permission
where management_role.code = 'TENANT_ADMIN'
  and management_role.tenant_id is null
  and permission.code = 'settings:write'
on conflict do nothing;

alter table public.administration_branding enable row level security;

create policy administration_branding_select_scoped
on public.administration_branding for select to authenticated
using ((select internal_security.has_administration_access(tenant_id, administration_id)));

create policy administration_branding_insert_scoped
on public.administration_branding for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'settings:write')));

create policy administration_branding_update_scoped
on public.administration_branding for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'settings:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'settings:write')));

create policy administration_branding_delete_scoped
on public.administration_branding for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'settings:write')));

grant select, insert, update, delete on public.administration_branding to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('administration-branding', 'administration-branding', false, 2097152,
  array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy administration_branding_logo_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'administration-branding'
  and (select internal_security.current_user_has_permission(
    (storage.foldername(name))[1]::uuid,
    (storage.foldername(name))[2]::uuid,
    'settings:write'
  ))
);

create policy administration_branding_logo_read
on storage.objects for select to authenticated
using (
  bucket_id = 'administration-branding'
  and exists (
    select 1
    from public.administration_branding branding
    where branding.tenant_id = (storage.foldername(name))[1]::uuid
      and branding.administration_id = (storage.foldername(name))[2]::uuid
      and branding.logo_storage_path = name
      and internal_security.has_administration_access(branding.tenant_id, branding.administration_id)
  )
);

create policy administration_branding_logo_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'administration-branding'
  and (select internal_security.current_user_has_permission(
    (storage.foldername(name))[1]::uuid,
    (storage.foldername(name))[2]::uuid,
    'settings:write'
  ))
);

alter table public.user_preferences
  add column use_company_theme boolean not null default true;
