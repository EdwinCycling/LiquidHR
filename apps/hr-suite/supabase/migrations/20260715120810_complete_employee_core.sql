create type public.relation_type as enum (
  'PARTNER', 'CHILD', 'PARENT', 'SIBLING', 'DOCTOR', 'DENTIST', 'OTHER'
);

alter table public.employees
  rename column bsn to bsn_ciphertext;

comment on column public.employees.bsn_ciphertext is
  'AES-256-GCM ciphertext; nooit rechtstreeks via een user-scoped query selecteren.';

alter table public.employees
  drop constraint employees_employee_number_key;

alter table public.employees
  add constraint employees_tenant_employee_number_key unique (tenant_id, employee_number);

create table public.employee_number_sequences (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  next_value bigint not null default 100001 check (next_value > 0),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.employee_number_sequences enable row level security;
revoke all on table public.employee_number_sequences from anon, authenticated;

create function public.reserve_employee_number(p_tenant_id uuid)
returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  reserved_value bigint;
begin
  if current_user not in ('postgres', 'service_role')
    and not internal_security.current_user_has_permission(
      p_tenant_id,
      null,
      'employee:write'
    ) then
    raise exception 'EMPLOYEE_NUMBER_FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.employee_number_sequences (tenant_id, next_value)
  values (p_tenant_id, 100002)
  on conflict (tenant_id) do update
    set next_value = public.employee_number_sequences.next_value + 1,
        updated_at = timezone('utc', now())
  returning next_value - 1 into reserved_value;

  return reserved_value::text;
end;
$$;

revoke all on function public.reserve_employee_number(uuid) from public, anon;
grant execute on function public.reserve_employee_number(uuid) to authenticated, service_role;

create policy employee_number_sequences_select_scoped
on public.employee_number_sequences for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'employee:write')));
create policy employee_number_sequences_insert_scoped
on public.employee_number_sequences for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'employee:write')));
create policy employee_number_sequences_update_scoped
on public.employee_number_sequences for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'employee:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'employee:write')));
grant select, insert, update on public.employee_number_sequences to authenticated;

create table public.employee_addresses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null,
  street text not null check (length(trim(street)) between 1 and 160),
  house_number text not null check (length(trim(house_number)) between 1 and 20),
  addition text,
  postal_code text not null check (length(trim(postal_code)) between 2 and 16),
  city text not null check (length(trim(city)) between 1 and 120),
  province text,
  country_code text not null default 'NL' check (country_code ~ '^[A-Z]{2}$'),
  valid_from date not null,
  valid_until date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint employee_addresses_employee_scope_fkey
    foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id) on delete cascade,
  constraint employee_addresses_dates_valid
    check (valid_until is null or valid_until >= valid_from),
  constraint employee_addresses_no_overlap
    exclude using gist (
      tenant_id with =,
      employee_id with =,
      daterange(valid_from, coalesce(valid_until, 'infinity'::date), '[]') with &&
    ) where (deleted_at is null)
);

create index employee_addresses_employee_period_idx
  on public.employee_addresses (tenant_id, employee_id, valid_from desc)
  where deleted_at is null;

create table public.employee_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null,
  iban_ciphertext text not null,
  iban_last_four text not null check (iban_last_four ~ '^[A-Z0-9]{4}$'),
  bic text,
  account_holder text not null check (length(trim(account_holder)) between 1 and 160),
  description text,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint employee_bank_accounts_employee_scope_fkey
    foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id) on delete cascade
);

create unique index employee_bank_accounts_one_primary_idx
  on public.employee_bank_accounts (tenant_id, employee_id)
  where is_primary and deleted_at is null;

create index employee_bank_accounts_employee_idx
  on public.employee_bank_accounts (tenant_id, employee_id)
  where deleted_at is null;

create table public.employee_relations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null,
  relation_type public.relation_type not null,
  is_emergency_contact boolean not null default false,
  first_name text,
  initials text,
  prefix text,
  last_name text not null check (length(trim(last_name)) between 1 and 120),
  gender public.gender,
  birth_date date,
  phone text,
  mobile text,
  email text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint employee_relations_employee_scope_fkey
    foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id) on delete cascade
);

create index employee_relations_employee_idx
  on public.employee_relations (tenant_id, employee_id, is_emergency_contact desc)
  where deleted_at is null;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid,
  entity_name text not null,
  entity_id uuid not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('CREATE', 'UPDATE', 'ARCHIVE', 'DELETE', 'REVEAL')),
  changes jsonb not null default '{}'::jsonb check (jsonb_typeof(changes) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  constraint audit_logs_administration_scope_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete restrict
);

