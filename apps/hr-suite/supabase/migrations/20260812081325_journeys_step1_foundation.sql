-- Journeys stap 1: HR-groepbrede templateconfiguratie en immutable publicatie.
-- Runtime Journeys, participants, materialisatie en outcomes vallen expliciet buiten deze migratie.

alter table public.tenant_modules drop constraint if exists tenant_modules_module_code_check;
alter table public.tenant_modules add constraint tenant_modules_module_code_check
  check (module_code in ('HERA','REMINDERS','TALENT','SURVEYS','ENPS','TEAM_COMPASS','JOURNEYS','DOCUMENTS'));

insert into public.tenant_modules (tenant_id, module_code, is_enabled, enabled_at)
select tenant.id, 'JOURNEYS', false, null
from public.tenants tenant
on conflict (tenant_id, module_code) do nothing;

insert into public.permissions (code, name, category, description) values
  ('journey-template:read', 'Journey templates lezen', 'Journeys', 'Templates en gepubliceerde versies binnen de actieve HR-groep raadplegen.'),
  ('journey-template:write', 'Journey templates beheren', 'Journeys', 'Drafts, fases, rollen, momenten, topics en audiences beheren.'),
  ('journey-template:publish', 'Journey templates publiceren', 'Journeys', 'Immutable templateversies publiceren en templates uitfaseren.'),
  ('journey:read', 'Journeys lezen', 'Journeys', 'Operationele HR-projecties binnen geldige scope lezen.'),
  ('journey:write', 'Journeys beheren', 'Journeys', 'Journeys starten en de operationele lifecycle beheren.'),
  ('self:journey:read', 'Eigen Journey lezen', 'Journeys', 'De eigen target-Journey en eigen audience lezen.'),
  ('self:journey:write', 'Eigen Journey bijwerken', 'Journeys', 'Toegestane eigen topicuitkomsten vastleggen.'),
  ('journey-participation:read', 'Journey-deelname lezen', 'Journeys', 'Audience-begrensde Journeys lezen waarin de actor participant is.'),
  ('journey-participation:write', 'Journey-deelname bijwerken', 'Journeys', 'Eigen toegewezen Journey-acties uitvoeren.')
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'TENANT_ADMIN'
  and permission.code in (
    'journey-template:read', 'journey-template:write', 'journey-template:publish',
    'journey:read', 'journey:write', 'self:journey:read', 'self:journey:write',
    'journey-participation:read', 'journey-participation:write'
  )
on conflict do nothing;

create type public.journey_template_lifecycle as enum ('DRAFT', 'PUBLISHED', 'RETIRED');
create type public.journey_template_version_status as enum ('DRAFT', 'PUBLISHED');
create type public.journey_type as enum ('PREBOARDING', 'ONBOARDING', 'REBOARDING', 'INTERNAL_TRANSFER', 'PROMOTION', 'RETURN', 'OFFBOARDING', 'CUSTOM');
create type public.journey_anchor_rule as enum ('EMPLOYMENT_START_DATE', 'MANUAL_DATE');
create type public.journey_role_cardinality as enum ('ONE', 'MANY');
create type public.journey_role_resolver_type as enum ('TARGET_EMPLOYEE', 'DIRECT_MANAGER', 'DEPARTMENT_MANAGER', 'SPECIFIC_EMPLOYEE', 'MANUAL');
create type public.journey_topic_type as enum ('INFORMATION', 'ACTION', 'CHECK_IN', 'DOCUMENT');

create table public.journey_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hr_group_id uuid not null,
  key text not null check (key ~ '^[a-z][a-z0-9_-]{0,79}$'),
  name jsonb not null check (jsonb_typeof(name) = 'object' and nullif(btrim(name ->> 'nl'), '') is not null and nullif(btrim(name ->> 'en'), '') is not null),
  description jsonb not null check (jsonb_typeof(description) = 'object' and nullif(btrim(description ->> 'nl'), '') is not null and nullif(btrim(description ->> 'en'), '') is not null),
  journey_type public.journey_type not null,
  lifecycle public.journey_template_lifecycle not null default 'DRAFT',
  current_published_version_id uuid,
  created_by_user_id uuid not null references auth.users(id),
  updated_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, id),
  unique (tenant_id, hr_group_id, key),
  foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id) on delete cascade
);

create table public.journey_template_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  template_id uuid not null,
  status public.journey_template_version_status not null default 'DRAFT',
  version_number integer,
  revision integer not null default 1 check (revision > 0),
  anchor_rule public.journey_anchor_rule not null,
  published_at timestamptz,
  published_by_user_id uuid references auth.users(id),
  created_by_user_id uuid not null references auth.users(id),
  updated_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, template_id) references public.journey_templates(tenant_id, hr_group_id, id) on delete cascade,
  check (
    (status = 'DRAFT' and version_number is null and published_at is null and published_by_user_id is null)
    or (status = 'PUBLISHED' and version_number is not null and version_number > 0 and published_at is not null and published_by_user_id is not null)
  )
);

