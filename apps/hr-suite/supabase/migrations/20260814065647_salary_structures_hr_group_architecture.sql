-- Salarisstructuren Stap 1: definitief HR-groepmodel, historiebehoud en security.

create type public.salary_structure_type as enum ('SCALE_WITH_STEPS', 'SALARY_BAND');
create type public.salary_structure_basis as enum ('MONTHLY_BASE', 'FOUR_WEEKLY_BASE', 'ANNUAL_BASE', 'HOURLY');
create type public.salary_progression_type as enum ('MANUAL', 'TIME_IN_STEP', 'FIXED_DATE');
create type public.salary_band_input_method as enum ('MIDPOINT_SPREAD', 'MIN_MAX', 'MANUAL_ANCHORS');
create type public.salary_structure_migration_status as enum ('OPEN', 'RESOLVED', 'IGNORED');

create table public.salary_structures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  structure_type public.salary_structure_type not null,
  code text,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text check (description is null or char_length(description) <= 1000),
  is_active boolean not null default true,
  created_by_user_id uuid references auth.users(id) on delete restrict,
  updated_by_user_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint salary_structures_code_valid check (code is null or char_length(btrim(code)) between 1 and 40),
  constraint salary_structures_hr_group_fkey foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete restrict,
  constraint salary_structures_scope_id_key unique (tenant_id, hr_group_id, id)
);

create unique index salary_structures_code_key
  on public.salary_structures (tenant_id, hr_group_id, upper(code))
  where code is not null;
create index salary_structures_group_active_idx
  on public.salary_structures (tenant_id, hr_group_id, is_active, structure_type);

create table public.salary_structure_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  salary_structure_id uuid not null,
  revision_number integer not null check (revision_number > 0),
  status public.salary_revision_status not null default 'DRAFT',
  effective_from date not null,
  salary_basis public.salary_structure_basis not null,
  currency_code text not null default 'EUR' check (currency_code ~ '^[A-Z]{3}$'),
  description text check (description is null or char_length(description) <= 1000),
  lock_version integer not null default 1 check (lock_version > 0),
  published_at timestamptz,
  published_by_user_id uuid references auth.users(id) on delete restrict,
  created_by_user_id uuid references auth.users(id) on delete restrict,
  updated_by_user_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint salary_structure_revisions_publish_state_valid check (
    (status = 'PUBLISHED' and published_at is not null and published_by_user_id is not null)
    or status <> 'PUBLISHED'
  ),
  constraint salary_structure_revisions_structure_fkey
    foreign key (tenant_id, hr_group_id, salary_structure_id)
    references public.salary_structures(tenant_id, hr_group_id, id) on delete cascade,
  constraint salary_structure_revisions_number_key
    unique (tenant_id, hr_group_id, salary_structure_id, revision_number),
  constraint salary_structure_revisions_effective_key
    unique (tenant_id, hr_group_id, salary_structure_id, effective_from),
  constraint salary_structure_revisions_scope_id_key unique (tenant_id, hr_group_id, id)
);

create index salary_structure_revisions_effective_idx
  on public.salary_structure_revisions (tenant_id, hr_group_id, salary_structure_id, effective_from desc);

create table public.salary_scale_revision_values (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  salary_structure_revision_id uuid not null,
  salary_scale_id uuid not null,
  code text not null check (char_length(btrim(code)) between 1 and 40),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text check (description is null or char_length(description) <= 1000),
  sort_order integer not null check (sort_order >= 0),
  progression_type public.salary_progression_type not null default 'MANUAL',
  default_months_to_next_step integer check (default_months_to_next_step is null or default_months_to_next_step > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint salary_scale_revision_values_revision_fkey
    foreign key (tenant_id, hr_group_id, salary_structure_revision_id)
    references public.salary_structure_revisions(tenant_id, hr_group_id, id) on delete cascade,
  constraint salary_scale_revision_values_code_key
    unique (salary_structure_revision_id, code),
  constraint salary_scale_revision_values_order_key
    unique (salary_structure_revision_id, sort_order),
  constraint salary_scale_revision_values_membership_key
    unique (tenant_id, hr_group_id, salary_structure_revision_id, salary_scale_id)
);

create table public.salary_bands (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  salary_structure_id uuid not null,
  identity_key text not null check (char_length(btrim(identity_key)) between 1 and 80),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint salary_bands_structure_fkey
    foreign key (tenant_id, hr_group_id, salary_structure_id)
    references public.salary_structures(tenant_id, hr_group_id, id) on delete cascade,
  constraint salary_bands_identity_key unique (salary_structure_id, identity_key),
  constraint salary_bands_scope_id_key unique (tenant_id, hr_group_id, id)
);

create table public.salary_band_values (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  salary_structure_revision_id uuid not null,
  salary_band_id uuid not null,
  code text not null check (char_length(btrim(code)) between 1 and 40),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  sort_order integer not null check (sort_order >= 0),
  input_method public.salary_band_input_method not null,
  minimum_amount numeric(14,2) not null check (minimum_amount > 0),
  midpoint_amount numeric(14,2) not null check (midpoint_amount >= minimum_amount),
  maximum_amount numeric(14,2) check (maximum_amount is null or maximum_amount >= midpoint_amount),
  input_spread_percentage numeric(9,4) check (input_spread_percentage is null or input_spread_percentage >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint salary_band_values_revision_fkey
    foreign key (tenant_id, hr_group_id, salary_structure_revision_id)
    references public.salary_structure_revisions(tenant_id, hr_group_id, id) on delete cascade,
  constraint salary_band_values_band_fkey
    foreign key (tenant_id, hr_group_id, salary_band_id)
    references public.salary_bands(tenant_id, hr_group_id, id) on delete restrict,
  constraint salary_band_values_code_key unique (salary_structure_revision_id, code),
  constraint salary_band_values_order_key unique (salary_structure_revision_id, sort_order),
  constraint salary_band_values_membership_key
    unique (tenant_id, hr_group_id, salary_structure_revision_id, salary_band_id)
);

create table public.labor_condition_salary_structures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  labor_condition_set_id uuid not null,
  salary_structure_id uuid not null,
  created_by_user_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  constraint labor_condition_salary_structures_condition_fkey
    foreign key (tenant_id, hr_group_id, labor_condition_set_id)
    references public.labor_condition_sets(tenant_id, hr_group_id, id) on delete cascade,
  constraint labor_condition_salary_structures_structure_fkey
    foreign key (tenant_id, hr_group_id, salary_structure_id)
    references public.salary_structures(tenant_id, hr_group_id, id) on delete cascade,
  constraint labor_condition_salary_structures_key
    unique (tenant_id, hr_group_id, labor_condition_set_id, salary_structure_id)
);

create table public.salary_structure_migration_conflicts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  legacy_scale_code text not null,
  source_administration_ids uuid[] not null,
  salary_structure_ids uuid[] not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  status public.salary_structure_migration_status not null default 'OPEN',
  resolution jsonb,
  resolved_at timestamptz,
  resolved_by_user_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint salary_structure_migration_conflicts_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete cascade,
  constraint salary_structure_migration_conflicts_state_valid check (
    (status = 'RESOLVED' and resolved_at is not null and resolved_by_user_id is not null)
    or status <> 'RESOLVED'
  ),
  constraint salary_structure_migration_conflicts_key
    unique (tenant_id, hr_group_id, legacy_scale_code)
);

