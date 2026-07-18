insert into public.permissions (code, name, category, description) values
  ('settings:read', 'HR-instellingen bekijken', 'Organisatie & inrichting', 'Opent de centrale HR-admininstellingen voor toegestane onderdelen.'),
  ('modules:read', 'Actieve modules bekijken', 'Tenant & administraties', 'Bekijkt tenantbreed welke optionele modules beschikbaar en actief zijn.'),
  ('modules:write', 'Actieve modules beheren', 'Tenant & administraties', 'Activeert of deactiveert tenantbrede optionele modules.'),
  ('work-schedule:read', 'Roosters bekijken', 'Contract & dienstverband', 'Bekijkt repeterende werkpatronen binnen de geldige medewerkerscope.'),
  ('work-schedule:write', 'Roosters beheren', 'Contract & dienstverband', 'Publiceert repeterende werkpatronen binnen de geldige administratie.'),
  ('holidays:read', 'Feestdagen bekijken', 'Kalender', 'Bekijkt geïmporteerde en lokale feestdagen van een administratie.'),
  ('holidays:write', 'Feestdagen beheren', 'Kalender', 'Importeert en beheert feestdagen van een administratie.')
on conflict (code) do update set name=excluded.name, category=excluded.category, description=excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id from public.management_roles role cross join public.permissions permission
where role.code in ('TENANT_ADMIN','HR_ADVISOR')
  and permission.code in ('settings:read','modules:read','work-schedule:read','work-schedule:write','holidays:read','holidays:write')
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id from public.management_roles role cross join public.permissions permission
where role.code='TENANT_ADMIN' and permission.code='modules:write'
on conflict do nothing;

create table public.tenant_modules (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_code text not null check (module_code in ('HERA','DOCUMENTS','REMINDERS')),
  is_enabled boolean not null default true,
  enabled_at timestamptz,
  enabled_by uuid references auth.users(id) on delete set null,
  disabled_at timestamptz,
  disabled_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now()),
  primary key (tenant_id,module_code),
  constraint tenant_modules_state_valid check (
    (is_enabled and disabled_at is null and disabled_by is null)
    or (not is_enabled and enabled_at is null and enabled_by is null)
  )
);

create table public.employment_work_patterns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  employee_id uuid not null,
  employment_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 120),
  cycle_weeks smallint not null check (cycle_weeks between 1 and 4),
  anchor_date date not null check (extract(isodow from anchor_date)=1),
  average_minutes_per_week integer not null check (average_minutes_per_week between 0 and 10080),
  valid_from date not null,
  valid_until date,
  change_set_id uuid references public.employment_change_sets(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now()),
  constraint employment_work_patterns_period_valid check (valid_until is null or valid_until > valid_from),
  constraint employment_work_patterns_employment_fkey foreign key (tenant_id,administration_id,employee_id,employment_id)
    references public.employments(tenant_id,administration_id,employee_id,id) on delete cascade,
  constraint employment_work_patterns_no_overlap exclude using gist (
    tenant_id with =, employment_id with =, daterange(valid_from,valid_until,'[)') with &&
  ),
  unique (tenant_id,administration_id,id)
);

create table public.employment_work_pattern_days (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  work_pattern_id uuid not null,
  week_index smallint not null check (week_index between 1 and 4),
  iso_weekday smallint not null check (iso_weekday between 1 and 7),
  is_working_day boolean not null,
  starts_at time,
  ends_at time,
  break_minutes integer not null default 0 check (break_minutes between 0 and 1440),
  scheduled_minutes integer not null check (scheduled_minutes between 0 and 1440),
  note text check (note is null or length(note)<=240),
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now()),
  constraint employment_work_pattern_days_pattern_fkey foreign key (tenant_id,administration_id,work_pattern_id)
    references public.employment_work_patterns(tenant_id,administration_id,id) on delete cascade,
  constraint employment_work_pattern_days_state_valid check (
    (not is_working_day and starts_at is null and ends_at is null and break_minutes=0 and scheduled_minutes=0)
    or (is_working_day and scheduled_minutes>0 and ((starts_at is null and ends_at is null) or (starts_at is not null and ends_at is not null and ends_at>starts_at)))
  ),
  unique (work_pattern_id,week_index,iso_weekday)
);

