begin;

-- Stap 5: bedrijf en locaties zijn groepsbreed. Een administratie blijft een
-- vaste administratieve referentie, maar bepaalt niet meer welke locatie
-- medewerkers binnen de HR-groep kunnen gebruiken.

insert into public.permissions (code, name, category, description)
values
  ('company-data:read', 'Bedrijfsgegevens bekijken', 'Organisatie', 'Bekijkt bedrijfsgegevens en locaties van de actieve HR-groep.'),
  ('company-data:write', 'Bedrijfsgegevens beheren', 'Organisatie', 'Beheert bedrijfsgegevens en locaties van de actieve HR-groep.')
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description;

alter table public.administration_company_data
  add column if not exists hr_group_id uuid;

alter table public.administration_locations
  add column if not exists hr_group_id uuid;

do $$
begin
  if exists (
    select 1
    from public.administration_company_data company
    where company.hr_group_id is null
  ) then
    raise exception 'HR_GROUP_COMPANY_DATA_SCOPE_INVALID';
  end if;

  if exists (
    select 1
    from public.administration_locations location
    where location.hr_group_id is null
  ) then
    raise exception 'HR_GROUP_LOCATION_SCOPE_INVALID';
  end if;

  if exists (
    select 1
    from public.administration_company_data company
    group by company.tenant_id, company.hr_group_id
    having count(distinct coalesce(company.address_line_1, '')) > 1
       or count(distinct coalesce(company.address_line_2, '')) > 1
       or count(distinct coalesce(company.street, '')) > 1
       or count(distinct coalesce(company.house_number, '')) > 1
       or count(distinct coalesce(company.house_number_addition, '')) > 1
       or count(distinct coalesce(company.postal_code, '')) > 1
       or count(distinct coalesce(company.city, '')) > 1
       or count(distinct coalesce(company.region, '')) > 1
       or count(distinct coalesce(company.country_code, '')) > 1
  ) then
    raise exception 'HR_GROUP_COMPANY_DATA_DUPLICATE_SCOPE';
  end if;
end;
$$;

-- De oude guard kijkt nog naar administratie-eigenaarschap. Hij mag de
-- gecontroleerde samenvoeging naar één groepsrij niet blokkeren; de nieuwe
-- groepsbrede guard wordt direct na de merge opnieuw aangemaakt.
drop trigger if exists guard_administration_company_data_location_mode on public.administration_company_data;
drop trigger if exists guard_administration_location_mode on public.administration_locations;

-- De bestaande synthetische demo-admins delen op dit moment dezelfde
-- bedrijfsdata. Bij meerdere rijen per groep blijft de oudste rij de stabiele
-- technische rij; lege velden worden uit de andere rij(en) aangevuld. Bij
-- inhoudelijk verschillende adressen stopt de migratie hierboven bewust.
do $$
declare
  company_group record;
  duplicate_row record;
begin
  for company_group in
    select tenant_id, hr_group_id, (array_agg(id order by id))[1] as keep_id
    from public.administration_company_data
    group by tenant_id, hr_group_id
    having count(*) > 1
  loop
    for duplicate_row in
      select *
      from public.administration_company_data
      where tenant_id = company_group.tenant_id
        and hr_group_id = company_group.hr_group_id
        and id <> company_group.keep_id
      order by id
    loop
      update public.administration_company_data keep_row
      set single_location = keep_row.single_location and duplicate_row.single_location,
          address_line_1 = coalesce(keep_row.address_line_1, duplicate_row.address_line_1),
          address_line_2 = coalesce(keep_row.address_line_2, duplicate_row.address_line_2),
          street = coalesce(keep_row.street, duplicate_row.street),
          house_number = coalesce(keep_row.house_number, duplicate_row.house_number),
          house_number_addition = coalesce(keep_row.house_number_addition, duplicate_row.house_number_addition),
          postal_code = coalesce(keep_row.postal_code, duplicate_row.postal_code),
          city = coalesce(keep_row.city, duplicate_row.city),
          region = coalesce(keep_row.region, duplicate_row.region),
          country_code = coalesce(keep_row.country_code, duplicate_row.country_code),
          source = coalesce(keep_row.source, duplicate_row.source),
          source_reference = coalesce(keep_row.source_reference, duplicate_row.source_reference),
          created_by_user_id = coalesce(keep_row.created_by_user_id, duplicate_row.created_by_user_id),
          updated_by_user_id = coalesce(keep_row.updated_by_user_id, duplicate_row.updated_by_user_id)
      where keep_row.id = company_group.keep_id;
    end loop;

    delete from public.administration_company_data
    where tenant_id = company_group.tenant_id
      and hr_group_id = company_group.hr_group_id
      and id <> company_group.keep_id;
  end loop;