-- De bestaande schaalrecords worden stabiele logical scale identities. Iedere
-- oude schaal krijgt eerst een eigen named structure; dubbele codes blijven
-- afzonderlijk bewaard en worden expliciet als migratieconflict geregistreerd.
insert into public.salary_structures (
  id, tenant_id, hr_group_id, structure_type, code, name, description, is_active, created_at, updated_at
)
select
  scale.id,
  scale.tenant_id,
  administration.hr_group_id,
  'SCALE_WITH_STEPS',
  case when count(*) over (
    partition by scale.tenant_id, administration.hr_group_id, upper(scale.code)
  ) = 1 then upper(btrim(scale.code)) else null end,
  scale.name,
  scale.description,
  scale.is_active,
  scale.created_at,
  scale.updated_at
from public.salary_scales scale
join public.administrations administration
  on administration.tenant_id = scale.tenant_id
 and administration.id = scale.administration_id;

insert into public.salary_structure_migration_conflicts (
  tenant_id, hr_group_id, legacy_scale_code, source_administration_ids,
  salary_structure_ids, reason
)
select
  scale.tenant_id,
  administration.hr_group_id,
  upper(btrim(scale.code)),
  array_agg(scale.administration_id order by scale.administration_id),
  array_agg(scale.id order by scale.id),
  'Dezelfde legacy schaalcode kwam voor in meerdere administraties binnen één HR-groep.'
from public.salary_scales scale
join public.administrations administration
  on administration.tenant_id = scale.tenant_id
 and administration.id = scale.administration_id
group by scale.tenant_id, administration.hr_group_id, upper(btrim(scale.code))
having count(*) > 1;

alter table public.salary_scales
  add column hr_group_id uuid,
  add column salary_structure_id uuid;

update public.salary_scales scale
set hr_group_id = administration.hr_group_id,
    salary_structure_id = scale.id
from public.administrations administration
where administration.tenant_id = scale.tenant_id
  and administration.id = scale.administration_id;

alter table public.salary_scales
  alter column hr_group_id set not null,
  alter column salary_structure_id set not null;

insert into public.salary_structure_revisions (
  id, tenant_id, hr_group_id, salary_structure_id, revision_number, status,
  effective_from, salary_basis, currency_code, description, published_at,
  published_by_user_id, created_at, updated_at
)
select
  revision.id,
  revision.tenant_id,
  administration.hr_group_id,
  revision.salary_scale_id,
  revision.revision_number,
  revision.status,
  revision.valid_from,
  'MONTHLY_BASE',
  coalesce((
    select step.currency_code
    from public.salary_scale_steps step
    where step.salary_scale_revision_id = revision.id
    order by step.sequence_number, step.id
    limit 1
  ), 'EUR'),
  revision.description,
  revision.published_at,
  revision.published_by_user_id,
  revision.created_at,
  revision.updated_at
from public.salary_scale_revisions revision
join public.administrations administration
  on administration.tenant_id = revision.tenant_id
 and administration.id = revision.administration_id;

insert into public.salary_scale_revision_values (
  tenant_id, hr_group_id, salary_structure_revision_id, salary_scale_id,
  code, name, description, sort_order
)
select
  revision.tenant_id,
  administration.hr_group_id,
  revision.id,
  scale.id,
  scale.code,
  scale.name,
  scale.description,
  0
from public.salary_scale_revisions revision
join public.salary_scales scale
  on scale.tenant_id = revision.tenant_id
 and scale.administration_id = revision.administration_id
 and scale.id = revision.salary_scale_id
join public.administrations administration
  on administration.tenant_id = revision.tenant_id
 and administration.id = revision.administration_id;

drop function if exists public.publish_salary_scale_revision(uuid, jsonb);
drop trigger if exists guard_published_salary_step on public.salary_scale_steps;
drop trigger if exists guard_published_salary_revision on public.salary_scale_revisions;
drop function if exists internal_security.guard_published_salary_step();
drop function if exists internal_security.guard_published_salary_revision();

