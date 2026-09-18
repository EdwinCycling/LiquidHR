begin;

-- A process remains the owner of lifecycle and assignment. These two columns
-- make the business boundary explicit and queryable without teaching the
-- generic engine about Leave or Actual Work fields.
alter table public.process_recipe_catalog
  add column if not exists business_type text not null default 'P_MUTATION',
  add column if not exists business_category text not null default 'GENERAL';

alter table public.process_definitions
  add column if not exists business_type text not null default 'P_MUTATION',
  add column if not exists business_category text not null default 'GENERAL';

alter table public.process_instances
  add column if not exists business_type text not null default 'P_MUTATION',
  add column if not exists business_category text not null default 'GENERAL';

alter table public.process_work_items
  add column if not exists business_type text not null default 'P_MUTATION',
  add column if not exists business_category text not null default 'GENERAL';

alter table public.process_recipe_catalog
  drop constraint if exists process_recipe_catalog_business_type_check,
  drop constraint if exists process_recipe_catalog_business_category_check;
alter table public.process_recipe_catalog
  add constraint process_recipe_catalog_business_type_check
    check (business_type in ('P_MUTATION', 'LEAVE', 'ACTUAL_WORK', 'OTHER')),
  add constraint process_recipe_catalog_business_category_check
    check (business_category in ('GENERAL', 'INTERNAL_TRANSFER', 'DOCUMENT_ACKNOWLEDGEMENT', 'LEAVE_REQUEST', 'ACTUAL_WORK_ENTRY'));

alter table public.process_definitions
  drop constraint if exists process_definitions_business_type_check,
  drop constraint if exists process_definitions_business_category_check;
alter table public.process_definitions
  add constraint process_definitions_business_type_check
    check (business_type in ('P_MUTATION', 'LEAVE', 'ACTUAL_WORK', 'OTHER')),
  add constraint process_definitions_business_category_check
    check (business_category in ('GENERAL', 'INTERNAL_TRANSFER', 'DOCUMENT_ACKNOWLEDGEMENT', 'LEAVE_REQUEST', 'ACTUAL_WORK_ENTRY'));

alter table public.process_instances
  drop constraint if exists process_instances_business_type_check,
  drop constraint if exists process_instances_business_category_check;
alter table public.process_instances
  add constraint process_instances_business_type_check
    check (business_type in ('P_MUTATION', 'LEAVE', 'ACTUAL_WORK', 'OTHER')),
  add constraint process_instances_business_category_check
    check (business_category in ('GENERAL', 'INTERNAL_TRANSFER', 'DOCUMENT_ACKNOWLEDGEMENT', 'LEAVE_REQUEST', 'ACTUAL_WORK_ENTRY'));

alter table public.process_work_items
  drop constraint if exists process_work_items_business_type_check,
  drop constraint if exists process_work_items_business_category_check;
alter table public.process_work_items
  add constraint process_work_items_business_type_check
    check (business_type in ('P_MUTATION', 'LEAVE', 'ACTUAL_WORK', 'OTHER')),
  add constraint process_work_items_business_category_check
    check (business_category in ('GENERAL', 'INTERNAL_TRANSFER', 'DOCUMENT_ACKNOWLEDGEMENT', 'LEAVE_REQUEST', 'ACTUAL_WORK_ENTRY'));

update public.process_recipe_catalog
set business_type = case when recipe_key = 'leave-request' then 'LEAVE' else 'P_MUTATION' end,
    business_category = case
      when recipe_key = 'internal-transfer' then 'INTERNAL_TRANSFER'
      when recipe_key = 'document-acknowledgement' then 'DOCUMENT_ACKNOWLEDGEMENT'
      when recipe_key = 'leave-request' then 'LEAVE_REQUEST'
      else 'GENERAL'
    end;

update public.process_definitions
set business_type = case when key = 'leave-request' then 'LEAVE' else 'P_MUTATION' end,
    business_category = case
      when key = 'internal-transfer' then 'INTERNAL_TRANSFER'
      when key = 'document-acknowledgement' then 'DOCUMENT_ACKNOWLEDGEMENT'
      when key = 'leave-request' then 'LEAVE_REQUEST'
      else 'GENERAL'
    end;

update public.process_instances instance
set business_type = definition.business_type,
    business_category = definition.business_category
from public.process_definitions definition
where definition.id = instance.process_definition_id
  and definition.tenant_id = instance.tenant_id
  and definition.hr_group_id = instance.hr_group_id;

update public.process_work_items item
set business_type = instance.business_type,
    business_category = instance.business_category
from public.process_instances instance
where instance.id = item.process_instance_id
  and instance.tenant_id = item.tenant_id
  and instance.hr_group_id = item.hr_group_id;

create index if not exists process_definitions_business_lookup_idx
  on public.process_definitions (tenant_id, hr_group_id, business_type, business_category, status, administration_id);
create index if not exists process_instances_business_lookup_idx
  on public.process_instances (tenant_id, hr_group_id, business_type, business_category, status, updated_at desc);
create index if not exists process_work_items_business_lookup_idx
  on public.process_work_items (tenant_id, hr_group_id, business_type, business_category, status, updated_at desc);

create or replace function internal_security.sync_process_business_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_type text;
  resolved_category text;
begin
  if tg_table_name = 'process_instances' then
    select definition.business_type, definition.business_category
      into resolved_type, resolved_category
    from public.process_definitions definition
    where definition.tenant_id = new.tenant_id
      and definition.hr_group_id = new.hr_group_id
      and definition.id = new.process_definition_id;
  else
    select instance.business_type, instance.business_category
      into resolved_type, resolved_category
    from public.process_instances instance
    where instance.tenant_id = new.tenant_id
      and instance.hr_group_id = new.hr_group_id
      and instance.id = new.process_instance_id;
  end if;

  new.business_type := coalesce(resolved_type, new.business_type, 'P_MUTATION');
  new.business_category := coalesce(resolved_category, new.business_category, 'GENERAL');
  return new;
end;
$$;

revoke all on function internal_security.sync_process_business_metadata() from public, anon, authenticated;

drop trigger if exists process_instances_business_metadata on public.process_instances;
create trigger process_instances_business_metadata
before insert or update on public.process_instances
for each row execute function internal_security.sync_process_business_metadata();

drop trigger if exists process_work_items_business_metadata on public.process_work_items;
create trigger process_work_items_business_metadata
before insert or update on public.process_work_items
for each row execute function internal_security.sync_process_business_metadata();

-- A recipe may be activated once per administration. Tenant-scoped recipes
-- retain a null administration id and use the all-zero UUID as the unique
-- index sentinel.
alter table public.process_recipe_activations
  add column if not exists scope_type public.access_scope_type,
  add column if not exists administration_id uuid;

update public.process_recipe_activations activation
set scope_type = definition.scope_type,
    administration_id = definition.administration_id
from public.process_definitions definition
where definition.id = activation.process_definition_id
  and definition.tenant_id = activation.tenant_id
  and definition.hr_group_id = activation.hr_group_id;

update public.process_recipe_activations
set scope_type = 'TENANT'::public.access_scope_type
where scope_type is null;

alter table public.process_recipe_activations
  alter column scope_type set default 'TENANT',
  alter column scope_type set not null;

alter table public.process_recipe_activations
  drop constraint if exists process_recipe_activation_scope_check,
  drop constraint if exists process_recipe_activation_administration_fkey,
  drop constraint if exists process_recipe_activation_unique;
alter table public.process_recipe_activations
  add constraint process_recipe_activation_scope_check check (
    (scope_type = 'TENANT'::public.access_scope_type and administration_id is null)
    or (scope_type = 'ADMINISTRATION'::public.access_scope_type and administration_id is not null)
  ),
  add constraint process_recipe_activation_administration_fkey
    foreign key (tenant_id, hr_group_id, administration_id)
    references public.administrations(tenant_id, hr_group_id, id)
    on delete restrict;