create index audit_logs_entity_idx
  on public.audit_logs (tenant_id, entity_name, entity_id, created_at desc);
create index audit_logs_actor_idx
  on public.audit_logs (tenant_id, actor_user_id, created_at desc)
  where actor_user_id is not null;

insert into public.permissions (code, name, category, description)
values
  ('employee-bsn:read', 'BSN bekijken', 'Persoonlijk', 'Bekijkt het volledige BSN via een expliciete, gelogde actie.'),
  ('employee-bsn:write', 'BSN wijzigen', 'Persoonlijk', 'Legt een versleuteld BSN vast of vervangt dit.'),
  ('self:employee-bsn:read', 'Eigen BSN bekijken', 'Persoonlijk', 'Bekijkt uitsluitend het eigen BSN via een gelogde actie.'),
  ('bank-account:read', 'Bankrekeningen bekijken', 'Persoonlijk', 'Bekijkt gemaskeerde bankrekeninggegevens binnen de geldige scope.'),
  ('bank-account:write', 'Bankrekeningen wijzigen', 'Persoonlijk', 'Beheert bankrekeningen binnen de geldige scope.'),
  ('audit:read', 'Activiteitenhistorie bekijken', 'Beheer', 'Bekijkt de gesaneerde activiteitenhistorie binnen de tenant.')
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'TENANT_ADMIN'
  and role.tenant_id is null
  and permission.code in (
    'employee-bsn:read', 'employee-bsn:write',
    'bank-account:read', 'bank-account:write', 'audit:read'
  )
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission on permission.code = 'self:employee-bsn:read'
where role.code = 'EMPLOYEE'
  and role.tenant_id is null
on conflict do nothing;

create function internal_security.employee_subresource_can_read(
  requested_tenant_id uuid,
  requested_employee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1
      from public.employees employee
      where employee.id = requested_employee_id
        and employee.tenant_id = requested_tenant_id
        and (
          (
            requested_employee_id = internal_security.current_employee_id()
            and internal_security.current_employee_has_permission('self:employee:read')
          )
          or internal_security.can_manage_employee(requested_employee_id, 'employee:read')
        )
    );
$$;

create function internal_security.employee_subresource_can_write(
  requested_tenant_id uuid,
  requested_employee_id uuid,
  self_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1
      from public.employees employee
      where employee.id = requested_employee_id
        and employee.tenant_id = requested_tenant_id
        and (
          (
            requested_employee_id = internal_security.current_employee_id()
            and internal_security.current_employee_has_permission(self_permission)
          )
          or internal_security.can_manage_employee(requested_employee_id, 'employee:write')
        )
    );
$$;

revoke all on function internal_security.employee_subresource_can_read(uuid, uuid) from public, anon, authenticated;
revoke all on function internal_security.employee_subresource_can_write(uuid, uuid, text) from public, anon, authenticated;

create function internal_security.audit_hr_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_data jsonb;
  old_data jsonb;
  audit_action text;
  audit_tenant uuid;
  audit_entity_id uuid;