end;
$$;

-- De oude administratie-relaties worden verwijderd voordat de kolommen worden
-- verwijderd. Locatieplaatsingen blijven bestaan via de nieuwe groeps-FK.
drop policy if exists administration_company_data_read on public.administration_company_data;
drop policy if exists administration_company_data_write on public.administration_company_data;
drop policy if exists administration_company_data_insert on public.administration_company_data;
drop policy if exists administration_company_data_update on public.administration_company_data;
drop policy if exists administration_company_data_delete on public.administration_company_data;
drop policy if exists administration_locations_read on public.administration_locations;
drop policy if exists administration_locations_write on public.administration_locations;
drop policy if exists administration_locations_insert on public.administration_locations;
drop policy if exists administration_locations_update on public.administration_locations;
drop policy if exists administration_locations_delete on public.administration_locations;

alter table public.employee_organizations
  drop constraint if exists employee_organizations_location_scope_fkey;

alter table public.administration_company_data
  drop constraint if exists administration_company_data_administration_fkey,
  drop constraint if exists administration_company_data_scope_key,
  drop constraint if exists administration_company_data_hr_group_fkey;

alter table public.administration_locations
  drop constraint if exists administration_locations_administration_fkey,
  drop constraint if exists administration_locations_scope_key,
  drop constraint if exists administration_locations_hr_group_fkey;

drop index if exists public.administration_locations_tenant_hr_group_id_key;
drop index if exists public.administration_locations_tenant_administration_active_idx;
drop index if exists public.employee_organizations_location_scope_idx;

alter table public.administration_company_data
  drop column administration_id,
  add constraint administration_company_data_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete restrict,
  add constraint administration_company_data_scope_key
    unique (tenant_id, hr_group_id);

alter table public.administration_locations
  drop column administration_id,
  add constraint administration_locations_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete restrict,
  add constraint administration_locations_tenant_hr_group_id_key
    unique (tenant_id, hr_group_id, id);

alter table public.employee_organizations
  add constraint employee_organizations_location_hr_group_scope_fkey
    foreign key (tenant_id, hr_group_id, location_id)
    references public.administration_locations(tenant_id, hr_group_id, id)
    on delete restrict;

create index administration_locations_tenant_hr_group_active_idx
  on public.administration_locations (tenant_id, hr_group_id, is_active, name);
create index employee_organizations_location_hr_group_scope_idx
  on public.employee_organizations (tenant_id, hr_group_id, location_id)
  where location_id is not null;

create or replace function internal_security.guard_administration_location_mode()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'administration_company_data' then
    if new.single_location and exists (
      select 1
      from public.administration_locations location
      where location.tenant_id = new.tenant_id
        and location.hr_group_id = new.hr_group_id
    ) then
      raise exception 'COMPANY_HAS_LOCATIONS' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'administration_locations' then
    if exists (
      select 1
      from public.administration_company_data company
      where company.tenant_id = new.tenant_id
        and company.hr_group_id = new.hr_group_id
        and company.single_location
    ) then
      raise exception 'SINGLE_LOCATION_MODE' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_administration_company_data_location_mode
before insert or update on public.administration_company_data
for each row execute function internal_security.guard_administration_location_mode();

create trigger guard_administration_location_mode
before insert or update on public.administration_locations
for each row execute function internal_security.guard_administration_location_mode();