create table public.holiday_calendars (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  calendar_year smallint not null check (calendar_year between 2000 and 2200),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  provider text not null default 'NAGER_DATE' check (provider='NAGER_DATE'),
  imported_at timestamptz,
  imported_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now()),
  constraint holiday_calendars_administration_fkey foreign key (tenant_id,administration_id)
    references public.administrations(tenant_id,id) on delete cascade,
  unique (tenant_id,administration_id,calendar_year,country_code),
  unique (tenant_id,administration_id,id)
);

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  holiday_calendar_id uuid not null,
  holiday_date date not null,
  provider_name text not null check (length(btrim(provider_name)) between 1 and 160),
  display_name text check (display_name is null or length(btrim(display_name)) between 1 and 160),
  source text not null check (source in ('API','MANUAL')),
  external_key text,
  holiday_types text[] not null default '{}',
  subdivision_codes text[] not null default '{}',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now()),
  constraint holidays_calendar_fkey foreign key (tenant_id,administration_id,holiday_calendar_id)
    references public.holiday_calendars(tenant_id,administration_id,id) on delete cascade,
  constraint holidays_source_valid check ((source='API' and external_key is not null) or (source='MANUAL' and external_key is null)),
  unique (holiday_calendar_id,id)
);

create unique index holidays_external_key_unique on public.holidays(holiday_calendar_id,external_key) where external_key is not null;
create index employment_work_patterns_month_idx on public.employment_work_patterns(administration_id,valid_from,valid_until,employee_id);
create index employment_work_pattern_days_projection_idx on public.employment_work_pattern_days(work_pattern_id,week_index,iso_weekday);
create index holiday_calendars_lookup_idx on public.holiday_calendars(administration_id,calendar_year,country_code);
create index holidays_month_idx on public.holidays(administration_id,holiday_date) where is_active;

create or replace function internal_security.tenant_module_enabled(requested_tenant_id uuid,requested_module_code text)
returns boolean language sql stable security definer set search_path=''
as $$
  select (select auth.uid()) is not null
    and internal_security.has_tenant_access(requested_tenant_id)
    and exists(select 1 from public.tenant_modules module where module.tenant_id=requested_tenant_id and module.module_code=requested_module_code and module.is_enabled);
$$;
revoke all on function internal_security.tenant_module_enabled(uuid,text) from public,anon,authenticated;
grant execute on function internal_security.tenant_module_enabled(uuid,text) to authenticated;

create or replace function internal_security.audit_configuration_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $$
declare row_data jsonb; old_data jsonb; entity_id uuid; tenant uuid; action text;
begin
  if tg_op='DELETE' then row_data:=to_jsonb(old);old_data:='{}';tenant:=old.tenant_id;action:='DELETE';
  else row_data:=to_jsonb(new);old_data:=case when tg_op='UPDATE' then to_jsonb(old) else '{}' end;tenant:=new.tenant_id;action:=case when tg_op='INSERT' then 'CREATE' else 'UPDATE' end;end if;
  entity_id:=coalesce(nullif(row_data->>'id','')::uuid,nullif(row_data->>'tenant_id','')::uuid);
  insert into public.audit_logs(tenant_id,entity_name,entity_id,actor_user_id,action,changes)
  values(tenant,tg_argv[0],entity_id,auth.uid(),action,jsonb_build_object('before',old_data,'after',row_data));
  if tg_op='DELETE' then return old;end if;return new;
end;
$$;
revoke all on function internal_security.audit_configuration_change() from public,anon,authenticated;

