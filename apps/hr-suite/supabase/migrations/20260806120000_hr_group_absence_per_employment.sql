begin;

-- Verzuiminrichting is groepsbreed. administration_id blijft uitsluitend als
-- nullable historische metadata bestaan; nieuwe reads/writes gebruiken de
-- HR-groep als configuratiegrens.
alter table public.absence_settings
  alter column administration_id drop not null;

alter table public.absence_settings
  drop constraint if exists absence_settings_administration_scope_fkey;

alter table public.absence_settings
  drop constraint if exists absence_settings_administration_unique;

do $$
begin
  if exists (
    select 1
    from public.absence_settings
    group by tenant_id, hr_group_id
    having count(*) > 1
  ) then
    raise exception 'ABSENCE_SETTINGS_GROUP_CONSOLIDATION_REQUIRED';
  end if;
end;
$$;

create unique index if not exists absence_settings_tenant_hr_group_unique
  on public.absence_settings (tenant_id, hr_group_id);

comment on column public.absence_settings.administration_id is
  'Historische metadata; verzuiminstellingen worden per HR-groep beheerd.';

-- Een spell hoort altijd bij hetzelfde dienstverband als de case. De
-- bestaande data kan deterministisch vanuit de case worden aangevuld.
alter table public.absence_spells
  add column if not exists employment_id uuid;

update public.absence_spells spell
set employment_id = absence_case.employment_id
from public.absence_cases absence_case
where absence_case.tenant_id = spell.tenant_id
  and absence_case.hr_group_id = spell.hr_group_id
  and absence_case.id = spell.case_id
  and spell.employment_id is null;

do $$
begin
  if exists (select 1 from public.absence_spells where employment_id is null) then
    raise exception 'ABSENCE_SPELL_EMPLOYMENT_BACKFILL_INCOMPLETE';
  end if;
end;
$$;

alter table public.absence_spells
  alter column employment_id set not null;

create unique index if not exists absence_cases_tenant_hr_group_id_employment_key
  on public.absence_cases (tenant_id, hr_group_id, id, employment_id);

alter table public.absence_spells
  drop constraint if exists absence_spells_case_employment_hr_group_fkey;

alter table public.absence_spells
  add constraint absence_spells_case_employment_hr_group_fkey
  foreign key (tenant_id, hr_group_id, case_id, employment_id)
  references public.absence_cases (tenant_id, hr_group_id, id, employment_id)
  on delete cascade;

create unique index if not exists absence_spells_tenant_hr_group_case_id_key
  on public.absence_spells (tenant_id, hr_group_id, case_id, id);

alter table public.absence_capacity_changes
  drop constraint if exists absence_capacity_case_spell_hr_group_fkey;

alter table public.absence_capacity_changes
  add constraint absence_capacity_case_spell_hr_group_fkey
  foreign key (tenant_id, hr_group_id, case_id, spell_id)
  references public.absence_spells (tenant_id, hr_group_id, case_id, id)
  on delete cascade;

create index if not exists absence_cases_group_employment_date_idx
  on public.absence_cases (tenant_id, hr_group_id, employment_id, first_absence_on desc);

create index if not exists absence_spells_group_employment_date_idx
  on public.absence_spells (tenant_id, hr_group_id, employment_id, started_on desc);

create index if not exists absence_capacity_group_case_effective_idx
  on public.absence_capacity_changes (tenant_id, hr_group_id, case_id, effective_on desc);

create extension if not exists btree_gist with schema extensions;

alter table public.absence_spells
  drop constraint if exists absence_spells_no_employment_overlap;

alter table public.absence_spells
  add constraint absence_spells_no_employment_overlap
  exclude using gist (
    tenant_id with =,
    hr_group_id with =,
    employment_id with =,
    daterange(
      started_on,
      coalesce(recovered_on + 1, 'infinity'::date),
      '[)'
    ) with &&
  );

-- Replace the administration-scoped settings policies. The restrictive
-- group boundary remains the hard visibility boundary; these policies add
-- the group permission required for configuration access.
drop policy if exists absence_settings_select on public.absence_settings;
drop policy if exists absence_settings_insert on public.absence_settings;
drop policy if exists absence_settings_update on public.absence_settings;
drop policy if exists absence_settings_delete on public.absence_settings;