create unique index journey_template_versions_one_draft_idx
  on public.journey_template_versions (tenant_id, hr_group_id, template_id)
  where status = 'DRAFT';
create unique index journey_template_versions_number_idx
  on public.journey_template_versions (tenant_id, hr_group_id, template_id, version_number)
  where status = 'PUBLISHED';
create unique index journey_template_versions_source_revision_idx
  on public.journey_template_versions (tenant_id, hr_group_id, template_id, revision)
  where status = 'PUBLISHED';

alter table public.journey_templates add constraint journey_templates_current_version_fk
  foreign key (tenant_id, hr_group_id, current_published_version_id)
  references public.journey_template_versions(tenant_id, hr_group_id, id);

create table public.journey_template_phases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  template_version_id uuid not null,
  key text not null check (key ~ '^[a-z][a-z0-9_-]{0,79}$'),
  name jsonb not null check (jsonb_typeof(name) = 'object' and nullif(btrim(name ->> 'nl'), '') is not null and nullif(btrim(name ->> 'en'), '') is not null),
  sort_order integer not null check (sort_order >= 0),
  unique (tenant_id, hr_group_id, template_version_id, id),
  unique (tenant_id, hr_group_id, template_version_id, key),
  unique (tenant_id, hr_group_id, template_version_id, sort_order),
  foreign key (tenant_id, hr_group_id, template_version_id) references public.journey_template_versions(tenant_id, hr_group_id, id) on delete cascade
);

create table public.journey_template_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  template_version_id uuid not null,
  key text not null check (key ~ '^[a-z][a-z0-9_-]{0,79}$'),
  name jsonb not null check (jsonb_typeof(name) = 'object' and nullif(btrim(name ->> 'nl'), '') is not null and nullif(btrim(name ->> 'en'), '') is not null),
  is_required boolean not null default true,
  cardinality public.journey_role_cardinality not null,
  resolver_type public.journey_role_resolver_type not null,
  resolver_role_code text,
  resolver_employee_id uuid,
  sort_order integer not null check (sort_order >= 0),
  unique (tenant_id, hr_group_id, template_version_id, id),
  unique (tenant_id, hr_group_id, template_version_id, key),
  unique (tenant_id, hr_group_id, template_version_id, sort_order),
  foreign key (tenant_id, hr_group_id, template_version_id) references public.journey_template_versions(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, resolver_employee_id) references public.employees(tenant_id, hr_group_id, id),
  check ((resolver_type = 'SPECIFIC_EMPLOYEE') = (resolver_employee_id is not null)),
  check ((resolver_type = 'DEPARTMENT_MANAGER') = (resolver_role_code is not null))
);

create table public.journey_template_moments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  template_version_id uuid not null,
  phase_id uuid not null,
  key text not null check (key ~ '^[a-z][a-z0-9_-]{0,79}$'),
  name jsonb not null check (jsonb_typeof(name) = 'object' and nullif(btrim(name ->> 'nl'), '') is not null and nullif(btrim(name ->> 'en'), '') is not null),
  date_offset_days integer not null check (date_offset_days between -730 and 730),
  availability_offset_days integer not null check (availability_offset_days between -730 and date_offset_days),
  sort_order integer not null check (sort_order >= 0),
  unique (tenant_id, hr_group_id, template_version_id, id),
  unique (tenant_id, hr_group_id, template_version_id, key),
  unique (tenant_id, hr_group_id, template_version_id, sort_order),
  foreign key (tenant_id, hr_group_id, template_version_id) references public.journey_template_versions(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, template_version_id, phase_id) references public.journey_template_phases(tenant_id, hr_group_id, template_version_id, id)
);

create table public.journey_template_topics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  template_version_id uuid not null,
  moment_id uuid not null,
  owner_role_id uuid not null,
  key text not null check (key ~ '^[a-z][a-z0-9_-]{0,79}$'),
  topic_type public.journey_topic_type not null,
  title jsonb not null check (jsonb_typeof(title) = 'object' and nullif(btrim(title ->> 'nl'), '') is not null and nullif(btrim(title ->> 'en'), '') is not null),
  body jsonb not null check (jsonb_typeof(body) = 'object' and nullif(btrim(body ->> 'nl'), '') is not null and nullif(btrim(body ->> 'en'), '') is not null),
  action_url text check (action_url is null or action_url ~ '^https?://'),
  is_required boolean not null default true,
  sort_order integer not null check (sort_order >= 0),
  unique (tenant_id, hr_group_id, template_version_id, id),
  unique (tenant_id, hr_group_id, template_version_id, key),
  unique (tenant_id, hr_group_id, template_version_id, moment_id, sort_order),
  foreign key (tenant_id, hr_group_id, template_version_id) references public.journey_template_versions(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, template_version_id, moment_id) references public.journey_template_moments(tenant_id, hr_group_id, template_version_id, id),
  foreign key (tenant_id, hr_group_id, template_version_id, owner_role_id) references public.journey_template_roles(tenant_id, hr_group_id, template_version_id, id),
  check ((topic_type = 'ACTION' and action_url is not null) or (topic_type <> 'ACTION' and action_url is null))
);