drop policy if exists salary_scales_read on public.salary_scales;
drop policy if exists salary_scales_write on public.salary_scales;
drop policy if exists salary_scales_insert on public.salary_scales;
drop policy if exists salary_scales_update on public.salary_scales;
drop policy if exists salary_scales_delete on public.salary_scales;
drop policy if exists salary_scale_steps_read on public.salary_scale_steps;
drop policy if exists salary_scale_steps_write on public.salary_scale_steps;
drop policy if exists salary_scale_steps_insert on public.salary_scale_steps;
drop policy if exists salary_scale_steps_update on public.salary_scale_steps;
drop policy if exists salary_scale_steps_delete on public.salary_scale_steps;
drop policy if exists salary_scale_revisions_read on public.salary_scale_revisions;
drop policy if exists salary_scale_revisions_write on public.salary_scale_revisions;
drop policy if exists salary_scale_revisions_insert on public.salary_scale_revisions;
drop policy if exists salary_scale_revisions_update on public.salary_scale_revisions;
drop policy if exists salary_scale_revisions_delete on public.salary_scale_revisions;

alter table public.employment_salaries
  add column hr_group_id uuid;

update public.employment_salaries salary
set hr_group_id = employment.hr_group_id
from public.employments employment
where employment.tenant_id = salary.tenant_id
  and employment.id = salary.employment_id;

alter table public.employment_salaries
  alter column hr_group_id set not null,
  drop constraint if exists employment_salaries_scale_step_fkey;

alter table public.salary_scale_steps
  drop constraint if exists salary_scale_steps_revision_fkey,
  drop constraint if exists salary_scale_steps_scale_fkey,
  drop constraint if exists salary_scale_steps_code_period_key,
  drop constraint if exists salary_scale_steps_period_valid,
  drop constraint if exists salary_scale_steps_scope_id_key,
  drop constraint if exists salary_scale_steps_revision_code_key,
  drop constraint if exists salary_scale_steps_revision_sequence_key,
  add column hr_group_id uuid;

update public.salary_scale_steps step
set hr_group_id = administration.hr_group_id
from public.administrations administration
where administration.tenant_id = step.tenant_id
  and administration.id = step.administration_id;

alter table public.salary_scale_steps
  alter column hr_group_id set not null;

alter table public.salary_scale_steps
  rename column salary_scale_revision_id to salary_structure_revision_id;

alter table public.salary_scale_steps
  add column progression_type public.salary_progression_type not null default 'MANUAL',
  add column months_to_next_step integer check (months_to_next_step is null or months_to_next_step > 0),
  add constraint salary_scale_steps_revision_membership_fkey
    foreign key (tenant_id, hr_group_id, salary_structure_revision_id, salary_scale_id)
    references public.salary_scale_revision_values(
      tenant_id, hr_group_id, salary_structure_revision_id, salary_scale_id
    ) on delete cascade,
  add constraint salary_scale_steps_revision_code_key
    unique (salary_structure_revision_id, salary_scale_id, step_code),
  add constraint salary_scale_steps_revision_sequence_key
    unique (salary_structure_revision_id, salary_scale_id, sequence_number),
  add constraint salary_scale_steps_scope_id_key unique (tenant_id, hr_group_id, id);

alter table public.salary_scale_steps
  drop column valid_from,
  drop column valid_until,
  drop column administration_id;

alter table public.salary_scale_revisions
  drop constraint if exists salary_scale_revisions_tenant_id_administration_id_salary__fkey;

alter table public.salary_scales
  drop constraint if exists salary_scales_administration_fkey,
  drop constraint if exists salary_scales_code_key,
  drop constraint if exists salary_scales_scope_id_key,
  add constraint salary_scales_structure_fkey
    foreign key (tenant_id, hr_group_id, salary_structure_id)
    references public.salary_structures(tenant_id, hr_group_id, id) on delete cascade,
  add constraint salary_scales_identity_key unique (salary_structure_id, id),
  add constraint salary_scales_scope_id_key unique (tenant_id, hr_group_id, id);

alter table public.salary_scales drop column administration_id;

drop table public.salary_scale_revisions;

alter table public.salary_scale_revision_values
  add constraint salary_scale_revision_values_scale_fkey
    foreign key (tenant_id, hr_group_id, salary_scale_id)
    references public.salary_scales(tenant_id, hr_group_id, id) on delete restrict;

alter table public.employment_salaries
  add constraint employment_salaries_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete restrict,
  add constraint employment_salaries_employment_hr_group_fkey
    foreign key (tenant_id, hr_group_id, employment_id)
    references public.employments(tenant_id, hr_group_id, id) on delete cascade,
  add constraint employment_salaries_scale_step_fkey
    foreign key (tenant_id, hr_group_id, salary_scale_step_id)
    references public.salary_scale_steps(tenant_id, hr_group_id, id) on delete restrict;

create index employment_salaries_tenant_hr_group_idx
  on public.employment_salaries (tenant_id, hr_group_id);
create index salary_scales_structure_idx
  on public.salary_scales (tenant_id, hr_group_id, salary_structure_id);
create index salary_scale_revision_values_revision_idx
  on public.salary_scale_revision_values (tenant_id, hr_group_id, salary_structure_revision_id);
create index salary_scale_steps_revision_idx
  on public.salary_scale_steps (tenant_id, hr_group_id, salary_structure_revision_id, salary_scale_id);
create index salary_bands_structure_idx
  on public.salary_bands (tenant_id, hr_group_id, salary_structure_id);
create index salary_band_values_revision_idx
  on public.salary_band_values (tenant_id, hr_group_id, salary_structure_revision_id);
create index labor_condition_salary_structures_structure_idx
  on public.labor_condition_salary_structures (tenant_id, hr_group_id, salary_structure_id);

create or replace function internal_security.populate_employment_salary_hr_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_hr_group_id uuid;
begin
  select employment.hr_group_id into expected_hr_group_id
  from public.employments employment
  where employment.tenant_id = new.tenant_id
    and employment.id = new.employment_id;
  if expected_hr_group_id is null then
    raise exception 'EMPLOYMENT_HR_GROUP_NOT_FOUND' using errcode = '23503';
  end if;
  if new.hr_group_id is not null and new.hr_group_id <> expected_hr_group_id then
    raise exception 'EMPLOYMENT_SALARY_HR_GROUP_MISMATCH' using errcode = '23514';
  end if;
  new.hr_group_id := expected_hr_group_id;
  return new;
