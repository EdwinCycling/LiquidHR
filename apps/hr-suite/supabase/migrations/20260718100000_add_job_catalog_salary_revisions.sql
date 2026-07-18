create type public.salary_revision_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');
create type public.salary_step_kind as enum ('REGULAR', 'START', 'MAXIMUM', 'SPECIAL');

insert into public.permissions (code, name, category, description)
values
  ('job-catalog:read', 'Functiecatalogus bekijken', 'Stamtabellen', 'Bekijkt functiegroepen en functies binnen de actieve administratie.'),
  ('job-catalog:write', 'Functiecatalogus beheren', 'Stamtabellen', 'Beheert functiegroepen en functies binnen de actieve administratie.'),
  ('salary-structure:read', 'Salarisstructuur bekijken', 'Stamtabellen', 'Bekijkt schalen en revisies; bedragen vereisen daarnaast salary:read.'),
  ('salary-structure:write', 'Salarisstructuur beheren', 'Stamtabellen', 'Beheert schalen en revisies; bedragen vereisen daarnaast salary:write.')
on conflict (code) do update set name = excluded.name, category = excluded.category, description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id from public.management_roles role cross join public.permissions permission
where role.code in ('TENANT_ADMIN', 'HR_ADMIN')
  and permission.code in ('job-catalog:read', 'job-catalog:write', 'salary-structure:read', 'salary-structure:write')
on conflict do nothing;

create table public.job_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  code text not null check (char_length(btrim(code)) between 1 and 40),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text check (description is null or char_length(description) <= 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (tenant_id, administration_id) references public.administrations(tenant_id, id) on delete cascade,
  unique (tenant_id, administration_id, code),
  unique (tenant_id, administration_id, id)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  job_group_id uuid not null,
  code text not null check (char_length(btrim(code)) between 1 and 40),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (tenant_id, administration_id, job_group_id) references public.job_groups(tenant_id, administration_id, id) on delete restrict,
  unique (tenant_id, administration_id, code),
  unique (tenant_id, administration_id, id)
);

create table public.job_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  job_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text check (description is null or char_length(description) <= 1000),
  valid_from date not null,
  valid_until date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (valid_until is null or valid_until > valid_from),
  foreign key (tenant_id, administration_id, job_id) references public.jobs(tenant_id, administration_id, id) on delete cascade,
  exclude using gist (tenant_id with =, administration_id with =, job_id with =, daterange(valid_from, valid_until, '[)') with &&),
  unique (tenant_id, administration_id, id)
);

create table public.salary_scale_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  salary_scale_id uuid not null,
  revision_number integer not null check (revision_number > 0),
  status public.salary_revision_status not null default 'DRAFT',
  description text check (description is null or char_length(description) <= 1000),
  valid_from date not null,
  valid_until date,
  published_at timestamptz,
  published_by_user_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (valid_until is null or valid_until > valid_from),
  check ((status = 'PUBLISHED' and published_at is not null) or status <> 'PUBLISHED'),
  foreign key (tenant_id, administration_id, salary_scale_id) references public.salary_scales(tenant_id, administration_id, id) on delete cascade,
  unique (tenant_id, administration_id, salary_scale_id, revision_number),
  unique (tenant_id, administration_id, id),
  exclude using gist (tenant_id with =, administration_id with =, salary_scale_id with =, daterange(valid_from, valid_until, '[)') with &&) where (status = 'PUBLISHED')
);

alter table public.salary_scale_steps
  add column salary_scale_revision_id uuid,
  add column sequence_number integer,
  add column hourly_amount numeric(12,4) check (hourly_amount is null or hourly_amount >= 0),
  add column step_kind public.salary_step_kind not null default 'REGULAR';

with revision_sources as (
  select salary_scale_id, tenant_id, administration_id, valid_from, max(valid_until) as valid_until,
         row_number() over (partition by salary_scale_id order by valid_from) as revision_number
  from public.salary_scale_steps group by salary_scale_id, tenant_id, administration_id, valid_from
), inserted as (
  insert into public.salary_scale_revisions (
    tenant_id, administration_id, salary_scale_id, revision_number, status, description,
    valid_from, valid_until, published_at, published_by_user_id
  )
  select source.tenant_id, source.administration_id, source.salary_scale_id, source.revision_number,
         'PUBLISHED', 'Gemigreerde schaalversie', source.valid_from, source.valid_until,
         timezone('utc', now()), (select id from auth.users order by created_at limit 1)
  from revision_sources source
  returning id, salary_scale_id, valid_from
)
update public.salary_scale_steps step set salary_scale_revision_id = inserted.id
from inserted where inserted.salary_scale_id = step.salary_scale_id and inserted.valid_from = step.valid_from;

