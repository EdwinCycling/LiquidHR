create table public.relation_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code public.relation_type not null,
  name_nl text not null check (length(trim(name_nl)) between 1 and 120),
  name_en text not null check (length(trim(name_en)) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint relation_types_tenant_code_key unique (tenant_id, code),
  constraint relation_types_tenant_id_id_key unique (tenant_id, id)
);

create index relation_types_tenant_active_idx on public.relation_types (tenant_id, is_active, name_nl);
create trigger set_relation_types_updated_at
before update on public.relation_types
for each row execute function internal_security.set_updated_at();

alter table public.relation_types enable row level security;
create policy relation_types_read on public.relation_types
for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'employee:read')));
create policy relation_types_insert on public.relation_types
for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'employee:write')));
create policy relation_types_update on public.relation_types
for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'employee:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'employee:write')));
create policy relation_types_delete on public.relation_types
for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'employee:write')));

grant select, insert, update, delete on public.relation_types to authenticated;

insert into public.relation_types (tenant_id, code, name_nl, name_en)
select tenant.id, defaults.code, defaults.name_nl, defaults.name_en
from public.tenants tenant
cross join (values
  ('PARTNER'::public.relation_type, 'Partner', 'Partner'),
  ('CHILD'::public.relation_type, 'Kind', 'Child'),
  ('PARENT'::public.relation_type, 'Ouder', 'Parent'),
  ('SIBLING'::public.relation_type, 'Broer of zus', 'Sibling'),
  ('DOCTOR'::public.relation_type, 'Huisarts', 'Doctor'),
  ('DENTIST'::public.relation_type, 'Tandarts', 'Dentist'),
  ('OTHER'::public.relation_type, 'Overig', 'Other')
) as defaults(code, name_nl, name_en)
on conflict (tenant_id, code) do nothing;