end;
$$;

revoke all on function internal_security.populate_employment_salary_hr_group() from public, anon, authenticated;

create trigger populate_employment_salary_hr_group
before insert on public.employment_salaries
for each row execute function internal_security.populate_employment_salary_hr_group();

create trigger prevent_employment_salaries_hr_group_change
before update of hr_group_id on public.employment_salaries
for each row execute function internal_security.prevent_hr_group_change();

create or replace function internal_security.prevent_salary_structure_type_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.structure_type <> old.structure_type
     or new.tenant_id <> old.tenant_id
     or new.hr_group_id <> old.hr_group_id then
    raise exception 'SALARY_STRUCTURE_IDENTITY_IMMUTABLE' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function internal_security.prevent_published_salary_revision_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = 'PUBLISHED' then
    raise exception 'SALARY_STRUCTURE_REVISION_IMMUTABLE' using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function internal_security.prevent_published_salary_content_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  revision_id uuid;
begin
  revision_id := case when tg_op = 'DELETE'
    then old.salary_structure_revision_id
    else new.salary_structure_revision_id
  end;
  if exists (
    select 1
    from public.salary_structure_revisions revision
    where revision.id = revision_id and revision.status = 'PUBLISHED'
  ) then
    raise exception 'SALARY_STRUCTURE_REVISION_IMMUTABLE' using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function internal_security.enforce_salary_content_membership()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  revision_structure_id uuid;
  content_structure_id uuid;
begin
  select revision.salary_structure_id into revision_structure_id
  from public.salary_structure_revisions revision
  where revision.tenant_id = new.tenant_id
    and revision.hr_group_id = new.hr_group_id
    and revision.id = new.salary_structure_revision_id;

  if tg_table_name = 'salary_scale_revision_values' then
    select scale.salary_structure_id into content_structure_id
    from public.salary_scales scale
    where scale.tenant_id = new.tenant_id
      and scale.hr_group_id = new.hr_group_id
      and scale.id = new.salary_scale_id;
  else
    select band.salary_structure_id into content_structure_id
    from public.salary_bands band
    where band.tenant_id = new.tenant_id
      and band.hr_group_id = new.hr_group_id
      and band.id = new.salary_band_id;
  end if;

  if revision_structure_id is null or content_structure_id is null
     or revision_structure_id <> content_structure_id then
    raise exception 'SALARY_STRUCTURE_CONTENT_MEMBERSHIP_MISMATCH' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function internal_security.prevent_salary_structure_type_change() from public, anon, authenticated;
revoke all on function internal_security.prevent_published_salary_revision_mutation() from public, anon, authenticated;
revoke all on function internal_security.prevent_published_salary_content_mutation() from public, anon, authenticated;
revoke all on function internal_security.enforce_salary_content_membership() from public, anon, authenticated;

create trigger prevent_salary_structure_type_change
before update on public.salary_structures
for each row execute function internal_security.prevent_salary_structure_type_change();
create trigger prevent_published_salary_revision_mutation
before update or delete on public.salary_structure_revisions
for each row execute function internal_security.prevent_published_salary_revision_mutation();
create trigger prevent_published_salary_scale_value_mutation
before insert or update or delete on public.salary_scale_revision_values
for each row execute function internal_security.prevent_published_salary_content_mutation();
create trigger prevent_published_salary_step_mutation
before insert or update or delete on public.salary_scale_steps
for each row execute function internal_security.prevent_published_salary_content_mutation();
create trigger prevent_published_salary_band_value_mutation
before insert or update or delete on public.salary_band_values
for each row execute function internal_security.prevent_published_salary_content_mutation();
create trigger enforce_salary_scale_revision_membership
before insert or update on public.salary_scale_revision_values
for each row execute function internal_security.enforce_salary_content_membership();
create trigger enforce_salary_band_value_membership
before insert or update on public.salary_band_values
for each row execute function internal_security.enforce_salary_content_membership();