create table public.journey_template_topic_audiences (
  tenant_id uuid not null,
  hr_group_id uuid not null,
  template_version_id uuid not null,
  topic_id uuid not null,
  role_id uuid not null,
  primary key (tenant_id, hr_group_id, template_version_id, topic_id, role_id),
  foreign key (tenant_id, hr_group_id, template_version_id) references public.journey_template_versions(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, template_version_id, topic_id) references public.journey_template_topics(tenant_id, hr_group_id, template_version_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, template_version_id, role_id) references public.journey_template_roles(tenant_id, hr_group_id, template_version_id, id)
);

create index journey_templates_scope_idx on public.journey_templates (tenant_id, hr_group_id, lifecycle, updated_at desc);
create index journey_template_versions_template_idx on public.journey_template_versions (tenant_id, hr_group_id, template_id, status);
create index journey_template_phases_version_idx on public.journey_template_phases (tenant_id, hr_group_id, template_version_id, sort_order);
create index journey_template_roles_version_idx on public.journey_template_roles (tenant_id, hr_group_id, template_version_id, sort_order);
create index journey_template_moments_version_idx on public.journey_template_moments (tenant_id, hr_group_id, template_version_id, sort_order);
create index journey_template_topics_version_idx on public.journey_template_topics (tenant_id, hr_group_id, template_version_id, moment_id, sort_order);
create index journey_template_topic_audiences_role_idx on public.journey_template_topic_audiences (tenant_id, hr_group_id, template_version_id, role_id);

create or replace function internal_security.journeys_module_enabled(requested_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tenant_modules module
    where module.tenant_id = requested_tenant_id
      and module.module_code = 'JOURNEYS'
      and module.is_enabled
  );
$$;

revoke all on function internal_security.journeys_module_enabled(uuid) from public, anon, authenticated;
grant execute on function internal_security.journeys_module_enabled(uuid) to authenticated;

