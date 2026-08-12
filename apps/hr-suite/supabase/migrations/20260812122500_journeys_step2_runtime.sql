-- Journeys stap 2: gepinde runtime, concrete participants, HR-lifecycle en reminderadapter.
-- Self-/participantprojecties en topicoutcomes worden pas in stap 3 ontsloten.

begin;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code in ('TENANT_ADMIN', 'HR_ADMIN')
  and permission.code in (
    'journey-template:read', 'journey-template:write', 'journey-template:publish',
    'journey:read', 'journey:write'
  )
on conflict do nothing;

create type public.journey_status as enum ('PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');
create type public.journey_participant_status as enum ('ASSIGNED', 'ACTIVE', 'REPLACED', 'REMOVED');
create type public.journey_participant_source as enum ('TARGET_EMPLOYEE', 'DIRECT_MANAGER', 'DEPARTMENT_MANAGER', 'SPECIFIC_EMPLOYEE', 'MANUAL');
create type public.journey_topic_status as enum ('PENDING', 'COMPLETED', 'SKIPPED');
create type public.journey_reminder_link_status as enum ('ACTIVE', 'SUSPENDED', 'CANCELLED');

create table public.journeys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hr_group_id uuid not null,
  template_id uuid not null,
  template_version_id uuid not null,
  template_version_number integer not null check (template_version_number > 0),
  template_name jsonb not null check (jsonb_typeof(template_name) = 'object'),
  target_employee_id uuid not null,
  employment_id uuid,
  anchor_date date not null,
  status public.journey_status not null,
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 8 and 160),
  version integer not null default 1 check (version > 0),
  activated_at timestamptz not null default timezone('utc', now()),
  paused_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by_user_id uuid not null references auth.users(id),
  updated_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, id),
  unique (tenant_id, hr_group_id, idempotency_key),
  foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, template_id) references public.journey_templates(tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, template_version_id) references public.journey_template_versions(tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, target_employee_id) references public.employees(tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, employment_id) references public.employments(tenant_id, hr_group_id, id),
  check (
    (status = 'PAUSED' and paused_at is not null and completed_at is null and cancelled_at is null)
    or (status = 'COMPLETED' and completed_at is not null and cancelled_at is null)
    or (status = 'CANCELLED' and cancelled_at is not null and completed_at is null)
    or (status in ('PLANNED', 'ACTIVE') and paused_at is null and completed_at is null and cancelled_at is null)
  )
);

create table public.journey_phases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  journey_id uuid not null,
  template_phase_id uuid not null,
  key text not null,
  name jsonb not null check (jsonb_typeof(name) = 'object'),
  sort_order integer not null check (sort_order >= 0),
  unique (tenant_id, hr_group_id, journey_id, id),
  unique (tenant_id, hr_group_id, journey_id, key),
  foreign key (tenant_id, hr_group_id, journey_id) references public.journeys(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (template_phase_id) references public.journey_template_phases(id)
);

create table public.journey_participants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  journey_id uuid not null,
  template_role_id uuid not null,
  role_key text not null,
  role_name jsonb not null check (jsonb_typeof(role_name) = 'object'),
  employee_id uuid not null,
  source public.journey_participant_source not null,
  resolver_role_code text,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 500),
  status public.journey_participant_status not null default 'ASSIGNED',
  replaced_by_participant_id uuid,
  assigned_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, journey_id, id),
  unique (journey_id, role_key, employee_id, assigned_at),
  foreign key (tenant_id, hr_group_id, journey_id) references public.journeys(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (template_role_id) references public.journey_template_roles(id),
  foreign key (tenant_id, hr_group_id, employee_id) references public.employees(tenant_id, hr_group_id, id),
  foreign key (replaced_by_participant_id) references public.journey_participants(id),
  check ((status in ('REPLACED', 'REMOVED')) = (ended_at is not null))
);

create table public.journey_participant_changes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  journey_id uuid not null,
  previous_participant_id uuid not null,
  replacement_participant_id uuid not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  changed_by_user_id uuid not null references auth.users(id),
  changed_at timestamptz not null default timezone('utc', now()),
  foreign key (tenant_id, hr_group_id, journey_id) references public.journeys(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (previous_participant_id) references public.journey_participants(id),
  foreign key (replacement_participant_id) references public.journey_participants(id)
);

create table public.journey_moments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  journey_id uuid not null,
  phase_id uuid not null,
  template_moment_id uuid not null,
  key text not null,
  name jsonb not null check (jsonb_typeof(name) = 'object'),
  date_offset_days integer not null,
  availability_offset_days integer not null,
  scheduled_on date not null,
  available_on date not null,
  sort_order integer not null check (sort_order >= 0),
  unique (tenant_id, hr_group_id, journey_id, id),
  unique (tenant_id, hr_group_id, journey_id, key),
  foreign key (tenant_id, hr_group_id, journey_id) references public.journeys(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, journey_id, phase_id) references public.journey_phases(tenant_id, hr_group_id, journey_id, id),
  foreign key (template_moment_id) references public.journey_template_moments(id),
  check (available_on <= scheduled_on)
);

