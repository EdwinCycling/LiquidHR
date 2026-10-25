begin;

-- Canonieke organisatiescope; feestdagen blijven afkomstig uit het bestaande register.
create table public.work_calendars (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  administration_id uuid,
  current_revision integer not null default 0 check (current_revision >= 0),
  current_version_id uuid,
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id,id),
  foreign key (tenant_id, hr_group_id, administration_id) references public.administrations(tenant_id,hr_group_id,id)
);
create unique index work_calendars_group_default on public.work_calendars(tenant_id,hr_group_id) where administration_id is null;
create unique index work_calendars_administration on public.work_calendars(tenant_id,hr_group_id,administration_id) where administration_id is not null;

create table public.work_calendar_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  calendar_id uuid not null,
  revision integer not null check (revision > 0),
  name text not null check (length(btrim(name)) between 1 and 120),
  time_zone text not null,
  weekdays smallint[] not null check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  valid_from date not null,
  valid_until date not null,
  holiday_selection_confirmed boolean not null check (holiday_selection_confirmed),
  reason text not null check (length(btrim(reason)) between 1 and 500),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (valid_until >= valid_from and valid_until-valid_from <= 3660),
  unique (tenant_id,hr_group_id,id),
  unique (tenant_id,hr_group_id,calendar_id,id),
  unique (calendar_id,revision),
  foreign key (tenant_id,hr_group_id,calendar_id) references public.work_calendars(tenant_id,hr_group_id,id)
);
alter table public.work_calendars add constraint work_calendars_current_version_fk
  foreign key (tenant_id,hr_group_id,id,current_version_id)
  references public.work_calendar_versions(tenant_id,hr_group_id,calendar_id,id);

create table public.work_calendar_exceptions (
  tenant_id uuid not null,
  hr_group_id uuid not null,
  version_id uuid not null,
  exception_date date not null,
  is_workday boolean not null,
  label text not null check (length(btrim(label)) between 1 and 160),
  source_holiday_id uuid,
  primary key (version_id,exception_date),
  foreign key (tenant_id,hr_group_id,version_id) references public.work_calendar_versions(tenant_id,hr_group_id,id)
);
comment on column public.work_calendar_exceptions.source_holiday_id is
  'Herkomstverwijzing, bij publicatie scoped gevalideerd. Snapshot blijft bestaan als het bronregister later wijzigt.';
create index work_calendar_versions_group on public.work_calendar_versions(tenant_id,hr_group_id,calendar_id);
create index work_calendar_exceptions_group on public.work_calendar_exceptions(tenant_id,hr_group_id,version_id);

alter table public.work_calendars enable row level security;
alter table public.work_calendar_versions enable row level security;
alter table public.work_calendar_exceptions enable row level security;
create policy work_calendars_read on public.work_calendars for select to authenticated using (
  internal_security.current_user_has_hr_group_permission(tenant_id,hr_group_id,'process-definition:write')
  and (administration_id is null or internal_security.has_administration_access(tenant_id,administration_id))
);
create policy work_calendar_versions_read on public.work_calendar_versions for select to authenticated using (
  exists(select 1 from public.work_calendars c where c.id=calendar_id and c.tenant_id=work_calendar_versions.tenant_id and c.hr_group_id=work_calendar_versions.hr_group_id)
);
create policy work_calendar_exceptions_read on public.work_calendar_exceptions for select to authenticated using (
  exists(select 1 from public.work_calendar_versions v where v.id=version_id and v.tenant_id=work_calendar_exceptions.tenant_id and v.hr_group_id=work_calendar_exceptions.hr_group_id)
);
revoke all on public.work_calendars,public.work_calendar_versions,public.work_calendar_exceptions from public,anon,authenticated;
grant select on public.work_calendars,public.work_calendar_versions,public.work_calendar_exceptions to authenticated;

create function internal_security.guard_work_calendar_version()
returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'WORK_CALENDAR_VERSION_IMMUTABLE' using errcode='55000';
end;
$$;
revoke all on function internal_security.guard_work_calendar_version() from public,anon,authenticated;
create trigger work_calendar_versions_immutable before update or delete on public.work_calendar_versions for each row execute function internal_security.guard_work_calendar_version();
create trigger work_calendar_exceptions_immutable before update or delete on public.work_calendar_exceptions for each row execute function internal_security.guard_work_calendar_version();