create policy absence_settings_group_select
on public.absence_settings
for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(
    tenant_id, hr_group_id, 'absence-settings:read'
  ))
);

create policy absence_settings_group_insert
on public.absence_settings
for insert to authenticated
with check (
  (select internal_security.current_user_has_hr_group_permission(
    tenant_id, hr_group_id, 'absence-settings:write'
  ))
);

create policy absence_settings_group_update
on public.absence_settings
for update to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(
    tenant_id, hr_group_id, 'absence-settings:write'
  ))
)
with check (
  (select internal_security.current_user_has_hr_group_permission(
    tenant_id, hr_group_id, 'absence-settings:write'
  ))
);

drop trigger if exists audit_absence_settings on public.absence_settings;
create trigger audit_absence_settings
after insert or update or delete on public.absence_settings
for each row execute function internal_security.audit_hr_change('absence_setting');

-- Self-service reporting is explicit and remains disabled by default.
insert into public.permissions (code, name, category, description)
values (
  'self:absence:write',
  'Eigen verzuim melden',
  'Verzuim',
  'Meldt als medewerker een eigen eerste ziektedag binnen de actieve HR-groep.'
)
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission on permission.code = 'self:absence:write'
where role.code = 'EMPLOYEE'
  and role.tenant_id is null
on conflict do nothing;

-- The old RPC accepted an administration id as scope. Remove it before
-- creating the group-aware signature, so PostgREST cannot expose both paths.
drop function if exists public.report_absence(uuid, uuid, uuid, uuid, date, numeric, date, boolean, boolean, boolean, text);
drop function if exists internal_security.report_absence(uuid, uuid, uuid, uuid, date, numeric, date, boolean, boolean, boolean, text);

