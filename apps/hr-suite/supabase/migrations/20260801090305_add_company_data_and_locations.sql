insert into public.permissions (code, name, category, description)
values
  ('company-data:read', 'Bedrijfsgegevens bekijken', 'Organisatie', 'Bekijkt bedrijfsgegevens en locaties van de actieve administratie.'),
  ('company-data:write', 'Bedrijfsgegevens beheren', 'Organisatie', 'Beheert bedrijfsgegevens en locaties van de actieve administratie.')
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'TENANT_ADMIN'
  and permission.code in ('company-data:read', 'company-data:write')
on conflict do nothing;

create table public.administration_company_data (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  single_location boolean not null default true,
  address_line_1 text,
  address_line_2 text,
  street text,
  house_number text,
  house_number_addition text,
  postal_code text,
  city text,
  region text,
  country_code text not null default 'NL',
  source text not null default 'manual' check (source in ('manual', 'pdok', 'geoapify')),
  source_reference text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  constraint administration_company_data_administration_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id)
    on delete cascade,
  constraint administration_company_data_scope_key unique (tenant_id, administration_id),
  constraint administration_company_data_country_code_check check (country_code ~ '^[A-Z]{2}$'),
  constraint administration_company_data_text_length_check check (
    (address_line_1 is null or char_length(btrim(address_line_1)) <= 240)
    and (address_line_2 is null or char_length(btrim(address_line_2)) <= 240)
    and (street is null or char_length(btrim(street)) <= 160)
    and (house_number is null or char_length(btrim(house_number)) <= 20)
    and (house_number_addition is null or char_length(btrim(house_number_addition)) <= 20)
    and (postal_code is null or char_length(btrim(postal_code)) <= 16)
    and (city is null or char_length(btrim(city)) <= 120)
    and (region is null or char_length(btrim(region)) <= 120)
    and (source_reference is null or char_length(btrim(source_reference)) <= 240)
  )
);

create table public.administration_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  name text not null,
  address_line_1 text,
  address_line_2 text,
  street text,
  house_number text,
  house_number_addition text,
  postal_code text,
  city text,
  region text,
  country_code text not null default 'NL',
  source text not null default 'manual' check (source in ('manual', 'pdok', 'geoapify')),
  source_reference text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  constraint administration_locations_administration_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id)
    on delete cascade,
  constraint administration_locations_scope_key unique (tenant_id, administration_id, id),
  constraint administration_locations_name_check check (char_length(btrim(name)) between 1 and 160),
  constraint administration_locations_country_code_check check (country_code ~ '^[A-Z]{2}$'),
  constraint administration_locations_text_length_check check (
    (address_line_1 is null or char_length(btrim(address_line_1)) <= 240)
    and (address_line_2 is null or char_length(btrim(address_line_2)) <= 240)
    and (street is null or char_length(btrim(street)) <= 160)
    and (house_number is null or char_length(btrim(house_number)) <= 20)
    and (house_number_addition is null or char_length(btrim(house_number_addition)) <= 20)
    and (postal_code is null or char_length(btrim(postal_code)) <= 16)
    and (city is null or char_length(btrim(city)) <= 120)
    and (region is null or char_length(btrim(region)) <= 120)
    and (source_reference is null or char_length(btrim(source_reference)) <= 240)
  )
);

alter table public.employee_organizations
  add column location_id uuid,
  add constraint employee_organizations_location_scope_fkey
    foreign key (tenant_id, administration_id, location_id)
    references public.administration_locations(tenant_id, administration_id, id)
    on delete restrict;

create index administration_locations_tenant_administration_active_idx
  on public.administration_locations (tenant_id, administration_id, is_active, name);
create index employee_organizations_location_scope_idx
  on public.employee_organizations (tenant_id, administration_id, location_id)
  where location_id is not null;

create trigger set_administration_company_data_updated_at
before update on public.administration_company_data
for each row execute function internal_security.set_updated_at();

create trigger set_administration_locations_updated_at
before update on public.administration_locations
for each row execute function internal_security.set_updated_at();

create function internal_security.guard_administration_location_mode()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'administration_company_data' and new.single_location and exists (
    select 1
    from public.administration_locations location
    where location.tenant_id = new.tenant_id
      and location.administration_id = new.administration_id
  ) then
    raise exception 'COMPANY_HAS_LOCATIONS' using errcode = 'P0001';
  end if;

  if tg_table_name = 'administration_locations' and exists (
    select 1
    from public.administration_company_data company
    where company.tenant_id = new.tenant_id
      and company.administration_id = new.administration_id
      and company.single_location
  ) then
    raise exception 'SINGLE_LOCATION_MODE' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger guard_administration_company_data_location_mode
before insert or update on public.administration_company_data
for each row execute function internal_security.guard_administration_location_mode();

create trigger guard_administration_location_mode
before insert on public.administration_locations
for each row execute function internal_security.guard_administration_location_mode();

insert into public.administration_company_data (tenant_id, administration_id, single_location)
select administration.tenant_id, administration.id, true
from public.administrations administration
on conflict (tenant_id, administration_id) do nothing;

alter table public.administration_company_data enable row level security;
alter table public.administration_locations enable row level security;

create policy administration_company_data_read
on public.administration_company_data
for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'company-data:read')));

create policy administration_company_data_write
on public.administration_company_data
for all to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'company-data:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'company-data:write')));

create policy administration_locations_read
on public.administration_locations
for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'company-data:read')));

create policy administration_locations_write
on public.administration_locations
for all to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'company-data:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'company-data:write')));

grant select, insert, update, delete on public.administration_company_data to authenticated;
grant select, insert, update, delete on public.administration_locations to authenticated;

revoke all on function internal_security.guard_administration_location_mode() from public, anon, authenticated;