create function internal_security.require_work_calendar_admin(requested_group uuid, requested_administration uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare scoped_tenant uuid;
begin
  select tenant_id into scoped_tenant from public.hr_groups where id=requested_group and is_active;
  if auth.uid() is null or scoped_tenant is null or not internal_security.current_user_has_hr_group_permission(scoped_tenant,requested_group,'process-definition:write') then
    raise exception 'WORK_CALENDAR_FORBIDDEN' using errcode='42501';
  end if;
  if requested_administration is not null and (not exists(
    select 1 from public.administrations a where a.id=requested_administration and a.tenant_id=scoped_tenant and a.hr_group_id=requested_group and a.is_active
  ) or not internal_security.has_administration_access(scoped_tenant,requested_administration)
    or not internal_security.process_scope_has_permission(scoped_tenant,requested_group,'ADMINISTRATION'::public.access_scope_type,requested_administration,'process-definition:write')) then
    raise exception 'WORK_CALENDAR_FORBIDDEN' using errcode='42501';
  end if;
  return scoped_tenant;
end;
$$;
revoke all on function internal_security.require_work_calendar_admin(uuid,uuid) from public,anon,authenticated;

create function public.publish_work_calendar(requested_hr_group_id uuid, requested_administration_id uuid, requested_config jsonb, requested_expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  tenant_ref uuid;
  calendar_row public.work_calendars%rowtype;
  version_ref uuid;
  weekdays_ref smallint[];
  valid_start date;
  valid_end date;
  group_zone text;
  item jsonb;
  holiday_ref uuid;
  source_row record;
  source_date date;
begin
  tenant_ref := internal_security.require_work_calendar_admin(requested_hr_group_id,requested_administration_id);
  if jsonb_typeof(requested_config) is distinct from 'object'
    or exists(select 1 from jsonb_object_keys(requested_config) k where k not in ('name','weekdays','validFrom','validUntil','holidayIds','exceptions','holidaySelectionConfirmed','reason'))
    or jsonb_typeof(requested_config->'weekdays') is distinct from 'array'
    or jsonb_array_length(requested_config->'weekdays') not between 1 and 7
    or exists(select 1 from jsonb_array_elements(requested_config->'weekdays') d where jsonb_typeof(d)<>'number' or d::text !~ '^[1-7]$')
    or jsonb_typeof(requested_config->'holidayIds') is distinct from 'array'
    or jsonb_array_length(requested_config->'holidayIds')>500
    or jsonb_typeof(requested_config->'exceptions') is distinct from 'array'
    or jsonb_array_length(requested_config->'exceptions')>1000
    or requested_config->'holidaySelectionConfirmed' is distinct from 'true'::jsonb
    or jsonb_typeof(requested_config->'name') is distinct from 'string'
    or jsonb_typeof(requested_config->'reason') is distinct from 'string'
    or jsonb_typeof(requested_config->'validFrom') is distinct from 'string'
    or jsonb_typeof(requested_config->'validUntil') is distinct from 'string'
    or requested_config->>'validFrom' !~ '^\d{4}-\d{2}-\d{2}$'
    or requested_config->>'validUntil' !~ '^\d{4}-\d{2}-\d{2}$'
    or length(btrim(coalesce(requested_config->>'name',''))) not between 1 and 120
    or length(btrim(coalesce(requested_config->>'reason',''))) not between 1 and 500
    or requested_expected_revision is null or requested_expected_revision<0 then
    raise exception 'WORK_CALENDAR_INPUT_INVALID' using errcode='22023';
  end if;
  select array_agg(d::text::smallint order by d::text::smallint) into weekdays_ref from jsonb_array_elements(requested_config->'weekdays') d;
  if (select count(distinct d) from unnest(weekdays_ref) d)<>cardinality(weekdays_ref) then
    raise exception 'WORK_CALENDAR_INPUT_INVALID' using errcode='22023';
  end if;
  valid_start := (requested_config->>'validFrom')::date;
  valid_end := (requested_config->>'validUntil')::date;
  if valid_start is null or valid_end is null or valid_start<date '2000-01-01' or valid_end>date '2200-12-31' or valid_end<valid_start or valid_end-valid_start>3660 then
    raise exception 'WORK_CALENDAR_INPUT_INVALID' using errcode='22023';
  end if;
  select time_zone into group_zone from public.hr_groups where tenant_id=tenant_ref and id=requested_hr_group_id;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=group_zone) then
    raise exception 'SLA_TIME_ZONE_NOT_CONFIGURED' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tenant_ref::text||requested_hr_group_id::text||coalesce(requested_administration_id::text,'group'),0));
  select * into calendar_row from public.work_calendars
    where tenant_id=tenant_ref and hr_group_id=requested_hr_group_id and administration_id is not distinct from requested_administration_id for update;
  if coalesce(calendar_row.current_revision,0)<>requested_expected_revision then
    raise exception 'WORK_CALENDAR_STALE' using errcode='40001';
  end if;
  if calendar_row.id is null then
    insert into public.work_calendars(tenant_id,hr_group_id,administration_id)
      values(tenant_ref,requested_hr_group_id,requested_administration_id) returning * into calendar_row;
  end if;
  insert into public.work_calendar_versions(tenant_id,hr_group_id,calendar_id,revision,name,time_zone,weekdays,valid_from,valid_until,holiday_selection_confirmed,reason,created_by)
    values(tenant_ref,requested_hr_group_id,calendar_row.id,calendar_row.current_revision+1,btrim(requested_config->>'name'),group_zone,weekdays_ref,valid_start,valid_end,true,btrim(requested_config->>'reason'),auth.uid()) returning id into version_ref;
  for item in select value from jsonb_array_elements(requested_config->'holidayIds') loop
    if jsonb_typeof(item) is distinct from 'string' or item #>> '{}' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'WORK_CALENDAR_INPUT_INVALID' using errcode='22023';
    end if;
    holiday_ref := (item #>> '{}')::uuid;
    select h.holiday_date,coalesce(h.display_name,h.provider_name) as label into source_row
      from public.holidays h join public.holiday_calendars c on c.id=h.holiday_calendar_id and c.tenant_id=h.tenant_id and c.hr_group_id=h.hr_group_id
      where h.id=holiday_ref and h.tenant_id=tenant_ref and h.hr_group_id=requested_hr_group_id and h.is_active and c.country_code='NL'
        and h.holiday_date between valid_start and valid_end;
    if not found then raise exception 'WORK_CALENDAR_HOLIDAY_OUT_OF_SCOPE' using errcode='22023'; end if;
    insert into public.work_calendar_exceptions values(tenant_ref,requested_hr_group_id,version_ref,source_row.holiday_date,false,source_row.label,holiday_ref);
  end loop;
  for item in select value from jsonb_array_elements(requested_config->'exceptions') loop
    if jsonb_typeof(item) is distinct from 'object' or exists(select 1 from jsonb_object_keys(item) k where k not in ('date','isWorkday','label'))
      or jsonb_typeof(item->'isWorkday') is distinct from 'boolean'
      or jsonb_typeof(item->'label') is distinct from 'string'
      or jsonb_typeof(item->'date') is distinct from 'string'
      or item->>'date' !~ '^\d{4}-\d{2}-\d{2}$'
      or length(btrim(coalesce(item->>'label',''))) not between 1 and 160 then
      raise exception 'WORK_CALENDAR_INPUT_INVALID' using errcode='22023';
    end if;
    source_date := (item->>'date')::date;
    if source_date is null or source_date not between valid_start and valid_end then raise exception 'WORK_CALENDAR_INPUT_INVALID' using errcode='22023'; end if;
    insert into public.work_calendar_exceptions values(tenant_ref,requested_hr_group_id,version_ref,source_date,(item->>'isWorkday')::boolean,btrim(item->>'label'),null);
  end loop;
  update public.work_calendars set current_version_id=version_ref,current_revision=current_revision+1 where id=calendar_row.id;
  insert into public.audit_logs(tenant_id,administration_id,entity_name,entity_id,actor_user_id,action,changes)
    values(tenant_ref,requested_administration_id,'work_calendars',calendar_row.id,auth.uid(),case when calendar_row.current_revision=0 then 'CREATE' else 'UPDATE' end,
      jsonb_build_object('runtimeAction','WORK_CALENDAR_PUBLISHED','previousVersionId',calendar_row.current_version_id,'versionId',version_ref,'revision',calendar_row.current_revision+1,'reason',requested_config->>'reason'));
  return jsonb_build_object('calendarId',calendar_row.id,'versionId',version_ref,'revision',calendar_row.current_revision+1);
end;
$$;
revoke all on function public.publish_work_calendar(uuid,uuid,jsonb,integer) from public,anon;
grant execute on function public.publish_work_calendar(uuid,uuid,jsonb,integer) to authenticated;

create function public.get_work_calendars(requested_hr_group_id uuid, requested_administration_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant_ref uuid; result jsonb; effective_version uuid;
begin
  tenant_ref := internal_security.require_work_calendar_admin(requested_hr_group_id,requested_administration_id);
  select c.current_version_id into effective_version from public.work_calendars c
    where c.tenant_id=tenant_ref and c.hr_group_id=requested_hr_group_id and (c.administration_id is null or c.administration_id=requested_administration_id)
    order by c.administration_id nulls last limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'administrationId',c.administration_id,'revision',c.current_revision,
    'version',to_jsonb(v),'exceptions',coalesce((select jsonb_agg(jsonb_build_object('date',e.exception_date,'isWorkday',e.is_workday,'label',e.label,'sourceHolidayId',e.source_holiday_id) order by e.exception_date) from public.work_calendar_exceptions e where e.version_id=v.id),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(h) from (select revision,created_at,reason from public.work_calendar_versions where calendar_id=c.id order by revision desc limit 20) h),'[]'::jsonb)) order by c.administration_id nulls first),'[]'::jsonb) into result
    from public.work_calendars c join public.work_calendar_versions v on v.id=c.current_version_id
    where c.tenant_id=tenant_ref and c.hr_group_id=requested_hr_group_id and (c.administration_id is null or c.administration_id=requested_administration_id);
  return jsonb_build_object('calendars',result,'effectiveVersionId',effective_version);