create or replace function internal_security.validate_salary_structure_revision(requested_revision_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  revision_row public.salary_structure_revisions%rowtype;
  structure_type public.salary_structure_type;
begin
  select revision.* into revision_row
  from public.salary_structure_revisions revision
  where revision.id = requested_revision_id;

  if not found or revision_row.status <> 'DRAFT' then
    raise exception 'SALARY_STRUCTURE_DRAFT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select structure.structure_type into structure_type
  from public.salary_structures structure
  where structure.tenant_id = revision_row.tenant_id
    and structure.hr_group_id = revision_row.hr_group_id
    and structure.id = revision_row.salary_structure_id;

  if structure_type = 'SCALE_WITH_STEPS' then
    if not exists (
      select 1 from public.salary_scale_revision_values value
      where value.salary_structure_revision_id = requested_revision_id
    ) then
      raise exception 'SALARY_STRUCTURE_SCALE_REQUIRED' using errcode = '23514';
    end if;
    if exists (
      select 1
      from public.salary_scale_revision_values value
      where value.salary_structure_revision_id = requested_revision_id
        and not exists (
          select 1 from public.salary_scale_steps step
          where step.salary_structure_revision_id = value.salary_structure_revision_id
            and step.salary_scale_id = value.salary_scale_id
        )
    ) then
      raise exception 'SALARY_STRUCTURE_STEP_REQUIRED' using errcode = '23514';
    end if;
    if exists (
      select 1
      from public.salary_scale_steps step
      join public.salary_scale_revision_values value
        on value.salary_structure_revision_id = step.salary_structure_revision_id
       and value.salary_scale_id = step.salary_scale_id
      where step.salary_structure_revision_id = requested_revision_id
        and step.sequence_number = (
          select max(last_step.sequence_number)
          from public.salary_scale_steps last_step
          where last_step.salary_structure_revision_id = step.salary_structure_revision_id
            and last_step.salary_scale_id = step.salary_scale_id
        )
        and (step.months_to_next_step is not null or step.progression_type <> 'MANUAL')
    ) then
      raise exception 'SALARY_STRUCTURE_FINAL_STEP_PROGRESSION_INVALID' using errcode = '23514';
    end if;
  else
    if not exists (
      select 1 from public.salary_band_values value
      where value.salary_structure_revision_id = requested_revision_id
    ) then
      raise exception 'SALARY_STRUCTURE_BAND_REQUIRED' using errcode = '23514';
    end if;
    if exists (
      select 1
      from public.salary_band_values value
      where value.salary_structure_revision_id = requested_revision_id
        and value.maximum_amount is null
        and value.sort_order <> (
          select max(last_band.sort_order)
          from public.salary_band_values last_band
          where last_band.salary_structure_revision_id = requested_revision_id
        )
    ) then
      raise exception 'SALARY_STRUCTURE_OPEN_BAND_NOT_HIGHEST' using errcode = '23514';
    end if;
  end if;
end;
$$;

create or replace function public.create_salary_structure(
  requested_hr_group_id uuid,
  requested_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  requested_tenant_id uuid;
  structure_row public.salary_structures%rowtype;
begin
  if auth.uid() is null then
    raise exception 'SALARY_STRUCTURE_AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;
  select group_row.tenant_id into requested_tenant_id
  from public.hr_groups group_row
  where group_row.id = requested_hr_group_id and group_row.is_active;
  if requested_tenant_id is null then
    raise exception 'SALARY_STRUCTURE_HR_GROUP_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not internal_security.current_user_has_hr_group_permission(
    requested_tenant_id, requested_hr_group_id, 'salary-structure:write'
  ) or not internal_security.current_user_has_hr_group_permission(
    requested_tenant_id, requested_hr_group_id, 'salary:write'
  ) then
    raise exception 'SALARY_STRUCTURE_FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.salary_structures (
    tenant_id, hr_group_id, structure_type, code, name, description,
    created_by_user_id, updated_by_user_id
  ) values (
    requested_tenant_id,
    requested_hr_group_id,
    (requested_payload ->> 'structureType')::public.salary_structure_type,
    nullif(upper(btrim(requested_payload ->> 'code')), ''),
    btrim(requested_payload ->> 'name'),
    nullif(btrim(requested_payload ->> 'description'), ''),
    auth.uid(),
    auth.uid()
  ) returning * into structure_row;

  return jsonb_build_object(
    'id', structure_row.id,
    'structureType', structure_row.structure_type,
    'code', structure_row.code,
    'name', structure_row.name
  );
end;
$$;