create or replace function internal_security.ensure_hr_group_company_data()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.administration_company_data (tenant_id, hr_group_id, single_location)
  values (new.tenant_id, new.id, true)
  on conflict (tenant_id, hr_group_id) do nothing;
  return new;
end;
$$;

drop trigger if exists ensure_hr_group_company_data_after_insert on public.hr_groups;
create trigger ensure_hr_group_company_data_after_insert
after insert on public.hr_groups
for each row execute function internal_security.ensure_hr_group_company_data();

revoke all on function internal_security.ensure_hr_group_company_data() from public, anon, authenticated;

insert into public.administration_company_data (tenant_id, hr_group_id, single_location)
select group_row.tenant_id,
       group_row.id,
       not exists (
         select 1
         from public.administration_locations location
         where location.tenant_id = group_row.tenant_id
           and location.hr_group_id = group_row.id
       )
from public.hr_groups group_row
on conflict (tenant_id, hr_group_id) do nothing;

update public.administration_company_data company
set single_location = false
where exists (
  select 1
  from public.administration_locations location
  where location.tenant_id = company.tenant_id
    and location.hr_group_id = company.hr_group_id
);

create or replace function internal_security.guard_employee_organization_location()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  company_row public.administration_company_data%rowtype;
begin
  if new.location_id is null then
    return new;
  end if;

  select company.* into company_row
  from public.administration_company_data company
  where company.tenant_id = new.tenant_id
    and company.hr_group_id = new.hr_group_id;

  if company_row.id is null then
    raise exception 'COMPANY_DATA_NOT_FOUND' using errcode = 'P0002';
  end if;
  if company_row.single_location then
    raise exception 'SINGLE_LOCATION_MODE' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
    from public.administration_locations location
    where location.id = new.location_id
      and location.tenant_id = new.tenant_id
      and location.hr_group_id = new.hr_group_id
      and location.is_active
  ) then
    raise exception 'LOCATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_employee_organization_location on public.employee_organizations;
create trigger guard_employee_organization_location
before insert or update of tenant_id, hr_group_id, administration_id, location_id
on public.employee_organizations
for each row execute function internal_security.guard_employee_organization_location();

revoke all on function internal_security.guard_employee_organization_location() from public, anon, authenticated;