end;
$$;
revoke all on function public.get_work_calendars(uuid,uuid) from public,anon;
grant execute on function public.get_work_calendars(uuid,uuid) to authenticated;

-- Eén berekeningspad voor runtime en de beheerpreview. Startdatum telt niet mee.
create function internal_security.work_calendar_deadline(requested_version uuid, requested_activation timestamptz, requested_days integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v public.work_calendar_versions%rowtype; candidate date; start_local timestamp;
  remaining integer := requested_days; working boolean; counted date[] := '{}'; skipped date[] := '{}';
begin
  select * into v from public.work_calendar_versions where id=requested_version;
  if v.id is null then raise exception 'SLA_WORKDAY_CALENDAR_REQUIRED' using errcode='P0001'; end if;
  if requested_activation is null or requested_days is null or requested_days not between 1 and 3660
    or cardinality(v.weekdays) not between 1 and 7 or not (v.weekdays <@ array[1,2,3,4,5,6,7]::smallint[])
    or (select count(distinct d) from unnest(v.weekdays) d)<>cardinality(v.weekdays)
    or not exists(select 1 from pg_catalog.pg_timezone_names where name=v.time_zone) then
    raise exception 'SLA_WORKDAY_CALENDAR_INVALID' using errcode='P0001';
  end if;
  start_local := requested_activation at time zone v.time_zone;
  candidate := start_local::date;
  if candidate not between v.valid_from and v.valid_until then raise exception 'SLA_WORKDAY_CALENDAR_OUT_OF_RANGE' using errcode='P0001'; end if;
  while remaining>0 loop
    candidate := candidate+1;
    if candidate>v.valid_until then raise exception 'SLA_WORKDAY_CALENDAR_OUT_OF_RANGE' using errcode='P0001'; end if;
    select is_workday into working from public.work_calendar_exceptions where version_id=v.id and exception_date=candidate;
    working := coalesce(working,extract(isodow from candidate)::smallint=any(v.weekdays));
    if working then remaining:=remaining-1; counted:=array_append(counted,candidate); else skipped:=array_append(skipped,candidate); end if;
  end loop;
  return jsonb_build_object('deadlineAt',(candidate+start_local::time) at time zone v.time_zone,'calendarVersionId',v.id,'revision',v.revision,'timeZone',v.time_zone,'countedDates',counted,'skippedDates',skipped);
end;
$$;
revoke all on function internal_security.work_calendar_deadline(uuid,timestamptz,integer) from public,anon,authenticated;

create function public.preview_work_calendar_deadline(requested_version_id uuid, requested_local_start timestamp, requested_days integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v public.work_calendar_versions%rowtype; c public.work_calendars%rowtype;
begin
  select * into v from public.work_calendar_versions where id=requested_version_id;
  if v.id is null then raise exception 'WORK_CALENDAR_NOT_FOUND' using errcode='P0002'; end if;
  select * into c from public.work_calendars where id=v.calendar_id;
  perform internal_security.require_work_calendar_admin(c.hr_group_id,c.administration_id);
  return internal_security.work_calendar_deadline(v.id,requested_local_start at time zone v.time_zone,requested_days);
end;
$$;
revoke all on function public.preview_work_calendar_deadline(uuid,timestamp,integer) from public,anon;
grant execute on function public.preview_work_calendar_deadline(uuid,timestamp,integer) to authenticated;

create function internal_security.resolve_process_work_calendar(requested_tenant uuid, requested_group uuid, requested_administration uuid)
returns uuid language plpgsql stable security definer set search_path='' as $$
declare version_ref uuid;
begin
  select c.current_version_id into version_ref from public.work_calendars c
    where c.tenant_id=requested_tenant and c.hr_group_id=requested_group and (c.administration_id is null or c.administration_id=requested_administration)
    order by c.administration_id nulls last limit 1;
  if version_ref is null then raise exception 'SLA_WORKDAY_CALENDAR_REQUIRED' using errcode='P0001'; end if;
  return version_ref;
end;
$$;
revoke all on function internal_security.resolve_process_work_calendar(uuid,uuid,uuid) from public,anon,authenticated;

alter table public.process_step_instances add column work_calendar_version_id uuid;
alter table public.process_step_instances add constraint process_steps_work_calendar_version_fk
  foreign key (tenant_id,hr_group_id,work_calendar_version_id) references public.work_calendar_versions(tenant_id,hr_group_id,id);
create index process_steps_work_calendar_version on public.process_step_instances(tenant_id,hr_group_id,work_calendar_version_id) where work_calendar_version_id is not null;

-- De oude P7-trigger rekende ook bij updates opnieuw. PMUX-06A is het enige
-- actieve materialisatiepad; verwijder de ongebruikte parallelle weekdaglus.
drop trigger if exists process_step_deadline_before on public.process_step_instances;
drop function if exists internal_security.set_process_step_deadline();
drop function if exists internal_security.process_deadline_at(timestamptz,jsonb);

do $migration$
declare definition text; old_branch text := E'  if business_days then\n    raise exception ''SLA_WORKDAY_CALENDAR_REQUIRED'' using errcode = ''P0001'';\n  end if;';
begin
  select replace(pg_get_functiondef('internal_security.materialize_process_step_deadline()'::regprocedure),E'\r\n',E'\n') into definition;
  if (length(definition)-length(replace(definition,old_branch,'')))/length(old_branch)<>1 then raise exception 'WORK_CALENDAR_RUNTIME_ANCHOR_INVALID'; end if;
  definition := replace(definition,'select version.definition_json into definition_content','select internal_security.process_definition_content(version.definition_json) into definition_content');
  definition := replace(definition,old_branch,$branch$  if business_days then
    if duration_unit <> 'DAYS' then raise exception 'PROCESS_SLA_CONFIGURATION_INVALID' using errcode='P0001'; end if;
    new.work_calendar_version_id := internal_security.resolve_process_work_calendar(instance_row.tenant_id,instance_row.hr_group_id,instance_row.administration_id);
    new.deadline_at := (internal_security.work_calendar_deadline(new.work_calendar_version_id,new.activated_at,duration_amount)->>'deadlineAt')::timestamptz;
    return new;
  end if;$branch$);
  execute definition;
end;
$migration$;

create function internal_security.guard_process_work_deadline()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.deadline_at is distinct from old.deadline_at or new.work_calendar_version_id is distinct from old.work_calendar_version_id then
    raise exception 'PROCESS_DEADLINE_IMMUTABLE' using errcode='55000';
  end if;
  return new;
end;
$$;
revoke all on function internal_security.guard_process_work_deadline() from public,anon,authenticated;
create trigger process_steps_deadline_immutable before update of deadline_at,work_calendar_version_id on public.process_step_instances for each row execute function internal_security.guard_process_work_deadline();

create function internal_security.audit_process_work_deadline()
returns trigger language plpgsql security definer set search_path='' as $$
declare i public.process_instances%rowtype;
begin
  if new.work_calendar_version_id is null then return new; end if;
  select * into i from public.process_instances where tenant_id=new.tenant_id and hr_group_id=new.hr_group_id and id=new.process_instance_id;
  insert into public.audit_logs(tenant_id,administration_id,entity_name,entity_id,actor_user_id,action,changes,correlation_id)
    values(new.tenant_id,i.administration_id,'process_step_instances',new.id,auth.uid(),'CREATE',jsonb_build_object('runtimeAction','PROCESS_WORKDAY_DEADLINE_SET','calendarVersionId',new.work_calendar_version_id,'deadlineAt',new.deadline_at,'activatedAt',new.activated_at),i.correlation_id);
  return new;
end;
$$;
revoke all on function internal_security.audit_process_work_deadline() from public,anon,authenticated;
create trigger process_steps_work_deadline_audit after insert on public.process_step_instances for each row execute function internal_security.audit_process_work_deadline();

comment on column public.process_step_instances.work_calendar_version_id is 'Immutable werkkalenderrevisie bij stapactivatie; latere publicaties wijzigen bestaande deadlines niet.';
commit;