create function internal_security.report_absence(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_start_date date,
  requested_absence_percentage numeric,
  requested_expected_recovery_on date default null,
  requested_has_sickness_benefit_safety_net boolean default null,
  requested_is_work_accident boolean default null,
  requested_is_third_party_traffic_accident boolean default null,
  requested_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  existing_mutation public.absence_mutations%rowtype;
  employment_row public.employments%rowtype;
  settings_row public.absence_settings%rowtype;
  case_record public.absence_cases%rowtype;
  spell_record public.absence_spells%rowtype;
  spell_id uuid;
  threshold smallint;
  prior_count integer;
  self_report boolean := false;
  reminder_id uuid;
  reminder_description text;
  target_employee_id uuid;
begin
  if actor_id is null
     or not internal_security.has_hr_group_access(requested_tenant_id, requested_hr_group_id) then
    raise exception 'ABSENCE_FORBIDDEN' using errcode = '42501';
  end if;

  select * into employment_row
  from public.employments employment
  where employment.tenant_id = requested_tenant_id
    and employment.hr_group_id = requested_hr_group_id
    and employment.employee_id = requested_employee_id
    and employment.id = requested_employment_id
    and employment.record_status = 'CONFIRMED'
    and employment.deleted_at is null
    and employment.starts_on <= requested_start_date
    and (employment.ends_on is null or employment.ends_on >= requested_start_date)
  for update;

  if not found then
    raise exception 'ABSENCE_EMPLOYMENT_INVALID' using errcode = '23514';
  end if;

  select * into settings_row
  from public.absence_settings settings
  where settings.tenant_id = requested_tenant_id
    and settings.hr_group_id = requested_hr_group_id;

  self_report := requested_employee_id = internal_security.current_employee_id(
    requested_tenant_id, requested_hr_group_id
  )
  and coalesce(settings_row.employee_self_report_enabled, false)
  and internal_security.current_employee_has_permission('self:absence:write');

  if not self_report
     and not (
       internal_security.current_user_has_hr_group_permission(
         requested_tenant_id, requested_hr_group_id, 'absence:write'
       )
       or internal_security.can_manage_employee(requested_employee_id, 'absence:write')
     ) then
    raise exception 'ABSENCE_FORBIDDEN' using errcode = '42501';
  end if;

  if requested_absence_percentage is null then
    requested_absence_percentage := 100;
  end if;
  if requested_absence_percentage <= 0 or requested_absence_percentage > 100 then
    raise exception 'ABSENCE_PERCENTAGE_INVALID' using errcode = '22023';
  end if;
  if requested_expected_recovery_on is not null
     and requested_expected_recovery_on < requested_start_date then
    raise exception 'ABSENCE_DATE_ORDER_INVALID' using errcode = '22023';
  end if;
  if self_report and (
    requested_expected_recovery_on is not null
    or requested_has_sickness_benefit_safety_net is not null
    or requested_is_work_accident is not null
    or requested_is_third_party_traffic_accident is not null
  ) then
    raise exception 'ABSENCE_SELF_SERVICE_FIELDS_FORBIDDEN' using errcode = '42501';
  end if;

  if requested_idempotency_key is not null then
    select * into existing_mutation
    from public.absence_mutations mutation
    where mutation.tenant_id = requested_tenant_id
      and mutation.operation_key = requested_idempotency_key;
    if found then
      if existing_mutation.hr_group_id <> requested_hr_group_id then
        raise exception 'ABSENCE_IDEMPOTENCY_CONFLICT' using errcode = '23505';
      end if;
      return existing_mutation.result_case_id;
    end if;
  end if;

  threshold := coalesce(settings_row.frequent_absence_threshold, 3);

  select count(*) into prior_count
  from public.absence_cases absence_case
  where absence_case.tenant_id = requested_tenant_id
    and absence_case.hr_group_id = requested_hr_group_id
    and absence_case.employment_id = requested_employment_id
    and absence_case.first_absence_on >= requested_start_date - interval '1 year'
    and absence_case.first_absence_on < requested_start_date
    and absence_case.archived_at is null;

  select * into case_record
  from public.absence_cases absence_case
  where absence_case.tenant_id = requested_tenant_id
    and absence_case.hr_group_id = requested_hr_group_id
    and absence_case.employment_id = requested_employment_id
    and absence_case.status in ('ACTIVE', 'RECOVERY_WINDOW')
    and absence_case.archived_at is null
  order by absence_case.first_absence_on desc
  limit 1
  for update;

  if case_record.id is not null then
    select * into spell_record
    from public.absence_spells spell
    where spell.tenant_id = requested_tenant_id
      and spell.hr_group_id = requested_hr_group_id
      and spell.case_id = case_record.id
    order by spell.started_on desc
    limit 1
    for update;

    if spell_record.id is null or spell_record.recovered_on is null then
      raise exception 'ABSENCE_ACTIVE_SPELL_EXISTS' using errcode = '23514';
    end if;
    if requested_start_date <= spell_record.recovered_on then
      raise exception 'ABSENCE_OVERLAP' using errcode = '23P01';
    end if;

    if requested_start_date - spell_record.recovered_on < 28 then
      update public.absence_cases
      set status = 'ACTIVE',
          recovery_window_ends_on = null,
          updated_at = timezone('utc', now())
      where tenant_id = requested_tenant_id
        and hr_group_id = requested_hr_group_id
        and id = case_record.id;
    else
      update public.absence_cases
      set status = 'CLOSED',
          closed_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
      where tenant_id = requested_tenant_id
        and hr_group_id = requested_hr_group_id
        and id = case_record.id;
      case_record.id := null;
    end if;
  end if;

  if case_record.id is null then
    insert into public.absence_cases (
      tenant_id, hr_group_id, administration_id, employee_id, employment_id,
      first_absence_on, effective_clock_start_on, case_manager_employee_id,
      has_sickness_benefit_safety_net, is_work_accident,
      is_third_party_traffic_accident, prior_case_count_12_months,
      frequent_absence_threshold, is_frequent_absence, created_by_user_id
    ) values (
      requested_tenant_id, requested_hr_group_id, employment_row.administration_id,
      requested_employee_id, requested_employment_id, requested_start_date,
      requested_start_date,
      case when exists (
        select 1
        from public.employees manager
        where manager.tenant_id = requested_tenant_id
          and manager.hr_group_id = requested_hr_group_id
          and manager.id = settings_row.default_case_manager_employee_id
          and manager.deleted_at is null
      ) then settings_row.default_case_manager_employee_id else null end,
      requested_has_sickness_benefit_safety_net, requested_is_work_accident,
      requested_is_third_party_traffic_accident, prior_count::smallint,
      threshold, prior_count + 1 >= threshold, actor_id
    ) returning * into case_record;
  end if;

  insert into public.absence_spells (
    tenant_id, hr_group_id, case_id, employment_id, started_on,
    expected_recovery_on, reported_by_user_id
  ) values (
    requested_tenant_id, requested_hr_group_id, case_record.id,
    requested_employment_id, requested_start_date,
    requested_expected_recovery_on, actor_id
  ) returning id into spell_id;

  insert into public.absence_capacity_changes (
    tenant_id, hr_group_id, case_id, spell_id, effective_on,
    absence_percentage, created_by_user_id
  ) values (
    requested_tenant_id, requested_hr_group_id, case_record.id, spell_id,
    requested_start_date, requested_absence_percentage, actor_id
  );

  if self_report then
    reminder_description := format(
      'Ziekmelding door medewerker. Eerste ziektedag: %s. Controleer de ziekmelding en vul de aanvullende gegevens aan.',
      requested_start_date
    );
    for target_employee_id in
      select employee.id
      from public.user_hr_group_access group_access
      join public.management_roles role on role.id = group_access.management_role_id
      join public.employees employee
        on employee.auth_user_id = group_access.user_id
       and employee.tenant_id = requested_tenant_id
       and employee.hr_group_id = requested_hr_group_id
       and employee.deleted_at is null
      where group_access.tenant_id = requested_tenant_id
        and group_access.hr_group_id = requested_hr_group_id
        and group_access.is_active
        and role.code in ('TENANT_ADMIN', 'HR_ADMIN')
      union
      select manager.id
      from public.employee_organizations placement
      join public.employees manager
        on manager.id = placement.direct_manager_id
       and manager.tenant_id = requested_tenant_id
       and manager.hr_group_id = requested_hr_group_id
       and manager.deleted_at is null
      where placement.tenant_id = requested_tenant_id
        and placement.hr_group_id = requested_hr_group_id
        and placement.employee_id = requested_employee_id
        and placement.effective_from <= current_date
        and (placement.effective_to is null or placement.effective_to >= current_date)
    loop
      insert into public.reminders (
        tenant_id, administration_id, created_by_user_id, reminder_type,
        target_type, title, description, remind_at, status, published_at
      ) values (
        requested_tenant_id, employment_row.administration_id, actor_id, 'HR',
        'EMPLOYEES', 'Controleer ziekmelding', reminder_description,
        timezone('utc', now()), 'PUBLISHED', timezone('utc', now())
      ) returning id into reminder_id;

      insert into public.reminder_targets (
        tenant_id, administration_id, reminder_id, employee_id
      ) values (
        requested_tenant_id, employment_row.administration_id, reminder_id, target_employee_id
      );

      insert into public.reminder_recipients (
        tenant_id, reminder_id, user_id, employee_id, effective_remind_at
      )
      select requested_tenant_id, reminder_id, employee.auth_user_id, employee.id,
             timezone('utc', now())
      from public.employees employee
      where employee.id = target_employee_id
        and employee.auth_user_id is not null
      on conflict (reminder_id, user_id) do nothing;
    end loop;
  end if;

  if requested_idempotency_key is not null then
    insert into public.absence_mutations (
      tenant_id, hr_group_id, operation_key, operation_type, result_case_id
    ) values (
      requested_tenant_id, requested_hr_group_id, requested_idempotency_key,
      'REPORT', case_record.id
    ) on conflict (tenant_id, operation_key) do nothing;
  end if;

  return case_record.id;
end;
$$;

create function public.report_absence(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_start_date date,
  requested_absence_percentage numeric,
  requested_expected_recovery_on date default null,
  requested_has_sickness_benefit_safety_net boolean default null,
  requested_is_work_accident boolean default null,
  requested_is_third_party_traffic_accident boolean default null,
  requested_idempotency_key text default null
)
returns uuid
language sql
set search_path = public, internal_security, pg_temp
as $$
  select internal_security.report_absence(
    requested_tenant_id, requested_hr_group_id, requested_employee_id,
    requested_employment_id, requested_start_date, requested_absence_percentage,
    requested_expected_recovery_on, requested_has_sickness_benefit_safety_net,
    requested_is_work_accident, requested_is_third_party_traffic_accident,
    requested_idempotency_key
  );
$$;

create or replace function internal_security.recover_absence(
  requested_case_id uuid,
  requested_recovered_on date,
  requested_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  case_record public.absence_cases%rowtype;
  spell_record public.absence_spells%rowtype;
  existing_mutation public.absence_mutations%rowtype;
begin
  select * into case_record
  from public.absence_cases absence_case
  where absence_case.id = requested_case_id
  for update;

  if actor_id is null or case_record.id is null
     or not internal_security.has_hr_group_access(case_record.tenant_id, case_record.hr_group_id)
     or not (
       internal_security.current_user_has_hr_group_permission(
         case_record.tenant_id, case_record.hr_group_id, 'absence:recover'
       )
       or internal_security.can_manage_employee(case_record.employee_id, 'absence:recover')
     ) then
    raise exception 'ABSENCE_FORBIDDEN' using errcode = '42501';
  end if;

  if requested_idempotency_key is not null then
    select * into existing_mutation
    from public.absence_mutations mutation
    where mutation.tenant_id = case_record.tenant_id
      and mutation.operation_key = requested_idempotency_key;
    if found then
      if existing_mutation.hr_group_id <> case_record.hr_group_id then
        raise exception 'ABSENCE_IDEMPOTENCY_CONFLICT' using errcode = '23505';
      end if;
      return existing_mutation.result_case_id;
    end if;
  end if;

  select * into spell_record
  from public.absence_spells spell
  where spell.tenant_id = case_record.tenant_id
    and spell.hr_group_id = case_record.hr_group_id
    and spell.case_id = case_record.id
    and spell.recovered_on is null
  order by spell.started_on desc
  limit 1
  for update;

  if not found then
    raise exception 'ABSENCE_NO_OPEN_SPELL' using errcode = '23514';
  end if;
  if requested_recovered_on < spell_record.started_on then
    raise exception 'ABSENCE_DATE_ORDER_INVALID' using errcode = '22023';
  end if;

  update public.absence_spells
  set recovered_on = requested_recovered_on,
      recovered_at = timezone('utc', now()),
      recovered_by_user_id = actor_id,
      updated_at = timezone('utc', now())
  where id = spell_record.id;

  update public.absence_cases
  set status = 'RECOVERY_WINDOW',
      recovery_window_ends_on = requested_recovered_on + 28,
      updated_at = timezone('utc', now())
  where tenant_id = case_record.tenant_id
    and hr_group_id = case_record.hr_group_id
    and id = case_record.id;

  if requested_idempotency_key is not null then
    insert into public.absence_mutations (
      tenant_id, hr_group_id, operation_key, operation_type, result_case_id
    ) values (
      case_record.tenant_id, case_record.hr_group_id, requested_idempotency_key,
      'RECOVERY', case_record.id
    ) on conflict (tenant_id, operation_key) do nothing;
  end if;

  return case_record.id;
end;
$$;

create or replace function public.recover_absence(
  requested_case_id uuid,
  requested_recovered_on date,
  requested_idempotency_key text default null
)
returns uuid
language sql
set search_path = public, internal_security, pg_temp
as $$
  select internal_security.recover_absence(
    requested_case_id, requested_recovered_on, requested_idempotency_key
  );
$$;

create function internal_security.change_absence_capacity(
  requested_case_id uuid,
  requested_effective_on date,
  requested_absence_percentage numeric,
  requested_expected_next_review_on date default null,
  requested_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  case_record public.absence_cases%rowtype;
  spell_record public.absence_spells%rowtype;
  existing_mutation public.absence_mutations%rowtype;
begin
  select * into case_record
  from public.absence_cases absence_case
  where absence_case.id = requested_case_id
  for update;

  if actor_id is null or case_record.id is null
     or not internal_security.has_hr_group_access(case_record.tenant_id, case_record.hr_group_id)
     or not (
       internal_security.current_user_has_hr_group_permission(
         case_record.tenant_id, case_record.hr_group_id, 'absence:write'
       )
       or internal_security.can_manage_employee(case_record.employee_id, 'absence:write')
     ) then
    raise exception 'ABSENCE_FORBIDDEN' using errcode = '42501';
  end if;

  if requested_absence_percentage <= 0 or requested_absence_percentage > 100 then
    raise exception 'ABSENCE_PERCENTAGE_INVALID' using errcode = '22023';
  end if;

  if requested_idempotency_key is not null then
    select * into existing_mutation
    from public.absence_mutations mutation
    where mutation.tenant_id = case_record.tenant_id
      and mutation.operation_key = requested_idempotency_key;
    if found then
      if existing_mutation.hr_group_id <> case_record.hr_group_id then
        raise exception 'ABSENCE_IDEMPOTENCY_CONFLICT' using errcode = '23505';
      end if;
      return existing_mutation.result_case_id;
    end if;
  end if;

  select * into spell_record
  from public.absence_spells spell
  where spell.tenant_id = case_record.tenant_id
    and spell.hr_group_id = case_record.hr_group_id
    and spell.case_id = case_record.id
    and spell.recovered_on is null
  order by spell.started_on desc
  limit 1
  for update;

  if not found then
    raise exception 'ABSENCE_NO_OPEN_SPELL' using errcode = '23514';
  end if;
  if requested_effective_on < spell_record.started_on
     or (
       requested_expected_next_review_on is not null
       and requested_expected_next_review_on < requested_effective_on
     ) then
    raise exception 'ABSENCE_DATE_ORDER_INVALID' using errcode = '22023';
  end if;

  insert into public.absence_capacity_changes (
    tenant_id, hr_group_id, case_id, spell_id, effective_on,
    absence_percentage, expected_next_review_on, created_by_user_id
  ) values (
    case_record.tenant_id, case_record.hr_group_id, case_record.id,
    spell_record.id, requested_effective_on, requested_absence_percentage,
    requested_expected_next_review_on, actor_id
  );

  if requested_idempotency_key is not null then
    insert into public.absence_mutations (
      tenant_id, hr_group_id, operation_key, operation_type, result_case_id
    ) values (
      case_record.tenant_id, case_record.hr_group_id, requested_idempotency_key,
      'CAPACITY', case_record.id
    ) on conflict (tenant_id, operation_key) do nothing;
  end if;

  return case_record.id;
end;
$$;

create function public.change_absence_capacity(
  requested_case_id uuid,
  requested_effective_on date,
  requested_absence_percentage numeric,
  requested_expected_next_review_on date default null,
  requested_idempotency_key text default null
)
returns uuid
language sql
set search_path = public, internal_security, pg_temp
as $$
  select internal_security.change_absence_capacity(
    requested_case_id, requested_effective_on, requested_absence_percentage,
    requested_expected_next_review_on, requested_idempotency_key
  );
$$;

revoke all on function internal_security.report_absence(uuid, uuid, uuid, uuid, date, numeric, date, boolean, boolean, boolean, text) from public, anon, authenticated;
revoke all on function internal_security.recover_absence(uuid, date, text) from public, anon, authenticated;
revoke all on function internal_security.change_absence_capacity(uuid, date, numeric, date, text) from public, anon, authenticated;
grant execute on function internal_security.report_absence(uuid, uuid, uuid, uuid, date, numeric, date, boolean, boolean, boolean, text) to authenticated;
grant execute on function internal_security.recover_absence(uuid, date, text) to authenticated;
grant execute on function internal_security.change_absence_capacity(uuid, date, numeric, date, text) to authenticated;

revoke all on function public.report_absence(uuid, uuid, uuid, uuid, date, numeric, date, boolean, boolean, boolean, text) from public, anon;
revoke all on function public.recover_absence(uuid, date, text) from public, anon;
revoke all on function public.change_absence_capacity(uuid, date, numeric, date, text) from public, anon;
grant execute on function public.report_absence(uuid, uuid, uuid, uuid, date, numeric, date, boolean, boolean, boolean, text) to authenticated;
grant execute on function public.recover_absence(uuid, date, text) to authenticated;
grant execute on function public.change_absence_capacity(uuid, date, numeric, date, text) to authenticated;

-- One default row per active group makes the setting explicit and keeps the
-- first read deterministic without fabricating employee-specific data.
insert into public.absence_settings (tenant_id, hr_group_id)
select group_row.tenant_id, group_row.id
from public.hr_groups group_row
where group_row.is_active
on conflict (tenant_id, hr_group_id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'absence_spells_no_employment_overlap'
      and conrelid = 'public.absence_spells'::regclass
  ) then
    raise exception 'ABSENCE_OVERLAP_CONSTRAINT_MISSING';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'absence_spells'
      and column_name = 'employment_id'
      and is_nullable = 'NO'
  ) then
    raise exception 'ABSENCE_SPELL_EMPLOYMENT_REQUIRED_MISSING';
  end if;
end;
$$;

commit;
