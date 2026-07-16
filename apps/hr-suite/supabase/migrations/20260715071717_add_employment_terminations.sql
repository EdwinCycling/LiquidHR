create type public.termination_workflow_status as enum (
  'DRAFT', 'CONFIRMED', 'PAYROLL_READY', 'REPORTED', 'CANCELLED'
);
create type public.termination_initiator as enum (
  'EMPLOYER', 'EMPLOYEE', 'MUTUAL', 'BY_LAW', 'OTHER'
);
create type public.final_settlement_status as enum (
  'NOT_STARTED', 'IN_PROGRESS', 'READY', 'COMPLETED'
);

create table public.statutory_termination_reasons (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[0-9]{2}$'),
  label_nl text not null,
  label_en text not null,
  valid_from date not null,
  valid_until date,
  source_year smallint not null,
  source_url text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint statutory_termination_reasons_period_valid
    check (valid_until is null or valid_until > valid_from),
  constraint statutory_termination_reasons_code_version_key unique (code, valid_from)
);

insert into public.statutory_termination_reasons (
  id, code, label_nl, label_en, valid_from, valid_until, source_year, source_url
)
values
  (md5('termination-reason:31:2023')::uuid, '31', 'Einde van rechtswege, om een andere reden', 'Ended by operation of law for another reason', '2023-01-01', '2026-01-01', 2025, 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf'),
  (md5('termination-reason:01:2026')::uuid, '01', 'Opzegging of ontslag door werkgever binnen de proeftijd', 'Termination by employer during probation', '2026-01-01', null, 2026, 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf'),
  (md5('termination-reason:03:2026')::uuid, '03', 'Ontbinding door rechter op verzoek van de werkgever', 'Dissolution by court at the employer request', '2026-01-01', null, 2026, 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf'),
  (md5('termination-reason:04:2026')::uuid, '04', 'Beëindiging met wederzijds goedvinden op initiatief van werkgever', 'Mutual termination initiated by the employer', '2026-01-01', null, 2026, 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf'),
  (md5('termination-reason:05:2026')::uuid, '05', 'Ontslag door werkgever vanwege langdurige arbeidsongeschiktheid', 'Termination by employer due to long-term incapacity', '2026-01-01', null, 2026, 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf'),
  (md5('termination-reason:06:2026')::uuid, '06', 'Ontslag door werkgever vanwege bedrijfseconomische redenen', 'Termination by employer for economic reasons', '2026-01-01', null, 2026, 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf'),
  (md5('termination-reason:20:2026')::uuid, '20', 'Einde door opzegging of initiatief van de werknemer', 'Termination initiated by the employee', '2026-01-01', null, 2026, 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf'),
  (md5('termination-reason:21:2026')::uuid, '21', 'Ontslag op staande voet door werkgever', 'Summary dismissal by the employer', '2026-01-01', null, 2026, 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf'),
  (md5('termination-reason:30:2026')::uuid, '30', 'Einde bepaalde tijd door verstrijken van de duur', 'Expiry of a fixed-term employment relationship', '2026-01-01', null, 2026, 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf'),
  (md5('termination-reason:32:2026')::uuid, '32', 'Einde van rechtswege vanwege pensionering', 'Ended by operation of law due to retirement', '2026-01-01', null, 2026, 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf'),
  (md5('termination-reason:33:2026')::uuid, '33', 'Einde van rechtswege vanwege overlijden', 'Ended by operation of law due to death', '2026-01-01', null, 2026, 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf'),
  (md5('termination-reason:34:2026')::uuid, '34', 'Einde van rechtswege om een andere reden', 'Ended by operation of law for another reason', '2026-01-01', null, 2026, 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf'),
  (md5('termination-reason:40:2026')::uuid, '40', 'Einde uitzendovereenkomst vanwege ziekte uitzendkracht', 'Agency work ended because of illness', '2026-01-01', null, 2026, 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf'),
  (md5('termination-reason:41:2026')::uuid, '41', 'Einde uitzendovereenkomst om een andere reden', 'Agency work ended for another reason', '2026-01-01', null, 2026, 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf'),
  (md5('termination-reason:50:2026')::uuid, '50', 'Ontslag publiekrechtelijke aanstelling wegens ongeschiktheid', 'Public appointment ended due to unsuitability', '2026-01-01', null, 2026, 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf'),
  (md5('termination-reason:51:2026')::uuid, '51', 'Ontslag publiekrechtelijke aanstelling vanwege pensionering', 'Public appointment ended due to retirement', '2026-01-01', null, 2026, 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf'),
  (md5('termination-reason:90:2026')::uuid, '90', 'Arbeidsverhouding loopt door; IKV administratief beëindigd', 'Employment continues; income relationship ended administratively', '2026-01-01', null, 2026, 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf'),
  (md5('termination-reason:91:2026')::uuid, '91', 'Arbeidsverhouding loopt door bij een nieuwe werkgever', 'Employment continues with a new employer', '2026-01-01', null, 2026, 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf'),
  (md5('termination-reason:92:2026')::uuid, '92', 'Zonder onderbreking opgevolgd bij dezelfde werkgever', 'Immediately followed by a new relationship with the same employer', '2026-01-01', null, 2026, 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf'),
  (md5('termination-reason:99:2026')::uuid, '99', 'Andere, niet genoemde reden', 'Another reason not listed', '2026-01-01', null, 2026, 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf');

create table public.employment_terminations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_id uuid not null,
  last_working_day date not null,
  internal_reason_id uuid,
  statutory_reason_id uuid references public.statutory_termination_reasons(id) on delete restrict,
  initiator public.termination_initiator not null,
  explanation text,
  workflow_status public.termination_workflow_status not null default 'DRAFT',
  final_settlement_status public.final_settlement_status not null default 'NOT_STARTED',
  reported_at timestamptz,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  confirmed_by_user_id uuid references auth.users(id) on delete restrict,
  confirmed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employment_terminations_employment_fkey
    foreign key (tenant_id, administration_id, employee_id, employment_id)
    references public.employments(tenant_id, administration_id, employee_id, id) on delete restrict,
  constraint employment_terminations_internal_reason_fkey
    foreign key (tenant_id, administration_id, internal_reason_id)
    references public.employment_end_reasons(tenant_id, administration_id, id) on delete restrict,
  constraint employment_terminations_confirmation_valid check (
    (
      workflow_status in ('CONFIRMED', 'PAYROLL_READY', 'REPORTED')
      and statutory_reason_id is not null
      and internal_reason_id is not null
      and confirmed_by_user_id is not null
      and confirmed_at is not null
    )
    or workflow_status in ('DRAFT', 'CANCELLED')
  ),
  constraint employment_terminations_reported_valid check (
    (workflow_status = 'REPORTED' and reported_at is not null)
    or (workflow_status <> 'REPORTED' and reported_at is null)
  )
);

create unique index employment_terminations_current_key
  on public.employment_terminations (tenant_id, employment_id)
  where workflow_status <> 'CANCELLED';
create index employment_terminations_internal_reason_id_idx
  on public.employment_terminations (internal_reason_id) where internal_reason_id is not null;
create index employment_terminations_statutory_reason_id_idx
  on public.employment_terminations (statutory_reason_id) where statutory_reason_id is not null;
create index employment_terminations_created_by_idx on public.employment_terminations (created_by_user_id);
create index employment_terminations_confirmed_by_idx on public.employment_terminations (confirmed_by_user_id)
  where confirmed_by_user_id is not null;

create or replace function internal_security.guard_reported_termination()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.workflow_status = 'REPORTED' and new is distinct from old then
    raise exception 'TERMINATION_REPORTED_IMMUTABLE';
  end if;
  return new;
end;
$$;
revoke all on function internal_security.guard_reported_termination() from public, anon, authenticated;

create trigger guard_reported_termination_before_update
before update on public.employment_terminations
for each row execute function internal_security.guard_reported_termination();
create trigger set_employment_terminations_updated_at
before update on public.employment_terminations
for each row execute function internal_security.set_updated_at();

create or replace function public.confirm_employment_termination(requested_termination_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  termination public.employment_terminations%rowtype;
  employment public.employments%rowtype;
  timeline_end date;
begin
  select * into termination
  from public.employment_terminations row
  where row.id = requested_termination_id
  for update;

  if not found then raise exception 'TERMINATION_NOT_FOUND'; end if;
  if termination.workflow_status <> 'DRAFT' then raise exception 'TERMINATION_INVALID_STATE'; end if;
  if not internal_security.current_user_has_permission(
    termination.tenant_id, termination.administration_id, 'contract:write'
  ) then raise exception 'PERMISSION_DENIED'; end if;

  select * into employment from public.employments row
  where row.id = termination.employment_id and row.tenant_id = termination.tenant_id
  for update;

  if termination.last_working_day < employment.starts_on then
    raise exception 'TERMINATION_DATE_INVALID';
  end if;
  if termination.internal_reason_id is null or termination.statutory_reason_id is null then
    raise exception 'TERMINATION_REASON_REQUIRED';
  end if;
  if not exists (
    select 1 from public.statutory_termination_reasons reason
    where reason.id = termination.statutory_reason_id
      and reason.valid_from <= termination.last_working_day
      and (reason.valid_until is null or reason.valid_until > termination.last_working_day)
  ) then raise exception 'STATUTORY_REASON_NOT_VALID_ON_DATE'; end if;

  if exists (
    select 1 from public.employment_labor_conditions where employment_id = employment.id and valid_from > termination.last_working_day
    union all select 1 from public.employment_schedules where employment_id = employment.id and valid_from > termination.last_working_day
    union all select 1 from public.employment_salaries where employment_id = employment.id and valid_from > termination.last_working_day
    union all select 1 from public.employment_cost_allocations where employment_id = employment.id and valid_from > termination.last_working_day
  ) then raise exception 'TERMINATION_TIMELINE_CONFLICT'; end if;

  timeline_end := termination.last_working_day + 1;
  update public.employment_labor_conditions set valid_until = timeline_end
    where employment_id = employment.id and valid_from < timeline_end
      and (valid_until is null or valid_until > timeline_end);
  update public.employment_schedules set valid_until = timeline_end
    where employment_id = employment.id and valid_from < timeline_end
      and (valid_until is null or valid_until > timeline_end);
  update public.employment_salaries set valid_until = timeline_end
    where employment_id = employment.id and valid_from < timeline_end
      and (valid_until is null or valid_until > timeline_end);
  update public.employment_cost_allocations set valid_until = timeline_end
    where employment_id = employment.id and valid_from < timeline_end
      and (valid_until is null or valid_until > timeline_end);

  update public.employments
  set ends_on = termination.last_working_day,
      record_status = 'CONFIRMED'
  where id = employment.id;

  update public.employment_terminations
  set workflow_status = 'CONFIRMED',
      confirmed_by_user_id = (select auth.uid()),
      confirmed_at = timezone('utc', now())
  where id = termination.id;
end;
$$;

revoke all on function public.confirm_employment_termination(uuid) from public, anon;
grant execute on function public.confirm_employment_termination(uuid) to authenticated;

alter table public.statutory_termination_reasons enable row level security;
alter table public.employment_terminations enable row level security;
create policy statutory_termination_reasons_read
on public.statutory_termination_reasons for select to authenticated using (true);
create policy employment_terminations_read
on public.employment_terminations for select to authenticated
using ((select internal_security.can_manage_employee(employee_id, 'contract:read')));
create policy employment_terminations_insert
on public.employment_terminations for insert to authenticated
with check (
  created_by_user_id = (select auth.uid())
  and (select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write'))
);
create policy employment_terminations_update
on public.employment_terminations for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write')));

grant select on public.statutory_termination_reasons to authenticated;
grant select, insert, update on public.employment_terminations to authenticated;