create table public.journey_topics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  journey_id uuid not null,
  moment_id uuid not null,
  template_topic_id uuid not null,
  owner_role_key text not null,
  key text not null,
  topic_type public.journey_topic_type not null,
  title jsonb not null check (jsonb_typeof(title) = 'object'),
  body jsonb not null check (jsonb_typeof(body) = 'object'),
  action_url text,
  is_required boolean not null,
  status public.journey_topic_status not null default 'PENDING',
  sort_order integer not null check (sort_order >= 0),
  completed_at timestamptz,
  unique (tenant_id, hr_group_id, journey_id, id),
  unique (tenant_id, hr_group_id, journey_id, key),
  foreign key (tenant_id, hr_group_id, journey_id) references public.journeys(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, journey_id, moment_id) references public.journey_moments(tenant_id, hr_group_id, journey_id, id),
  foreign key (template_topic_id) references public.journey_template_topics(id),
  check ((status = 'PENDING' and completed_at is null) or (status <> 'PENDING' and completed_at is not null))
);

create table public.journey_topic_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  journey_id uuid not null,
  topic_id uuid not null,
  participant_id uuid not null,
  is_owner boolean not null default false,
  is_visible boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, journey_id, topic_id, participant_id),
  foreign key (tenant_id, hr_group_id, journey_id) references public.journeys(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, journey_id, topic_id) references public.journey_topics(tenant_id, hr_group_id, journey_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, journey_id, participant_id) references public.journey_participants(tenant_id, hr_group_id, journey_id, id)
);

create table public.journey_reminder_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  journey_id uuid not null,
  moment_id uuid not null,
  participant_id uuid not null,
  reminder_id uuid not null,
  status public.journey_reminder_link_status not null default 'ACTIVE',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, journey_id, moment_id, participant_id),
  unique (reminder_id),
  foreign key (tenant_id, hr_group_id, journey_id) references public.journeys(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, journey_id, moment_id) references public.journey_moments(tenant_id, hr_group_id, journey_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, journey_id, participant_id) references public.journey_participants(tenant_id, hr_group_id, journey_id, id),
  foreign key (reminder_id) references public.reminders(id) on delete cascade
);

create index journeys_scope_status_idx on public.journeys (tenant_id, hr_group_id, status, anchor_date, updated_at desc);
create index journeys_target_idx on public.journeys (tenant_id, hr_group_id, target_employee_id, updated_at desc);
create index journeys_template_id_idx on public.journeys (template_id);
create index journeys_template_version_id_idx on public.journeys (template_version_id);
create index journeys_employment_id_idx on public.journeys (employment_id) where employment_id is not null;
create index journeys_created_by_user_id_idx on public.journeys (created_by_user_id);
create index journeys_updated_by_user_id_idx on public.journeys (updated_by_user_id);
create index journey_phases_journey_idx on public.journey_phases (tenant_id, hr_group_id, journey_id, sort_order);
create index journey_phases_template_phase_id_idx on public.journey_phases (template_phase_id);
create index journey_participants_journey_idx on public.journey_participants (tenant_id, hr_group_id, journey_id, status, role_key);
create index journey_participants_employee_idx on public.journey_participants (tenant_id, hr_group_id, employee_id, status);
create index journey_participants_template_role_id_idx on public.journey_participants (template_role_id);
create index journey_participants_replaced_by_idx on public.journey_participants (replaced_by_participant_id) where replaced_by_participant_id is not null;
create index journey_participant_changes_journey_idx on public.journey_participant_changes (tenant_id, hr_group_id, journey_id, changed_at desc);
create index journey_participant_changes_previous_idx on public.journey_participant_changes (previous_participant_id);
create index journey_participant_changes_replacement_idx on public.journey_participant_changes (replacement_participant_id);
create index journey_participant_changes_user_idx on public.journey_participant_changes (changed_by_user_id);
create index journey_moments_journey_idx on public.journey_moments (tenant_id, hr_group_id, journey_id, scheduled_on, sort_order);
create index journey_moments_phase_id_idx on public.journey_moments (phase_id);
create index journey_moments_template_moment_id_idx on public.journey_moments (template_moment_id);
create index journey_topics_journey_idx on public.journey_topics (tenant_id, hr_group_id, journey_id, status, sort_order);
create index journey_topics_moment_idx on public.journey_topics (moment_id, status);
create index journey_topics_template_topic_id_idx on public.journey_topics (template_topic_id);
create index journey_topic_assignments_participant_idx on public.journey_topic_assignments (participant_id, topic_id);
create index journey_topic_assignments_topic_idx on public.journey_topic_assignments (topic_id, participant_id);
create index journey_reminder_links_journey_idx on public.journey_reminder_links (tenant_id, hr_group_id, journey_id, status);
create index journey_reminder_links_moment_id_idx on public.journey_reminder_links (moment_id);
create index journey_reminder_links_participant_id_idx on public.journey_reminder_links (participant_id);

