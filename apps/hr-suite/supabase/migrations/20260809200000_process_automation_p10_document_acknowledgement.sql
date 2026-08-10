begin;

-- P10: one vertical recipe only. The document itself remains owned by the
-- document dossier; this table records the immutable acknowledgement event.

insert into public.permissions (code, name, category, description)
values (
  'document:read',
  'Documentdossiers bekijken',
  'Documenten',
  'Bekijkt documenten binnen medewerker- en doelgroepscope.'
)
on conflict (code) do nothing;

-- The employee role may read documents addressed to the employee. Audience
-- matching remains mandatory in can_access_document; this does not grant
-- access to another employee's dossier.
insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission on permission.code = 'document:read'
where role.code = 'EMPLOYEE'
  and role.tenant_id is null
on conflict do nothing;

insert into public.document_categories (tenant_id, administration_id, code, name, description)
select administration.tenant_id, administration.id,
  'process-document-acknowledgement',
  'Procesbevestiging documentkennisname',
  'Automatisch gegenereerde bevestigingen van documentkennisname.'
from public.administrations administration
on conflict (tenant_id, administration_id, code) do nothing;

create table if not exists public.employee_document_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  administration_id uuid not null,
  employee_id uuid not null,
  document_id uuid not null,
  process_instance_id uuid not null,
  work_item_id uuid not null,
  acknowledged_by_user_id uuid not null default auth.uid(),
  acknowledged_at timestamptz not null default timezone('utc', now()),
  document_checksum_sha256 text not null check (document_checksum_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default timezone('utc', now()),
  constraint employee_document_ack_scope_fkey
    foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id) on delete restrict,
  constraint employee_document_ack_administration_fkey
    foreign key (tenant_id, hr_group_id, administration_id)
    references public.administrations(tenant_id, hr_group_id, id) on delete restrict,
  constraint employee_document_ack_employee_fkey
    foreign key (tenant_id, hr_group_id, employee_id)
    references public.employees(tenant_id, hr_group_id, id) on delete restrict,
  constraint employee_document_ack_document_fkey
    foreign key (tenant_id, administration_id, document_id)
    references public.employee_documents(tenant_id, administration_id, id) on delete restrict,
  constraint employee_document_ack_instance_fkey
    foreign key (tenant_id, hr_group_id, process_instance_id)
    references public.process_instances(tenant_id, hr_group_id, id) on delete restrict,
  constraint employee_document_ack_work_item_fkey
    foreign key (tenant_id, hr_group_id, work_item_id)
    references public.process_work_items(tenant_id, hr_group_id, id) on delete restrict,
  constraint employee_document_ack_unique
    unique (tenant_id, hr_group_id, employee_id, document_id)
);

create index if not exists employee_document_ack_employee_idx
  on public.employee_document_acknowledgements (tenant_id, hr_group_id, employee_id, acknowledged_at desc);
create index if not exists employee_document_ack_document_idx
  on public.employee_document_acknowledgements (tenant_id, administration_id, document_id, acknowledged_at desc);
create index if not exists employee_document_ack_process_idx
  on public.employee_document_acknowledgements (tenant_id, hr_group_id, process_instance_id, work_item_id);

alter table public.employee_document_acknowledgements enable row level security;
drop policy if exists employee_document_ack_no_direct_access on public.employee_document_acknowledgements;
create policy employee_document_ack_no_direct_access
on public.employee_document_acknowledgements for all to authenticated
using (false) with check (false);
revoke all on table public.employee_document_acknowledgements from public, anon, authenticated;

-- A generic ACKNOWLEDGE action must not be able to complete this recipe
-- without the domain adapter's commit marker. CANCEL remains available.
create or replace function internal_security.guard_document_acknowledgement_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_document_acknowledgement boolean;
  has_domain_commit boolean;