create trigger tenant_modules_updated before update on public.tenant_modules for each row execute function internal_security.set_updated_at();
create trigger employment_work_patterns_updated before update on public.employment_work_patterns for each row execute function internal_security.set_updated_at();
create trigger employment_work_pattern_days_updated before update on public.employment_work_pattern_days for each row execute function internal_security.set_updated_at();
create trigger holiday_calendars_updated before update on public.holiday_calendars for each row execute function internal_security.set_updated_at();
create trigger holidays_updated before update on public.holidays for each row execute function internal_security.set_updated_at();
create trigger audit_tenant_modules after insert or update or delete on public.tenant_modules for each row execute function internal_security.audit_configuration_change('tenant_module');
create trigger audit_employment_work_patterns after insert or update or delete on public.employment_work_patterns for each row execute function internal_security.audit_configuration_change('employment_work_pattern');
create trigger audit_employment_work_pattern_days after insert or update or delete on public.employment_work_pattern_days for each row execute function internal_security.audit_configuration_change('employment_work_pattern_day');
create trigger audit_holiday_calendars after insert or update or delete on public.holiday_calendars for each row execute function internal_security.audit_configuration_change('holiday_calendar');
create trigger audit_holidays after insert or update or delete on public.holidays for each row execute function internal_security.audit_configuration_change('holiday');

alter table public.tenant_modules enable row level security;
alter table public.employment_work_patterns enable row level security;
alter table public.employment_work_pattern_days enable row level security;
alter table public.holiday_calendars enable row level security;
alter table public.holidays enable row level security;

create policy tenant_modules_read on public.tenant_modules for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id,null,'modules:read')));
create policy tenant_modules_insert on public.tenant_modules for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id,null,'modules:write')));
create policy tenant_modules_update on public.tenant_modules for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id,null,'modules:write')))
with check ((select internal_security.current_user_has_permission(tenant_id,null,'modules:write')));
create policy tenant_modules_delete on public.tenant_modules for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id,null,'modules:write')));

create policy employment_work_patterns_read on public.employment_work_patterns for select to authenticated
using ((select internal_security.can_manage_employee(employee_id,'contract:read')) and (select internal_security.current_user_has_permission(tenant_id,administration_id,'work-schedule:read')));
create policy employment_work_patterns_write on public.employment_work_patterns for all to authenticated
using ((select internal_security.current_user_has_permission(tenant_id,administration_id,'work-schedule:write')))
with check ((select internal_security.current_user_has_permission(tenant_id,administration_id,'work-schedule:write')));
create policy employment_work_pattern_days_read on public.employment_work_pattern_days for select to authenticated
using (exists(select 1 from public.employment_work_patterns pattern where pattern.id=work_pattern_id));
create policy employment_work_pattern_days_write on public.employment_work_pattern_days for all to authenticated
using ((select internal_security.current_user_has_permission(tenant_id,administration_id,'work-schedule:write')))
with check ((select internal_security.current_user_has_permission(tenant_id,administration_id,'work-schedule:write')));

create policy holiday_calendars_read on public.holiday_calendars for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id,administration_id,'holidays:read')));
create policy holiday_calendars_write on public.holiday_calendars for all to authenticated
using ((select internal_security.current_user_has_permission(tenant_id,administration_id,'holidays:write')))
with check ((select internal_security.current_user_has_permission(tenant_id,administration_id,'holidays:write')));
create policy holidays_read on public.holidays for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id,administration_id,'holidays:read')));
create policy holidays_write on public.holidays for all to authenticated
using ((select internal_security.current_user_has_permission(tenant_id,administration_id,'holidays:write')))
with check ((select internal_security.current_user_has_permission(tenant_id,administration_id,'holidays:write')));

grant select,insert,update,delete on public.tenant_modules to authenticated;
grant select,insert,update,delete on public.employment_work_patterns to authenticated;
grant select,insert,update,delete on public.employment_work_pattern_days to authenticated;
grant select,insert,update,delete on public.holiday_calendars to authenticated;
grant select,insert,update,delete on public.holidays to authenticated;

