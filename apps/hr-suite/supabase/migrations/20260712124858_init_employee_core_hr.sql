create type public.gender as enum (
  'MALE',
  'FEMALE',
  'OTHER',
  'PREFER_NOT_TO_SAY'
);

create type public.name_usage as enum (
  'BIRTH_NAME',
  'PARTNER_NAME',
  'PARTNER_BEFORE_BIRTH_NAME',
  'BIRTH_NAME_BEFORE_PARTNER_NAME'
);

create type public.marital_status as enum (
  'SINGLE',
  'MARRIED',
  'REGISTERED_PARTNERSHIP',
  'DIVORCED',
  'WIDOWED'
);

create type public.education_level as enum (
  'MBO',
  'HBO',
  'WO',
  'HIGHSCHOOL',
  'OTHER',
  'UNKNOWN'
);

create schema if not exists internal_security;
revoke all on schema internal_security from public;

create function internal_security.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

revoke all on function internal_security.set_updated_at() from public;

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_number text not null unique,
  title text,
  initials text,
  first_name text not null,
  birth_name_prefix text,
  birth_name text not null,
  partner_name_prefix text,
  partner_name text,
  name_usage public.name_usage not null,
  gender public.gender not null,
  pronouns text,
  birth_date date,
  birth_place text,
  birth_country text,
  nationality text,
  bsn text,
  marital_status public.marital_status,
  marital_status_date date,
  education_level public.education_level,
  preferred_language text not null default 'nl',
  private_email text,
  private_phone text,
  private_mobile text,
  work_email text,
  work_phone text,
  work_phone_ext text,
  work_mobile text,
  avatar_url text,
  original_hire_date date,
  is_active boolean not null default true,
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint employees_custom_fields_must_be_an_object
    check (jsonb_typeof(custom_fields) = 'object')
);

comment on column public.employees.bsn is
  'Versleutelde BSN-ciphertext. De applicatielaag mag hier nooit een leesbaar BSN opslaan.';

create index employees_active_name_idx
  on public.employees (is_active, birth_name, first_name)
  where deleted_at is null;

create index employees_work_email_idx
  on public.employees (work_email)
  where work_email is not null and deleted_at is null;

create trigger set_employees_updated_at
before update on public.employees
for each row
execute function internal_security.set_updated_at();

alter table public.employees enable row level security;

create policy employees_bootstrap_deny_direct_access
on public.employees
as restrictive
for all
to authenticated
using (false)
with check (false);

grant select, insert, update, delete on table public.employees to authenticated;