create or replace function public.save_salary_structure_draft(
  requested_structure_id uuid,
  requested_draft_id uuid,
  requested_expected_lock_version integer,
  requested_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  structure_row public.salary_structures%rowtype;
  revision_row public.salary_structure_revisions%rowtype;
  next_revision_number integer;
  next_lock_version integer;
  scale_item jsonb;
  step_item jsonb;
  band_item jsonb;
  logical_scale_id uuid;
  logical_band_id uuid;
begin
  if auth.uid() is null then
    raise exception 'SALARY_STRUCTURE_AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;
  select * into structure_row
  from public.salary_structures
  where id = requested_structure_id and is_active
  for update;
  if not found then
    raise exception 'SALARY_STRUCTURE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not internal_security.current_user_has_hr_group_permission(
    structure_row.tenant_id, structure_row.hr_group_id, 'salary-structure:write'
  ) or not internal_security.current_user_has_hr_group_permission(
    structure_row.tenant_id, structure_row.hr_group_id, 'salary:write'
  ) then
    raise exception 'SALARY_STRUCTURE_FORBIDDEN' using errcode = '42501';
  end if;
  if requested_payload ->> 'structureType' <> structure_row.structure_type::text then
    raise exception 'SALARY_STRUCTURE_TYPE_MISMATCH' using errcode = '23514';
  end if;

  if requested_draft_id is null then
    if requested_expected_lock_version is not null then
      raise exception 'SALARY_STRUCTURE_DRAFT_CONFLICT' using errcode = '40001';
    end if;
    select coalesce(max(revision.revision_number), 0) + 1 into next_revision_number
    from public.salary_structure_revisions revision
    where revision.salary_structure_id = structure_row.id;
    insert into public.salary_structure_revisions (
      tenant_id, hr_group_id, salary_structure_id, revision_number, status,
      effective_from, salary_basis, currency_code, description,
      created_by_user_id, updated_by_user_id
    ) values (
      structure_row.tenant_id,
      structure_row.hr_group_id,
      structure_row.id,
      next_revision_number,
      'DRAFT',
      (requested_payload ->> 'effectiveFrom')::date,
      (requested_payload ->> 'salaryBasis')::public.salary_structure_basis,
      requested_payload ->> 'currencyCode',
      nullif(btrim(requested_payload ->> 'description'), ''),
      auth.uid(),
      auth.uid()
    ) returning * into revision_row;
    next_lock_version := revision_row.lock_version;
  else
    select * into revision_row
    from public.salary_structure_revisions revision
    where revision.id = requested_draft_id
      and revision.salary_structure_id = structure_row.id
      and revision.status = 'DRAFT'
    for update;
    if not found then
      raise exception 'SALARY_STRUCTURE_DRAFT_NOT_FOUND' using errcode = 'P0002';
    end if;
    if requested_expected_lock_version is null
       or revision_row.lock_version <> requested_expected_lock_version then
      raise exception 'SALARY_STRUCTURE_DRAFT_CONFLICT' using errcode = '40001';
    end if;
    next_lock_version := revision_row.lock_version + 1;
    update public.salary_structure_revisions
    set effective_from = (requested_payload ->> 'effectiveFrom')::date,
        salary_basis = (requested_payload ->> 'salaryBasis')::public.salary_structure_basis,
        currency_code = requested_payload ->> 'currencyCode',
        description = nullif(btrim(requested_payload ->> 'description'), ''),
        lock_version = next_lock_version,
        updated_by_user_id = auth.uid(),
        updated_at = timezone('utc', now())
    where id = revision_row.id;

    delete from public.salary_scale_steps
    where salary_structure_revision_id = revision_row.id;
    delete from public.salary_scale_revision_values
    where salary_structure_revision_id = revision_row.id;
    delete from public.salary_band_values
    where salary_structure_revision_id = revision_row.id;
  end if;

  if structure_row.structure_type = 'SCALE_WITH_STEPS' then
    if jsonb_typeof(requested_payload -> 'scales') <> 'array' then
      raise exception 'SALARY_STRUCTURE_SCALES_INVALID' using errcode = '22023';
    end if;
    for scale_item in select value from jsonb_array_elements(requested_payload -> 'scales') loop
      logical_scale_id := nullif(scale_item ->> 'logicalScaleId', '')::uuid;
      if logical_scale_id is null then
        insert into public.salary_scales (
          tenant_id, hr_group_id, salary_structure_id, code, name, description
        ) values (
          structure_row.tenant_id,
          structure_row.hr_group_id,
          structure_row.id,
          btrim(scale_item ->> 'code'),
          btrim(scale_item ->> 'name'),
          nullif(btrim(scale_item ->> 'description'), '')
        ) returning id into logical_scale_id;
      elsif not exists (
        select 1 from public.salary_scales scale
        where scale.id = logical_scale_id
          and scale.tenant_id = structure_row.tenant_id
          and scale.hr_group_id = structure_row.hr_group_id
          and scale.salary_structure_id = structure_row.id
      ) then
        raise exception 'SALARY_STRUCTURE_SCALE_IDENTITY_INVALID' using errcode = '23514';
      end if;

      insert into public.salary_scale_revision_values (
        tenant_id, hr_group_id, salary_structure_revision_id, salary_scale_id,
        code, name, description, sort_order, progression_type,
        default_months_to_next_step
      ) values (
        structure_row.tenant_id,
        structure_row.hr_group_id,
        revision_row.id,
        logical_scale_id,
        btrim(scale_item ->> 'code'),
        btrim(scale_item ->> 'name'),
        nullif(btrim(scale_item ->> 'description'), ''),
        (scale_item ->> 'sortOrder')::integer,
        (scale_item ->> 'progressionType')::public.salary_progression_type,
        nullif(scale_item ->> 'defaultMonthsToNextStep', '')::integer
      );

      for step_item in select value from jsonb_array_elements(scale_item -> 'steps') loop
        insert into public.salary_scale_steps (
          tenant_id, hr_group_id, salary_scale_id, salary_structure_revision_id,
          step_code, step_name, sequence_number, fulltime_amount, hourly_amount,
          step_kind, progression_type, months_to_next_step, currency_code
        ) values (
          structure_row.tenant_id,
          structure_row.hr_group_id,
          logical_scale_id,
          revision_row.id,
          btrim(step_item ->> 'stepCode'),
          btrim(step_item ->> 'stepName'),
          (step_item ->> 'sequenceNumber')::integer,
          (step_item ->> 'fulltimeAmount')::numeric,
          nullif(step_item ->> 'hourlyAmount', '')::numeric,
          (step_item ->> 'stepKind')::public.salary_step_kind,
          (step_item ->> 'progressionType')::public.salary_progression_type,
          nullif(step_item ->> 'monthsToNextStep', '')::integer,
          requested_payload ->> 'currencyCode'
        );
      end loop;
    end loop;
  else
    if jsonb_typeof(requested_payload -> 'bands') <> 'array' then
      raise exception 'SALARY_STRUCTURE_BANDS_INVALID' using errcode = '22023';
    end if;
    for band_item in select value from jsonb_array_elements(requested_payload -> 'bands') loop
      logical_band_id := nullif(band_item ->> 'logicalBandId', '')::uuid;
      if logical_band_id is null then
        insert into public.salary_bands (
          tenant_id, hr_group_id, salary_structure_id, identity_key
        ) values (
          structure_row.tenant_id,
          structure_row.hr_group_id,
          structure_row.id,
          btrim(band_item ->> 'identityKey')
        ) returning id into logical_band_id;
      elsif not exists (
        select 1 from public.salary_bands band
        where band.id = logical_band_id
          and band.tenant_id = structure_row.tenant_id
          and band.hr_group_id = structure_row.hr_group_id
          and band.salary_structure_id = structure_row.id
      ) then
        raise exception 'SALARY_STRUCTURE_BAND_IDENTITY_INVALID' using errcode = '23514';
      end if;

      insert into public.salary_band_values (
        tenant_id, hr_group_id, salary_structure_revision_id, salary_band_id,
        code, name, sort_order, input_method, minimum_amount, midpoint_amount,
        maximum_amount, input_spread_percentage
      ) values (
        structure_row.tenant_id,
        structure_row.hr_group_id,
        revision_row.id,
        logical_band_id,
        btrim(band_item ->> 'code'),
        btrim(band_item ->> 'name'),
        (band_item ->> 'sortOrder')::integer,
        (band_item ->> 'inputMethod')::public.salary_band_input_method,
        (band_item ->> 'minimum')::numeric,
        (band_item ->> 'midpoint')::numeric,
        nullif(band_item ->> 'maximum', '')::numeric,
        nullif(band_item ->> 'inputSpreadPercentage', '')::numeric
      );
    end loop;
  end if;

  return jsonb_build_object(
    'id', revision_row.id,
    'revisionNumber', revision_row.revision_number,
    'lockVersion', next_lock_version,
    'status', 'DRAFT'
  );