create or replace function public.manage_employment_company_location(
  requested_employment_id uuid,
  requested_placement_id uuid,
  requested_effective_on date,
  requested_location_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  employment_row public.employments%rowtype;
  placement_row public.employee_organizations%rowtype;
  company_row public.administration_company_data%rowtype;
  resulting_id uuid;
begin
  select employment.* into employment_row
  from public.employments employment
  where employment.id = requested_employment_id
    and employment.deleted_at is null
  for update;
  if employment_row.id is null then raise exception 'EMPLOYMENT_NOT_FOUND'; end if;
  if not internal_security.current_user_has_permission(
    employment_row.tenant_id, employment_row.administration_id,
    'organization-placement:write'
  ) then raise exception 'FORBIDDEN'; end if;

  select company.* into company_row
  from public.administration_company_data company
  where company.tenant_id = employment_row.tenant_id
    and company.hr_group_id = employment_row.hr_group_id;
  if company_row.id is null then raise exception 'COMPANY_DATA_NOT_FOUND'; end if;
  if company_row.single_location then raise exception 'SINGLE_LOCATION_MODE'; end if;
  if not exists (
    select 1
    from public.administration_locations location
    where location.id = requested_location_id
      and location.tenant_id = employment_row.tenant_id
      and location.hr_group_id = employment_row.hr_group_id
      and location.is_active
  ) then raise exception 'LOCATION_NOT_FOUND'; end if;

  if requested_placement_id is not null then
    update public.employee_organizations
    set location_id = requested_location_id
    where id = requested_placement_id
      and employment_id = requested_employment_id
      and hr_group_id = employment_row.hr_group_id
    returning id into resulting_id;
    if resulting_id is null then raise exception 'PLACEMENT_NOT_FOUND'; end if;
    return resulting_id;
  end if;

  if requested_effective_on <= employment_row.starts_on
     or (
       employment_row.ends_on is not null
       and requested_effective_on > employment_row.ends_on
     ) then raise exception 'LOCATION_EFFECTIVE_DATE_INVALID'; end if;

  select placement.* into placement_row
  from public.employee_organizations placement
  where placement.employment_id = requested_employment_id
    and placement.hr_group_id = employment_row.hr_group_id
    and placement.effective_from < requested_effective_on
    and (
      placement.effective_to is null
      or placement.effective_to >= requested_effective_on
    )
  order by placement.effective_from desc
  limit 1
  for update;
  if placement_row.id is null then raise exception 'LOCATION_CHAIN_GAP'; end if;

  update public.employee_organizations
  set effective_to = requested_effective_on - 1
  where id = placement_row.id;

  insert into public.employee_organizations (
    tenant_id, hr_group_id, administration_id, employee_id, employment_id,
    department_id, job_id, job_title, direct_manager_id,
    direct_manager_deputy_id, cost_bearer, location_id,
    effective_from, effective_to
  ) values (
    employment_row.tenant_id, employment_row.hr_group_id, employment_row.administration_id,
    employment_row.employee_id, employment_row.id,
    placement_row.department_id, placement_row.job_id, placement_row.job_title,
    placement_row.direct_manager_id, placement_row.direct_manager_deputy_id,
    placement_row.cost_bearer, requested_location_id,
    requested_effective_on, placement_row.effective_to
  ) returning id into resulting_id;

  return resulting_id;
end;
$$;

revoke all on function public.manage_employment_company_location(uuid, uuid, date, uuid) from public, anon;
grant execute on function public.manage_employment_company_location(uuid, uuid, date, uuid) to authenticated;

create or replace function public.manage_employment_organization_timeline(
  requested_employment_id uuid,
  requested_placement_id uuid,
  requested_effective_on date,
  requested_department_id uuid,
  requested_job_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  employment_row public.employments%rowtype;
  placement_row public.employee_organizations%rowtype;
  job_name text;
  resulting_id uuid;
begin
  select employment.* into employment_row
  from public.employments employment
  where employment.id = requested_employment_id
    and employment.deleted_at is null
  for update;
  if employment_row.id is null then raise exception 'EMPLOYMENT_NOT_FOUND'; end if;
  if not internal_security.current_user_has_permission(
    employment_row.tenant_id, employment_row.administration_id,
    'organization-placement:write'
  ) then raise exception 'FORBIDDEN'; end if;

  if not exists (
    select 1 from public.departments department
    where department.id = requested_department_id
      and department.tenant_id = employment_row.tenant_id
      and department.hr_group_id = employment_row.hr_group_id
      and department.is_active
  ) then raise exception 'DEPARTMENT_NOT_FOUND'; end if;

  select revision.name into job_name
  from public.jobs job
  join public.job_revisions revision on revision.job_id = job.id and revision.tenant_id = job.tenant_id
  where job.id = requested_job_id
    and job.tenant_id = employment_row.tenant_id
    and job.hr_group_id = employment_row.hr_group_id
    and job.is_active
    and revision.valid_from <= requested_effective_on
    and (revision.valid_until is null or revision.valid_until > requested_effective_on)
  order by revision.valid_from desc
  limit 1;
  if job_name is null then raise exception 'JOB_NOT_FOUND'; end if;

  if requested_placement_id is not null then
    update public.employee_organizations
    set department_id = requested_department_id,
        job_id = requested_job_id,
        job_title = job_name
    where id = requested_placement_id
      and employment_id = requested_employment_id
      and hr_group_id = employment_row.hr_group_id
    returning id into resulting_id;
    if resulting_id is null then raise exception 'PLACEMENT_NOT_FOUND'; end if;
    return resulting_id;
  end if;

  if requested_effective_on <= employment_row.starts_on
     or (
       employment_row.ends_on is not null
       and requested_effective_on > employment_row.ends_on
     ) then raise exception 'PLACEMENT_EFFECTIVE_DATE_INVALID'; end if;

  select placement.* into placement_row
  from public.employee_organizations placement
  where placement.employment_id = requested_employment_id
    and placement.hr_group_id = employment_row.hr_group_id
    and placement.effective_from < requested_effective_on
    and (
      placement.effective_to is null
      or placement.effective_to >= requested_effective_on
    )
  order by placement.effective_from desc
  limit 1
  for update;
  if placement_row.id is null then raise exception 'PLACEMENT_CHAIN_GAP'; end if;

  update public.employee_organizations
  set effective_to = requested_effective_on - 1
  where id = placement_row.id;

  insert into public.employee_organizations (
    tenant_id, hr_group_id, administration_id, employee_id, employment_id,
    department_id, job_id, job_title, direct_manager_id,
    direct_manager_deputy_id, cost_bearer, location_id,
    effective_from, effective_to
  ) values (
    employment_row.tenant_id, employment_row.hr_group_id, employment_row.administration_id,
    employment_row.employee_id, employment_row.id,
    requested_department_id, requested_job_id, job_name,
    placement_row.direct_manager_id, placement_row.direct_manager_deputy_id,
    placement_row.cost_bearer, placement_row.location_id,
    requested_effective_on, placement_row.effective_to
  ) returning id into resulting_id;

  return resulting_id;
end;
$$;

revoke all on function public.manage_employment_organization_timeline(uuid, uuid, date, uuid, uuid) from public, anon;
grant execute on function public.manage_employment_organization_timeline(uuid, uuid, date, uuid, uuid) to authenticated;

create policy administration_company_data_read
on public.administration_company_data
for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'company-data:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'organization-placement:read'))
);

create policy administration_company_data_insert
on public.administration_company_data
for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'company-data:write')));