begin
  if new.status = 'COMPLETED'::public.process_step_instance_status
    and old.status is distinct from new.status
  then
    select exists (
      select 1
      from public.process_instances instance
      join public.process_recipe_activations activation
        on activation.tenant_id = instance.tenant_id
       and activation.hr_group_id = instance.hr_group_id
       and activation.process_definition_id = instance.process_definition_id
      join public.process_recipe_catalog recipe on recipe.id = activation.process_recipe_id
      where instance.tenant_id = new.tenant_id
        and instance.hr_group_id = new.hr_group_id
        and instance.id = new.process_instance_id
        and recipe.recipe_key = 'document-acknowledgement'
        and new.step_key = 'acknowledge'
    ) into is_document_acknowledgement;
    if is_document_acknowledgement then
      select exists (
        select 1
        from public.process_domain_commits domain_commit
        join public.process_work_items item
          on item.tenant_id = domain_commit.tenant_id
         and item.hr_group_id = domain_commit.hr_group_id
         and item.id = domain_commit.work_item_id
         and item.step_instance_id = new.id
        where domain_commit.tenant_id = new.tenant_id
          and domain_commit.hr_group_id = new.hr_group_id
          and domain_commit.process_instance_id = new.process_instance_id
          and domain_commit.adapter_key = 'DOCUMENT_ACKNOWLEDGEMENT'
      ) into has_domain_commit;
      if not has_domain_commit then
        raise exception 'DOCUMENT_ACKNOWLEDGEMENT_DOMAIN_COMMIT_REQUIRED' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function internal_security.guard_document_acknowledgement_completion() from public, anon, authenticated;
drop trigger if exists guard_document_acknowledgement_completion on public.process_step_instances;
create trigger guard_document_acknowledgement_completion
before update on public.process_step_instances
for each row execute function internal_security.guard_document_acknowledgement_completion();

insert into public.process_recipe_catalog (
  recipe_key, recipe_version, title, description, adapter_key, definition_json, status
)
values (
  'document-acknowledgement',
  1,
  '{"nl":"Document lezen en bevestigen","en":"Read and acknowledge document"}'::jsonb,
  '{"nl":"Laat een medewerker een toegewezen document lezen en expliciet bevestigen.","en":"Ask an employee to read an assigned document and explicitly acknowledge it."}'::jsonb,
  'DOCUMENT_ACKNOWLEDGEMENT',
  $$
  {
    "schemaVersion": 1,
    "key": "document-acknowledgement",
    "status": "DRAFT",
    "title": {"nl": "Document lezen en bevestigen", "en": "Read and acknowledge document"},
    "description": {"nl": "Laat een medewerker een toegewezen document lezen en expliciet bevestigen.", "en": "Ask an employee to read an assigned document and explicitly acknowledge it."},
    "enabledLanguages": ["nl", "en"],
    "startStepKey": "acknowledge",
    "participants": [
      {"key":"subject-employee","label":{"nl":"Medewerker","en":"Employee"},"selector":{"type":"SUBJECT_EMPLOYEE","resolutionDatePolicy":"STEP_ACTIVATED_AT"},"assignmentMode":"EXACTLY_ONE","permission":"self:process-task:act"}
    ],
    "forms": [
      {"key":"document-acknowledgement-form","version":1,"title":{"nl":"Documentbevestiging","en":"Document acknowledgement"},"description":{"nl":"Lees het document en bevestig daarna dat je kennis hebt genomen.","en":"Read the document and then confirm that you have acknowledged it."},"sections":[
        {"key":"document","title":{"nl":"Document","en":"Document"},"fields":[
          {"key":"document","label":{"nl":"Toegevoegd document","en":"Assigned document"},"type":"DOCUMENT_REFERENCE","binding":{"kind":"DOMAIN_READ","key":"employee.document"},"access":[{"participantKey":"subject-employee","mode":"READ"}]},
          {"key":"acknowledged","label":{"nl":"Ik heb dit document gelezen en begrepen.","en":"I have read and understood this document."},"type":"BOOLEAN","binding":{"kind":"PROCESS_ONLY"},"access":[{"participantKey":"subject-employee","mode":"WRITE_REQUIRED"}]}
        ]}
      ]}
    ],
    "steps": [
      {"key":"acknowledge","type":"ACKNOWLEDGEMENT","title":{"nl":"Document bevestigen","en":"Acknowledge document"},"participantKey":"subject-employee","formKey":"document-acknowledgement-form","allowedActions":["ACKNOWLEDGE","CANCEL"]},
      {"key":"completed","type":"END","title":{"nl":"Afgerond","en":"Completed"},"allowedActions":[],"terminalOutcome":"COMPLETED"},
      {"key":"cancelled","type":"END","title":{"nl":"Geannuleerd","en":"Cancelled"},"allowedActions":[],"terminalOutcome":"CANCELLED"}
    ],
    "transitions": [
      {"key":"acknowledge-complete","fromStepKey":"acknowledge","toStepKey":"completed","action":"ACKNOWLEDGE","kind":"FORWARD","label":{"nl":"Bevestig kennisname","en":"Acknowledge document"}},
      {"key":"acknowledge-cancel","fromStepKey":"acknowledge","toStepKey":"cancelled","action":"CANCEL","kind":"FORWARD","label":{"nl":"Annuleer","en":"Cancel"}}
    ],
    "output":{"key":"document-acknowledgement-record","title":{"nl":"Bevestiging documentkennisname","en":"Document acknowledgement record"},"format":"PDF","dossierCategoryKey":"process-document-acknowledgement","fieldKeys":["document","acknowledged"]}
  }
  $$::jsonb,
  'PUBLISHED'
)
on conflict (recipe_key, recipe_version) do update
set title = excluded.title,
    description = excluded.description,
    adapter_key = excluded.adapter_key,
    definition_json = excluded.definition_json,
    status = excluded.status;