update public.salary_scale_steps target set sequence_number = ranked.position
from (
  select id, row_number() over (partition by salary_scale_revision_id order by step_code, id) - 1 as position
  from public.salary_scale_steps
) ranked where ranked.id = target.id;

alter table public.salary_scale_steps
  alter column salary_scale_revision_id set not null,
  alter column sequence_number set not null,
  add constraint salary_scale_steps_revision_fkey foreign key (tenant_id, administration_id, salary_scale_revision_id)
    references public.salary_scale_revisions(tenant_id, administration_id, id) on delete restrict,
  add constraint salary_scale_steps_revision_code_key unique (salary_scale_revision_id, step_code),
  add constraint salary_scale_steps_revision_sequence_key unique (salary_scale_revision_id, sequence_number);

alter table public.employee_organizations add column job_id uuid;
alter table public.employee_organizations add constraint employee_organizations_job_fkey
  foreign key (tenant_id, administration_id, job_id) references public.jobs(tenant_id, administration_id, id) on delete restrict;
create index employee_organizations_job_id_idx on public.employee_organizations(job_id) where job_id is not null;
create index employee_organizations_job_scope_idx on public.employee_organizations(tenant_id, administration_id, job_id) where job_id is not null;

create index jobs_group_id_idx on public.jobs(job_group_id);
create index jobs_group_scope_idx on public.jobs(tenant_id, administration_id, job_group_id);
create index job_revisions_job_id_idx on public.job_revisions(job_id);
create index job_revisions_job_scope_idx on public.job_revisions(tenant_id, administration_id, job_id);
create index salary_scale_revisions_scale_id_idx on public.salary_scale_revisions(salary_scale_id);
create index salary_scale_revisions_scale_scope_idx on public.salary_scale_revisions(tenant_id, administration_id, salary_scale_id);
create index salary_scale_steps_revision_scope_idx on public.salary_scale_steps(tenant_id, administration_id, salary_scale_revision_id);

create trigger set_job_groups_updated_at before update on public.job_groups for each row execute function internal_security.set_updated_at();
create trigger set_jobs_updated_at before update on public.jobs for each row execute function internal_security.set_updated_at();
create trigger set_job_revisions_updated_at before update on public.job_revisions for each row execute function internal_security.set_updated_at();
create trigger set_salary_scale_revisions_updated_at before update on public.salary_scale_revisions for each row execute function internal_security.set_updated_at();

create function internal_security.guard_published_salary_revision() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.status = 'PUBLISHED' then raise exception 'SALARY_REVISION_IMMUTABLE' using errcode = 'P0001'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end; $$;
create trigger guard_published_salary_revision before update or delete on public.salary_scale_revisions
for each row execute function internal_security.guard_published_salary_revision();

create function internal_security.guard_published_salary_step() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if exists (
    select 1 from public.salary_scale_revisions revision
    where revision.id = case when tg_op = 'DELETE' then old.salary_scale_revision_id else new.salary_scale_revision_id end
      and revision.status = 'PUBLISHED'
  ) then
    raise exception 'SALARY_REVISION_IMMUTABLE' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end; $$;
create trigger guard_published_salary_step before insert or update or delete on public.salary_scale_steps
for each row execute function internal_security.guard_published_salary_step();

alter table public.job_groups enable row level security;
alter table public.jobs enable row level security;
alter table public.job_revisions enable row level security;
alter table public.salary_scale_revisions enable row level security;

create policy job_groups_read on public.job_groups for select to authenticated using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'job-catalog:read')));
create policy job_groups_write on public.job_groups for all to authenticated using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'job-catalog:write'))) with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'job-catalog:write')));
create policy jobs_read on public.jobs for select to authenticated using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'job-catalog:read')));
create policy jobs_write on public.jobs for all to authenticated using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'job-catalog:write'))) with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'job-catalog:write')));
create policy job_revisions_read on public.job_revisions for select to authenticated using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'job-catalog:read')));
create policy job_revisions_write on public.job_revisions for all to authenticated using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'job-catalog:write'))) with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'job-catalog:write')));
create policy salary_scale_revisions_read on public.salary_scale_revisions for select to authenticated using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary-structure:read')));
create policy salary_scale_revisions_write on public.salary_scale_revisions for all to authenticated using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary-structure:write')) and (select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write'))) with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary-structure:write')) and (select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')));

grant select, insert, update, delete on public.job_groups, public.jobs, public.job_revisions, public.salary_scale_revisions to authenticated;