create policy administration_company_data_update
on public.administration_company_data
for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'company-data:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'company-data:write')));

create policy administration_company_data_delete
on public.administration_company_data
for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'company-data:write')));

create policy administration_locations_read
on public.administration_locations
for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'company-data:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'organization-placement:read'))
);

create policy administration_locations_insert
on public.administration_locations
for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'company-data:write')));

create policy administration_locations_update
on public.administration_locations
for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'company-data:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'company-data:write')));

create policy administration_locations_delete
on public.administration_locations
for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'company-data:write')));

revoke all on public.administration_company_data from anon, public;
revoke all on public.administration_locations from anon, public;
grant select, insert, update, delete on public.administration_company_data to authenticated;
grant select, insert, update, delete on public.administration_locations to authenticated;

drop policy if exists administrations_update_hr_group_manager on public.administrations;
create policy administrations_update_hr_group_manager
on public.administrations for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'hr-group:manage')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'hr-group:manage')));

grant update on public.administrations to authenticated;

create or replace function internal_security.prevent_administration_identity_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.hr_group_id is distinct from old.hr_group_id
     or new.code is distinct from old.code then
    raise exception 'ADMINISTRATION_IDENTITY_IMMUTABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_administration_identity_change on public.administrations;
create trigger prevent_administration_identity_change
before update of id, tenant_id, hr_group_id, code
on public.administrations
for each row execute function internal_security.prevent_administration_identity_change();

revoke all on function internal_security.prevent_administration_identity_change() from public, anon, authenticated;

drop trigger if exists audit_administrations on public.administrations;
create trigger audit_administrations
after update of name, administration_number on public.administrations
for each row execute function internal_security.audit_configuration_change('administration');

drop trigger if exists audit_administration_company_data on public.administration_company_data;
create trigger audit_administration_company_data
after insert or update or delete on public.administration_company_data
for each row execute function internal_security.audit_configuration_change('hr_group_company_data');

drop trigger if exists audit_administration_locations on public.administration_locations;
create trigger audit_administration_locations
after insert or update or delete on public.administration_locations
for each row execute function internal_security.audit_configuration_change('hr_group_location');