end;
$$;

create or replace function public.replace_labor_condition_salary_structures(
  requested_labor_condition_set_id uuid,
  requested_salary_structure_ids uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  condition_row public.labor_condition_sets%rowtype;
begin
  if auth.uid() is null then
    raise exception 'SALARY_STRUCTURE_AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;
  select * into condition_row
  from public.labor_condition_sets condition_set
  where condition_set.id = requested_labor_condition_set_id
  for update;
  if not found then
    raise exception 'LABOR_CONDITION_SET_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not internal_security.current_user_has_hr_group_permission(
    condition_row.tenant_id, condition_row.hr_group_id, 'salary-structure:write'
  ) then
    raise exception 'SALARY_STRUCTURE_FORBIDDEN' using errcode = '42501';
  end if;
  if cardinality(requested_salary_structure_ids) <> (
    select count(distinct structure.id)
    from public.salary_structures structure
    where structure.tenant_id = condition_row.tenant_id
      and structure.hr_group_id = condition_row.hr_group_id
      and structure.is_active
      and structure.id = any(requested_salary_structure_ids)
  ) then
    raise exception 'LABOR_CONDITION_SALARY_STRUCTURE_SCOPE_INVALID' using errcode = '23514';
  end if;

  delete from public.labor_condition_salary_structures relation
  where relation.tenant_id = condition_row.tenant_id
    and relation.hr_group_id = condition_row.hr_group_id
    and relation.labor_condition_set_id = condition_row.id;

  insert into public.labor_condition_salary_structures (
    tenant_id, hr_group_id, labor_condition_set_id, salary_structure_id,
    created_by_user_id
  )
  select
    condition_row.tenant_id,
    condition_row.hr_group_id,
    condition_row.id,
    structure_id,
    auth.uid()
  from unnest(requested_salary_structure_ids) structure_id;

  return jsonb_build_object('count', cardinality(requested_salary_structure_ids));
end;
$$;

create or replace function public.publish_salary_structure_revision(
  requested_revision_id uuid,
  requested_expected_lock_version integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  revision_row public.salary_structure_revisions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'SALARY_STRUCTURE_AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;
  select * into revision_row
  from public.salary_structure_revisions
  where id = requested_revision_id
  for update;
  if not found or revision_row.status <> 'DRAFT' then
    raise exception 'SALARY_STRUCTURE_DRAFT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not internal_security.current_user_has_hr_group_permission(
    revision_row.tenant_id, revision_row.hr_group_id, 'salary-structure:write'
  ) or not internal_security.current_user_has_hr_group_permission(
    revision_row.tenant_id, revision_row.hr_group_id, 'salary:write'
  ) then
    raise exception 'SALARY_STRUCTURE_FORBIDDEN' using errcode = '42501';
  end if;
  if revision_row.lock_version <> requested_expected_lock_version then
    raise exception 'SALARY_STRUCTURE_DRAFT_CONFLICT' using errcode = '40001';
  end if;

  perform internal_security.validate_salary_structure_revision(requested_revision_id);

  update public.salary_structure_revisions
  set status = 'PUBLISHED',
      published_at = timezone('utc', now()),
      published_by_user_id = auth.uid(),
      updated_by_user_id = auth.uid(),
      updated_at = timezone('utc', now()),
      lock_version = lock_version + 1
  where id = requested_revision_id;

  return jsonb_build_object(
    'id', requested_revision_id,
    'status', 'PUBLISHED',
    'lockVersion', requested_expected_lock_version + 1
  );
end;
$$;

revoke all on function internal_security.validate_salary_structure_revision(uuid) from public, anon, authenticated;
revoke all on function public.create_salary_structure(uuid, jsonb) from public, anon;
revoke all on function public.save_salary_structure_draft(uuid, uuid, integer, jsonb) from public, anon;
revoke all on function public.replace_labor_condition_salary_structures(uuid, uuid[]) from public, anon;
revoke all on function public.publish_salary_structure_revision(uuid, integer) from public, anon;
grant execute on function public.create_salary_structure(uuid, jsonb) to authenticated;
grant execute on function public.save_salary_structure_draft(uuid, uuid, integer, jsonb) to authenticated;
grant execute on function public.replace_labor_condition_salary_structures(uuid, uuid[]) to authenticated;
grant execute on function public.publish_salary_structure_revision(uuid, integer) to authenticated;

create or replace function internal_security.audit_salary_structure_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_id uuid;
  row_tenant_id uuid;
  before_state jsonb;
  after_state jsonb;