create unique index if not exists process_recipe_activation_scope_unique
  on public.process_recipe_activations (
    tenant_id,
    hr_group_id,
    process_recipe_id,
    scope_type,
    coalesce(administration_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
create index if not exists process_recipe_activations_administration_idx
  on public.process_recipe_activations (tenant_id, hr_group_id, administration_id, process_recipe_id);

-- The typed link is the only bridge from a Leave domain request to a process.
-- The table is deliberately inaccessible through the Data API; adapter
-- functions below are the server-side read/write boundary.
create unique index if not exists leave_requests_workflow_idempotency_unique
  on public.leave_requests (tenant_id, hr_group_id, idempotency_key);
create unique index if not exists leave_requests_tenant_hr_group_admin_id_key
  on public.leave_requests (tenant_id, hr_group_id, administration_id, id);

create table if not exists public.process_leave_subjects (
  process_instance_id uuid primary key,
  tenant_id uuid not null,
  hr_group_id uuid not null,
  administration_id uuid not null,
  leave_request_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint process_leave_subjects_instance_fkey
    foreign key (tenant_id, hr_group_id, process_instance_id)
    references public.process_instances(tenant_id, hr_group_id, id)
    on delete cascade,
  constraint process_leave_subjects_request_fkey
    foreign key (tenant_id, hr_group_id, administration_id, leave_request_id)
    references public.leave_requests(tenant_id, hr_group_id, administration_id, id)
    on delete cascade,
  constraint process_leave_subjects_request_unique unique (tenant_id, hr_group_id, leave_request_id),
  constraint process_leave_subjects_scope_check check (administration_id is not null)
);

create index if not exists process_leave_subjects_request_idx
  on public.process_leave_subjects (tenant_id, hr_group_id, leave_request_id);

alter table public.process_leave_subjects enable row level security;
drop policy if exists process_leave_subjects_no_direct_access on public.process_leave_subjects;
create policy process_leave_subjects_no_direct_access
  on public.process_leave_subjects for all to authenticated
  using (false) with check (false);
revoke all on table public.process_leave_subjects from public, anon, authenticated;

-- Self-service is intentionally separate from the legacy HR calendar write.
insert into public.permissions (code, name, category, description)
values (
  'self:leave:request',
  'Verlofaanvraag indienen',
  'Verlof',
  'Een medewerker mag een eigen verlofaanvraag indienen voor goedkeuring.'
)
on conflict (code) do update
set name = excluded.name, category = excluded.category, description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.tenant_id is null
  and role.code = 'EMPLOYEE'
  and permission.code = 'self:leave:request'
on conflict do nothing;

insert into public.permissions (code, name, category, description)
values (
  'self:process-instance:cancel',
  'Eigen proces annuleren',
  'Processen',
  'Een medewerker mag een eigen actieve procesaanvraag annuleren.'
)
on conflict (code) do update
set name = excluded.name, category = excluded.category, description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.tenant_id is null
  and role.code = 'EMPLOYEE'
  and permission.code = 'self:process-instance:cancel'
on conflict do nothing;

insert into public.process_recipe_catalog (
  recipe_key,
  recipe_version,
  title,
  description,
  adapter_key,
  definition_json,
  business_type,
  business_category
)
values (
  'leave-request',
  1,
  '{"nl":"Verlofaanvraag","en":"Leave request"}'::jsonb,
  '{"nl":"Een native verlofaanvraag met effectieve managergoedkeuring en een idempotente domeinboeking.","en":"A native leave request with effective-manager approval and an idempotent domain booking."}'::jsonb,
  'LEAVE_REQUEST',
  $recipe$
  {
    "schemaVersion": 1,
    "key": "leave-request",
    "status": "DRAFT",
    "title": {"nl": "Verlofaanvraag", "en": "Leave request"},
    "description": {"nl": "Een native verlofaanvraag met managergoedkeuring.", "en": "A native leave request with manager approval."},
    "enabledLanguages": ["nl", "en"],
    "startStepKey": "request",
    "participants": [
      {
        "key": "initiator",
        "label": {"nl": "Aanvrager", "en": "Initiator"},
        "selector": {"type": "INITIATOR", "resolutionDatePolicy": "STEP_ACTIVATED_AT"},
        "assignmentMode": "EXACTLY_ONE",
        "permission": "self:process-task:act"
      },
      {
        "key": "manager",
        "label": {"nl": "Effectieve manager", "en": "Effective manager"},
        "selector": {"type": "DIRECT_MANAGER_OF_SUBJECT", "resolutionDatePolicy": "BUSINESS_EFFECTIVE_DATE"},
        "assignmentMode": "EXACTLY_ONE",
        "permission": "process-task:act"
      }
    ],
    "forms": [],
    "steps": [
      {
        "key": "request",
        "type": "ACKNOWLEDGEMENT",
        "title": {"nl": "Verlofaanvraag indienen", "en": "Submit leave request"},
        "participantKey": "initiator",
        "allowedActions": ["ACKNOWLEDGE", "CANCEL"]
      },
      {
        "key": "manager-approval",
        "type": "DECISION",
        "title": {"nl": "Verlofaanvraag beoordelen", "en": "Review leave request"},
        "participantKey": "manager",
        "allowedActions": ["APPROVE", "REJECT", "REQUEST_CHANGES", "CANCEL"],
        "sla": {
          "duration": {"amount": 2, "unit": "DAYS"},
          "businessDays": true,
          "onBreach": "NOTIFY"
        }
      },
      {
        "key": "manager-approval-retry",
        "type": "DECISION",
        "title": {"nl": "Aangepaste verlofaanvraag beoordelen", "en": "Review updated leave request"},
        "participantKey": "manager",
        "allowedActions": ["APPROVE", "REJECT", "REQUEST_CHANGES", "CANCEL"],
        "sla": {
          "duration": {"amount": 2, "unit": "DAYS"},
          "businessDays": true,
          "onBreach": "NOTIFY"
        }
      },
      {
        "key": "employee-changes",
        "type": "ACKNOWLEDGEMENT",
        "title": {"nl": "Verlofaanvraag aanpassen", "en": "Update leave request"},
        "participantKey": "initiator",
        "allowedActions": ["ACKNOWLEDGE", "CANCEL"]
      },
      {
        "key": "completed",
        "type": "END",
        "title": {"nl": "Goedgekeurd", "en": "Approved"},
        "allowedActions": [],
        "terminalOutcome": "COMPLETED"
      },
      {
        "key": "rejected",
        "type": "END",
        "title": {"nl": "Afgewezen", "en": "Rejected"},
        "allowedActions": [],
        "terminalOutcome": "REJECTED"
      },
      {
        "key": "cancelled",
        "type": "END",
        "title": {"nl": "Geannuleerd", "en": "Cancelled"},
        "allowedActions": [],
        "terminalOutcome": "CANCELLED"
      }
    ],
    "transitions": [
      {
        "key": "request-acknowledge",
        "fromStepKey": "request",
        "toStepKey": "manager-approval",
        "action": "ACKNOWLEDGE",
        "kind": "FORWARD",
        "label": {"nl": "Aanvraag indienen", "en": "Submit request"}
      },
      {
        "key": "request-cancel",
        "fromStepKey": "request",
        "toStepKey": "cancelled",
        "action": "CANCEL",
        "kind": "FORWARD",
        "label": {"nl": "Annuleren", "en": "Cancel"}
      },
      {
        "key": "manager-approve",
        "fromStepKey": "manager-approval",
        "toStepKey": "completed",
        "action": "APPROVE",
        "kind": "FORWARD",
        "label": {"nl": "Goedkeuren", "en": "Approve"}
      },
      {
        "key": "manager-reject",
        "fromStepKey": "manager-approval",
        "toStepKey": "rejected",
        "action": "REJECT",
        "kind": "FORWARD",
        "label": {"nl": "Afwijzen", "en": "Reject"}
      },
      {
        "key": "manager-changes",
        "fromStepKey": "manager-approval",
        "toStepKey": "employee-changes",
        "action": "REQUEST_CHANGES",
        "kind": "RECOVERY",
        "label": {"nl": "Wijzigingen vragen", "en": "Request changes"}
      },
      {
        "key": "manager-cancel",
        "fromStepKey": "manager-approval",
        "toStepKey": "cancelled",
        "action": "CANCEL",
        "kind": "FORWARD",
        "label": {"nl": "Annuleren", "en": "Cancel"}
      },
      {
        "key": "employee-changes-acknowledge",
        "fromStepKey": "employee-changes",
        "toStepKey": "manager-approval-retry",
        "action": "ACKNOWLEDGE",
        "kind": "FORWARD",
        "label": {"nl": "Opnieuw indienen", "en": "Resubmit request"}
      },
      {
        "key": "employee-changes-cancel",
        "fromStepKey": "employee-changes",
        "toStepKey": "cancelled",
        "action": "CANCEL",
        "kind": "FORWARD",
        "label": {"nl": "Annuleren", "en": "Cancel"}
      },
      {
        "key": "manager-retry-approve",
        "fromStepKey": "manager-approval-retry",
        "toStepKey": "completed",
        "action": "APPROVE",
        "kind": "FORWARD",
        "label": {"nl": "Goedkeuren", "en": "Approve"}
      },
      {
        "key": "manager-retry-reject",
        "fromStepKey": "manager-approval-retry",
        "toStepKey": "rejected",
        "action": "REJECT",
        "kind": "FORWARD",
        "label": {"nl": "Afwijzen", "en": "Reject"}
      },
      {
        "key": "manager-retry-changes",
        "fromStepKey": "manager-approval-retry",
        "toStepKey": "employee-changes",
        "action": "REQUEST_CHANGES",
        "kind": "RECOVERY",
        "label": {"nl": "Wijzigingen vragen", "en": "Request changes"}
      },
      {
        "key": "manager-retry-cancel",
        "fromStepKey": "manager-approval-retry",
        "toStepKey": "cancelled",
        "action": "CANCEL",
        "kind": "FORWARD",
        "label": {"nl": "Annuleren", "en": "Cancel"}
      }
    ]
  }
  $recipe$::jsonb,
  'LEAVE',
  'LEAVE_REQUEST'
)
on conflict (recipe_key, recipe_version) do update
set title = excluded.title,
    description = excluded.description,
    adapter_key = excluded.adapter_key,
    definition_json = excluded.definition_json,
    business_type = excluded.business_type,
    business_category = excluded.business_category,
    status = excluded.status;

create or replace function internal_security.activate_process_recipe_internal(
  requested_recipe_id uuid,
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_scope_type public.access_scope_type,
  requested_administration_id uuid,
  requested_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  recipe_row public.process_recipe_catalog%rowtype;
  activation_row public.process_recipe_activations%rowtype;
  definition_result jsonb;
  definition_id uuid;
  definition_key text;
  definition_json jsonb;
begin
  if actor_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if not internal_security.current_user_has_hr_group_permission(
    requested_tenant_id, requested_hr_group_id, 'process-definition:write'
  ) then
    raise exception 'PROCESS_RECIPE_FORBIDDEN' using errcode = '42501';
  end if;
  if requested_scope_type = 'TENANT'::public.access_scope_type
     and requested_administration_id is not null then
    raise exception 'PROCESS_RECIPE_SCOPE_INVALID' using errcode = '22023';
  end if;
  if requested_scope_type = 'ADMINISTRATION'::public.access_scope_type
     and requested_administration_id is null then
    raise exception 'PROCESS_RECIPE_SCOPE_INVALID' using errcode = '22023';
  end if;

  select recipe.* into recipe_row
  from public.process_recipe_catalog recipe
  where recipe.id = requested_recipe_id
    and recipe.status = 'PUBLISHED';
  if recipe_row.id is null then
    raise exception 'PROCESS_RECIPE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select activation.* into activation_row
  from public.process_recipe_activations activation
  where activation.tenant_id = requested_tenant_id
    and activation.hr_group_id = requested_hr_group_id
    and activation.process_recipe_id = requested_recipe_id
    and activation.scope_type = requested_scope_type
    and activation.administration_id is not distinct from requested_administration_id;
  if activation_row.id is not null then
    return jsonb_build_object(
      'activationId', activation_row.id,
      'processDefinitionId', activation_row.process_definition_id,
      'recipeId', recipe_row.id,
      'recipeKey', recipe_row.recipe_key,
      'recipeVersion', recipe_row.recipe_version,
      'existing', true
    );
  end if;

  definition_key := coalesce(
    nullif(btrim(requested_key), ''),
    recipe_row.recipe_key || '-v' || recipe_row.recipe_version::text
  );
  if definition_key !~ '^[a-z][a-z0-9_-]*$' then
    raise exception 'PROCESS_RECIPE_INVALID_KEY' using errcode = '22023';
  end if;
  definition_json := jsonb_set(recipe_row.definition_json, '{key}', to_jsonb(definition_key), true);

  select public.create_process_definition_draft(
    requested_tenant_id,
    requested_hr_group_id,
    requested_scope_type,
    requested_administration_id,
    definition_key,
    recipe_row.title,
    recipe_row.description,
    definition_json,
    jsonb_build_object(
      'source', 'CERTIFIED_RECIPE',
      'recipeKey', recipe_row.recipe_key,
      'recipeVersion', recipe_row.recipe_version,
      'adapterKey', recipe_row.adapter_key
    )
  ) into definition_result;
  definition_id := (definition_result ->> 'id')::uuid;

  update public.process_definitions
  set business_type = recipe_row.business_type,
      business_category = recipe_row.business_category
  where id = definition_id
    and tenant_id = requested_tenant_id
    and hr_group_id = requested_hr_group_id;

  insert into public.process_recipe_activations (
    tenant_id,
    hr_group_id,
    process_recipe_id,
    process_definition_id,
    activated_by_user_id,
    scope_type,
    administration_id
  )
  values (
    requested_tenant_id,
    requested_hr_group_id,
    requested_recipe_id,
    definition_id,
    actor_id,
    requested_scope_type,
    requested_administration_id
  )
  returning * into activation_row;

  insert into public.audit_logs (
    tenant_id, entity_name, entity_id, actor_user_id, action, changes
  )
  values (
    requested_tenant_id,
    'process_recipe_activation',
    activation_row.id,
    actor_id,
    'CREATE',
    jsonb_build_object(
      'recipeKey', recipe_row.recipe_key,
      'recipeVersion', recipe_row.recipe_version,
      'processDefinitionId', definition_id,
      'scopeType', requested_scope_type,
      'administrationId', requested_administration_id
    )
  );

  return jsonb_build_object(
    'activationId', activation_row.id,
    'processDefinitionId', definition_id,
    'recipeId', recipe_row.id,
    'recipeKey', recipe_row.recipe_key,
    'recipeVersion', recipe_row.recipe_version,
    'definitionKey', definition_key,
    'existing', false
  );
end;
$$;

create or replace function public.activate_process_recipe(
  requested_recipe_id uuid,
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_scope_type public.access_scope_type,
  requested_administration_id uuid,
  requested_key text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.activate_process_recipe_internal(
    requested_recipe_id,
    requested_tenant_id,
    requested_hr_group_id,
    requested_scope_type,
    requested_administration_id,
    requested_key
  );
$$;

revoke all on function internal_security.activate_process_recipe_internal(uuid, uuid, uuid, public.access_scope_type, uuid, text)
  from public, anon, authenticated;
revoke all on function public.activate_process_recipe(uuid, uuid, uuid, public.access_scope_type, uuid, text)
  from public, anon;
grant execute on function public.activate_process_recipe(uuid, uuid, uuid, public.access_scope_type, uuid, text)
  to authenticated;

create or replace function internal_security.calculate_leave_workflow_minutes(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_start_date date,
  requested_end_date date,
  requested_time_mode public.leave_request_time_mode,
  requested_specific_start time,
  requested_specific_end time
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  employment_row public.employments%rowtype;
  schedule_row public.employment_schedules%rowtype;
  selected_day date;
  day_hours numeric := 0;
  total_minutes integer := 0;
  half_day_minutes integer := 240;
begin
  if requested_end_date < requested_start_date then
    raise exception 'LEAVE_PERIOD_INVALID' using errcode = '22023';
  end if;
  if requested_time_mode = 'SPECIFIC_HOURS'
     and (
       requested_start_date <> requested_end_date
       or requested_specific_start is null
       or requested_specific_end is null
       or requested_specific_end <= requested_specific_start
     ) then
    raise exception 'LEAVE_TIME_SELECTION_INVALID' using errcode = '22023';
  end if;

  select employment.* into employment_row
  from public.employments employment
  where employment.tenant_id = requested_tenant_id
    and employment.hr_group_id = requested_hr_group_id
    and employment.employee_id = requested_employee_id
    and employment.id = requested_employment_id
    and employment.record_status = 'CONFIRMED'
    and employment.deleted_at is null;
  if employment_row.id is null then
    raise exception 'LEAVE_EMPLOYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if requested_start_date < employment_row.starts_on
     or (
       employment_row.ends_on is not null
       and requested_end_date > employment_row.ends_on
     ) then
    raise exception 'LEAVE_EMPLOYMENT_DATE_INVALID' using errcode = '22023';
  end if;

  select coalesce(settings.half_day_minutes, 240)
    into half_day_minutes
  from public.leave_settings settings
  where settings.tenant_id = requested_tenant_id
    and settings.hr_group_id = requested_hr_group_id
  limit 1;
  half_day_minutes := coalesce(half_day_minutes, 240);

  for selected_day in
    select generate_series(requested_start_date, requested_end_date, interval '1 day')::date
  loop
    select schedule.* into schedule_row
    from public.employment_schedules schedule
    where schedule.tenant_id = requested_tenant_id
      and schedule.administration_id = employment_row.administration_id
      and schedule.employee_id = requested_employee_id
      and schedule.employment_id = requested_employment_id
      and schedule.valid_from <= selected_day
      and (schedule.valid_until is null or schedule.valid_until >= selected_day)
    order by schedule.valid_from desc
    limit 1;

    day_hours := case extract(isodow from selected_day)::integer
      when 1 then coalesce(schedule_row.monday_hours, 0)
      when 2 then coalesce(schedule_row.tuesday_hours, 0)
      when 3 then coalesce(schedule_row.wednesday_hours, 0)
      when 4 then coalesce(schedule_row.thursday_hours, 0)
      when 5 then coalesce(schedule_row.friday_hours, 0)
      when 6 then coalesce(schedule_row.saturday_hours, 0)
      when 7 then coalesce(schedule_row.sunday_hours, 0)
      else 0
    end;

    if exists (
      select 1
      from public.holidays holiday
      where holiday.tenant_id = requested_tenant_id
        and holiday.hr_group_id = requested_hr_group_id
        and holiday.holiday_date = selected_day
        and holiday.is_active
    ) then
      day_hours := 0;
    end if;

    if requested_time_mode = 'FULL_DAY' then
      total_minutes := total_minutes + round(day_hours * 60)::integer;
    elsif requested_time_mode in ('MORNING', 'AFTERNOON') then
      total_minutes := total_minutes + least(half_day_minutes, round(day_hours * 60)::integer);
    else
      total_minutes := round(
        extract(epoch from (requested_specific_end - requested_specific_start)) / 60
      )::integer;
    end if;
  end loop;

  if total_minutes <= 0 then
    raise exception 'LEAVE_NO_SCHEDULED_TIME' using errcode = '22023';
  end if;
  return total_minutes;
end;
$$;

revoke all on function internal_security.calculate_leave_workflow_minutes(uuid, uuid, uuid, uuid, date, date, public.leave_request_time_mode, time, time)
  from public, anon, authenticated;

create or replace function internal_security.leave_workflow_type_ids(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_employment_id uuid,
  requested_mode public.leave_request_mode,
  requested_priority_rule_id uuid,
  requested_leave_type_id uuid,
  requested_start_date date,
  requested_end_date date
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  type_ids uuid[];
  profile_id uuid;
  rule_profile_id uuid;
begin
  if requested_mode = 'DIRECT' then
    if requested_leave_type_id is null then
      raise exception 'LEAVE_TYPE_REQUIRED' using errcode = '22023';
    end if;
    if not exists (
      select 1
      from public.leave_types type
      where type.id = requested_leave_type_id
        and type.tenant_id = requested_tenant_id
        and type.hr_group_id = requested_hr_group_id
        and type.is_active
        and type.is_self_service
    ) then
      raise exception 'LEAVE_TYPE_NOT_FOUND' using errcode = 'P0002';
    end if;
    return array[requested_leave_type_id];
  end if;

  if requested_priority_rule_id is null then
    raise exception 'LEAVE_PRIORITY_RULE_REQUIRED' using errcode = '22023';
  end if;
  profile_id := public.resolve_leave_profile_for_employment(
    requested_tenant_id,
    requested_hr_group_id,
    requested_employment_id,
    requested_start_date
  );
  select rule.leave_profile_id
    into rule_profile_id
  from public.leave_priority_rules rule
  where rule.id = requested_priority_rule_id
    and rule.tenant_id = requested_tenant_id
    and rule.hr_group_id = requested_hr_group_id
    and rule.is_active
    and rule.valid_from <= requested_start_date
    and (rule.valid_until is null or rule.valid_until >= requested_end_date);
  if rule_profile_id is null
     or (profile_id is not null and rule_profile_id <> profile_id) then
    raise exception 'LEAVE_PRIORITY_RULE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select array_agg(item.leave_type_id order by item.sort_order)
    into type_ids
  from public.leave_priority_rule_items item
  where item.tenant_id = requested_tenant_id
    and item.hr_group_id = requested_hr_group_id
    and item.priority_rule_id = requested_priority_rule_id;
  if type_ids is null or cardinality(type_ids) = 0 then
    raise exception 'LEAVE_PRIORITY_RULE_EMPTY' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(type_ids) selected_type
    where not exists (
      select 1
      from public.leave_types type
      where type.id = selected_type
        and type.tenant_id = requested_tenant_id
        and type.hr_group_id = requested_hr_group_id
        and type.is_active
        and type.is_self_service
    )
  ) then
    raise exception 'LEAVE_PRIORITY_RULE_INVALID' using errcode = '22023';
  end if;
  return type_ids;
end;
$$;

revoke all on function internal_security.leave_workflow_type_ids(uuid, uuid, uuid, public.leave_request_mode, uuid, uuid, date, date)
  from public, anon, authenticated;

create or replace function internal_security.start_leave_request_workflow_internal(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_mode public.leave_request_mode,
  requested_priority_rule_id uuid,
  requested_leave_type_id uuid,
  requested_start_date date,
  requested_end_date date,
  requested_time_mode public.leave_request_time_mode,
  requested_specific_start time,
  requested_specific_end time,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_employee_id uuid;
  employment_row public.employments%rowtype;
  definition_row public.process_definitions%rowtype;
  existing_request public.leave_requests%rowtype;
  request_id uuid;
  instance_id uuid;
  request_item public.process_work_items%rowtype;
  active_item public.process_work_items%rowtype;
  step_expected_version bigint;
  type_ids uuid[];
  total_minutes integer;
  start_result jsonb;
  action_result jsonb;
  event_id uuid;
  correlation_id uuid := coalesce(requested_correlation_id, extensions.gen_random_uuid());
begin
  if actor_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if requested_idempotency_key is null
     or length(btrim(requested_idempotency_key)) < 8
     or length(btrim(requested_idempotency_key)) > 160 then
    raise exception 'LEAVE_IDEMPOTENCY_KEY_REQUIRED' using errcode = '22023';
  end if;
  if not internal_security.current_user_has_hr_group_permission(
    requested_tenant_id, requested_hr_group_id, 'self:leave:request'
  ) then
    raise exception 'LEAVE_REQUEST_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  actor_employee_id := internal_security.current_employee_id(
    requested_tenant_id, requested_hr_group_id
  );
  if actor_employee_id is null or actor_employee_id <> requested_employee_id then
    raise exception 'LEAVE_SELF_SCOPE_REQUIRED' using errcode = '42501';
  end if;

  select request.* into existing_request
  from public.leave_requests request
  where request.tenant_id = requested_tenant_id
    and request.hr_group_id = requested_hr_group_id
    and request.idempotency_key = btrim(requested_idempotency_key)
  for update;
  if existing_request.id is not null then
    if existing_request.actor_user_id <> actor_id
       or existing_request.employee_id <> requested_employee_id
       or existing_request.employment_id <> requested_employment_id
       or existing_request.request_mode <> requested_mode
       or existing_request.start_date <> requested_start_date
       or existing_request.end_date <> requested_end_date
       or existing_request.time_mode <> requested_time_mode
       or existing_request.leave_type_id is distinct from requested_leave_type_id
       or existing_request.priority_rule_id is distinct from requested_priority_rule_id then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = 'P0001';
    end if;
    select link.process_instance_id into instance_id
    from public.process_leave_subjects link
    where link.tenant_id = existing_request.tenant_id
      and link.hr_group_id = existing_request.hr_group_id
      and link.leave_request_id = existing_request.id;
    if instance_id is null then
      raise exception 'LEAVE_WORKFLOW_LINK_MISSING' using errcode = 'P0001';
    end if;
    select event.id into event_id
    from public.process_events event
    where event.tenant_id = existing_request.tenant_id
      and event.hr_group_id = existing_request.hr_group_id
      and event.process_instance_id = instance_id
      and event.idempotency_key = btrim(requested_idempotency_key)
    order by event.sequence_number
    limit 1;
    select item.* into active_item
    from public.process_work_items item
    where item.tenant_id = existing_request.tenant_id
      and item.hr_group_id = existing_request.hr_group_id
      and item.process_instance_id = instance_id
      and item.status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status)
    order by item.created_at desc, item.id
    limit 1;
    return internal_security.process_runtime_result(
      existing_request.tenant_id,
      existing_request.hr_group_id,
      instance_id,
      event_id
    ) || jsonb_build_object(
      'requestId', existing_request.id,
      'workItemId', active_item.id,
      'businessStatus', case existing_request.status
        when 'PENDING'::public.leave_request_status then 'WAITING'
        when 'CHANGES_REQUESTED'::public.leave_request_status then 'CHANGES_REQUESTED'
        when 'APPROVED'::public.leave_request_status then 'COMPLETED'
        when 'REJECTED'::public.leave_request_status then 'REJECTED'
        when 'CANCELLED'::public.leave_request_status then 'CANCELLED'
      end,
      'existing', true
    );
  end if;

  select employment.* into employment_row
  from public.employments employment
  where employment.tenant_id = requested_tenant_id
    and employment.hr_group_id = requested_hr_group_id
    and employment.employee_id = requested_employee_id
    and employment.id = requested_employment_id
    and employment.administration_id = requested_administration_id
    and employment.record_status = 'CONFIRMED'
    and employment.deleted_at is null
  for update;
  if employment_row.id is null then
    raise exception 'LEAVE_EMPLOYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if requested_end_date < requested_start_date
     or requested_start_date < employment_row.starts_on
     or (employment_row.ends_on is not null and requested_end_date > employment_row.ends_on) then
    raise exception 'LEAVE_EMPLOYMENT_DATE_INVALID' using errcode = '22023';
  end if;

  total_minutes := internal_security.calculate_leave_workflow_minutes(
    requested_tenant_id,
    requested_hr_group_id,
    requested_employee_id,
    requested_employment_id,
    requested_start_date,
    requested_end_date,
    requested_time_mode,
    requested_specific_start,
    requested_specific_end
  );
  type_ids := internal_security.leave_workflow_type_ids(
    requested_tenant_id,
    requested_hr_group_id,
    requested_employment_id,
    requested_mode,
    requested_priority_rule_id,
    requested_leave_type_id,
    requested_start_date,
    requested_end_date
  );

  select definition.* into definition_row
  from public.process_definitions definition
  where definition.tenant_id = requested_tenant_id
    and definition.hr_group_id = requested_hr_group_id
    and definition.status = 'PUBLISHED'::public.process_definition_status
    and definition.business_type = 'LEAVE'
    and definition.scope_type = 'ADMINISTRATION'::public.access_scope_type
    and definition.administration_id = requested_administration_id
  order by
    case when definition.scope_type = 'ADMINISTRATION'::public.access_scope_type then 0 else 1 end,
    definition.updated_at desc,
    definition.id
  limit 1;
  if definition_row.id is null then
    raise exception 'LEAVE_WORKFLOW_NOT_CONFIGURED' using errcode = 'P0002';
  end if;

  insert into public.leave_requests (
    tenant_id,
    hr_group_id,
    administration_id,
    employee_id,
    employment_id,
    request_mode,
    priority_rule_id,
    leave_type_id,
    start_date,
    end_date,
    time_mode,
    specific_start,
    specific_end,
    requested_minutes,
    status,
    source,
    idempotency_key,
    actor_user_id
  )
  values (
    requested_tenant_id,
    requested_hr_group_id,
    requested_administration_id,
    requested_employee_id,
    requested_employment_id,
    requested_mode,
    requested_priority_rule_id,
    requested_leave_type_id,
    requested_start_date,
    requested_end_date,
    requested_time_mode,
    requested_specific_start,
    requested_specific_end,
    total_minutes,
    'PENDING'::public.leave_request_status,
    'ESS_PROCESS_AUTOMATION',
    btrim(requested_idempotency_key),
    actor_id
  )
  returning id into request_id;

  select internal_security.start_process(
    definition_row.id,
    requested_employee_id,
    requested_employment_id,
    requested_start_date,
    btrim(requested_idempotency_key),
    correlation_id
  ) into start_result;
  instance_id := (start_result ->> 'processInstanceId')::uuid;

  insert into public.process_leave_subjects (
    process_instance_id,
    tenant_id,
    hr_group_id,
    administration_id,
    leave_request_id
  )
  values (
    instance_id,
    requested_tenant_id,
    requested_hr_group_id,
    requested_administration_id,
    request_id
  );

  select item.* into request_item
  from public.process_work_items item
  where item.tenant_id = requested_tenant_id
    and item.hr_group_id = requested_hr_group_id
    and item.process_instance_id = instance_id
    and item.step_key = 'request'
    and item.status = 'OPEN'::public.process_work_item_status
  order by item.created_at desc, item.id
  limit 1;
  if request_item.id is null then
    raise exception 'LEAVE_WORKFLOW_REQUEST_STEP_MISSING' using errcode = 'P0001';
  end if;
  select step.expected_version into step_expected_version
  from public.process_step_instances step
  where step.id = request_item.step_instance_id;

  select internal_security.perform_process_work_item_action(
    request_item.id,
    'ACKNOWLEDGE',
    request_item.expected_version,
    step_expected_version,
    btrim(requested_idempotency_key) || ':submitted',
    correlation_id
  ) into action_result;

  select item.* into active_item
  from public.process_work_items item
  where item.tenant_id = requested_tenant_id
    and item.hr_group_id = requested_hr_group_id
    and item.process_instance_id = instance_id
    and item.status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status)
  order by item.created_at desc, item.id
  limit 1;
  return action_result || jsonb_build_object(
    'requestId', request_id,
    'workItemId', active_item.id,
    'businessStatus', 'WAITING',
    'existing', false,
    'requestedMinutes', total_minutes,
    'leaveTypeIds', to_jsonb(type_ids)
  );
end;
$$;

revoke all on function internal_security.start_leave_request_workflow_internal(uuid, uuid, uuid, uuid, uuid, public.leave_request_mode, uuid, uuid, date, date, public.leave_request_time_mode, time, time, text, uuid)
  from public, anon, authenticated;

create or replace function internal_security.book_leave_request_workflow(
  requested_request_id uuid,
  requested_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.leave_requests%rowtype;
  employment_row public.employments%rowtype;
  schedule_row public.employment_schedules%rowtype;
  leave_type_row public.leave_types%rowtype;
  bucket_row public.leave_balance_buckets%rowtype;
  selected_day date;
  type_id uuid;
  type_ids uuid[];
  total_minutes integer;
  requested_hours numeric;
  remaining_hours numeric;
  available_hours numeric;
  allocated_hours numeric;
  used_hours numeric;
  annual_limit numeric;
  part_time_factor numeric;
  allocation_order smallint := 0;
  allocation_count integer := 0;
  profile_id uuid;
begin
  select request.* into request_row
  from public.leave_requests request
  where request.id = requested_request_id
  for update;
  if request_row.id is null then
    raise exception 'LEAVE_REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if request_row.status = 'APPROVED'::public.leave_request_status then
    return jsonb_build_object(
      'requestId', request_row.id,
      'status', request_row.status,
      'requestedMinutes', request_row.requested_minutes,
      'alreadyBooked', true
    );
  end if;
  if request_row.status <> 'PENDING'::public.leave_request_status then
    raise exception 'LEAVE_REQUEST_NOT_BOOKABLE' using errcode = 'P0001';
  end if;

  select employment.* into employment_row
  from public.employments employment
  where employment.tenant_id = request_row.tenant_id
    and employment.hr_group_id = request_row.hr_group_id
    and employment.administration_id = request_row.administration_id
    and employment.employee_id = request_row.employee_id
    and employment.id = request_row.employment_id
    and employment.record_status = 'CONFIRMED'
    and employment.deleted_at is null
  for update;
  if employment_row.id is null then
    raise exception 'LEAVE_EMPLOYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if request_row.start_date < employment_row.starts_on
     or (employment_row.ends_on is not null and request_row.end_date > employment_row.ends_on) then
    raise exception 'LEAVE_EMPLOYMENT_DATE_INVALID' using errcode = '22023';
  end if;

  total_minutes := internal_security.calculate_leave_workflow_minutes(
    request_row.tenant_id,
    request_row.hr_group_id,
    request_row.employee_id,
    request_row.employment_id,
    request_row.start_date,
    request_row.end_date,
    request_row.time_mode,
    request_row.specific_start,
    request_row.specific_end
  );
  if total_minutes <> request_row.requested_minutes then
    update public.leave_requests
    set requested_minutes = total_minutes,
        updated_at = timezone('utc', now())
    where id = request_row.id;
    request_row.requested_minutes := total_minutes;
  end if;
  requested_hours := round((total_minutes::numeric / 60)::numeric, 4);

  type_ids := internal_security.leave_workflow_type_ids(
    request_row.tenant_id,
    request_row.hr_group_id,
    request_row.employment_id,
    request_row.request_mode,
    request_row.priority_rule_id,
    request_row.leave_type_id,
    request_row.start_date,
    request_row.end_date
  );

  select schedule.part_time_factor into part_time_factor
  from public.employment_schedules schedule
  where schedule.tenant_id = request_row.tenant_id
    and schedule.administration_id = request_row.administration_id
    and schedule.employee_id = request_row.employee_id
    and schedule.employment_id = request_row.employment_id
    and schedule.valid_from <= request_row.start_date
    and (schedule.valid_until is null or schedule.valid_until >= request_row.start_date)
  order by schedule.valid_from desc
  limit 1;

  remaining_hours := requested_hours;
  foreach type_id in array type_ids loop
    select type.* into leave_type_row
    from public.leave_types type
    where type.tenant_id = request_row.tenant_id
      and type.hr_group_id = request_row.hr_group_id
      and type.id = type_id
      and type.is_active;
    if leave_type_row.id is null then
      raise exception 'LEAVE_TYPE_NOT_FOUND' using errcode = 'P0002';
    end if;

    if leave_type_row.entitlement_mode in (
      'ANNUAL_HOURS_CAP'::public.leave_type_entitlement_mode,
      'ANNUAL_HOURS_FTE_CAP'::public.leave_type_entitlement_mode
    ) then
      annual_limit := case
        when leave_type_row.entitlement_mode = 'ANNUAL_HOURS_CAP'::public.leave_type_entitlement_mode
          then leave_type_row.annual_hours_cap
        when part_time_factor is null
          then null
        else leave_type_row.annual_hours_fte_cap * part_time_factor
      end;
      if leave_type_row.entitlement_mode = 'ANNUAL_HOURS_FTE_CAP'::public.leave_type_entitlement_mode
         and part_time_factor is null then
        raise exception 'LEAVE_PART_TIME_FACTOR_REQUIRED' using errcode = '22023';
      end if;
      if annual_limit is not null then
        select coalesce(sum(abs(transaction.amount)), 0)
          into used_hours
        from public.leave_accrual_transactions transaction
        where transaction.tenant_id = request_row.tenant_id
          and transaction.hr_group_id = request_row.hr_group_id
          and transaction.employment_id = request_row.employment_id
          and transaction.leave_type_id = type_id
          and transaction.transaction_type = 'TAKEN'::public.leave_transaction_type
          and transaction.transaction_date between
            make_date(extract(year from request_row.start_date)::integer, 1, 1)
            and make_date(extract(year from request_row.start_date)::integer, 12, 31);
        if used_hours + remaining_hours > annual_limit then
          raise exception 'LEAVE_ANNUAL_LIMIT_EXCEEDED' using errcode = '23514';
        end if;
      end if;
    end if;

    if leave_type_row.entitlement_mode = 'UNLIMITED'::public.leave_type_entitlement_mode then
      allocation_order := allocation_order + 1;
      insert into public.leave_request_allocations (
        tenant_id, hr_group_id, administration_id, request_id, employee_id,
        employment_id, leave_type_id, bucket_id, allocated_hours, sort_order
      )
      values (
        request_row.tenant_id, request_row.hr_group_id, request_row.administration_id,
        request_row.id, request_row.employee_id, request_row.employment_id,
        type_id, null, remaining_hours, allocation_order
      );
      allocation_count := allocation_count + 1;
      remaining_hours := 0;
      exit;
    end if;

    for bucket_row in
      select bucket.*
      from public.leave_balance_buckets bucket
      where bucket.tenant_id = request_row.tenant_id
        and bucket.hr_group_id = request_row.hr_group_id
        and bucket.employee_id = request_row.employee_id
        and bucket.employment_id = request_row.employment_id
        and bucket.leave_type_id = type_id
        and bucket.expiration_date > request_row.start_date
        and bucket.total_accrued > bucket.total_taken + bucket.total_expired
      order by bucket.expiration_date, bucket.accrual_year, bucket.id
      for update
    loop
      available_hours := bucket_row.total_accrued - bucket_row.total_taken - bucket_row.total_expired;
      allocated_hours := least(remaining_hours, available_hours);
      if allocated_hours > 0 then
        allocation_order := allocation_order + 1;
        insert into public.leave_request_allocations (
          tenant_id, hr_group_id, administration_id, request_id, employee_id,
          employment_id, leave_type_id, bucket_id, allocated_hours, sort_order
        )
        values (
          request_row.tenant_id, request_row.hr_group_id, bucket_row.administration_id,
          request_row.id, request_row.employee_id, request_row.employment_id,
          type_id, bucket_row.id, allocated_hours, allocation_order
        );
        update public.leave_balance_buckets
        set total_taken = total_taken + allocated_hours,
            updated_at = timezone('utc', now())
        where id = bucket_row.id;
        insert into public.leave_accrual_transactions (
          tenant_id, hr_group_id, administration_id, employee_id, employment_id,
          leave_type_id, bucket_id, transaction_type, amount, reason,
          actor_user_id, source_type, source_id, source_key, transaction_date
        )
        values (
          request_row.tenant_id, request_row.hr_group_id, bucket_row.administration_id,
          request_row.employee_id, request_row.employment_id, type_id, bucket_row.id,
          'TAKEN'::public.leave_transaction_type, -allocated_hours,
          'Verlofaanvraag via workflow', requested_actor_user_id,
          'ESS_LEAVE_WORKFLOW', request_row.id,
          request_row.id::text || ':' || bucket_row.id::text,
          request_row.start_date
        );
        allocation_count := allocation_count + 1;
        remaining_hours := remaining_hours - allocated_hours;
      end if;
      exit when remaining_hours <= 0;
    end loop;
    exit when remaining_hours <= 0;
  end loop;

  if remaining_hours > 0 then
    raise exception 'LEAVE_INSUFFICIENT_BALANCE' using errcode = '23514';
  end if;

  update public.leave_requests
  set status = 'APPROVED'::public.leave_request_status,
      updated_at = timezone('utc', now())
  where id = request_row.id;

  return jsonb_build_object(
    'requestId', request_row.id,
    'status', 'APPROVED',
    'requestedMinutes', total_minutes,
    'allocationCount', allocation_count,
    'alreadyBooked', false
  );
end;
$$;

revoke all on function internal_security.book_leave_request_workflow(uuid, uuid)
  from public, anon, authenticated;

-- Native Leave actions are an adapter boundary. The generic engine still owns
-- the transition, assignment, optimistic versions and immutable events; this
-- function owns only the Leave validation/status/ledger side effect.
create or replace function internal_security.perform_leave_workflow_action_internal(
  requested_work_item_id uuid,
  requested_action text,
  requested_expected_version bigint,
  requested_step_expected_version bigint,
  requested_idempotency_key text,
  requested_correlation_id uuid,
  requested_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  link_row public.process_leave_subjects%rowtype;
  request_row public.leave_requests%rowtype;
  actor_user_id uuid := auth.uid();
  actor_employee_id uuid;
  existing_event_id uuid;
  existing_actor_user_id uuid;
  existing_event_work_item_id uuid;
  existing_event_action text;
  action_result jsonb;
  booking_result jsonb;
  commit_result jsonb;
  correlation_id uuid;
begin
  if actor_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if requested_action not in ('ACKNOWLEDGE', 'APPROVE', 'REJECT', 'REQUEST_CHANGES', 'CANCEL') then
    raise exception 'FORBIDDEN_ACTION' using errcode = '42501';
  end if;
  if requested_idempotency_key is null or pg_catalog.btrim(requested_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001';
  end if;

  select instance.* into instance_row
  from public.process_instances instance
  join public.process_work_items item
    on item.tenant_id = instance.tenant_id
   and item.hr_group_id = instance.hr_group_id
   and item.process_instance_id = instance.id
   and item.id = requested_work_item_id
  for update of instance;
  if instance_row.id is null then
    raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002';
  end if;

  select item.* into item_row
  from public.process_work_items item
  where item.tenant_id = instance_row.tenant_id
    and item.hr_group_id = instance_row.hr_group_id
    and item.id = requested_work_item_id
  for update;
  if item_row.id is null then
    raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002';
  end if;
  if item_row.business_type <> 'LEAVE' then
    raise exception 'LEAVE_WORKFLOW_REQUIRED' using errcode = '42501';
  end if;

  select link.* into link_row
  from public.process_leave_subjects link
  where link.tenant_id = item_row.tenant_id
    and link.hr_group_id = item_row.hr_group_id
    and link.process_instance_id = item_row.process_instance_id
  for update;
  if link_row.process_instance_id is null then
    raise exception 'LEAVE_WORKFLOW_LINK_MISSING' using errcode = 'P0001';
  end if;

  select request.* into request_row
  from public.leave_requests request
  where request.tenant_id = link_row.tenant_id
    and request.hr_group_id = link_row.hr_group_id
    and request.administration_id = link_row.administration_id
    and request.id = link_row.leave_request_id
  for update;
  if request_row.id is null then
    raise exception 'LEAVE_REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  actor_employee_id := internal_security.current_employee_id(instance_row.tenant_id, instance_row.hr_group_id);
  if actor_employee_id is null then
    raise exception 'ACTOR_EMPLOYEE_NOT_FOUND' using errcode = '42501';
  end if;
  if not internal_security.process_form_actor_allowed(
    instance_row.tenant_id,
    instance_row.hr_group_id,
    instance_row.id,
    item_row.id,
    actor_user_id,
    actor_employee_id
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select event.id, event.actor_user_id, event.work_item_id, event.payload ->> 'action'
    into existing_event_id, existing_actor_user_id, existing_event_work_item_id, existing_event_action
  from public.process_events event
  where event.tenant_id = instance_row.tenant_id
    and event.hr_group_id = instance_row.hr_group_id
    and event.process_instance_id = instance_row.id
    and event.idempotency_key = pg_catalog.btrim(requested_idempotency_key);
  if existing_event_id is not null then
    if existing_actor_user_id is distinct from actor_user_id
      or existing_event_work_item_id is distinct from requested_work_item_id
      or existing_event_action is distinct from requested_action then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = 'P0001';
    end if;
    return internal_security.process_runtime_result(
      instance_row.tenant_id,
      instance_row.hr_group_id,
      instance_row.id,
      existing_event_id
    ) || jsonb_build_object(
      'requestId', request_row.id,
      'leaveRequestId', request_row.id,
      'businessStatus', case request_row.status
        when 'PENDING'::public.leave_request_status then 'WAITING'
        when 'CHANGES_REQUESTED'::public.leave_request_status then 'CHANGES_REQUESTED'
        when 'APPROVED'::public.leave_request_status then 'COMPLETED'
        when 'REJECTED'::public.leave_request_status then 'REJECTED'
        when 'CANCELLED'::public.leave_request_status then 'CANCELLED'
      end,
      'existing', true
    );
  end if;

  if requested_action = 'REQUEST_CHANGES'
     and pg_catalog.length(pg_catalog.btrim(coalesce(requested_reason, ''))) < 1 then
    raise exception 'REQUEST_CHANGES_REASON_REQUIRED' using errcode = '22023';
  end if;

  correlation_id := coalesce(requested_correlation_id, instance_row.correlation_id);
  if requested_action = 'APPROVE' then
    booking_result := internal_security.book_leave_request_workflow(request_row.id, actor_user_id);
    request_row.status := 'APPROVED'::public.leave_request_status;
  elsif requested_action = 'REJECT' then
    if request_row.status not in ('PENDING'::public.leave_request_status, 'CHANGES_REQUESTED'::public.leave_request_status) then
      raise exception 'LEAVE_REQUEST_NOT_ACTIONABLE' using errcode = '40901';
    end if;
    update public.leave_requests
    set status = 'REJECTED'::public.leave_request_status,
        updated_at = timezone('utc', now())
    where tenant_id = request_row.tenant_id
      and hr_group_id = request_row.hr_group_id
      and administration_id = request_row.administration_id
      and id = request_row.id;
    request_row.status := 'REJECTED'::public.leave_request_status;
  elsif requested_action = 'CANCEL' then
    if request_row.status not in ('PENDING'::public.leave_request_status, 'CHANGES_REQUESTED'::public.leave_request_status) then
      raise exception 'LEAVE_REQUEST_NOT_CANCELLABLE' using errcode = '40901';
    end if;
    update public.leave_requests
    set status = 'CANCELLED'::public.leave_request_status,
        updated_at = timezone('utc', now())
    where tenant_id = request_row.tenant_id
      and hr_group_id = request_row.hr_group_id
      and administration_id = request_row.administration_id
      and id = request_row.id;
    request_row.status := 'CANCELLED'::public.leave_request_status;
  elsif requested_action = 'ACKNOWLEDGE' and item_row.step_key = 'employee-changes' then
    if request_row.status <> 'CHANGES_REQUESTED'::public.leave_request_status then
      raise exception 'LEAVE_REQUEST_NOT_RESUBMITTABLE' using errcode = '40901';
    end if;
    update public.leave_requests
    set status = 'PENDING'::public.leave_request_status,
        updated_at = timezone('utc', now())
    where tenant_id = request_row.tenant_id
      and hr_group_id = request_row.hr_group_id
      and administration_id = request_row.administration_id
      and id = request_row.id;
    request_row.status := 'PENDING'::public.leave_request_status;
  end if;

  if requested_action = 'REQUEST_CHANGES' then
    update public.leave_requests
    set status = 'CHANGES_REQUESTED'::public.leave_request_status,
        updated_at = timezone('utc', now())
    where tenant_id = request_row.tenant_id
      and hr_group_id = request_row.hr_group_id
      and administration_id = request_row.administration_id
      and id = request_row.id;
    request_row.status := 'CHANGES_REQUESTED'::public.leave_request_status;
    action_result := internal_security.request_process_work_item_changes(
      requested_work_item_id,
      requested_expected_version,
      requested_step_expected_version,
      pg_catalog.btrim(requested_idempotency_key),
      correlation_id,
      pg_catalog.btrim(requested_reason)
    );
  else
    action_result := internal_security.perform_process_work_item_action(
      requested_work_item_id,
      requested_action,
      requested_expected_version,
      requested_step_expected_version,
      pg_catalog.btrim(requested_idempotency_key),
      correlation_id
    );
  end if;

  if requested_action = 'APPROVE' then
    commit_result := action_result || booking_result || jsonb_build_object(
      'adapterKey', 'LEAVE_REQUEST_BOOKING',
      'writesPerformed', true,
      'correlationId', correlation_id
    );
    insert into public.process_domain_commits (
      tenant_id,
      hr_group_id,
      process_instance_id,
      work_item_id,
      adapter_key,
      correlation_id,
      idempotency_key,
      result,
      created_by_user_id
    ) values (
      instance_row.tenant_id,
      instance_row.hr_group_id,
      instance_row.id,
      item_row.id,
      'LEAVE_REQUEST_BOOKING',
      correlation_id,
      pg_catalog.btrim(requested_idempotency_key) || ':domain',
      commit_result,
      actor_user_id
    );
    return commit_result;
  end if;

  return action_result || jsonb_build_object(
    'requestId', request_row.id,
    'leaveRequestId', request_row.id,
    'businessStatus', case request_row.status
      when 'PENDING'::public.leave_request_status then 'WAITING'
      when 'CHANGES_REQUESTED'::public.leave_request_status then 'CHANGES_REQUESTED'
      when 'APPROVED'::public.leave_request_status then 'COMPLETED'
      when 'REJECTED'::public.leave_request_status then 'REJECTED'
      when 'CANCELLED'::public.leave_request_status then 'CANCELLED'
    end,
    'existing', false
  );
end;
$$;

revoke all on function internal_security.perform_leave_workflow_action_internal(uuid, text, bigint, bigint, text, uuid, text)
  from public, anon, authenticated;

create or replace function public.start_leave_request_workflow(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_mode public.leave_request_mode,
  requested_priority_rule_id uuid,
  requested_leave_type_id uuid,
  requested_start_date date,
  requested_end_date date,
  requested_time_mode public.leave_request_time_mode,
  requested_specific_start time,
  requested_specific_end time,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.start_leave_request_workflow_internal(
    requested_tenant_id,
    requested_hr_group_id,
    requested_administration_id,
    requested_employee_id,
    requested_employment_id,
    requested_mode,
    requested_priority_rule_id,
    requested_leave_type_id,
    requested_start_date,
    requested_end_date,
    requested_time_mode,
    requested_specific_start,
    requested_specific_end,
    requested_idempotency_key,
    requested_correlation_id
  );
$$;

revoke all on function public.start_leave_request_workflow(uuid, uuid, uuid, uuid, uuid, public.leave_request_mode, uuid, uuid, date, date, public.leave_request_time_mode, time, time, text, uuid)
  from public, anon;
grant execute on function public.start_leave_request_workflow(uuid, uuid, uuid, uuid, uuid, public.leave_request_mode, uuid, uuid, date, date, public.leave_request_time_mode, time, time, text, uuid)
  to authenticated;

create or replace function public.perform_leave_workflow_action(
  requested_work_item_id uuid,
  requested_action text,
  requested_expected_version bigint,
  requested_step_expected_version bigint,
  requested_idempotency_key text,
  requested_correlation_id uuid,
  requested_reason text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.perform_leave_workflow_action_internal(
    requested_work_item_id,
    requested_action,
    requested_expected_version,
    requested_step_expected_version,
    requested_idempotency_key,
    requested_correlation_id,
    requested_reason
  );
$$;

revoke all on function public.perform_leave_workflow_action(uuid, text, bigint, bigint, text, uuid, text)
  from public, anon;
grant execute on function public.perform_leave_workflow_action(uuid, text, bigint, bigint, text, uuid, text)
  to authenticated;

-- The unified projection keeps tab/status/type filters in the database. The
-- request view deliberately returns one current/terminal row per instance so
-- the shared shell does not show a separate row for every historical step.
create or replace function internal_security.get_unified_process_work_projection(
  requested_hr_group_id uuid,
  requested_view text default 'WORK',
  requested_tab text default 'TODO',
  requested_search text default null,
  requested_status text default null,
  requested_business_type text default null,
  requested_business_category text default null,
  requested_process_definition_id uuid default null,
  requested_administration_id uuid default null,
  requested_subject_employee_id uuid default null,
  requested_subject_employment_id uuid default null,
  requested_language text default 'nl',
  requested_sort text default 'NEEDS_ACTION',
  requested_limit integer default 100,
  requested_offset integer default 0
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
with base as (
  select
    item.id,
    item.tenant_id,
    item.hr_group_id,
    item.process_instance_id,
    item.step_instance_id,
    item.step_key,
    item.participant_key,
    item.assignment_mode,
    item.status,
    item.assignee_employee_id,
    item.claimed_by_user_id,
    item.claimed_at,
    item.available_at,
    item.deadline_at,
    item.expected_version,
    item.allow_self_assignment,
    item.assignment_snapshot,
    item.created_at,
    item.updated_at,
    item.business_type,
    item.business_category,
    instance.status as instance_status,
    instance.scope_type,
    instance.administration_id,
    instance.current_step_key,
    instance.instance_version,
    instance.started_at,
    instance.completed_at,
    instance.correlation_id,
    instance.initiator_user_id,
    definition.id as process_definition_id,
    definition.key as process_key,
    definition.title as process_title,
    version.definition_json,
    coalesce(direct_subject.employee_id, employment.employee_id) as subject_employee_id,
    employment_subject.employment_id as subject_employment_id,
    subject_employee.first_name as subject_first_name,
    subject_employee.birth_name as subject_birth_name,
    step_definition.step as step_definition,
    leave_link.leave_request_id,
    leave_request.status as leave_request_status,
    exists (
      select 1
      from public.process_work_item_candidates candidate
      where candidate.tenant_id = item.tenant_id
        and candidate.hr_group_id = item.hr_group_id
        and candidate.work_item_id = item.id
        and candidate.employee_id = internal_security.current_employee_id(item.tenant_id, item.hr_group_id)
        and candidate.candidate_user_id = auth.uid()
        and candidate.is_eligible
        and candidate.resolution_revision = (
          select max(latest.resolution_revision)
          from public.process_work_item_candidates latest
          where latest.tenant_id = item.tenant_id
            and latest.hr_group_id = item.hr_group_id
            and latest.work_item_id = item.id
        )
    ) as candidate_ok,
    internal_security.process_scope_has_permission(
      instance.tenant_id,
      instance.hr_group_id,
      instance.scope_type,
      instance.administration_id,
      'process-task:act'
    ) as scope_can_act
  from public.process_work_items item
  join public.process_instances instance
    on instance.tenant_id = item.tenant_id
   and instance.hr_group_id = item.hr_group_id
   and instance.id = item.process_instance_id
  join public.process_definitions definition
    on definition.tenant_id = instance.tenant_id
   and definition.hr_group_id = instance.hr_group_id
   and definition.id = instance.process_definition_id
  join public.process_versions version
    on version.tenant_id = instance.tenant_id
   and version.hr_group_id = instance.hr_group_id
   and version.process_definition_id = instance.process_definition_id
   and version.id = instance.process_version_id
  left join public.process_employee_subjects direct_subject
    on direct_subject.tenant_id = instance.tenant_id
   and direct_subject.hr_group_id = instance.hr_group_id
   and direct_subject.process_instance_id = instance.id
  left join public.process_employment_subjects employment_subject
    on employment_subject.tenant_id = instance.tenant_id
   and employment_subject.hr_group_id = instance.hr_group_id
   and employment_subject.process_instance_id = instance.id
  left join public.employments employment
    on employment.tenant_id = employment_subject.tenant_id
   and employment.hr_group_id = employment_subject.hr_group_id
   and employment.administration_id = employment_subject.administration_id
   and employment.id = employment_subject.employment_id
  left join public.employees subject_employee
    on subject_employee.tenant_id = instance.tenant_id
   and subject_employee.hr_group_id = instance.hr_group_id
   and subject_employee.id = coalesce(direct_subject.employee_id, employment.employee_id)
  left join lateral (
    select value as step
    from pg_catalog.jsonb_array_elements(coalesce(version.definition_json -> 'steps', '[]'::jsonb)) value
    where value ->> 'key' = item.step_key
    limit 1
  ) step_definition on true
  left join public.process_leave_subjects leave_link
    on leave_link.tenant_id = instance.tenant_id
   and leave_link.hr_group_id = instance.hr_group_id
   and leave_link.process_instance_id = instance.id
  left join public.leave_requests leave_request
    on leave_request.tenant_id = leave_link.tenant_id
   and leave_request.hr_group_id = leave_link.hr_group_id
   and leave_request.administration_id = leave_link.administration_id
   and leave_request.id = leave_link.leave_request_id
  where item.hr_group_id = requested_hr_group_id
    and internal_security.process_work_item_can_read(item.tenant_id, item.hr_group_id, item.id)
    and (
      upper(coalesce(requested_view, 'WORK')) <> 'REQUESTS'
      or instance.initiator_user_id = auth.uid()
    )
    and (
      requested_administration_id is null
      or instance.administration_id = requested_administration_id
    )
    and (
      requested_subject_employee_id is null
      or coalesce(direct_subject.employee_id, employment.employee_id) = requested_subject_employee_id
    )
    and (
      requested_subject_employment_id is null
      or employment_subject.employment_id = requested_subject_employment_id
    )
    and (
      requested_process_definition_id is null
      or instance.process_definition_id = requested_process_definition_id
    )
    and (
      requested_business_type is null
      or pg_catalog.btrim(requested_business_type) = ''
      or item.business_type = upper(pg_catalog.btrim(requested_business_type))
    )
    and (
      requested_business_category is null
      or pg_catalog.btrim(requested_business_category) = ''
      or item.business_category = upper(pg_catalog.btrim(requested_business_category))
    )
    and (
      requested_search is null
      or pg_catalog.btrim(requested_search) = ''
      or definition.key ilike '%' || pg_catalog.btrim(requested_search) || '%'
      or internal_security.process_localized_text(definition.title, requested_language, definition.key) ilike '%' || pg_catalog.btrim(requested_search) || '%'
      or pg_catalog.concat_ws(' ', subject_employee.first_name, subject_employee.birth_name) ilike '%' || pg_catalog.btrim(requested_search) || '%'
      or internal_security.process_localized_text(step_definition.step -> 'title', requested_language, item.step_key) ilike '%' || pg_catalog.btrim(requested_search) || '%'
    )
), ranked as (
  select base.*,
    pg_catalog.row_number() over (
      partition by base.process_instance_id
      order by case when base.status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status) then 0 else 1 end, base.updated_at desc, base.id
    ) as request_rank
  from base
), classified as (
  select ranked.*,
    (ranked.scope_can_act or ranked.candidate_ok) as can_act,
    (ranked.status = 'OPEN'::public.process_work_item_status and (ranked.scope_can_act or ranked.candidate_ok)) as can_claim,
    case
      when ranked.assignment_mode = 'ANY_ONE'::public.process_assignment_mode and ranked.candidate_ok then 'QUEUE'
      when ranked.candidate_ok then 'DIRECT'
      when ranked.scope_can_act then 'SCOPE'
      else 'PROCESS'
    end as received_via,
    case
      when ranked.business_type = 'LEAVE' and ranked.leave_request_status is not null then case ranked.leave_request_status
        when 'PENDING'::public.leave_request_status then case when ranked.status = 'CLAIMED'::public.process_work_item_status then 'IN_PROGRESS' else case when ranked.scope_can_act or ranked.candidate_ok then 'OPEN' else 'WAITING' end end
        when 'CHANGES_REQUESTED'::public.leave_request_status then 'CHANGES_REQUESTED'
        when 'APPROVED'::public.leave_request_status then 'COMPLETED'
        when 'REJECTED'::public.leave_request_status then 'REJECTED'
        when 'CANCELLED'::public.leave_request_status then 'CANCELLED'
      end
      when ranked.instance_status = 'REJECTED'::public.process_instance_status then 'REJECTED'
      when ranked.instance_status = 'CANCELLED'::public.process_instance_status or ranked.status = 'CANCELLED'::public.process_work_item_status then 'CANCELLED'
      when ranked.status = 'EXPIRED'::public.process_work_item_status then 'CANCELLED'
      when ranked.status = 'CLAIMED'::public.process_work_item_status then 'IN_PROGRESS'
      when ranked.status = 'COMPLETED'::public.process_work_item_status and ranked.instance_status = 'COMPLETED'::public.process_instance_status then 'COMPLETED'
      when ranked.scope_can_act or ranked.candidate_ok then 'OPEN'
      else 'WAITING'
    end as business_status,
    case
      when ranked.status in ('COMPLETED'::public.process_work_item_status, 'CANCELLED'::public.process_work_item_status, 'EXPIRED'::public.process_work_item_status) then 'COMPLETED'
      when ranked.instance_status in ('COMPLETED'::public.process_instance_status, 'REJECTED'::public.process_instance_status, 'CANCELLED'::public.process_instance_status) then 'COMPLETED'
      when ranked.instance_status in ('WAITING'::public.process_instance_status, 'BLOCKED'::public.process_instance_status) then 'WAITING'
      when ranked.claimed_by_user_id = auth.uid() then 'CLAIMED'
      when ranked.scope_can_act or ranked.candidate_ok then 'TODO'
      else 'WAITING'
    end as work_tab
  from ranked
), filtered as (
  select classified.*
  from classified
  where (
    (upper(coalesce(requested_view, 'WORK')) = 'REQUESTS' and classified.request_rank = 1)
    or upper(coalesce(requested_view, 'WORK')) <> 'REQUESTS'
  )
  and (
    upper(coalesce(requested_view, 'WORK')) = 'REQUESTS'
    or upper(coalesce(requested_tab, 'TODO')) = 'ALL'
    or classified.work_tab = upper(coalesce(requested_tab, 'TODO'))
    or (upper(coalesce(requested_tab, 'TODO')) = 'TODO' and classified.status = 'OPEN'::public.process_work_item_status and classified.can_act)
    or (upper(coalesce(requested_tab, 'TODO')) = 'CLAIMED' and classified.claimed_by_user_id = auth.uid())
  )
  and (
    requested_status is null
    or pg_catalog.btrim(requested_status) = ''
    or classified.business_status = upper(pg_catalog.btrim(requested_status))
    or classified.status::text = upper(pg_catalog.btrim(requested_status))
    or classified.instance_status::text = upper(pg_catalog.btrim(requested_status))
  )
), counted as (
  select filtered.*, count(*) over () as total_count
  from filtered
), paged as (
  select *
  from counted
  order by
    case when upper(coalesce(requested_sort, 'NEEDS_ACTION')) = 'NEEDS_ACTION' and can_act and status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status) then 0 else 1 end,
    case when deadline_at is not null and deadline_at < timezone('utc', now()) then 0 else 1 end,
    case when upper(coalesce(requested_sort, 'NEEDS_ACTION')) = 'DEADLINE' then deadline_at end asc nulls last,
    case when upper(coalesce(requested_sort, 'NEEDS_ACTION')) <> 'DEADLINE' then updated_at end desc,
    id
  offset greatest(coalesce(requested_offset, 0), 0)
  limit least(greatest(coalesce(requested_limit, 100), 1), 200)
)
select jsonb_build_object(
  'items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'workItemId', page.id,
      'processInstanceId', page.process_instance_id,
      'stepInstanceId', page.step_instance_id,
      'processDefinitionId', page.process_definition_id,
      'processKey', page.process_key,
      'processTitle', internal_security.process_localized_text(page.process_title, requested_language, page.process_key),
      'subjectEmployeeId', page.subject_employee_id,
      'subjectEmploymentId', page.subject_employment_id,
      'subjectName', nullif(pg_catalog.concat_ws(' ', page.subject_first_name, page.subject_birth_name), ''),
      'stepKey', page.step_key,
      'stepTitle', internal_security.process_localized_text(page.step_definition -> 'title', requested_language, page.step_key),
      'participantKey', page.participant_key,
      'assignmentMode', page.assignment_mode,
      'receivedVia', page.received_via,
      'assignmentExplanation', internal_security.process_work_item_assignment_explanation(page.assignment_snapshot),
      'status', page.status,
      'instanceStatus', page.instance_status,
      'currentStepKey', page.current_step_key,
      'instanceVersion', page.instance_version,
      'expectedVersion', page.expected_version,
      'claimedByUserId', page.claimed_by_user_id,
      'assigneeEmployeeId', page.assignee_employee_id,
      'claimedAt', page.claimed_at,
      'availableAt', page.available_at,
      'deadlineAt', page.deadline_at,
      'createdAt', page.created_at,
      'updatedAt', page.updated_at,
      'canAct', page.can_act,
      'canClaim', page.can_claim,
      'isOverdue', page.deadline_at is not null and page.deadline_at < timezone('utc', now()) and page.status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status),
      'businessType', page.business_type,
      'businessCategory', page.business_category,
      'businessStatus', page.business_status,
      'leaveRequestId', page.leave_request_id
    ) order by page.updated_at desc, page.id)
    from paged page
  ), '[]'::jsonb),
  'total', coalesce((select max(total_count) from paged), 0),
  'hasMore', coalesce((select max(total_count) from paged), 0) > greatest(coalesce(requested_offset, 0), 0) + least(greatest(coalesce(requested_limit, 100), 1), 200)
);
$$;

revoke all on function internal_security.get_unified_process_work_projection(uuid, text, text, text, text, text, text, uuid, uuid, uuid, uuid, text, text, integer, integer)
  from public, anon, authenticated;

create or replace function public.get_unified_process_work_projection(
  requested_hr_group_id uuid,
  requested_view text default 'WORK',
  requested_tab text default 'TODO',
  requested_search text default null,
  requested_status text default null,
  requested_business_type text default null,
  requested_business_category text default null,
  requested_process_definition_id uuid default null,
  requested_administration_id uuid default null,
  requested_subject_employee_id uuid default null,
  requested_subject_employment_id uuid default null,
  requested_language text default 'nl',
  requested_sort text default 'NEEDS_ACTION',
  requested_limit integer default 100,
  requested_offset integer default 0
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.get_unified_process_work_projection(
    requested_hr_group_id,
    requested_view,
    requested_tab,
    requested_search,
    requested_status,
    requested_business_type,
    requested_business_category,
    requested_process_definition_id,
    requested_administration_id,
    requested_subject_employee_id,
    requested_subject_employment_id,
    requested_language,
    requested_sort,
    requested_limit,
    requested_offset
  );
$$;

revoke all on function public.get_unified_process_work_projection(uuid, text, text, text, text, text, text, uuid, uuid, uuid, uuid, text, text, integer, integer)
  from public, anon;
grant execute on function public.get_unified_process_work_projection(uuid, text, text, text, text, text, text, uuid, uuid, uuid, uuid, text, text, integer, integer)
  to authenticated;

create or replace function internal_security.get_unified_process_work_item_detail(
  requested_work_item_id uuid,
  requested_language text default 'nl'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_result jsonb;
  item_row public.process_work_items%rowtype;
  link_row public.process_leave_subjects%rowtype;
  request_row public.leave_requests%rowtype;
  leave_type_name text;
  priority_rule_name text;
begin
  base_result := internal_security.get_process_work_item_detail(requested_work_item_id, requested_language);
  select item.* into item_row
  from public.process_work_items item
  where item.id = requested_work_item_id;
  if item_row.id is null then
    raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002';
  end if;

  select link.* into link_row
  from public.process_leave_subjects link
  where link.tenant_id = item_row.tenant_id
    and link.hr_group_id = item_row.hr_group_id
    and link.process_instance_id = item_row.process_instance_id;
  if link_row.process_instance_id is not null then
    select request.* into request_row
    from public.leave_requests request
    where request.tenant_id = link_row.tenant_id
      and request.hr_group_id = link_row.hr_group_id
      and request.administration_id = link_row.administration_id
      and request.id = link_row.leave_request_id;
    select type.name into leave_type_name
    from public.leave_types type
    where request_row.leave_type_id is not null
      and type.tenant_id = request_row.tenant_id
      and type.hr_group_id = request_row.hr_group_id
      and type.id = request_row.leave_type_id;
    select rule.name into priority_rule_name
    from public.leave_priority_rules rule
    where request_row.priority_rule_id is not null
      and rule.tenant_id = request_row.tenant_id
      and rule.hr_group_id = request_row.hr_group_id
      and rule.id = request_row.priority_rule_id;
  end if;

  return base_result || jsonb_build_object(
    'businessType', item_row.business_type,
    'businessCategory', item_row.business_category,
    'businessStatus', case when request_row.id is not null then case request_row.status
      when 'PENDING'::public.leave_request_status then case when coalesce((base_result ->> 'canAct')::boolean, false) then 'OPEN' else 'WAITING' end
      when 'CHANGES_REQUESTED'::public.leave_request_status then 'CHANGES_REQUESTED'
      when 'APPROVED'::public.leave_request_status then 'COMPLETED'
      when 'REJECTED'::public.leave_request_status then 'REJECTED'
      when 'CANCELLED'::public.leave_request_status then 'CANCELLED'
    end else case
      when item_row.status = 'COMPLETED'::public.process_work_item_status then 'COMPLETED'
      when item_row.status = 'CANCELLED'::public.process_work_item_status then 'CANCELLED'
      else item_row.status::text
    end end,
    'leaveRequestId', nullif(request_row.id, '00000000-0000-0000-0000-000000000000'::uuid),
    'leaveRequest', case when request_row.id is null then null else jsonb_build_object(
      'id', request_row.id,
      'employeeId', request_row.employee_id,
      'employmentId', request_row.employment_id,
      'requestMode', request_row.request_mode,
      'priorityRuleId', request_row.priority_rule_id,
      'priorityRuleName', priority_rule_name,
      'leaveTypeId', request_row.leave_type_id,
      'leaveTypeName', leave_type_name,
      'startDate', request_row.start_date,
      'endDate', request_row.end_date,
      'timeMode', request_row.time_mode,
      'specificStart', request_row.specific_start,
      'specificEnd', request_row.specific_end,
      'requestedMinutes', request_row.requested_minutes,
      'status', request_row.status,
      'source', request_row.source,
      'updatedAt', request_row.updated_at
    ) end
  );
end;
$$;

revoke all on function internal_security.get_unified_process_work_item_detail(uuid, text)
  from public, anon, authenticated;

create or replace function public.get_unified_process_work_item_detail(
  requested_work_item_id uuid,
  requested_language text default 'nl'
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.get_unified_process_work_item_detail(requested_work_item_id, requested_language);
$$;

revoke all on function public.get_unified_process_work_item_detail(uuid, text)
  from public, anon;
grant execute on function public.get_unified_process_work_item_detail(uuid, text)
  to authenticated;

comment on column public.process_work_items.business_type is 'Canoniek business type voor server-side werkfiltering; domeinvelden blijven bij het domein.';
comment on column public.process_work_items.business_category is 'Canonieke business categorie voor server-side werkfiltering.';
comment on table public.process_leave_subjects is 'Getypeerde Leave-adapterlink; geen directe Data API-toegang.';

commit;