begin
  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
    old_data := '{}'::jsonb;
    audit_action := 'DELETE';
    audit_tenant := old.tenant_id;
    audit_entity_id := old.id;
  else
    row_data := to_jsonb(new);
    old_data := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
    audit_action := case
      when tg_op = 'INSERT' then 'CREATE'
      when (row_data ->> 'deleted_at') is not null
        and (old_data ->> 'deleted_at') is null then 'ARCHIVE'
      else 'UPDATE'
    end;
    audit_tenant := new.tenant_id;
    audit_entity_id := new.id;
  end if;

  row_data := row_data - array[
    'bsn_ciphertext', 'bsn_fingerprint', 'iban_ciphertext'
  ];
  old_data := old_data - array[
    'bsn_ciphertext', 'bsn_fingerprint', 'iban_ciphertext'
  ];

  insert into public.audit_logs (
    tenant_id, entity_name, entity_id, actor_user_id, action, changes
  ) values (
    audit_tenant,
    tg_argv[0],
    audit_entity_id,
    auth.uid(),
    audit_action,
    jsonb_build_object('before', old_data, 'after', row_data)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function internal_security.audit_hr_change() from public, anon, authenticated;

create trigger set_employee_addresses_updated_at
before update on public.employee_addresses
for each row execute function internal_security.set_updated_at();
create trigger set_employee_bank_accounts_updated_at
before update on public.employee_bank_accounts
for each row execute function internal_security.set_updated_at();
create trigger set_employee_relations_updated_at
before update on public.employee_relations
for each row execute function internal_security.set_updated_at();

create trigger audit_employees
after insert or update or delete on public.employees
for each row execute function internal_security.audit_hr_change('employee');
create trigger audit_employee_addresses
after insert or update or delete on public.employee_addresses
for each row execute function internal_security.audit_hr_change('employee_address');
create trigger audit_employee_bank_accounts
after insert or update or delete on public.employee_bank_accounts
for each row execute function internal_security.audit_hr_change('employee_bank_account');
create trigger audit_employee_relations
after insert or update or delete on public.employee_relations
for each row execute function internal_security.audit_hr_change('employee_relation');

alter table public.employee_addresses enable row level security;
alter table public.employee_bank_accounts enable row level security;
alter table public.employee_relations enable row level security;
alter table public.audit_logs enable row level security;

create policy employee_addresses_select_scoped
on public.employee_addresses for select to authenticated
using ((select internal_security.employee_subresource_can_read(tenant_id, employee_id)));
create policy employee_addresses_insert_scoped
on public.employee_addresses for insert to authenticated
with check ((select internal_security.employee_subresource_can_write(tenant_id, employee_id, 'self:address:write')));
create policy employee_addresses_update_scoped
on public.employee_addresses for update to authenticated
using ((select internal_security.employee_subresource_can_write(tenant_id, employee_id, 'self:address:write')))
with check ((select internal_security.employee_subresource_can_write(tenant_id, employee_id, 'self:address:write')));

create policy employee_relations_select_scoped
on public.employee_relations for select to authenticated
using ((select internal_security.employee_subresource_can_read(tenant_id, employee_id)));
create policy employee_relations_insert_scoped
on public.employee_relations for insert to authenticated
with check ((select internal_security.employee_subresource_can_write(tenant_id, employee_id, 'self:relation:write')));
create policy employee_relations_update_scoped
on public.employee_relations for update to authenticated
using ((select internal_security.employee_subresource_can_write(tenant_id, employee_id, 'self:relation:write')))
with check ((select internal_security.employee_subresource_can_write(tenant_id, employee_id, 'self:relation:write')));

create policy employee_bank_accounts_select_scoped
on public.employee_bank_accounts for select to authenticated
using ((select internal_security.can_manage_employee(employee_id, 'bank-account:read')));
create policy employee_bank_accounts_insert_scoped
on public.employee_bank_accounts for insert to authenticated
with check ((select internal_security.can_manage_employee(employee_id, 'bank-account:write')));
create policy employee_bank_accounts_update_scoped
on public.employee_bank_accounts for update to authenticated
using ((select internal_security.can_manage_employee(employee_id, 'bank-account:write')))
with check ((select internal_security.can_manage_employee(employee_id, 'bank-account:write')));

create policy audit_logs_select_scoped
on public.audit_logs for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'audit:read')));

grant select, insert, update on public.employee_addresses to authenticated;
grant select, insert, update on public.employee_relations to authenticated;
grant select, insert, update on public.employee_bank_accounts to authenticated;
grant select on public.audit_logs to authenticated;
revoke insert, update, delete on public.audit_logs from authenticated;

revoke select, insert, update on public.employees from authenticated;
grant select (
  id, tenant_id, auth_user_id, employee_number, title, initials, first_name,
  birth_name_prefix, birth_name, partner_name_prefix, partner_name, name_usage,
  gender, pronouns, birth_date, birth_place, birth_country, nationality,
  marital_status, marital_status_date, education_level, preferred_language,
  private_email, private_phone, private_mobile, work_email, work_phone,
  work_phone_ext, work_mobile, avatar_url, original_hire_date, is_active,
  custom_fields, created_at, updated_at, deleted_at
) on public.employees to authenticated;
grant insert (
  tenant_id, employee_number, title, initials, first_name, birth_name_prefix,
  birth_name, partner_name_prefix, partner_name, name_usage, gender, pronouns,
  birth_date, birth_place, birth_country, nationality, marital_status,
  marital_status_date, education_level, preferred_language, private_email,
  private_phone, private_mobile, work_email, work_phone, work_phone_ext,
  work_mobile, avatar_url, original_hire_date, is_active
) on public.employees to authenticated;
grant update (
  employee_number, title, initials, first_name, birth_name_prefix, birth_name,
  partner_name_prefix, partner_name, name_usage, gender, pronouns, birth_date,
  birth_place, birth_country, nationality, marital_status, marital_status_date,
  education_level, preferred_language, private_email, private_phone,
  private_mobile, work_email, work_phone, work_phone_ext, work_mobile,
  avatar_url, original_hire_date, is_active, deleted_at
) on public.employees to authenticated;