-- Een nieuwe HR-groep krijgt tenant-brede groepsaccess van bestaande
-- tenant-scopes. Administratie-scopes blijven bewust beperkt tot hun eigen
-- groep.
create or replace function internal_security.sync_user_hr_group_access_after_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_hr_group_access (user_id, tenant_id, hr_group_id, management_role_id)
  select access.user_id, access.tenant_id, new.id, access.management_role_id
  from public.user_access access
  where access.tenant_id = new.tenant_id
    and access.scope_type = 'TENANT'
    and access.is_active
  on conflict (user_id, tenant_id, hr_group_id, management_role_id) do update
  set is_active = true,
      updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists sync_user_hr_group_access_after_group on public.hr_groups;
create trigger sync_user_hr_group_access_after_group
after insert on public.hr_groups
for each row execute function internal_security.sync_user_hr_group_access_after_group();

revoke all on function internal_security.sync_user_hr_group_access_after_group() from public, anon, authenticated;

-- Controlled testdata: one empty administration in a second group in the
-- existing demo tenant. No employee or person is invented; the rows only make
-- the group-boundary and group-wide company/location assertions reproducible.
do $$
declare
  demo_tenant_id uuid;
  boundary_group_id uuid;
  boundary_administration_id uuid;
begin
  select tenant.id into demo_tenant_id
  from public.tenants tenant
  where tenant.slug = 'liquid-hr-demo-holding'
  limit 1;

  if demo_tenant_id is not null then
    insert into public.hr_groups (tenant_id, code, name, description)
    values (
      demo_tenant_id,
      'TEST-BOUNDARY',
      'Testgroep voor HR-groepsgrens',
      'Gecontroleerde testgroep zonder medewerkers voor groepsisolatie.'
    )
    on conflict (tenant_id, code) do nothing;

    select group_row.id into boundary_group_id
    from public.hr_groups group_row
    where group_row.tenant_id = demo_tenant_id
      and group_row.code = 'TEST-BOUNDARY';

    insert into public.administrations (
      tenant_id, hr_group_id, code, name, administration_number
    )
    values (
      demo_tenant_id,
      boundary_group_id,
      'TEST-BOUNDARY-ADMIN',
      'Testadministratie groepsgrens',
      'TEST-BOUNDARY-001'
    )
    on conflict (tenant_id, code) do nothing;

    select administration.id into boundary_administration_id
    from public.administrations administration
    where administration.tenant_id = demo_tenant_id
      and administration.code = 'TEST-BOUNDARY-ADMIN';

    if not exists (
      select 1
      from public.administrations administration
      where administration.id = boundary_administration_id
        and administration.hr_group_id = boundary_group_id
    ) then
      raise exception 'HR_GROUP_TEST_ADMINISTRATION_SCOPE_INVALID';
    end if;

    update public.administration_company_data
    set single_location = false
    where tenant_id = demo_tenant_id
      and hr_group_id = boundary_group_id;

    if not exists (
      select 1
      from public.administration_locations location
      where location.tenant_id = demo_tenant_id
        and location.hr_group_id = boundary_group_id
        and location.name = 'Testgroep B locatie'
    ) then
      insert into public.administration_locations (
        tenant_id, hr_group_id, name, is_active, city, country_code
      )
      values (
        demo_tenant_id, boundary_group_id, 'Testgroep B locatie', true, 'Teststad', 'NL'
      );
    end if;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from public.administration_company_data company
    group by company.tenant_id, company.hr_group_id
    having count(*) <> 1
  ) then
    raise exception 'HR_GROUP_COMPANY_DATA_SCOPE_NOT_UNIQUE';
  end if;

  if exists (
    select 1
    from public.employee_organizations placement
    join public.administration_locations location
      on location.tenant_id = placement.tenant_id
     and location.id = placement.location_id
    where placement.location_id is not null
      and placement.hr_group_id <> location.hr_group_id
  ) then
    raise exception 'HR_GROUP_LOCATION_PLACEMENT_SCOPE_INVALID';
  end if;
end;
$$;

comment on table public.administration_company_data is
  'Groepsbrede bedrijfsgegevens; administratie_id is bewust geen eigendomssleutel.';
comment on table public.administration_locations is
  'Groepsbrede locaties; employee_organizations.location_id legt de employment-plaatsing vast.';
comment on column public.administrations.administration_number is
  'Beheerbaar administratienummer; het interne id blijft de technische sleutel.';

commit;
