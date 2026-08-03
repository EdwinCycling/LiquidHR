begin;

create table public.continuous_appraisal_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  item_id uuid not null,
  uploaded_by_employee_id uuid not null,
  uploaded_by_user_id uuid references auth.users(id) on delete set null,
  storage_key text not null,
  original_filename text not null check (char_length(btrim(original_filename)) between 1 and 255),
  content_type text not null check (content_type in ('image/png', 'image/jpeg', 'image/webp', 'application/pdf')),
  file_size bigint not null check (file_size between 1 and 10485760),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, id),
  unique (tenant_id, storage_key),
  foreign key (tenant_id, item_id) references public.continuous_appraisal_items(tenant_id, id) on delete restrict,
  foreign key (tenant_id, uploaded_by_employee_id) references public.employees(tenant_id, id) on delete restrict
);

create index continuous_appraisal_attachments_item_idx
  on public.continuous_appraisal_attachments (tenant_id, item_id, created_at);
create index continuous_appraisal_attachments_uploader_idx
  on public.continuous_appraisal_attachments (tenant_id, uploaded_by_employee_id, created_at);
create index continuous_appraisal_attachments_uploaded_by_user_idx
  on public.continuous_appraisal_attachments (uploaded_by_user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'continuous-appraisal-attachments',
  'continuous-appraisal-attachments',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.continuous_appraisal_attachments enable row level security;
revoke all on public.continuous_appraisal_attachments from public, anon;

create policy continuous_appraisal_attachments_select
on public.continuous_appraisal_attachments for select to authenticated
using (
  exists (
    select 1
    from public.continuous_appraisal_items item
    where item.tenant_id = continuous_appraisal_attachments.tenant_id
      and item.id = continuous_appraisal_attachments.item_id
  )
);

create policy continuous_appraisal_attachments_insert
on public.continuous_appraisal_attachments for insert to authenticated
with check (
  uploaded_by_employee_id = (select internal_security.current_employee_id())
  and exists (
    select 1
    from public.continuous_appraisal_items item
    where item.tenant_id = continuous_appraisal_attachments.tenant_id
      and item.id = continuous_appraisal_attachments.item_id
  )
  and (
    (select internal_security.current_employee_has_permission('self:continuous-appraisal:write'))
    or (select internal_security.current_user_has_permission(tenant_id, null, 'continuous-appraisal:write'))
    or exists (
      select 1
      from public.continuous_appraisal_items item
      where item.tenant_id = continuous_appraisal_attachments.tenant_id
        and item.id = continuous_appraisal_attachments.item_id
        and (select internal_security.can_manage_employee(item.employee_id, 'continuous-appraisal:write'))
    )
  )
);

create policy continuous_appraisal_objects_read
on storage.objects for select to authenticated
using (
  bucket_id = 'continuous-appraisal-attachments'
  and exists (
    select 1
    from public.continuous_appraisal_attachments attachment
    where attachment.storage_key = name
  )
);

grant select, insert on public.continuous_appraisal_attachments to authenticated;

create trigger audit_continuous_appraisal_attachments
after insert on public.continuous_appraisal_attachments
for each row execute function internal_security.audit_continuous_appraisal_change();

commit;