create or replace function public.publish_employment_work_pattern(
  requested_employment_id uuid,
  requested_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_employment public.employments%rowtype;
  pattern_id uuid := gen_random_uuid();
  requested_name text := btrim(requested_payload ->> 'name');
  requested_cycle_weeks smallint := (requested_payload ->> 'cycle_weeks')::smallint;
  requested_anchor_date date := (requested_payload ->> 'anchor_date')::date;
  requested_valid_from date := (requested_payload ->> 'valid_from')::date;
  requested_valid_until date := nullif(requested_payload ->> 'valid_until', '')::date;
  day_count integer;
  total_minutes integer;
  average_minutes integer;
begin
  select * into target_employment
  from public.employments employment
  where employment.id = requested_employment_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'WORK_PATTERN_EMPLOYMENT_NOT_FOUND';
  end if;

  if not internal_security.current_user_has_permission(
    target_employment.tenant_id,
    target_employment.administration_id,
    'work-schedule:write'
  ) then
    raise exception using errcode = '42501', message = 'WORK_PATTERN_FORBIDDEN';
  end if;

  if requested_name is null or length(requested_name) not between 1 and 120
     or requested_cycle_weeks not between 1 and 4
     or extract(isodow from requested_anchor_date) <> 1
     or requested_valid_from is null
     or (requested_valid_until is not null and requested_valid_until <= requested_valid_from) then
    raise exception using errcode = '22023', message = 'WORK_PATTERN_INVALID_HEADER';
  end if;

  with requested_days as (
    select *
    from jsonb_to_recordset(coalesce(requested_payload -> 'days', '[]'::jsonb)) as day(
      week_index smallint,
      iso_weekday smallint,
      is_working_day boolean,
      starts_at time,
      ends_at time,
      break_minutes integer,
      scheduled_minutes integer,
      note text
    )
  )
  select count(*), coalesce(sum(scheduled_minutes), 0)
  into day_count, total_minutes
  from requested_days
  where week_index between 1 and requested_cycle_weeks
    and iso_weekday between 1 and 7
    and break_minutes between 0 and 1440
    and scheduled_minutes between 0 and 1440
    and (
      (not is_working_day and starts_at is null and ends_at is null and break_minutes = 0 and scheduled_minutes = 0)
      or (
        is_working_day
        and starts_at is not null
        and ends_at is not null
        and ends_at > starts_at
        and scheduled_minutes > 0
        and scheduled_minutes = floor(extract(epoch from (ends_at - starts_at)) / 60)::integer - break_minutes
      )
    );

  if day_count <> requested_cycle_weeks * 7
     or (total_minutes % requested_cycle_weeks) <> 0
     or (
       select count(distinct (day ->> 'week_index', day ->> 'iso_weekday'))
       from jsonb_array_elements(coalesce(requested_payload -> 'days', '[]'::jsonb)) day
     ) <> requested_cycle_weeks * 7 then
    raise exception using errcode = '22023', message = 'WORK_PATTERN_INVALID_DAYS';
  end if;

  average_minutes := total_minutes / requested_cycle_weeks;

  if not exists (
    select 1 from public.employment_schedules schedule
    where schedule.employment_id = requested_employment_id
      and daterange(schedule.valid_from, schedule.valid_until, '[)') && daterange(requested_valid_from, requested_valid_until, '[)')
  ) or exists (
    select 1 from public.employment_schedules schedule
    where schedule.employment_id = requested_employment_id
      and daterange(schedule.valid_from, schedule.valid_until, '[)') && daterange(requested_valid_from, requested_valid_until, '[)')
      and round(schedule.average_hours_per_week * 60)::integer <> average_minutes
  ) then
    raise exception using errcode = '23514', message = 'WORK_PATTERN_HOURS_MISMATCH';
  end if;

  if exists (
    select 1 from public.employment_work_patterns pattern
    where pattern.employment_id = requested_employment_id
      and pattern.valid_from >= requested_valid_from
      and daterange(pattern.valid_from, pattern.valid_until, '[)') && daterange(requested_valid_from, requested_valid_until, '[)')
  ) then
    raise exception using errcode = '23P01', message = 'WORK_PATTERN_FUTURE_OVERLAP';
  end if;

  update public.employment_work_patterns pattern
  set valid_until = requested_valid_from
  where pattern.employment_id = requested_employment_id
    and pattern.valid_from < requested_valid_from
    and daterange(pattern.valid_from, pattern.valid_until, '[)') && daterange(requested_valid_from, requested_valid_until, '[)');

  insert into public.employment_work_patterns(
    id, tenant_id, administration_id, employee_id, employment_id, name,
    cycle_weeks, anchor_date, average_minutes_per_week, valid_from, valid_until, created_by
  ) values (
    pattern_id, target_employment.tenant_id, target_employment.administration_id,
    target_employment.employee_id, target_employment.id, requested_name,
    requested_cycle_weeks, requested_anchor_date, average_minutes,
    requested_valid_from, requested_valid_until, auth.uid()
  );

  insert into public.employment_work_pattern_days(
    tenant_id, administration_id, work_pattern_id, week_index, iso_weekday,
    is_working_day, starts_at, ends_at, break_minutes, scheduled_minutes, note
  )
  select target_employment.tenant_id, target_employment.administration_id, pattern_id,
    day.week_index, day.iso_weekday, day.is_working_day, day.starts_at, day.ends_at,
    day.break_minutes, day.scheduled_minutes, nullif(btrim(day.note), '')
  from jsonb_to_recordset(requested_payload -> 'days') as day(
    week_index smallint,
    iso_weekday smallint,
    is_working_day boolean,
    starts_at time,
    ends_at time,
    break_minutes integer,
    scheduled_minutes integer,
    note text
  );

  return pattern_id;
end;
$$;

revoke all on function public.publish_employment_work_pattern(uuid, jsonb) from public, anon;
grant execute on function public.publish_employment_work_pattern(uuid, jsonb) to authenticated;

insert into public.tenant_modules(tenant_id,module_code,is_enabled,enabled_at)
select tenant.id,module.code,true,timezone('utc',now()) from public.tenants tenant
cross join (values('HERA'),('DOCUMENTS'),('REMINDERS')) module(code)
on conflict(tenant_id,module_code) do nothing;

insert into public.employment_work_patterns(
  id,tenant_id,administration_id,employee_id,employment_id,name,cycle_weeks,anchor_date,average_minutes_per_week,valid_from,valid_until,change_set_id,created_at,updated_at
)
select schedule.id,schedule.tenant_id,schedule.administration_id,schedule.employee_id,schedule.employment_id,'Bestaand rooster',1,
  schedule.valid_from-(extract(isodow from schedule.valid_from)::integer-1),round(schedule.average_hours_per_week*60)::integer,
  schedule.valid_from,schedule.valid_until,schedule.change_set_id,schedule.created_at,schedule.updated_at
from public.employment_schedules schedule on conflict(id) do nothing;

insert into public.employment_work_pattern_days(
  tenant_id,administration_id,work_pattern_id,week_index,iso_weekday,is_working_day,break_minutes,scheduled_minutes
)
select pattern.tenant_id,pattern.administration_id,pattern.id,1,day.iso_weekday,coalesce(day.hours,0)>0,0,round(coalesce(day.hours,0)*60)::integer
from public.employment_work_patterns pattern
join public.employment_schedules schedule on schedule.id=pattern.id
cross join lateral (values
  (1,schedule.monday_hours),(2,schedule.tuesday_hours),(3,schedule.wednesday_hours),(4,schedule.thursday_hours),
  (5,schedule.friday_hours),(6,schedule.saturday_hours),(7,schedule.sunday_hours)
) day(iso_weekday,hours)
on conflict(work_pattern_id,week_index,iso_weekday) do nothing;