create or replace function internal_security.get_employee_document_acknowledgements_internal(
  requested_employee_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if not internal_security.can_manage_employee(requested_employee_id, 'document:read') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', acknowledgement.id,
      'documentId', acknowledgement.document_id,
      'documentTitle', document.title,
      'acknowledgedAt', acknowledgement.acknowledged_at,
      'acknowledgedByUserId', acknowledgement.acknowledged_by_user_id,
      'processInstanceId', acknowledgement.process_instance_id,
      'workItemId', acknowledgement.work_item_id,
      'documentChecksumSha256', acknowledgement.document_checksum_sha256
    ) order by acknowledgement.acknowledged_at desc)
    from public.employee_document_acknowledgements acknowledgement
    join public.employee_documents document
      on document.tenant_id = acknowledgement.tenant_id
     and document.administration_id = acknowledgement.administration_id
     and document.id = acknowledgement.document_id
     and document.deleted_at is null
    where acknowledgement.employee_id = requested_employee_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function internal_security.get_employee_document_acknowledgements_internal(uuid) from public, anon, authenticated;

create or replace function public.get_employee_document_acknowledgements(
  requested_employee_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.get_employee_document_acknowledgements_internal(requested_employee_id);
$$;

revoke all on function public.get_employee_document_acknowledgements(uuid) from public, anon;
grant execute on function public.get_employee_document_acknowledgements(uuid) to authenticated;

create or replace function internal_security.start_document_acknowledgement_internal(
  requested_process_definition_id uuid,
  requested_subject_employee_id uuid,
  requested_document_id uuid,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  definition_row public.process_definitions%rowtype;
  document_row public.employee_documents%rowtype;
  process_result jsonb;
  started_process_instance_id uuid;
  item_row public.process_work_items%rowtype;
  form_info jsonb;
begin
  if actor_user_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if requested_idempotency_key is null or pg_catalog.btrim(requested_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001';
  end if;

  select definition.* into definition_row
  from public.process_definitions definition
  join public.process_recipe_activations activation
    on activation.tenant_id = definition.tenant_id
   and activation.hr_group_id = definition.hr_group_id
   and activation.process_definition_id = definition.id
  join public.process_recipe_catalog recipe on recipe.id = activation.process_recipe_id
  where definition.id = requested_process_definition_id
    and definition.status = 'PUBLISHED'::public.process_definition_status
    and recipe.recipe_key = 'document-acknowledgement'
    and recipe.status = 'PUBLISHED';
  if definition_row.id is null then raise exception 'DOCUMENT_ACKNOWLEDGEMENT_RECIPE_NOT_PUBLISHED' using errcode = 'P0002'; end if;
  if not internal_security.current_user_has_hr_group_permission(
    definition_row.tenant_id, definition_row.hr_group_id, 'process-instance:start'
  ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select document.* into document_row
  from public.employee_documents document
  where document.tenant_id = definition_row.tenant_id
    and document.administration_id = definition_row.administration_id
    and document.id = requested_document_id
    and document.employee_id = requested_subject_employee_id
    and document.deleted_at is null
    and exists (
      select 1 from public.document_audiences audience
      where audience.tenant_id = document.tenant_id
        and audience.administration_id = document.administration_id
        and audience.document_id = document.id
        and audience.target_type = 'EMPLOYEE'::public.document_target_type
        and audience.target_employee_id = requested_subject_employee_id
    );
  if document_row.id is null then raise exception 'DOCUMENT_ACKNOWLEDGEMENT_DOCUMENT_NOT_FOUND' using errcode = 'P0002'; end if;

  select internal_security.start_process(
    requested_process_definition_id,
    requested_subject_employee_id,
    null,
    current_date,
    requested_idempotency_key,
    requested_correlation_id
  ) into process_result;
  started_process_instance_id := (process_result ->> 'processInstanceId')::uuid;

  update public.process_instances instance
  set metadata = jsonb_set(
    coalesce(instance.metadata, '{}'::jsonb),
    '{fields}',
    coalesce(instance.metadata -> 'fields', '{}'::jsonb) || jsonb_build_object(
      'document', jsonb_build_object(
        'id', document_row.id,
        'label', document_row.title,
        'originalFilename', document_row.original_filename,
        'contentType', document_row.content_type,
        'fileSize', document_row.file_size,
        'checksumSha256', document_row.checksum_sha256
      ),
      'documentId', document_row.id
    ),
    true
  )
  where instance.tenant_id = definition_row.tenant_id
    and instance.hr_group_id = definition_row.hr_group_id
    and instance.id = started_process_instance_id;

  select item.* into item_row
  from public.process_work_items item
  where item.tenant_id = definition_row.tenant_id
    and item.hr_group_id = definition_row.hr_group_id
    and item.process_instance_id = started_process_instance_id
    and item.step_key = 'acknowledge'
  order by item.created_at desc
  limit 1;
  if item_row.id is null then raise exception 'DOCUMENT_ACKNOWLEDGEMENT_WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;

  form_info := internal_security.resolve_process_form_definition(
    definition_row.tenant_id, definition_row.hr_group_id, item_row.process_version_id, item_row.step_key
  );
  insert into public.process_form_responses (
    tenant_id, hr_group_id, process_instance_id, step_instance_id, work_item_id,
    process_version_id, form_version_id, form_key, participant_key, revision,
    expected_version, current_values, new_values, last_saved_by_user_id, correlation_id
  ) values (
    item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, item_row.step_instance_id, item_row.id,
    item_row.process_version_id, nullif(form_info ->> 'formVersionId', '')::uuid, form_info ->> 'formKey', item_row.participant_key,
    1, 1,
    jsonb_build_object('document', jsonb_build_object(
      'id', document_row.id,
      'label', document_row.title,
      'originalFilename', document_row.original_filename,
      'contentType', document_row.content_type,
      'fileSize', document_row.file_size,
      'checksumSha256', document_row.checksum_sha256
    )),
    jsonb_build_object('acknowledged', false), actor_user_id,
    coalesce(requested_correlation_id, (process_result ->> 'correlationId')::uuid)
  )
  on conflict (tenant_id, hr_group_id, work_item_id) do nothing;

  return process_result || jsonb_build_object(
    'adapterKey', 'DOCUMENT_ACKNOWLEDGEMENT',
    'documentId', document_row.id,
    'documentTitle', document_row.title,
    'documentChecksumSha256', document_row.checksum_sha256,
    'workItemId', item_row.id
  );
end;
$$;

revoke all on function internal_security.start_document_acknowledgement_internal(uuid, uuid, uuid, text, uuid) from public, anon, authenticated;

create or replace function public.start_document_acknowledgement(
  requested_process_definition_id uuid,
  requested_subject_employee_id uuid,
  requested_document_id uuid,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.start_document_acknowledgement_internal(
    requested_process_definition_id,
    requested_subject_employee_id,
    requested_document_id,
    requested_idempotency_key,
    requested_correlation_id
  );
$$;

revoke all on function public.start_document_acknowledgement(uuid, uuid, uuid, text, uuid) from public, anon;
grant execute on function public.start_document_acknowledgement(uuid, uuid, uuid, text, uuid) to authenticated;

create or replace function internal_security.acknowledge_document_process_work_item_internal(
  requested_work_item_id uuid,
  requested_expected_version bigint,
  requested_step_expected_version bigint,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_employee_id uuid;
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  response_row public.process_form_responses%rowtype;
  document_row public.employee_documents%rowtype;
  domain_commit_row public.process_domain_commits%rowtype;
  document_value jsonb;
  document_id_text text;
  resolved_document_id uuid;
  subject_employee_id uuid;
  acknowledgement_id uuid;
  inserted_acknowledgement boolean := false;
  base_result jsonb;
  action_result jsonb;
  final_result jsonb;
begin
  if actor_user_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
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
  if instance_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;

  select item.* into item_row
  from public.process_work_items item
  where item.tenant_id = instance_row.tenant_id
    and item.hr_group_id = instance_row.hr_group_id
    and item.id = requested_work_item_id
  for update;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if item_row.step_key <> 'acknowledge' then raise exception 'DOCUMENT_ACKNOWLEDGEMENT_STEP_INVALID' using errcode = 'P0001'; end if;
  if not exists (
    select 1
    from public.process_recipe_activations activation
    join public.process_recipe_catalog recipe on recipe.id = activation.process_recipe_id
    where activation.tenant_id = instance_row.tenant_id
      and activation.hr_group_id = instance_row.hr_group_id
      and activation.process_definition_id = instance_row.process_definition_id
      and recipe.recipe_key = 'document-acknowledgement'
  ) then raise exception 'DOCUMENT_ACKNOWLEDGEMENT_RECIPE_INVALID' using errcode = 'P0001'; end if;

  select domain_commit.* into domain_commit_row
  from public.process_domain_commits domain_commit
  where domain_commit.tenant_id = instance_row.tenant_id
    and domain_commit.hr_group_id = instance_row.hr_group_id
    and domain_commit.process_instance_id = instance_row.id
    and domain_commit.adapter_key = 'DOCUMENT_ACKNOWLEDGEMENT';
  if domain_commit_row.id is not null then return domain_commit_row.result; end if;

  actor_employee_id := internal_security.current_employee_id(instance_row.tenant_id, instance_row.hr_group_id);
  if actor_employee_id is null or not internal_security.process_form_actor_allowed(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, item_row.id, actor_user_id, actor_employee_id
  ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if item_row.status not in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status) then
    raise exception 'WORK_ITEM_NOT_OPEN' using errcode = 'P0001';
  end if;
  if item_row.expected_version <> requested_expected_version then raise exception 'STALE_STATE' using errcode = 'P0001'; end if;

  select response.* into response_row
  from public.process_form_responses response
  where response.tenant_id = item_row.tenant_id
    and response.hr_group_id = item_row.hr_group_id
    and response.work_item_id = item_row.id
  for update;
  if response_row.id is null then raise exception 'DOCUMENT_ACKNOWLEDGEMENT_FORM_MISSING' using errcode = 'P0001'; end if;
  if requested_step_expected_version is not null and requested_step_expected_version <> (
    select step.expected_version
    from public.process_step_instances step
    where step.tenant_id = item_row.tenant_id
      and step.hr_group_id = item_row.hr_group_id
      and step.id = item_row.step_instance_id
  ) then raise exception 'STALE_STATE' using errcode = 'P0001'; end if;
  if coalesce(response_row.new_values -> 'acknowledged', 'false'::jsonb) <> 'true'::jsonb then
    raise exception 'DOCUMENT_ACKNOWLEDGEMENT_CONFIRMATION_REQUIRED' using errcode = 'P0001';
  end if;

  document_value := coalesce(response_row.current_values -> 'document', response_row.new_values -> 'document');
  document_id_text := coalesce(document_value ->> 'id', document_value #>> '{}');
  if document_id_text is null or document_id_text !~* '^[0-9a-f-]{36}$' then
    raise exception 'DOCUMENT_ACKNOWLEDGEMENT_DOCUMENT_REQUIRED' using errcode = 'P0001';
  end if;
  resolved_document_id := document_id_text::uuid;
  select subject.employee_id into subject_employee_id
  from public.process_employee_subjects subject
  where subject.tenant_id = instance_row.tenant_id
    and subject.hr_group_id = instance_row.hr_group_id
    and subject.process_instance_id = instance_row.id;
  select document.* into document_row
  from public.employee_documents document
  where document.tenant_id = instance_row.tenant_id
    and document.administration_id = instance_row.administration_id
    and document.id = resolved_document_id
    and document.employee_id = subject_employee_id
    and document.deleted_at is null
    and exists (
      select 1 from public.document_audiences audience
      where audience.tenant_id = document.tenant_id
        and audience.administration_id = document.administration_id
        and audience.document_id = document.id
        and audience.target_type = 'EMPLOYEE'::public.document_target_type
        and audience.target_employee_id = subject_employee_id
    );
  if document_row.id is null then raise exception 'DOCUMENT_ACKNOWLEDGEMENT_DOCUMENT_NOT_FOUND' using errcode = 'P0002'; end if;

  insert into public.employee_document_acknowledgements (
    tenant_id, hr_group_id, administration_id, employee_id, document_id,
    process_instance_id, work_item_id, acknowledged_by_user_id,
    document_checksum_sha256
  ) values (
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.administration_id, subject_employee_id, document_row.id,
    instance_row.id, item_row.id, actor_user_id, document_row.checksum_sha256
  ) on conflict (tenant_id, hr_group_id, employee_id, document_id) do nothing
  returning id into acknowledgement_id;
  inserted_acknowledgement := acknowledgement_id is not null;
  if acknowledgement_id is null then
    select acknowledgement.id into acknowledgement_id
    from public.employee_document_acknowledgements acknowledgement
    where acknowledgement.tenant_id = instance_row.tenant_id
      and acknowledgement.hr_group_id = instance_row.hr_group_id
      and acknowledgement.employee_id = subject_employee_id
      and acknowledgement.document_id = document_row.id;
  end if;

  update public.process_form_responses
  set status = 'SUBMITTED'
  where id = response_row.id;

  base_result := jsonb_build_object(
    'adapterKey', 'DOCUMENT_ACKNOWLEDGEMENT',
    'acknowledgementId', acknowledgement_id,
    'documentId', document_row.id,
    'documentTitle', document_row.title,
    'documentChecksumSha256', document_row.checksum_sha256,
    'alreadyAcknowledged', not inserted_acknowledgement,
    'writesPerformed', inserted_acknowledgement
  );
  insert into public.process_domain_commits (
    tenant_id, hr_group_id, process_instance_id, work_item_id, adapter_key,
    correlation_id, idempotency_key, result, created_by_user_id
  ) values (
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, item_row.id, 'DOCUMENT_ACKNOWLEDGEMENT',
    coalesce(requested_correlation_id, instance_row.correlation_id), pg_catalog.btrim(requested_idempotency_key), base_result, actor_user_id
  ) on conflict (process_instance_id, adapter_key) do nothing
  returning * into domain_commit_row;
  if domain_commit_row.id is null then
    select domain_commit.* into domain_commit_row
    from public.process_domain_commits domain_commit
    where domain_commit.tenant_id = instance_row.tenant_id
      and domain_commit.hr_group_id = instance_row.hr_group_id
      and domain_commit.process_instance_id = instance_row.id
      and domain_commit.adapter_key = 'DOCUMENT_ACKNOWLEDGEMENT';
    return domain_commit_row.result;
  end if;

  action_result := internal_security.perform_process_work_item_action(
    item_row.id,
    'ACKNOWLEDGE',
    requested_expected_version,
    requested_step_expected_version,
    requested_idempotency_key,
    requested_correlation_id
  );
  final_result := action_result || base_result;
  update public.process_domain_commits
  set result = final_result
  where id = domain_commit_row.id;
  return final_result;
end;
$$;

revoke all on function internal_security.acknowledge_document_process_work_item_internal(uuid, bigint, bigint, text, uuid) from public, anon, authenticated;

create or replace function public.acknowledge_document_process_work_item(
  requested_work_item_id uuid,
  requested_expected_version bigint,
  requested_step_expected_version bigint,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.acknowledge_document_process_work_item_internal(
    requested_work_item_id,
    requested_expected_version,
    requested_step_expected_version,
    requested_idempotency_key,
    requested_correlation_id
  );
$$;

revoke all on function public.acknowledge_document_process_work_item(uuid, bigint, bigint, text, uuid) from public, anon;
grant execute on function public.acknowledge_document_process_work_item(uuid, bigint, bigint, text, uuid) to authenticated;

create or replace function internal_security.get_document_acknowledgement_document_internal(
  requested_work_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_employee_id uuid;
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  response_row public.process_form_responses%rowtype;
  document_row public.employee_documents%rowtype;
  document_value jsonb;
  document_id_text text;
  document_id uuid;
  subject_employee_id uuid;
begin
  if actor_user_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  select item.* into item_row from public.process_work_items item where item.id = requested_work_item_id;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  select instance.* into instance_row
  from public.process_instances instance
  where instance.tenant_id = item_row.tenant_id
    and instance.hr_group_id = item_row.hr_group_id
    and instance.id = item_row.process_instance_id;
  actor_employee_id := internal_security.current_employee_id(instance_row.tenant_id, instance_row.hr_group_id);
  if actor_employee_id is null or not internal_security.process_form_actor_allowed(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, item_row.id, actor_user_id, actor_employee_id
  ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select response.* into response_row
  from public.process_form_responses response
  where response.tenant_id = item_row.tenant_id
    and response.hr_group_id = item_row.hr_group_id
    and response.work_item_id = item_row.id;
  document_value := coalesce(response_row.current_values -> 'document', response_row.new_values -> 'document');
  document_id_text := coalesce(document_value ->> 'id', document_value #>> '{}');
  if document_id_text is null or document_id_text !~* '^[0-9a-f-]{36}$' then
    raise exception 'DOCUMENT_ACKNOWLEDGEMENT_DOCUMENT_REQUIRED' using errcode = 'P0001';
  end if;
  document_id := document_id_text::uuid;
  select subject.employee_id into subject_employee_id
  from public.process_employee_subjects subject
  where subject.tenant_id = instance_row.tenant_id
    and subject.hr_group_id = instance_row.hr_group_id
    and subject.process_instance_id = instance_row.id;
  select document.* into document_row
  from public.employee_documents document
  where document.tenant_id = instance_row.tenant_id
    and document.administration_id = instance_row.administration_id
    and document.id = document_id
    and document.employee_id = subject_employee_id
    and document.deleted_at is null;
  if document_row.id is null then raise exception 'DOCUMENT_ACKNOWLEDGEMENT_DOCUMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'documentId', document_row.id,
    'employeeId', subject_employee_id,
    'title', document_row.title,
    'originalFilename', document_row.original_filename,
    'contentType', document_row.content_type,
    'checksumSha256', document_row.checksum_sha256,
    'acknowledged', exists (
      select 1 from public.employee_document_acknowledgements acknowledgement
      where acknowledgement.process_instance_id = instance_row.id
        and acknowledgement.document_id = document_row.id
    )
  );
end;
$$;

revoke all on function internal_security.get_document_acknowledgement_document_internal(uuid) from public, anon, authenticated;

create or replace function public.get_document_acknowledgement_document(
  requested_work_item_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.get_document_acknowledgement_document_internal(requested_work_item_id);
$$;

revoke all on function public.get_document_acknowledgement_document(uuid) from public, anon;
grant execute on function public.get_document_acknowledgement_document(uuid) to authenticated;

commit;