create or replace function internal_security.activate_journey_internal(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_template_version_id uuid,
  requested_target_employee_id uuid,
  requested_employment_id uuid,
  requested_anchor_date date,
  requested_idempotency_key text,
  requested_participants jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  version_row public.journey_template_versions%rowtype;
  template_row public.journey_templates%rowtype;
  journey_row public.journeys%rowtype;
  role_row public.journey_template_roles%rowtype;
  participant_item jsonb;
  role_count integer;
begin
  if actor_id is null then raise exception 'JOURNEY_AUTHENTICATION_REQUIRED' using errcode = '28000'; end if;
  if not internal_security.journeys_module_enabled(requested_tenant_id) then raise exception 'JOURNEYS_MODULE_DISABLED' using errcode = '42501'; end if;
  if not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'journey:write') then
    raise exception 'JOURNEY_FORBIDDEN' using errcode = '42501';
  end if;
  if requested_anchor_date is null or char_length(btrim(requested_idempotency_key)) not between 8 and 160 then
    raise exception 'JOURNEY_ACTIVATION_INVALID' using errcode = '22023';
  end if;
  if jsonb_typeof(requested_participants) <> 'array' then raise exception 'JOURNEY_PARTICIPANTS_INVALID' using errcode = '22023'; end if;

  select * into journey_row
  from public.journeys
  where tenant_id = requested_tenant_id and hr_group_id = requested_hr_group_id and idempotency_key = requested_idempotency_key;
  if found then return jsonb_build_object('id', journey_row.id, 'version', journey_row.version, 'idempotentReplay', true); end if;

  select * into version_row from public.journey_template_versions
  where id = requested_template_version_id and tenant_id = requested_tenant_id and hr_group_id = requested_hr_group_id and status = 'PUBLISHED';
  if not found then raise exception 'JOURNEY_TEMPLATE_VERSION_NOT_PUBLISHED' using errcode = 'P0002'; end if;
  select * into template_row from public.journey_templates where id = version_row.template_id;
  if not found or template_row.lifecycle = 'RETIRED' then raise exception 'JOURNEY_TEMPLATE_NOT_ACTIVATABLE' using errcode = '55000'; end if;
  if not exists (select 1 from public.employees where id = requested_target_employee_id and tenant_id = requested_tenant_id and hr_group_id = requested_hr_group_id and is_active and not is_archived and deleted_at is null) then
    raise exception 'JOURNEY_TARGET_NOT_FOUND' using errcode = 'P0002';
  end if;
  if requested_employment_id is not null and not exists (
    select 1 from public.employments employment
    where employment.id = requested_employment_id and employment.tenant_id = requested_tenant_id
      and employment.hr_group_id = requested_hr_group_id and employment.employee_id = requested_target_employee_id
      and employment.deleted_at is null
  ) then raise exception 'JOURNEY_EMPLOYMENT_NOT_FOUND' using errcode = 'P0002'; end if;

  for role_row in select * from public.journey_template_roles where template_version_id = version_row.id order by sort_order loop
    select count(*) into role_count
    from jsonb_array_elements(requested_participants) item
    where item ->> 'roleKey' = role_row.key;
    if role_row.is_required and role_count = 0 then raise exception 'JOURNEY_REQUIRED_PARTICIPANT_MISSING:%', role_row.key using errcode = '23514'; end if;
    if role_row.cardinality = 'ONE' and role_count > 1 then raise exception 'JOURNEY_PARTICIPANT_CARDINALITY_INVALID:%', role_row.key using errcode = '23514'; end if;
  end loop;

  insert into public.journeys (
    tenant_id, hr_group_id, template_id, template_version_id, template_version_number, template_name,
    target_employee_id, employment_id, anchor_date, status, idempotency_key, created_by_user_id, updated_by_user_id
  ) values (
    requested_tenant_id, requested_hr_group_id, template_row.id, version_row.id, version_row.version_number, template_row.name,
    requested_target_employee_id, requested_employment_id, requested_anchor_date,
    case when requested_anchor_date > current_date then 'PLANNED'::public.journey_status else 'ACTIVE'::public.journey_status end,
    requested_idempotency_key, actor_id, actor_id
  ) returning * into journey_row;

  insert into public.journey_phases (tenant_id, hr_group_id, journey_id, template_phase_id, key, name, sort_order)
  select requested_tenant_id, requested_hr_group_id, journey_row.id, phase.id, phase.key, phase.name, phase.sort_order
  from public.journey_template_phases phase where phase.template_version_id = version_row.id;

  for participant_item in select value from jsonb_array_elements(requested_participants) loop
    select * into role_row from public.journey_template_roles
    where template_version_id = version_row.id and key = participant_item ->> 'roleKey';
    if not found then raise exception 'JOURNEY_PARTICIPANT_ROLE_NOT_FOUND' using errcode = '23503'; end if;
    if not exists (
      select 1 from public.employees employee
      where employee.id = (participant_item ->> 'employeeId')::uuid and employee.tenant_id = requested_tenant_id
        and employee.hr_group_id = requested_hr_group_id and employee.is_active and not employee.is_archived and employee.deleted_at is null
    ) then raise exception 'JOURNEY_PARTICIPANT_NOT_FOUND' using errcode = 'P0002'; end if;
    if role_row.resolver_type = 'TARGET_EMPLOYEE' and (participant_item ->> 'employeeId')::uuid <> requested_target_employee_id then
      raise exception 'JOURNEY_TARGET_PARTICIPANT_INVALID' using errcode = '23514';
    end if;
    insert into public.journey_participants (
      tenant_id, hr_group_id, journey_id, template_role_id, role_key, role_name, employee_id,
      source, resolver_role_code, resolution_note, status
    ) values (
      requested_tenant_id, requested_hr_group_id, journey_row.id, role_row.id, role_row.key, role_row.name,
      (participant_item ->> 'employeeId')::uuid,
      (participant_item ->> 'source')::public.journey_participant_source,
      role_row.resolver_role_code, nullif(participant_item ->> 'resolutionNote', ''),
      case when journey_row.status = 'ACTIVE' then 'ACTIVE'::public.journey_participant_status else 'ASSIGNED'::public.journey_participant_status end
    );
  end loop;

  insert into public.journey_moments (
    tenant_id, hr_group_id, journey_id, phase_id, template_moment_id, key, name,
    date_offset_days, availability_offset_days, scheduled_on, available_on, sort_order
  )
  select requested_tenant_id, requested_hr_group_id, journey_row.id, runtime_phase.id, moment.id, moment.key, moment.name,
    moment.date_offset_days, moment.availability_offset_days,
    requested_anchor_date + moment.date_offset_days, requested_anchor_date + moment.availability_offset_days, moment.sort_order
  from public.journey_template_moments moment
  join public.journey_template_phases template_phase on template_phase.id = moment.phase_id
  join public.journey_phases runtime_phase on runtime_phase.journey_id = journey_row.id and runtime_phase.key = template_phase.key
  where moment.template_version_id = version_row.id;

  insert into public.journey_topics (
    tenant_id, hr_group_id, journey_id, moment_id, template_topic_id, owner_role_key, key,
    topic_type, title, body, action_url, is_required, sort_order
  )
  select requested_tenant_id, requested_hr_group_id, journey_row.id, runtime_moment.id, topic.id, owner_role.key,
    topic.key, topic.topic_type, topic.title, topic.body, topic.action_url, topic.is_required, topic.sort_order
  from public.journey_template_topics topic
  join public.journey_template_moments template_moment on template_moment.id = topic.moment_id
  join public.journey_template_roles owner_role on owner_role.id = topic.owner_role_id
  join public.journey_moments runtime_moment on runtime_moment.journey_id = journey_row.id and runtime_moment.key = template_moment.key
  where topic.template_version_id = version_row.id;

  insert into public.journey_topic_assignments (tenant_id, hr_group_id, journey_id, topic_id, participant_id, is_owner, is_visible)
  select requested_tenant_id, requested_hr_group_id, journey_row.id, runtime_topic.id, participant.id,
    participant.role_key = runtime_topic.owner_role_key, true
  from public.journey_topics runtime_topic
  join public.journey_template_topics template_topic on template_topic.id = runtime_topic.template_topic_id
  join public.journey_template_topic_audiences audience on audience.topic_id = template_topic.id
  join public.journey_template_roles audience_role on audience_role.id = audience.role_id
  join public.journey_participants participant on participant.journey_id = journey_row.id and participant.role_key = audience_role.key
  where runtime_topic.journey_id = journey_row.id
  on conflict (tenant_id, hr_group_id, journey_id, topic_id, participant_id)
  do update set is_owner = journey_topic_assignments.is_owner or excluded.is_owner;

  insert into public.journey_topic_assignments (tenant_id, hr_group_id, journey_id, topic_id, participant_id, is_owner, is_visible)
  select requested_tenant_id, requested_hr_group_id, journey_row.id, runtime_topic.id, participant.id, true, true
  from public.journey_topics runtime_topic
  join public.journey_participants participant on participant.journey_id = journey_row.id and participant.role_key = runtime_topic.owner_role_key
  where runtime_topic.journey_id = journey_row.id
  on conflict (tenant_id, hr_group_id, journey_id, topic_id, participant_id)
  do update set is_owner = true, is_visible = true;

  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (requested_tenant_id, 'journey', journey_row.id, actor_id, 'CREATE',
    jsonb_build_object('event', 'JOURNEY_ACTIVATED', 'templateVersionId', version_row.id,
      'templateVersionNumber', version_row.version_number, 'targetEmployeeId', requested_target_employee_id,
      'anchorDate', requested_anchor_date, 'status', journey_row.status));
  return jsonb_build_object('id', journey_row.id, 'version', journey_row.version, 'idempotentReplay', false);