begin
  row_id := case when tg_op = 'DELETE' then old.id else new.id end;
  row_tenant_id := case when tg_op = 'DELETE' then old.tenant_id else new.tenant_id end;
  before_state := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_state := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (
    row_tenant_id,
    tg_table_name,
    row_id,
    auth.uid(),
    case tg_op when 'INSERT' then 'CREATE' when 'UPDATE' then 'UPDATE' else 'DELETE' end,
    jsonb_build_object('before', before_state, 'after', after_state)
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function internal_security.audit_salary_structure_change() from public, anon, authenticated;

create trigger audit_salary_structures
after insert or update or delete on public.salary_structures
for each row execute function internal_security.audit_salary_structure_change();
create trigger audit_salary_structure_revisions
after insert or update or delete on public.salary_structure_revisions
for each row execute function internal_security.audit_salary_structure_change();
create trigger audit_salary_scale_revision_values
after insert or update or delete on public.salary_scale_revision_values
for each row execute function internal_security.audit_salary_structure_change();
create trigger audit_salary_scale_steps
after insert or update or delete on public.salary_scale_steps
for each row execute function internal_security.audit_salary_structure_change();
create trigger audit_salary_bands
after insert or update or delete on public.salary_bands
for each row execute function internal_security.audit_salary_structure_change();
create trigger audit_salary_band_values
after insert or update or delete on public.salary_band_values
for each row execute function internal_security.audit_salary_structure_change();
create trigger audit_labor_condition_salary_structures
after insert or update or delete on public.labor_condition_salary_structures
for each row execute function internal_security.audit_salary_structure_change();
create trigger audit_salary_structure_migration_conflicts
after insert or update or delete on public.salary_structure_migration_conflicts
for each row execute function internal_security.audit_salary_structure_change();

create trigger set_salary_structures_updated_at before update on public.salary_structures
for each row execute function internal_security.set_updated_at();
create trigger set_salary_structure_revisions_updated_at before update on public.salary_structure_revisions
for each row execute function internal_security.set_updated_at();
create trigger set_salary_scale_revision_values_updated_at before update on public.salary_scale_revision_values
for each row execute function internal_security.set_updated_at();
create trigger set_salary_bands_updated_at before update on public.salary_bands
for each row execute function internal_security.set_updated_at();
create trigger set_salary_band_values_updated_at before update on public.salary_band_values
for each row execute function internal_security.set_updated_at();
create trigger set_salary_structure_migration_conflicts_updated_at before update on public.salary_structure_migration_conflicts
for each row execute function internal_security.set_updated_at();

alter table public.salary_structures enable row level security;
alter table public.salary_structure_revisions enable row level security;
alter table public.salary_scales enable row level security;
alter table public.salary_scale_revision_values enable row level security;
alter table public.salary_scale_steps enable row level security;
alter table public.salary_bands enable row level security;
alter table public.salary_band_values enable row level security;
alter table public.labor_condition_salary_structures enable row level security;
alter table public.salary_structure_migration_conflicts enable row level security;

create policy salary_structures_read on public.salary_structures for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:read')));
create policy salary_structures_write on public.salary_structures for all to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:write'))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary:write'))
) with check (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:write'))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary:write'))
);
create policy salary_structure_revisions_read on public.salary_structure_revisions for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:read')));
create policy salary_structure_revisions_write on public.salary_structure_revisions for all to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:write'))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary:write'))
) with check (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:write'))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary:write'))
);
create policy salary_scales_read on public.salary_scales for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:read')));
create policy salary_scales_write on public.salary_scales for all to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:write'))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary:write'))
) with check (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:write'))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary:write'))
);
create policy salary_scale_revision_values_read on public.salary_scale_revision_values for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:read')));
create policy salary_scale_revision_values_write on public.salary_scale_revision_values for all to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:write'))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary:write'))
) with check (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:write'))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary:write'))
);
create policy salary_scale_steps_read on public.salary_scale_steps for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:read'))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary:read'))
);
create policy salary_scale_steps_write on public.salary_scale_steps for all to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:write'))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary:write'))
) with check (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:write'))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary:write'))
);
create policy salary_bands_read on public.salary_bands for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:read')));
create policy salary_bands_write on public.salary_bands for all to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:write'))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary:write'))
) with check (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:write'))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary:write'))
);
create policy salary_band_values_read on public.salary_band_values for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:read'))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary:read'))
);
create policy salary_band_values_write on public.salary_band_values for all to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:write'))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary:write'))
) with check (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:write'))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary:write'))
);
create policy labor_condition_salary_structures_read on public.labor_condition_salary_structures for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:read')));
create policy labor_condition_salary_structures_write on public.labor_condition_salary_structures for all to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:write')));
create policy salary_structure_migration_conflicts_read on public.salary_structure_migration_conflicts for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:read')));
create policy salary_structure_migration_conflicts_write on public.salary_structure_migration_conflicts for all to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'salary-structure:write')));

revoke all on table public.salary_structures from public, anon, authenticated;
revoke all on table public.salary_structure_revisions from public, anon, authenticated;
revoke all on table public.salary_scales from public, anon, authenticated;
revoke all on table public.salary_scale_revision_values from public, anon, authenticated;
revoke all on table public.salary_scale_steps from public, anon, authenticated;
revoke all on table public.salary_bands from public, anon, authenticated;
revoke all on table public.salary_band_values from public, anon, authenticated;
revoke all on table public.labor_condition_salary_structures from public, anon, authenticated;
revoke all on table public.salary_structure_migration_conflicts from public, anon, authenticated;

grant select, insert, update, delete on table public.salary_structures to authenticated;
grant select, insert, update, delete on table public.salary_structure_revisions to authenticated;
grant select, insert, update, delete on table public.salary_scales to authenticated;
grant select, insert, update, delete on table public.salary_scale_revision_values to authenticated;
grant select, insert, update, delete on table public.salary_scale_steps to authenticated;
grant select, insert, update, delete on table public.salary_bands to authenticated;
grant select, insert, update, delete on table public.salary_band_values to authenticated;
grant select, insert, update, delete on table public.labor_condition_salary_structures to authenticated;
grant select, insert, update, delete on table public.salary_structure_migration_conflicts to authenticated;

comment on table public.salary_structures is 'HR-groepbrede named salarisstructuren; het type blijft stabiel over revisies.';
comment on table public.salary_structure_revisions is 'Complete effectief gedateerde concept- en gepubliceerde salarisstructuurrevisies.';
comment on table public.salary_scales is 'Stabiele logical identity van een schaal binnen een SCALE_WITH_STEPS-structuur.';
comment on table public.salary_scale_steps is 'Concrete salarisbedragen per schaal en structuurrevisie; bestaande IDs blijven geldig voor employment_salaries.';
comment on table public.salary_bands is 'Stabiele logical identity van een salarisband over revisies.';
comment on table public.labor_condition_salary_structures is 'Beschikbaarheidsrelatie van een CAO/regeling naar logical salarisstructuren binnen dezelfde HR-groep.';