create or replace function internal_security.populate_journey_template_draft(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_version_id uuid,
  requested_draft jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  item jsonb;
  audience_key text;
begin
  if pg_catalog.jsonb_typeof(requested_draft) <> 'object'
     or pg_catalog.jsonb_typeof(requested_draft -> 'phases') <> 'array'
     or pg_catalog.jsonb_typeof(requested_draft -> 'roles') <> 'array'
     or pg_catalog.jsonb_typeof(requested_draft -> 'moments') <> 'array'
     or pg_catalog.jsonb_typeof(requested_draft -> 'topics') <> 'array' then
    raise exception 'JOURNEY_TEMPLATE_PAYLOAD_INVALID' using errcode = '22023';
  end if;

  for item in select value from pg_catalog.jsonb_array_elements(requested_draft -> 'phases') loop
    insert into public.journey_template_phases (tenant_id, hr_group_id, template_version_id, key, name, sort_order)
    values (requested_tenant_id, requested_hr_group_id, requested_version_id, item ->> 'key', item -> 'name', (item ->> 'sortOrder')::integer);
  end loop;

  for item in select value from pg_catalog.jsonb_array_elements(requested_draft -> 'roles') loop
    insert into public.journey_template_roles (
      tenant_id, hr_group_id, template_version_id, key, name, is_required, cardinality,
      resolver_type, resolver_role_code, resolver_employee_id, sort_order
    ) values (
      requested_tenant_id, requested_hr_group_id, requested_version_id, item ->> 'key', item -> 'name',
      (item ->> 'required')::boolean, (item ->> 'cardinality')::public.journey_role_cardinality,
      (item ->> 'resolverType')::public.journey_role_resolver_type, nullif(item ->> 'resolverRoleCode', ''),
      nullif(item ->> 'resolverEmployeeId', '')::uuid, (item ->> 'sortOrder')::integer
    );
  end loop;

  for item in select value from pg_catalog.jsonb_array_elements(requested_draft -> 'moments') loop
    insert into public.journey_template_moments (
      tenant_id, hr_group_id, template_version_id, phase_id, key, name,
      date_offset_days, availability_offset_days, sort_order
    )
    select requested_tenant_id, requested_hr_group_id, requested_version_id, phase.id,
      item ->> 'key', item -> 'name', (item ->> 'dateOffsetDays')::integer,
      (item ->> 'availabilityOffsetDays')::integer, (item ->> 'sortOrder')::integer
    from public.journey_template_phases phase
    where phase.tenant_id = requested_tenant_id and phase.hr_group_id = requested_hr_group_id
      and phase.template_version_id = requested_version_id and phase.key = item ->> 'phaseKey';
    if not found then raise exception 'JOURNEY_TEMPLATE_PHASE_NOT_FOUND' using errcode = '23503'; end if;
  end loop;

  for item in select value from pg_catalog.jsonb_array_elements(requested_draft -> 'topics') loop
    insert into public.journey_template_topics (
      tenant_id, hr_group_id, template_version_id, moment_id, owner_role_id, key,
      topic_type, title, body, action_url, is_required, sort_order
    )
    select requested_tenant_id, requested_hr_group_id, requested_version_id, moment.id, owner_role.id,
      item ->> 'key', (item ->> 'topicType')::public.journey_topic_type, item -> 'title', item -> 'body',
      nullif(item ->> 'actionUrl', ''), (item ->> 'required')::boolean, (item ->> 'sortOrder')::integer
    from public.journey_template_moments moment
    join public.journey_template_roles owner_role
      on owner_role.tenant_id = moment.tenant_id and owner_role.hr_group_id = moment.hr_group_id
     and owner_role.template_version_id = moment.template_version_id
     and owner_role.key = item ->> 'ownerRoleKey'
    where moment.tenant_id = requested_tenant_id and moment.hr_group_id = requested_hr_group_id
      and moment.template_version_id = requested_version_id and moment.key = item ->> 'momentKey';
    if not found then raise exception 'JOURNEY_TEMPLATE_TOPIC_REFERENCE_INVALID' using errcode = '23503'; end if;

    if pg_catalog.jsonb_array_length(item -> 'audienceRoleKeys') = 0 then
      raise exception 'JOURNEY_TEMPLATE_AUDIENCE_REQUIRED' using errcode = '23514';
    end if;
    for audience_key in select value #>> '{}' from pg_catalog.jsonb_array_elements(item -> 'audienceRoleKeys') loop
      insert into public.journey_template_topic_audiences (tenant_id, hr_group_id, template_version_id, topic_id, role_id)
      select requested_tenant_id, requested_hr_group_id, requested_version_id, topic.id, role.id
      from public.journey_template_topics topic
      join public.journey_template_roles role
        on role.tenant_id = topic.tenant_id and role.hr_group_id = topic.hr_group_id
       and role.template_version_id = topic.template_version_id and role.key = audience_key
      where topic.tenant_id = requested_tenant_id and topic.hr_group_id = requested_hr_group_id
        and topic.template_version_id = requested_version_id and topic.key = item ->> 'key';
      if not found then raise exception 'JOURNEY_TEMPLATE_AUDIENCE_ROLE_NOT_FOUND' using errcode = '23503'; end if;
    end loop;
  end loop;
end;
$$;

revoke all on function internal_security.populate_journey_template_draft(uuid, uuid, uuid, jsonb) from public, anon, authenticated;

create or replace function internal_security.create_journey_template_draft_internal(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_key text,
  requested_draft jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  template_row public.journey_templates%rowtype;
  version_row public.journey_template_versions%rowtype;
begin
  if actor_id is null then raise exception 'JOURNEY_AUTHENTICATION_REQUIRED' using errcode = '28000'; end if;
  if not internal_security.journeys_module_enabled(requested_tenant_id) then raise exception 'JOURNEYS_MODULE_DISABLED' using errcode = '42501'; end if;
  if not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'journey-template:write') then
    raise exception 'JOURNEY_TEMPLATE_FORBIDDEN' using errcode = '42501';
  end if;
  if requested_key is null or requested_key !~ '^[a-z][a-z0-9_-]{0,79}$' then raise exception 'JOURNEY_TEMPLATE_KEY_INVALID' using errcode = '22023'; end if;

  insert into public.journey_templates (
    tenant_id, hr_group_id, key, name, description, journey_type, lifecycle,
    created_by_user_id, updated_by_user_id
  ) values (
    requested_tenant_id, requested_hr_group_id, requested_key, requested_draft -> 'name', requested_draft -> 'description',
    (requested_draft ->> 'journeyType')::public.journey_type, 'DRAFT', actor_id, actor_id
  ) returning * into template_row;

  insert into public.journey_template_versions (
    tenant_id, hr_group_id, template_id, status, revision, anchor_rule,
    created_by_user_id, updated_by_user_id
  ) values (
    requested_tenant_id, requested_hr_group_id, template_row.id, 'DRAFT', 1,
    (requested_draft ->> 'anchorRule')::public.journey_anchor_rule, actor_id, actor_id
  ) returning * into version_row;

  perform internal_security.populate_journey_template_draft(requested_tenant_id, requested_hr_group_id, version_row.id, requested_draft);

  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (requested_tenant_id, 'journey_template', template_row.id, actor_id, 'CREATE',
    pg_catalog.jsonb_build_object('event', 'JOURNEY_TEMPLATE_CREATED', 'draftId', version_row.id));

  return pg_catalog.jsonb_build_object('id', template_row.id, 'draftId', version_row.id, 'revision', 1);
end;
$$;

create or replace function internal_security.save_journey_template_draft_internal(
  requested_draft_id uuid,
  requested_expected_revision integer,
  requested_draft jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  version_row public.journey_template_versions%rowtype;
  next_revision integer;
begin
  if actor_id is null then raise exception 'JOURNEY_AUTHENTICATION_REQUIRED' using errcode = '28000'; end if;
  select * into version_row from public.journey_template_versions where id = requested_draft_id for update;
  if not found or version_row.status <> 'DRAFT' then raise exception 'JOURNEY_TEMPLATE_DRAFT_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.journeys_module_enabled(version_row.tenant_id) then raise exception 'JOURNEYS_MODULE_DISABLED' using errcode = '42501'; end if;
  if not internal_security.current_user_has_hr_group_permission(version_row.tenant_id, version_row.hr_group_id, 'journey-template:write') then
    raise exception 'JOURNEY_TEMPLATE_FORBIDDEN' using errcode = '42501';
  end if;
  if version_row.revision <> requested_expected_revision then raise exception 'JOURNEY_TEMPLATE_DRAFT_CONFLICT' using errcode = '40001'; end if;
  if exists (select 1 from public.journey_templates template where template.id = version_row.template_id and template.lifecycle = 'RETIRED') then
    raise exception 'JOURNEY_TEMPLATE_RETIRED' using errcode = '55000';
  end if;

  delete from public.journey_template_topic_audiences where template_version_id = requested_draft_id;
  delete from public.journey_template_topics where template_version_id = requested_draft_id;
  delete from public.journey_template_moments where template_version_id = requested_draft_id;
  delete from public.journey_template_roles where template_version_id = requested_draft_id;
  delete from public.journey_template_phases where template_version_id = requested_draft_id;
  perform internal_security.populate_journey_template_draft(version_row.tenant_id, version_row.hr_group_id, requested_draft_id, requested_draft);

  next_revision := version_row.revision + 1;
  update public.journey_template_versions set revision = next_revision, anchor_rule = (requested_draft ->> 'anchorRule')::public.journey_anchor_rule,
    updated_by_user_id = actor_id, updated_at = timezone('utc', now()) where id = requested_draft_id;
  update public.journey_templates set name = requested_draft -> 'name', description = requested_draft -> 'description',
    journey_type = (requested_draft ->> 'journeyType')::public.journey_type, updated_by_user_id = actor_id,
    updated_at = timezone('utc', now()) where id = version_row.template_id;

  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (version_row.tenant_id, 'journey_template', version_row.template_id, actor_id, 'UPDATE',
    pg_catalog.jsonb_build_object('event', 'JOURNEY_TEMPLATE_DRAFT_SAVED', 'draftId', requested_draft_id, 'revision', next_revision));
  return pg_catalog.jsonb_build_object('id', version_row.template_id, 'draftId', requested_draft_id, 'revision', next_revision);
end;
$$;

create or replace function internal_security.publish_journey_template_internal(
  requested_draft_id uuid,
  requested_expected_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  draft_row public.journey_template_versions%rowtype;
  published_row public.journey_template_versions%rowtype;
  next_version integer;
begin
  if actor_id is null then raise exception 'JOURNEY_AUTHENTICATION_REQUIRED' using errcode = '28000'; end if;
  select * into draft_row from public.journey_template_versions where id = requested_draft_id for update;
  if not found or draft_row.status <> 'DRAFT' then raise exception 'JOURNEY_TEMPLATE_DRAFT_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.journeys_module_enabled(draft_row.tenant_id) then raise exception 'JOURNEYS_MODULE_DISABLED' using errcode = '42501'; end if;
  if not internal_security.current_user_has_hr_group_permission(draft_row.tenant_id, draft_row.hr_group_id, 'journey-template:publish') then
    raise exception 'JOURNEY_TEMPLATE_FORBIDDEN' using errcode = '42501';
  end if;
  if draft_row.revision <> requested_expected_revision then raise exception 'JOURNEY_TEMPLATE_DRAFT_CONFLICT' using errcode = '40001'; end if;
  if exists (select 1 from public.journey_templates template where template.id = draft_row.template_id and template.lifecycle = 'RETIRED') then
    raise exception 'JOURNEY_TEMPLATE_RETIRED' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.journey_template_versions version
    where version.tenant_id = draft_row.tenant_id and version.hr_group_id = draft_row.hr_group_id
      and version.template_id = draft_row.template_id and version.status = 'PUBLISHED'
      and version.revision = draft_row.revision
  ) then raise exception 'JOURNEY_TEMPLATE_ALREADY_PUBLISHED' using errcode = '55000'; end if;
  if not exists (select 1 from public.journey_template_phases where template_version_id = requested_draft_id)
     or not exists (select 1 from public.journey_template_roles where template_version_id = requested_draft_id)
     or not exists (select 1 from public.journey_template_moments where template_version_id = requested_draft_id) then
    raise exception 'JOURNEY_TEMPLATE_INCOMPLETE' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.journey_template_topics topic
    where topic.template_version_id = requested_draft_id
      and not exists (select 1 from public.journey_template_topic_audiences audience where audience.topic_id = topic.id)
  ) then raise exception 'JOURNEY_TEMPLATE_AUDIENCE_REQUIRED' using errcode = '23514'; end if;

  select coalesce(max(version_number), 0) + 1 into next_version
  from public.journey_template_versions
  where tenant_id = draft_row.tenant_id and hr_group_id = draft_row.hr_group_id
    and template_id = draft_row.template_id and status = 'PUBLISHED';

  insert into public.journey_template_versions (
    tenant_id, hr_group_id, template_id, status, version_number, revision, anchor_rule,
    published_at, published_by_user_id, created_by_user_id, updated_by_user_id
  ) values (
    draft_row.tenant_id, draft_row.hr_group_id, draft_row.template_id, 'PUBLISHED', next_version,
    draft_row.revision, draft_row.anchor_rule, timezone('utc', now()), actor_id, actor_id, actor_id
  ) returning * into published_row;

  insert into public.journey_template_phases (tenant_id, hr_group_id, template_version_id, key, name, sort_order)
  select tenant_id, hr_group_id, published_row.id, key, name, sort_order
  from public.journey_template_phases where template_version_id = requested_draft_id;
  insert into public.journey_template_roles (
    tenant_id, hr_group_id, template_version_id, key, name, is_required, cardinality,
    resolver_type, resolver_role_code, resolver_employee_id, sort_order
  ) select tenant_id, hr_group_id, published_row.id, key, name, is_required, cardinality,
    resolver_type, resolver_role_code, resolver_employee_id, sort_order
  from public.journey_template_roles where template_version_id = requested_draft_id;
  insert into public.journey_template_moments (
    tenant_id, hr_group_id, template_version_id, phase_id, key, name,
    date_offset_days, availability_offset_days, sort_order
  ) select moment.tenant_id, moment.hr_group_id, published_row.id, target_phase.id, moment.key, moment.name,
    moment.date_offset_days, moment.availability_offset_days, moment.sort_order
  from public.journey_template_moments moment
  join public.journey_template_phases source_phase on source_phase.id = moment.phase_id
  join public.journey_template_phases target_phase on target_phase.template_version_id = published_row.id and target_phase.key = source_phase.key
  where moment.template_version_id = requested_draft_id;
  insert into public.journey_template_topics (
    tenant_id, hr_group_id, template_version_id, moment_id, owner_role_id, key,
    topic_type, title, body, action_url, is_required, sort_order
  ) select topic.tenant_id, topic.hr_group_id, published_row.id, target_moment.id, target_role.id, topic.key,
    topic.topic_type, topic.title, topic.body, topic.action_url, topic.is_required, topic.sort_order
  from public.journey_template_topics topic
  join public.journey_template_moments source_moment on source_moment.id = topic.moment_id
  join public.journey_template_roles source_role on source_role.id = topic.owner_role_id
  join public.journey_template_moments target_moment on target_moment.template_version_id = published_row.id and target_moment.key = source_moment.key
  join public.journey_template_roles target_role on target_role.template_version_id = published_row.id and target_role.key = source_role.key
  where topic.template_version_id = requested_draft_id;
  insert into public.journey_template_topic_audiences (tenant_id, hr_group_id, template_version_id, topic_id, role_id)
  select audience.tenant_id, audience.hr_group_id, published_row.id, target_topic.id, target_role.id
  from public.journey_template_topic_audiences audience
  join public.journey_template_topics source_topic on source_topic.id = audience.topic_id
  join public.journey_template_roles source_role on source_role.id = audience.role_id
  join public.journey_template_topics target_topic on target_topic.template_version_id = published_row.id and target_topic.key = source_topic.key
  join public.journey_template_roles target_role on target_role.template_version_id = published_row.id and target_role.key = source_role.key
  where audience.template_version_id = requested_draft_id;

  update public.journey_templates set lifecycle = 'PUBLISHED', current_published_version_id = published_row.id,
    updated_by_user_id = actor_id, updated_at = timezone('utc', now()) where id = draft_row.template_id;
  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (draft_row.tenant_id, 'journey_template', draft_row.template_id, actor_id, 'UPDATE',
    pg_catalog.jsonb_build_object('event', 'JOURNEY_TEMPLATE_PUBLISHED', 'draftId', requested_draft_id,
      'publishedVersionId', published_row.id, 'versionNumber', next_version, 'draftRevision', draft_row.revision));
  return pg_catalog.jsonb_build_object('id', draft_row.template_id, 'draftId', requested_draft_id,
    'publishedVersionId', published_row.id, 'versionNumber', next_version, 'revision', draft_row.revision);
end;
$$;

create or replace function internal_security.retire_journey_template_internal(requested_template_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  template_row public.journey_templates%rowtype;
begin
  if actor_id is null then raise exception 'JOURNEY_AUTHENTICATION_REQUIRED' using errcode = '28000'; end if;
  select * into template_row from public.journey_templates where id = requested_template_id for update;
  if not found then raise exception 'JOURNEY_TEMPLATE_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.current_user_has_hr_group_permission(template_row.tenant_id, template_row.hr_group_id, 'journey-template:publish') then
    raise exception 'JOURNEY_TEMPLATE_FORBIDDEN' using errcode = '42501';
  end if;
  update public.journey_templates set lifecycle = 'RETIRED', updated_by_user_id = actor_id,
    updated_at = timezone('utc', now()) where id = requested_template_id;
  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (template_row.tenant_id, 'journey_template', template_row.id, actor_id, 'UPDATE',
    pg_catalog.jsonb_build_object('event', 'JOURNEY_TEMPLATE_RETIRED'));
  return pg_catalog.jsonb_build_object('id', template_row.id, 'lifecycle', 'RETIRED');
end;
$$;

revoke all on function internal_security.create_journey_template_draft_internal(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function internal_security.save_journey_template_draft_internal(uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function internal_security.publish_journey_template_internal(uuid, integer) from public, anon, authenticated;
revoke all on function internal_security.retire_journey_template_internal(uuid) from public, anon, authenticated;

create or replace function public.create_journey_template_draft(requested_tenant_id uuid, requested_hr_group_id uuid, requested_key text, requested_draft jsonb)
returns jsonb language sql security invoker set search_path = pg_catalog
as $$ select internal_security.create_journey_template_draft_internal($1, $2, $3, $4); $$;
create or replace function public.save_journey_template_draft(requested_draft_id uuid, requested_expected_revision integer, requested_draft jsonb)
returns jsonb language sql security invoker set search_path = pg_catalog
as $$ select internal_security.save_journey_template_draft_internal($1, $2, $3); $$;
create or replace function public.publish_journey_template(requested_draft_id uuid, requested_expected_revision integer)
returns jsonb language sql security invoker set search_path = pg_catalog
as $$ select internal_security.publish_journey_template_internal($1, $2); $$;
create or replace function public.retire_journey_template(requested_template_id uuid)
returns jsonb language sql security invoker set search_path = pg_catalog
as $$ select internal_security.retire_journey_template_internal($1); $$;

revoke all on function public.create_journey_template_draft(uuid, uuid, text, jsonb) from public, anon;
revoke all on function public.save_journey_template_draft(uuid, integer, jsonb) from public, anon;
revoke all on function public.publish_journey_template(uuid, integer) from public, anon;
revoke all on function public.retire_journey_template(uuid) from public, anon;
grant execute on function public.create_journey_template_draft(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.save_journey_template_draft(uuid, integer, jsonb) to authenticated;
grant execute on function public.publish_journey_template(uuid, integer) to authenticated;
grant execute on function public.retire_journey_template(uuid) to authenticated;
grant execute on function internal_security.create_journey_template_draft_internal(uuid, uuid, text, jsonb) to authenticated;
grant execute on function internal_security.save_journey_template_draft_internal(uuid, integer, jsonb) to authenticated;
grant execute on function internal_security.publish_journey_template_internal(uuid, integer) to authenticated;
grant execute on function internal_security.retire_journey_template_internal(uuid) to authenticated;

create or replace function internal_security.protect_published_journey_template_content()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if old.status = 'PUBLISHED' then raise exception 'JOURNEY_TEMPLATE_PUBLISHED_IMMUTABLE' using errcode = '55000'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function internal_security.protect_published_journey_template_child()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if exists (select 1 from public.journey_template_versions version where version.id = old.template_version_id and version.status = 'PUBLISHED') then
    raise exception 'JOURNEY_TEMPLATE_PUBLISHED_IMMUTABLE' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger protect_published_journey_template_content before update or delete on public.journey_template_versions
for each row execute function internal_security.protect_published_journey_template_content();
create trigger protect_published_journey_template_phases before update or delete on public.journey_template_phases
for each row execute function internal_security.protect_published_journey_template_child();
create trigger protect_published_journey_template_roles before update or delete on public.journey_template_roles
for each row execute function internal_security.protect_published_journey_template_child();
create trigger protect_published_journey_template_moments before update or delete on public.journey_template_moments
for each row execute function internal_security.protect_published_journey_template_child();
create trigger protect_published_journey_template_topics before update or delete on public.journey_template_topics
for each row execute function internal_security.protect_published_journey_template_child();
create trigger protect_published_journey_template_audiences before update or delete on public.journey_template_topic_audiences
for each row execute function internal_security.protect_published_journey_template_child();

revoke all on function internal_security.protect_published_journey_template_content() from public, anon, authenticated;
revoke all on function internal_security.protect_published_journey_template_child() from public, anon, authenticated;

alter table public.journey_templates enable row level security;
alter table public.journey_template_versions enable row level security;
alter table public.journey_template_phases enable row level security;
alter table public.journey_template_roles enable row level security;
alter table public.journey_template_moments enable row level security;
alter table public.journey_template_topics enable row level security;
alter table public.journey_template_topic_audiences enable row level security;

create policy journey_templates_read on public.journey_templates for select to authenticated using (
  (select internal_security.journeys_module_enabled(tenant_id)) and
  ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey-template:read'))
   or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey-template:write'))
   or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey-template:publish')))
);
create policy journey_template_versions_read on public.journey_template_versions for select to authenticated using (
  (select internal_security.journeys_module_enabled(tenant_id)) and
  ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey-template:read'))
   or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey-template:write'))
   or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey-template:publish')))
);
create policy journey_template_phases_read on public.journey_template_phases for select to authenticated using (
  (select internal_security.journeys_module_enabled(tenant_id)) and
  ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey-template:read'))
   or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey-template:write'))
   or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey-template:publish')))
);
create policy journey_template_roles_read on public.journey_template_roles for select to authenticated using (
  (select internal_security.journeys_module_enabled(tenant_id)) and
  ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey-template:read'))
   or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey-template:write'))
   or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey-template:publish')))
);
create policy journey_template_moments_read on public.journey_template_moments for select to authenticated using (
  (select internal_security.journeys_module_enabled(tenant_id)) and
  ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey-template:read'))
   or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey-template:write'))
   or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey-template:publish')))
);
create policy journey_template_topics_read on public.journey_template_topics for select to authenticated using (
  (select internal_security.journeys_module_enabled(tenant_id)) and
  ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey-template:read'))
   or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey-template:write'))
   or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey-template:publish')))
);
create policy journey_template_topic_audiences_read on public.journey_template_topic_audiences for select to authenticated using (
  (select internal_security.journeys_module_enabled(tenant_id)) and
  ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey-template:read'))
   or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey-template:write'))
   or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey-template:publish')))
);

revoke all on table public.journey_templates from public, anon, authenticated;
revoke all on table public.journey_template_versions from public, anon, authenticated;
revoke all on table public.journey_template_phases from public, anon, authenticated;
revoke all on table public.journey_template_roles from public, anon, authenticated;
revoke all on table public.journey_template_moments from public, anon, authenticated;
revoke all on table public.journey_template_topics from public, anon, authenticated;
revoke all on table public.journey_template_topic_audiences from public, anon, authenticated;
revoke all on table public.journey_templates from anon;
revoke all on table public.journey_template_versions from anon;
revoke all on table public.journey_template_phases from anon;
revoke all on table public.journey_template_roles from anon;
revoke all on table public.journey_template_moments from anon;
revoke all on table public.journey_template_topics from anon;
revoke all on table public.journey_template_topic_audiences from anon;
grant select on table public.journey_templates to authenticated;
grant select on table public.journey_template_versions to authenticated;
grant select on table public.journey_template_phases to authenticated;
grant select on table public.journey_template_roles to authenticated;
grant select on table public.journey_template_moments to authenticated;
grant select on table public.journey_template_topics to authenticated;
grant select on table public.journey_template_topic_audiences to authenticated;

comment on function public.publish_journey_template(uuid, integer) is
  'Publiceert atomair een immutable Journey-templateversie na module-, HR-groep-, permission- en revisionchecks.';