exception
  when unique_violation then
    select * into journey_row from public.journeys
    where tenant_id = requested_tenant_id and hr_group_id = requested_hr_group_id and idempotency_key = requested_idempotency_key;
    if found then return jsonb_build_object('id', journey_row.id, 'version', journey_row.version, 'idempotentReplay', true); end if;
    raise;
end;
$$;

-- Correcte reminderadapter met expliciete moment-ID; apart gehouden om de activatietransactie kort en toetsbaar te houden.
create or replace function internal_security.create_journey_reminders_internal(requested_journey_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  journey_row public.journeys%rowtype;
  item record;
  reminder_id uuid;
  recipient_user_id uuid;
  remind_at_value timestamptz;
  administration_id_value uuid;
begin
  select * into journey_row from public.journeys where id = requested_journey_id;
  if not found then raise exception 'JOURNEY_NOT_FOUND' using errcode = 'P0002'; end if;
  if auth.uid() is null or not internal_security.current_user_has_hr_group_permission(journey_row.tenant_id, journey_row.hr_group_id, 'journey:write') then
    raise exception 'JOURNEY_FORBIDDEN' using errcode = '42501';
  end if;
  select employment.administration_id into administration_id_value from public.employments employment where employment.id = journey_row.employment_id;
  for item in
    select distinct moment.id as moment_id, moment.available_on, participant.id as participant_id, participant.employee_id
    from public.journey_moments moment
    join public.journey_topics topic on topic.moment_id = moment.id
    join public.journey_topic_assignments assignment on assignment.topic_id = topic.id and assignment.is_owner
    join public.journey_participants participant on participant.id = assignment.participant_id
    where moment.journey_id = requested_journey_id and participant.status in ('ASSIGNED', 'ACTIVE')
  loop
    select employee.auth_user_id into recipient_user_id from public.employees employee where employee.id = item.employee_id;
    if recipient_user_id is null then continue; end if;
    remind_at_value := greatest((item.available_on::timestamp + time '09:00') at time zone 'Europe/Amsterdam', timezone('utc', now()) + interval '5 minutes');
    insert into public.reminders (
      tenant_id, administration_id, created_by_user_id, reminder_type, target_type,
      title, description, remind_at, status, published_at
    ) values (
      journey_row.tenant_id, administration_id_value, journey_row.created_by_user_id, 'HR', 'EMPLOYEES',
      'Journey: ' || coalesce(journey_row.template_name ->> 'nl', 'Journey'),
      'Open /journeys/' || journey_row.id::text || '#moment-' || item.moment_id::text,
      remind_at_value, 'PUBLISHED', timezone('utc', now())
    ) returning id into reminder_id;
    insert into public.reminder_targets (tenant_id, administration_id, reminder_id, employee_id)
    values (journey_row.tenant_id, administration_id_value, reminder_id, item.employee_id);
    insert into public.reminder_recipients (tenant_id, reminder_id, user_id, employee_id, effective_remind_at)
    values (journey_row.tenant_id, reminder_id, recipient_user_id, item.employee_id, remind_at_value);
    insert into public.journey_reminder_links (tenant_id, hr_group_id, journey_id, moment_id, participant_id, reminder_id)
    values (journey_row.tenant_id, journey_row.hr_group_id, journey_row.id, item.moment_id, item.participant_id, reminder_id)
    on conflict (tenant_id, hr_group_id, journey_id, moment_id, participant_id) do nothing;
  end loop;
end;
$$;

create or replace function internal_security.transition_journey_internal(requested_journey_id uuid, requested_expected_version integer, requested_action text)
returns jsonb language plpgsql security definer set search_path = pg_catalog
as $$
declare actor_id uuid := auth.uid(); journey_row public.journeys%rowtype; target_status public.journey_status;
begin
  if actor_id is null then raise exception 'JOURNEY_AUTHENTICATION_REQUIRED' using errcode = '28000'; end if;
  select * into journey_row from public.journeys where id = requested_journey_id for update;
  if not found then raise exception 'JOURNEY_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.current_user_has_hr_group_permission(journey_row.tenant_id, journey_row.hr_group_id, 'journey:write') then raise exception 'JOURNEY_FORBIDDEN' using errcode = '42501'; end if;
  if journey_row.version <> requested_expected_version then raise exception 'JOURNEY_VERSION_CONFLICT' using errcode = '40001'; end if;
  target_status := case requested_action
    when 'PAUSE' then 'PAUSED'::public.journey_status when 'RESUME' then 'ACTIVE'::public.journey_status
    when 'CANCEL' then 'CANCELLED'::public.journey_status when 'COMPLETE' then 'COMPLETED'::public.journey_status
    else null end;
  if target_status is null
     or (requested_action = 'PAUSE' and journey_row.status not in ('PLANNED', 'ACTIVE'))
     or (requested_action = 'RESUME' and journey_row.status <> 'PAUSED')
     or (requested_action in ('CANCEL', 'COMPLETE') and journey_row.status not in ('PLANNED', 'ACTIVE', 'PAUSED')) then
    raise exception 'JOURNEY_TRANSITION_INVALID' using errcode = '55000';
  end if;
  update public.journeys set status = target_status, version = version + 1, updated_by_user_id = actor_id, updated_at = timezone('utc', now()),
    paused_at = case when target_status = 'PAUSED' then timezone('utc', now()) else null end,
    completed_at = case when target_status = 'COMPLETED' then timezone('utc', now()) else null end,
    cancelled_at = case when target_status = 'CANCELLED' then timezone('utc', now()) else null end
  where id = requested_journey_id returning * into journey_row;
  if requested_action = 'PAUSE' then
    update public.reminders reminder set status = 'CANCELLED', cancelled_at = timezone('utc', now())
    from public.journey_reminder_links link where link.journey_id = journey_row.id and link.reminder_id = reminder.id and link.status = 'ACTIVE';
    update public.journey_reminder_links set status = 'SUSPENDED', updated_at = timezone('utc', now()) where journey_id = journey_row.id and status = 'ACTIVE';
  elsif requested_action = 'RESUME' then
    update public.reminders reminder set status = 'PUBLISHED', published_at = timezone('utc', now()), cancelled_at = null
    from public.journey_reminder_links link where link.journey_id = journey_row.id and link.reminder_id = reminder.id and link.status = 'SUSPENDED';
    update public.journey_reminder_links set status = 'ACTIVE', updated_at = timezone('utc', now()) where journey_id = journey_row.id and status = 'SUSPENDED';
  elsif requested_action in ('CANCEL', 'COMPLETE') then
    update public.reminders reminder set status = 'CANCELLED', cancelled_at = timezone('utc', now())
    from public.journey_reminder_links link where link.journey_id = journey_row.id and link.reminder_id = reminder.id and reminder.status <> 'CANCELLED';
    update public.journey_reminder_links set status = 'CANCELLED', updated_at = timezone('utc', now()) where journey_id = journey_row.id and status <> 'CANCELLED';
  end if;
  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (journey_row.tenant_id, 'journey', journey_row.id, actor_id, 'UPDATE', jsonb_build_object('event', 'JOURNEY_STATUS_CHANGED', 'action', requested_action, 'status', target_status, 'version', journey_row.version));
  return jsonb_build_object('id', journey_row.id, 'status', journey_row.status, 'version', journey_row.version);
end;
$$;

create or replace function internal_security.replace_journey_participant_internal(
  requested_journey_id uuid, requested_participant_id uuid, requested_replacement_employee_id uuid,
  requested_expected_version integer, requested_reason text
)
returns jsonb language plpgsql security definer set search_path = pg_catalog
as $$
declare actor_id uuid := auth.uid(); journey_row public.journeys%rowtype; previous_row public.journey_participants%rowtype; replacement_row public.journey_participants%rowtype; replacement_user_id uuid;
begin
  if actor_id is null then raise exception 'JOURNEY_AUTHENTICATION_REQUIRED' using errcode = '28000'; end if;
  if char_length(btrim(requested_reason)) not between 1 and 500 then raise exception 'JOURNEY_REPLACEMENT_REASON_REQUIRED' using errcode = '22023'; end if;
  select * into journey_row from public.journeys where id = requested_journey_id for update;
  if not found then raise exception 'JOURNEY_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.current_user_has_hr_group_permission(journey_row.tenant_id, journey_row.hr_group_id, 'journey:write') then raise exception 'JOURNEY_FORBIDDEN' using errcode = '42501'; end if;
  if journey_row.version <> requested_expected_version then raise exception 'JOURNEY_VERSION_CONFLICT' using errcode = '40001'; end if;
  if journey_row.status in ('COMPLETED', 'CANCELLED') then raise exception 'JOURNEY_REPLACEMENT_INVALID' using errcode = '55000'; end if;
  select * into previous_row from public.journey_participants where id = requested_participant_id and journey_id = journey_row.id and status in ('ASSIGNED', 'ACTIVE') for update;
  if not found then raise exception 'JOURNEY_PARTICIPANT_NOT_FOUND' using errcode = 'P0002'; end if;
  select employee.auth_user_id into replacement_user_id from public.employees employee
  where employee.id = requested_replacement_employee_id and employee.tenant_id = journey_row.tenant_id and employee.hr_group_id = journey_row.hr_group_id
    and employee.is_active and not employee.is_archived and employee.deleted_at is null;
  if not found then raise exception 'JOURNEY_REPLACEMENT_EMPLOYEE_NOT_FOUND' using errcode = 'P0002'; end if;
  if requested_replacement_employee_id = previous_row.employee_id then raise exception 'JOURNEY_REPLACEMENT_SAME_EMPLOYEE' using errcode = '23514'; end if;
  insert into public.journey_participants (
    tenant_id, hr_group_id, journey_id, template_role_id, role_key, role_name, employee_id,
    source, resolver_role_code, resolution_note, status
  ) values (
    previous_row.tenant_id, previous_row.hr_group_id, previous_row.journey_id, previous_row.template_role_id,
    previous_row.role_key, previous_row.role_name, requested_replacement_employee_id, 'MANUAL', previous_row.resolver_role_code,
    requested_reason, previous_row.status
  ) returning * into replacement_row;
  update public.journey_participants set status = 'REPLACED', replaced_by_participant_id = replacement_row.id, ended_at = timezone('utc', now()) where id = previous_row.id;
  insert into public.journey_participant_changes (tenant_id, hr_group_id, journey_id, previous_participant_id, replacement_participant_id, reason, changed_by_user_id)
  values (journey_row.tenant_id, journey_row.hr_group_id, journey_row.id, previous_row.id, replacement_row.id, btrim(requested_reason), actor_id);
  update public.journey_topic_assignments assignment set participant_id = replacement_row.id
  from public.journey_topics topic join public.journey_moments moment on moment.id = topic.moment_id
  where assignment.topic_id = topic.id and assignment.participant_id = previous_row.id and moment.scheduled_on >= current_date;
  update public.reminder_targets target set employee_id = requested_replacement_employee_id
  from public.journey_reminder_links link join public.journey_moments moment on moment.id = link.moment_id
  where link.participant_id = previous_row.id and link.reminder_id = target.reminder_id and moment.scheduled_on >= current_date;
  delete from public.reminder_recipients recipient using public.journey_reminder_links link, public.journey_moments moment
  where link.participant_id = previous_row.id and link.reminder_id = recipient.reminder_id and moment.id = link.moment_id and moment.scheduled_on >= current_date;
  if replacement_user_id is not null then
    insert into public.reminder_recipients (tenant_id, reminder_id, user_id, employee_id, effective_remind_at)
    select journey_row.tenant_id, reminder.id, replacement_user_id, requested_replacement_employee_id, reminder.remind_at
    from public.journey_reminder_links link join public.journey_moments moment on moment.id = link.moment_id join public.reminders reminder on reminder.id = link.reminder_id
    where link.participant_id = previous_row.id and moment.scheduled_on >= current_date
    on conflict (reminder_id, user_id) do nothing;
  end if;
  update public.journey_reminder_links set participant_id = replacement_row.id, updated_at = timezone('utc', now())
  where participant_id = previous_row.id and moment_id in (select id from public.journey_moments where journey_id = journey_row.id and scheduled_on >= current_date);
  update public.journeys set version = version + 1, updated_by_user_id = actor_id, updated_at = timezone('utc', now()) where id = journey_row.id returning * into journey_row;
  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (journey_row.tenant_id, 'journey', journey_row.id, actor_id, 'UPDATE', jsonb_build_object('event', 'JOURNEY_PARTICIPANT_REPLACED', 'roleKey', previous_row.role_key, 'previousEmployeeId', previous_row.employee_id, 'replacementEmployeeId', requested_replacement_employee_id, 'version', journey_row.version));
  return jsonb_build_object('id', journey_row.id, 'participantId', replacement_row.id, 'version', journey_row.version);
end;
$$;

-- De activatiekern materialiseert eerst; reminders worden daarna nog binnen dezelfde RPC-transactie gemaakt.
create or replace function public.activate_journey(
  requested_tenant_id uuid, requested_hr_group_id uuid, requested_template_version_id uuid,
  requested_target_employee_id uuid, requested_employment_id uuid, requested_anchor_date date,
  requested_idempotency_key text, requested_participants jsonb
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
declare result jsonb;
begin
  result := internal_security.activate_journey_internal($1, $2, $3, $4, $5, $6, $7, $8);
  if coalesce((result ->> 'idempotentReplay')::boolean, false) is false then perform internal_security.create_journey_reminders_internal((result ->> 'id')::uuid); end if;
  return result;
end;
$$;
create or replace function public.transition_journey(requested_journey_id uuid, requested_expected_version integer, requested_action text)
returns jsonb language sql security invoker set search_path = pg_catalog as $$ select internal_security.transition_journey_internal($1, $2, $3); $$;
create or replace function public.replace_journey_participant(requested_journey_id uuid, requested_participant_id uuid, requested_replacement_employee_id uuid, requested_expected_version integer, requested_reason text)
returns jsonb language sql security invoker set search_path = pg_catalog as $$ select internal_security.replace_journey_participant_internal($1, $2, $3, $4, $5); $$;

revoke all on function internal_security.activate_journey_internal(uuid, uuid, uuid, uuid, uuid, date, text, jsonb) from public, anon, authenticated;
revoke all on function internal_security.create_journey_reminders_internal(uuid) from public, anon, authenticated;
revoke all on function internal_security.transition_journey_internal(uuid, integer, text) from public, anon, authenticated;
revoke all on function internal_security.replace_journey_participant_internal(uuid, uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function internal_security.activate_journey_internal(uuid, uuid, uuid, uuid, uuid, date, text, jsonb) to authenticated;
grant execute on function internal_security.create_journey_reminders_internal(uuid) to authenticated;
grant execute on function internal_security.transition_journey_internal(uuid, integer, text) to authenticated;
grant execute on function internal_security.replace_journey_participant_internal(uuid, uuid, uuid, integer, text) to authenticated;
revoke all on function public.activate_journey(uuid, uuid, uuid, uuid, uuid, date, text, jsonb) from public, anon;
revoke all on function public.transition_journey(uuid, integer, text) from public, anon;
revoke all on function public.replace_journey_participant(uuid, uuid, uuid, integer, text) from public, anon;
grant execute on function public.activate_journey(uuid, uuid, uuid, uuid, uuid, date, text, jsonb) to authenticated;
grant execute on function public.transition_journey(uuid, integer, text) to authenticated;
grant execute on function public.replace_journey_participant(uuid, uuid, uuid, integer, text) to authenticated;

alter table public.journeys enable row level security;
alter table public.journey_phases enable row level security;
alter table public.journey_participants enable row level security;
alter table public.journey_participant_changes enable row level security;
alter table public.journey_moments enable row level security;
alter table public.journey_topics enable row level security;
alter table public.journey_topic_assignments enable row level security;
alter table public.journey_reminder_links enable row level security;

create policy journeys_hr_read on public.journeys for select to authenticated using (
  (select internal_security.journeys_module_enabled(tenant_id)) and
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey:read'))
);
create policy journey_phases_hr_read on public.journey_phases for select to authenticated using (
  (select internal_security.journeys_module_enabled(tenant_id)) and
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey:read'))
);
create policy journey_participants_hr_read on public.journey_participants for select to authenticated using (
  (select internal_security.journeys_module_enabled(tenant_id)) and
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey:read'))
);
create policy journey_participant_changes_hr_read on public.journey_participant_changes for select to authenticated using (
  (select internal_security.journeys_module_enabled(tenant_id)) and
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey:read'))
);
create policy journey_moments_hr_read on public.journey_moments for select to authenticated using (
  (select internal_security.journeys_module_enabled(tenant_id)) and
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey:read'))
);
create policy journey_topics_hr_read on public.journey_topics for select to authenticated using (
  (select internal_security.journeys_module_enabled(tenant_id)) and
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey:read'))
);
create policy journey_topic_assignments_hr_read on public.journey_topic_assignments for select to authenticated using (
  (select internal_security.journeys_module_enabled(tenant_id)) and
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey:read'))
);
create policy journey_reminder_links_hr_read on public.journey_reminder_links for select to authenticated using (
  (select internal_security.journeys_module_enabled(tenant_id)) and
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey:read'))
);

revoke all on table public.journeys from public, anon, authenticated;
revoke all on table public.journey_phases from public, anon, authenticated;
revoke all on table public.journey_participants from public, anon, authenticated;
revoke all on table public.journey_participant_changes from public, anon, authenticated;
revoke all on table public.journey_moments from public, anon, authenticated;
revoke all on table public.journey_topics from public, anon, authenticated;
revoke all on table public.journey_topic_assignments from public, anon, authenticated;
revoke all on table public.journey_reminder_links from public, anon, authenticated;
grant select on table public.journeys to authenticated;
grant select on table public.journey_phases to authenticated;
grant select on table public.journey_participants to authenticated;
grant select on table public.journey_participant_changes to authenticated;
grant select on table public.journey_moments to authenticated;
grant select on table public.journey_topics to authenticated;
grant select on table public.journey_topic_assignments to authenticated;
grant select on table public.journey_reminder_links to authenticated;

comment on function public.activate_journey(uuid, uuid, uuid, uuid, uuid, date, text, jsonb) is
  'Activeert idempotent en transactioneel een gepinde Journey-snapshot en maakt concrete reminders in de bestaande Tijdhub-infrastructuur.';

commit;
