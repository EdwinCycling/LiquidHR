begin;

alter table public.tenant_modules drop constraint if exists tenant_modules_module_code_check;
alter table public.tenant_modules add constraint tenant_modules_module_code_check
  check (module_code in ('HERA', 'DOCUMENTS', 'REMINDERS', 'TALENT', 'SURVEYS', 'ENPS', 'TEAM_COMPASS', 'JOURNEYS', 'RECRUITMENT', 'PAYROLL', 'PERFORMANCE_REVIEW_QUESTION_SETS'));

create table public.performance_review_question_sets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  hr_group_id uuid not null,
  name text not null check (length(btrim(name)) between 2 and 120),
  description text not null default '' check (length(description) <= 1000),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'AVAILABLE', 'ARCHIVED')),
  questions jsonb not null,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id)
);

create index performance_review_question_sets_scope_status_idx
  on public.performance_review_question_sets (tenant_id, hr_group_id, status, updated_at desc);

create table public.performance_review_question_set_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  question_set_id uuid not null references public.performance_review_question_sets(id),
  actor_user_id uuid not null references auth.users(id),
  action text not null check (action in ('CREATED', 'UPDATED', 'PUBLISHED', 'ARCHIVED', 'DUPLICATED')),
  version integer not null check (version > 0),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id)
);

create index performance_review_question_set_audit_events_set_idx
  on public.performance_review_question_set_audit_events (tenant_id, question_set_id, created_at);

create table public.performance_review_round_question_sets (
  round_id uuid primary key references public.performance_review_rounds(id),
  tenant_id uuid not null references public.tenants(id),
  hr_group_id uuid not null,
  enabled boolean not null default true,
  defaults jsonb not null check (jsonb_typeof(defaults) = 'object'),
  participant_overrides jsonb not null default '{}'::jsonb check (jsonb_typeof(participant_overrides) = 'object'),
  published_defaults_snapshot jsonb,
  published_at timestamptz,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id),
  check (published_defaults_snapshot is null or jsonb_typeof(published_defaults_snapshot) = 'object'),
  check ((published_defaults_snapshot is null) = (published_at is null))
);

create index performance_review_round_question_sets_scope_idx
  on public.performance_review_round_question_sets (tenant_id, hr_group_id, round_id);

create table public.performance_review_dossier_question_snapshots (
  tenant_id uuid not null references public.tenants(id),
  hr_group_id uuid not null,
  round_id uuid not null references public.performance_review_rounds(id),
  dossier_id uuid not null,
  respondent_role text not null check (respondent_role in ('EMPLOYEE', 'GV', 'AB')),
  selection_source text not null check (selection_source in ('ROUND_DEFAULT', 'OVERRIDE_SET', 'OVERRIDE_NONE', 'NO_DEFAULT')),
  source_set_id uuid references public.performance_review_question_sets(id),
  source_set_name text,
  source_set_version integer,
  definition_json jsonb,
  created_at timestamptz not null default now(),
  primary key (dossier_id, respondent_role),
  foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id),
  foreign key (tenant_id, dossier_id) references public.performance_review_dossiers(tenant_id, id),
  check ((source_set_id is null and source_set_name is null and source_set_version is null and definition_json is null)
      or (source_set_id is not null and source_set_name is not null and source_set_version > 0 and jsonb_typeof(definition_json) = 'array'))
);

create index performance_review_dossier_question_snapshots_scope_idx
  on public.performance_review_dossier_question_snapshots (tenant_id, hr_group_id, round_id, respondent_role);

create table public.performance_review_pending_question_overrides (
  round_id uuid not null references public.performance_review_rounds(id) on delete cascade,
  employee_id uuid not null,
  overrides jsonb not null check (jsonb_typeof(overrides) = 'object'),
  actor_user_id uuid not null references auth.users(id),
  primary key (round_id, employee_id)
);

alter table public.performance_review_submissions
  add column question_answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(question_answers) = 'object');

alter table public.performance_review_draft_archives
  add column question_answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(question_answers) = 'object');

alter table public.performance_review_audit_events
  drop constraint performance_review_audit_events_action_check;
alter table public.performance_review_audit_events
  add constraint performance_review_audit_events_action_check check (action in (
    'ROUND_CREATED', 'ROUND_PUBLISHED', 'ROUND_ACTIVATED', 'ROUND_CANCELLED', 'ROUND_DRAFT_UPDATED',
    'DOSSIER_CREATED', 'REVIEWER_REASSIGNED', 'SELF_SAVED', 'SELF_SUBMITTED', 'MANAGER_SAVED',
    'MANAGER_SUBMITTED', 'ACKNOWLEDGED', 'PRIVATE_NOTE_SAVED', 'ATTACHMENT_ADDED',
    'ATTACHMENT_REMOVED', 'APPRAISAL_LINKED', 'ROUND_CLOSED',
    'ADDITIONAL_REVIEWER_ENABLED', 'ADDITIONAL_REVIEWER_ASSIGNED', 'ADDITIONAL_REVIEWER_REPLACED',
    'ADDITIONAL_REVIEWER_RELEASED', 'REVIEWERS_SWAPPED', 'REVIEWERS_BULK_SWAPPED',
    'ADDITIONAL_REVIEWER_SAVED', 'ADDITIONAL_REVIEWER_SUBMITTED', 'REVIEWER_CLOSED',
    'PMUX_RESTARTED_FOR_ROLE_CHANGE', 'QUESTION_SETS_CONFIGURED', 'QUESTION_SET_OVERRIDE_CONFIGURED',
    'QUESTION_SET_SNAPSHOT_CREATED'
  ));

create or replace function internal_security.performance_review_question_sets_enabled(requested_tenant uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tenant_modules module
    where module.tenant_id = requested_tenant
      and module.module_code = 'PERFORMANCE_REVIEW_QUESTION_SETS'
      and module.is_enabled
  )
$$;

create or replace function internal_security.performance_review_localized_label_valid(value jsonb)
returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(value) = 'object'
    and length(btrim(coalesce(value->>'nl', ''))) between 1 and 1000
    and length(btrim(coalesce(value->>'en', ''))) between 1 and 1000
$$;

create or replace function internal_security.performance_review_question_set_definition_valid(definition jsonb)
returns boolean
language plpgsql immutable set search_path = '' as $$
declare item jsonb; option_item jsonb; row_item jsonb; question_id text; question_type text;
  question_count integer; option_count integer; row_count integer; selected_scale integer;
begin
  if jsonb_typeof(definition) <> 'array' then return false; end if;
  question_count := jsonb_array_length(definition);
  if question_count < 1 or question_count > 80 then return false; end if;
  if (select count(distinct question->>'id') from jsonb_array_elements(definition) question) <> question_count then return false; end if;
  for item in select value from jsonb_array_elements(definition) loop
    question_id := item->>'id';
    question_type := item->>'type';
    if jsonb_typeof(item) <> 'object' or question_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or not internal_security.performance_review_localized_label_valid(item->'prompt')
      or jsonb_typeof(item->'required') <> 'boolean'
      or (item ? 'help' and not internal_security.performance_review_localized_label_valid(item->'help')) then return false; end if;
    if question_type in ('SHORT_TEXT', 'LONG_TEXT') then continue; end if;
    if question_type = 'YES_NO' then
      if item->>'variant' not in ('YES_NO', 'AGREE_DISAGREE') then return false; end if;
      continue;
    end if;
    if question_type = 'SCALE' then
      if (item->>'scale') !~ '^(4|5|10)$' or jsonb_typeof(coalesce(item->'labels', '[]'::jsonb)) <> 'array'
        or jsonb_array_length(coalesce(item->'labels', '[]'::jsonb)) > 10 then return false; end if;
      selected_scale := (item->>'scale')::integer;
      for option_item in select value from jsonb_array_elements(coalesce(item->'labels', '[]'::jsonb)) loop
        if (option_item->>'value') !~ '^[0-9]+$' or (option_item->>'value')::integer not between 1 and selected_scale
          or not internal_security.performance_review_localized_label_valid(option_item->'label') then return false; end if;
      end loop;
      if (select count(distinct (label->>'value')::integer) from jsonb_array_elements(coalesce(item->'labels', '[]'::jsonb)) label) <> jsonb_array_length(coalesce(item->'labels', '[]'::jsonb)) then return false; end if;
      continue;
    end if;
    if question_type in ('SINGLE_CHOICE', 'MULTI_CHOICE') or (question_type = 'MATRIX' and item->>'matrixMode' = 'CHOICE') then
      if question_type = 'MATRIX' then
        if jsonb_typeof(item->'rows') <> 'array' or jsonb_array_length(item->'rows') not between 1 and 30 then return false; end if;
        for row_item in select value from jsonb_array_elements(item->'rows') loop
          if not (row_item ? 'id') or row_item->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            or not internal_security.performance_review_localized_label_valid(row_item->'label') then return false; end if;
        end loop;
        row_count := jsonb_array_length(item->'rows');
        if (select count(distinct row_value->>'id') from jsonb_array_elements(item->'rows') row_value) <> row_count then return false; end if;
      end if;
      if jsonb_typeof(item->'options') <> 'array' or jsonb_array_length(item->'options') not between 2 and (case when question_type = 'MATRIX' then 20 else 30 end) then return false; end if;
      for option_item in select value from jsonb_array_elements(item->'options') loop
        if not (option_item ? 'id') or option_item->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          or not internal_security.performance_review_localized_label_valid(option_item->'label') then return false; end if;
      end loop;
      option_count := jsonb_array_length(item->'options');
      if (select count(distinct option_value->>'id') from jsonb_array_elements(item->'options') option_value) <> option_count then return false; end if;
      if (select count(distinct option_value->'label'->>'nl') from jsonb_array_elements(item->'options') option_value) <> option_count
        or (select count(distinct option_value->'label'->>'en') from jsonb_array_elements(item->'options') option_value) <> option_count then return false; end if;
      if question_type = 'MATRIX' and (
        (select count(distinct row_value->'label'->>'nl') from jsonb_array_elements(item->'rows') row_value) <> row_count
        or (select count(distinct row_value->'label'->>'en') from jsonb_array_elements(item->'rows') row_value) <> row_count
      ) then return false; end if;
      continue;
    end if;
    if question_type = 'MATRIX' and item->>'matrixMode' = 'SCALE' then
      if jsonb_typeof(item->'rows') <> 'array' or jsonb_array_length(item->'rows') not between 1 and 30
        or (item->>'scale') !~ '^(4|5|10)$' or jsonb_typeof(coalesce(item->'labels', '[]'::jsonb)) <> 'array'
        or jsonb_array_length(coalesce(item->'labels', '[]'::jsonb)) > 10 then return false; end if;
      for row_item in select value from jsonb_array_elements(item->'rows') loop
        if row_item->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          or not internal_security.performance_review_localized_label_valid(row_item->'label') then return false; end if;
      end loop;
      row_count := jsonb_array_length(item->'rows');
      if (select count(distinct row_value->>'id') from jsonb_array_elements(item->'rows') row_value) <> row_count then return false; end if;
      if (select count(distinct row_value->'label'->>'nl') from jsonb_array_elements(item->'rows') row_value) <> row_count
        or (select count(distinct row_value->'label'->>'en') from jsonb_array_elements(item->'rows') row_value) <> row_count then return false; end if;
      selected_scale := (item->>'scale')::integer;
      for option_item in select value from jsonb_array_elements(coalesce(item->'labels', '[]'::jsonb)) loop
        if (option_item->>'value') !~ '^[0-9]+$' or (option_item->>'value')::integer not between 1 and selected_scale
          or not internal_security.performance_review_localized_label_valid(option_item->'label') then return false; end if;
      end loop;
      continue;
    end if;
    return false;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

create or replace function internal_security.performance_review_question_answers_valid(definition jsonb, answers jsonb, require_complete boolean)
returns boolean
language plpgsql immutable set search_path = '' as $$
declare answer_item record; question jsonb; question_item jsonb; choice_item jsonb; row_item jsonb;
  question_id text; question_type text; answer_value jsonb; answer_text text; row_count integer;
begin
  if jsonb_typeof(definition) <> 'array' or jsonb_typeof(answers) <> 'object'
    or not internal_security.performance_review_question_set_definition_valid(definition) then return false; end if;
  for answer_item in select key, value from jsonb_each(answers) loop
    question_id := answer_item.key;
    answer_value := answer_item.value;
    select value into question from jsonb_array_elements(definition) where value->>'id' = question_id;
    if question is null or answer_value = 'null'::jsonb then return false; end if;
    question_type := question->>'type';
    if question_type in ('SHORT_TEXT', 'LONG_TEXT') then
      if jsonb_typeof(answer_value) <> 'string' then return false; end if;
      answer_text := answer_value #>> '{}';
      if length(answer_text) > (case when question_type = 'SHORT_TEXT' then 500 else 5000 end) then return false; end if;
    elsif question_type in ('SINGLE_CHOICE', 'MULTI_CHOICE') then
      if question_type = 'SINGLE_CHOICE' and jsonb_typeof(answer_value) <> 'string' then return false; end if;
      if question_type = 'MULTI_CHOICE' and jsonb_typeof(answer_value) <> 'array' then return false; end if;
      if question_type = 'SINGLE_CHOICE' then
        if not exists (select 1 from jsonb_array_elements(question->'options') choice where choice->>'id' = answer_value #>> '{}') then return false; end if;
      else
        if (select count(distinct value #>> '{}') from jsonb_array_elements(answer_value)) <> jsonb_array_length(answer_value) then return false; end if;
        for choice_item in select value from jsonb_array_elements(answer_value) loop
          if jsonb_typeof(choice_item) <> 'string' or not exists (select 1 from jsonb_array_elements(question->'options') choice where choice->>'id' = choice_item #>> '{}') then return false; end if;
        end loop;
      end if;
    elsif question_type = 'YES_NO' then
      if jsonb_typeof(answer_value) <> 'string'
        or (question->>'variant' = 'YES_NO' and answer_value #>> '{}' not in ('YES', 'NO'))
        or (question->>'variant' = 'AGREE_DISAGREE' and answer_value #>> '{}' not in ('AGREE', 'DISAGREE')) then return false; end if;
    elsif question_type = 'SCALE' then
      if jsonb_typeof(answer_value) <> 'number' or (answer_value #>> '{}') !~ '^[0-9]+$'
        or (answer_value #>> '{}')::integer not between 1 and (question->>'scale')::integer then return false; end if;
    elsif question_type = 'MATRIX' then
      if jsonb_typeof(answer_value) <> 'object' then return false; end if;
      for answer_item in select key, value from jsonb_each(answer_value) loop
        select value into row_item from jsonb_array_elements(question->'rows') where value->>'id' = answer_item.key;
        if row_item is null then return false; end if;
        if question->>'matrixMode' = 'CHOICE' then
          if jsonb_typeof(answer_item.value) <> 'string' or not exists (
            select 1 from jsonb_array_elements(question->'options') choice where choice->>'id' = answer_item.value #>> '{}'
          ) then return false; end if;
        else
          if jsonb_typeof(answer_item.value) <> 'number' or (answer_item.value #>> '{}') !~ '^[0-9]+$'
            or (answer_item.value #>> '{}')::integer not between 1 and (question->>'scale')::integer then return false; end if;
        end if;
      end loop;
    else
      return false;
    end if;
  end loop;
  if not require_complete then return true; end if;
  for question_item in select value from jsonb_array_elements(definition) loop
    question_id := question_item->>'id';
    answer_value := answers->question_id;
    if coalesce((question_item->>'required')::boolean, false) then
      if answer_value is null then return false; end if;
      if question_item->>'type' in ('SHORT_TEXT', 'LONG_TEXT') and length(btrim(answer_value #>> '{}')) = 0 then return false; end if;
      if question_item->>'type' = 'MULTI_CHOICE' and jsonb_array_length(answer_value) = 0 then return false; end if;
      if question_item->>'type' = 'MATRIX' then
        row_count := jsonb_array_length(question_item->'rows');
        if (select count(*) from jsonb_each(answer_value)) <> row_count then return false; end if;
      end if;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

create or replace function internal_security.performance_review_question_role_visible(requested_dossier uuid, requested_role text)
returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare dossier_row public.performance_review_dossiers;
begin
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier;
  if dossier_row.id is null then return false; end if;
  if internal_security.performance_review_can_manage(dossier_row.tenant_id, dossier_row.hr_group_id) then return true; end if;
  if requested_role = 'EMPLOYEE' then
    return internal_security.current_employee_id(dossier_row.tenant_id, dossier_row.hr_group_id) = dossier_row.employee_id;
  elsif requested_role = 'GV' then
    return internal_security.current_employee_id(dossier_row.tenant_id, dossier_row.hr_group_id) = dossier_row.reviewer_employee_id
      and (dossier_row.reviewer_assignment_override or coalesce(internal_security.can_manage_employee(dossier_row.employee_id, 'performance-review:team-read'), false));
  elsif requested_role = 'AB' then
    return dossier_row.additional_reviewer_employee_id is not null
      and internal_security.current_employee_id(dossier_row.tenant_id, dossier_row.hr_group_id) = dossier_row.additional_reviewer_employee_id;
  end if;
  return false;
end;
$$;

create or replace function internal_security.performance_review_jsonb_object_size(value jsonb)
returns integer
language sql immutable set search_path = '' as $$
  select count(*)::integer from jsonb_object_keys(value)
$$;

create or replace function internal_security.performance_review_question_set_snapshot(source_set uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('sourceSetId', set_row.id, 'sourceSetName', set_row.name,
    'sourceSetVersion', set_row.version, 'questions', set_row.questions)
  from public.performance_review_question_sets set_row where set_row.id = source_set
$$;

create or replace function internal_security.performance_review_insert_dossier_question_snapshot(
  requested_dossier uuid, requested_role text, requested_default jsonb, requested_override jsonb
)
returns void
language plpgsql security definer set search_path = '' as $$
declare dossier_row public.performance_review_dossiers; config_row public.performance_review_round_question_sets;
  source_row public.performance_review_question_sets; selected_snapshot jsonb; selection text; selected_id uuid;
begin
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier;
  if dossier_row.id is null then raise exception 'PERFORMANCE_DOSSIER_NOT_FOUND'; end if;
  select * into config_row from public.performance_review_round_question_sets where round_id = dossier_row.round_id;
  if config_row.round_id is null or not config_row.enabled or config_row.published_at is null then return; end if;
  selection := 'ROUND_DEFAULT';
  if requested_override is not null and jsonb_typeof(requested_override) = 'object' then
    if requested_override->>'mode' = 'NONE' then
      selection := 'OVERRIDE_NONE'; selected_snapshot := null;
    elsif requested_override->>'mode' = 'SET' and (requested_override->>'questionSetId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      selected_id := (requested_override->>'questionSetId')::uuid;
      select * into source_row from public.performance_review_question_sets where id = selected_id
        and tenant_id = dossier_row.tenant_id and hr_group_id = dossier_row.hr_group_id and status = 'AVAILABLE';
      if source_row.id is null then raise exception 'PERFORMANCE_QUESTION_SET_NOT_AVAILABLE'; end if;
      selection := 'OVERRIDE_SET'; selected_snapshot := internal_security.performance_review_question_set_snapshot(source_row.id);
    else
      raise exception 'PERFORMANCE_QUESTION_SET_OVERRIDE_INVALID';
    end if;
  else
    selected_snapshot := requested_default;
    if coalesce(selected_snapshot->>'sourceSetId', '') = '' then selection := 'NO_DEFAULT'; end if;
  end if;
  insert into public.performance_review_dossier_question_snapshots (
    tenant_id, hr_group_id, round_id, dossier_id, respondent_role, selection_source,
    source_set_id, source_set_name, source_set_version, definition_json
  ) values (
    dossier_row.tenant_id, dossier_row.hr_group_id, dossier_row.round_id, dossier_row.id, requested_role, selection,
    nullif(selected_snapshot->>'sourceSetId', '')::uuid,
    nullif(selected_snapshot->>'sourceSetName', ''),
    nullif(selected_snapshot->>'sourceSetVersion', '')::integer,
    selected_snapshot->'questions'
  );
  insert into public.performance_review_audit_events (tenant_id, round_id, dossier_id, action, details)
  values (dossier_row.tenant_id, dossier_row.round_id, dossier_row.id, 'QUESTION_SET_SNAPSHOT_CREATED',
    jsonb_build_object('respondentRole', requested_role, 'selectionSource', selection,
      'questionSetId', nullif(selected_snapshot->>'sourceSetId', '')::uuid,
      'questionSetVersion', nullif(selected_snapshot->>'sourceSetVersion', '')::integer));
end;
$$;

create or replace function internal_security.performance_review_snapshot_additional_reviewer_questions()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare config_row public.performance_review_round_question_sets; role_override jsonb;
begin
  if old.additional_reviewer_employee_id is not null or new.additional_reviewer_employee_id is null then return new; end if;
  select * into config_row from public.performance_review_round_question_sets where round_id = new.round_id;
  if config_row.round_id is null or not config_row.enabled or config_row.published_at is null then return new; end if;
  if exists (select 1 from public.performance_review_dossier_question_snapshots where dossier_id = new.id and respondent_role = 'AB') then return new; end if;
  role_override := config_row.participant_overrides->new.employee_id::text->'AB';
  perform internal_security.performance_review_insert_dossier_question_snapshot(new.id, 'AB',
    config_row.published_defaults_snapshot->'AB', role_override);
  return new;
end;
$$;

create or replace function internal_security.performance_review_snapshot_question_sets_for_dossier()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare config_row public.performance_review_round_question_sets; pending_row public.performance_review_pending_question_overrides;
  role_code text; defaults_snapshot jsonb; role_override jsonb;
begin
  select * into config_row from public.performance_review_round_question_sets where round_id = new.round_id;
  if config_row.round_id is null or not config_row.enabled or config_row.published_at is null then return new; end if;
  select * into pending_row from public.performance_review_pending_question_overrides
    where round_id = new.round_id and employee_id = new.employee_id;
  for role_code in select unnest(array['EMPLOYEE','GV']::text[]) loop
    defaults_snapshot := config_row.published_defaults_snapshot->role_code;
    role_override := case when pending_row.employee_id is null then config_row.participant_overrides->new.employee_id::text->role_code
      else pending_row.overrides->role_code end;
    perform internal_security.performance_review_insert_dossier_question_snapshot(new.id, role_code, defaults_snapshot, role_override);
  end loop;
  if new.additional_reviewer_employee_id is not null then
    defaults_snapshot := config_row.published_defaults_snapshot->'AB';
    role_override := case when pending_row.employee_id is null then config_row.participant_overrides->new.employee_id::text->'AB'
      else pending_row.overrides->'AB' end;
    perform internal_security.performance_review_insert_dossier_question_snapshot(new.id, 'AB', defaults_snapshot, role_override);
  end if;
  return new;
end;
$$;

create or replace function internal_security.performance_review_snapshot_question_sets_for_round()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare config_row public.performance_review_round_question_sets; role_code text; set_id uuid; set_row public.performance_review_question_sets;
  defaults_snapshot jsonb := '{}'::jsonb; dossier_row public.performance_review_dossiers; role_override jsonb;
begin
  if new.status not in ('SCHEDULED', 'ACTIVE') or old.status not in ('DRAFT', 'SCHEDULED') then return new; end if;
  select * into config_row from public.performance_review_round_question_sets where round_id = new.id for update;
  if config_row.round_id is null or not config_row.enabled or config_row.published_at is not null then return new; end if;
  for role_code in select unnest(array['EMPLOYEE','GV','AB']::text[]) loop
    set_id := nullif(config_row.defaults->>role_code, '')::uuid;
    if set_id is null then
      defaults_snapshot := defaults_snapshot || jsonb_build_object(role_code, null);
    else
      select * into set_row from public.performance_review_question_sets where id = set_id
        and tenant_id = new.tenant_id and hr_group_id = new.hr_group_id and status = 'AVAILABLE' for share;
      if set_row.id is null then raise exception 'PERFORMANCE_QUESTION_SET_NOT_AVAILABLE'; end if;
      defaults_snapshot := defaults_snapshot || jsonb_build_object(role_code, internal_security.performance_review_question_set_snapshot(set_row.id));
    end if;
  end loop;
  update public.performance_review_round_question_sets set published_defaults_snapshot = defaults_snapshot,
    published_at = now(), updated_at = now() where round_id = new.id;
  for dossier_row in select dossier.* from public.performance_review_dossiers dossier where dossier.round_id = new.id loop
    for role_code in select unnest(array['EMPLOYEE','GV']::text[]) loop
      role_override := config_row.participant_overrides->dossier_row.employee_id::text->role_code;
      perform internal_security.performance_review_insert_dossier_question_snapshot(dossier_row.id, role_code, defaults_snapshot->role_code, role_override);
    end loop;
    if dossier_row.additional_reviewer_employee_id is not null then
      role_override := config_row.participant_overrides->dossier_row.employee_id::text->'AB';
      perform internal_security.performance_review_insert_dossier_question_snapshot(dossier_row.id, 'AB', defaults_snapshot->'AB', role_override);
    end if;
  end loop;
  return new;
end;
$$;

create or replace function internal_security.performance_review_question_snapshot_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'PERFORMANCE_QUESTION_SNAPSHOT_IMMUTABLE';
end;
$$;

create or replace function internal_security.performance_review_question_submission_context()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare context_json jsonb; snapshot_row public.performance_review_dossier_question_snapshots;
  required_complete boolean;
begin
  if coalesce(current_setting('liquidhr.performance_review.question_answers', true), '') <> '' then
    context_json := current_setting('liquidhr.performance_review.question_answers', true)::jsonb;
    if context_json->>'dossierId' = new.dossier_id::text and context_json->>'kind' = new.kind then
      new.question_answers := context_json->'answers';
    end if;
  end if;
  select * into snapshot_row from public.performance_review_dossier_question_snapshots
  where dossier_id = new.dossier_id and respondent_role = case new.kind when 'SELF' then 'EMPLOYEE' when 'MANAGER' then 'GV' else 'AB' end;
  if snapshot_row.dossier_id is null or snapshot_row.definition_json is null then
    if new.question_answers <> '{}'::jsonb then raise exception 'PERFORMANCE_QUESTION_ANSWERS_NOT_ASSIGNED'; end if;
    return new;
  end if;
  required_complete := new.submitted_at is not null;
  if not internal_security.performance_review_question_answers_valid(snapshot_row.definition_json, new.question_answers, required_complete) then
    if required_complete then raise exception 'PERFORMANCE_QUESTION_ANSWERS_REQUIRED_OR_INVALID'; end if;
    raise exception 'PERFORMANCE_QUESTION_ANSWERS_INVALID';
  end if;
  return new;
end;
$$;

create or replace function public.save_performance_review_question_set(
  requested_hr_group uuid, requested_id uuid, requested_name text, requested_description text,
  requested_status text, requested_questions jsonb, expected_version integer default null
)
returns public.performance_review_question_sets
language plpgsql security definer set search_path = '' as $$
declare group_row public.hr_groups; set_row public.performance_review_question_sets; event_action text;
begin
  select * into group_row from public.hr_groups where id = requested_hr_group and is_active;
  if group_row.id is null or not internal_security.performance_review_can_manage(group_row.tenant_id, requested_hr_group) then raise exception 'PERFORMANCE_FORBIDDEN'; end if;
  if not internal_security.performance_review_question_sets_enabled(group_row.tenant_id) then raise exception 'PERFORMANCE_QUESTION_SETS_MODULE_INACTIVE'; end if;
  if requested_status not in ('DRAFT', 'AVAILABLE') or length(btrim(coalesce(requested_name, ''))) not between 2 and 120
    or length(coalesce(requested_description, '')) > 1000 or not internal_security.performance_review_question_set_definition_valid(requested_questions) then
    raise exception 'PERFORMANCE_QUESTION_SET_INVALID';
  end if;
  if requested_id is null then
    insert into public.performance_review_question_sets (tenant_id, hr_group_id, name, description, status, questions, created_by, updated_by)
    values (group_row.tenant_id, requested_hr_group, btrim(requested_name), btrim(coalesce(requested_description, '')),
      requested_status, requested_questions, auth.uid(), auth.uid()) returning * into set_row;
    event_action := case when requested_status = 'AVAILABLE' then 'PUBLISHED' else 'CREATED' end;
  else
    select * into set_row from public.performance_review_question_sets where id = requested_id
      and tenant_id = group_row.tenant_id and hr_group_id = requested_hr_group for update;
    if set_row.id is null then raise exception 'PERFORMANCE_QUESTION_SET_NOT_FOUND'; end if;
    if set_row.status = 'ARCHIVED' then raise exception 'PERFORMANCE_QUESTION_SET_ARCHIVED'; end if;
    if expected_version is null or set_row.version <> expected_version then raise exception 'PERFORMANCE_QUESTION_SET_VERSION_CONFLICT'; end if;
    if set_row.status = 'AVAILABLE' and requested_status <> 'AVAILABLE' then raise exception 'PERFORMANCE_QUESTION_SET_STATUS_INVALID'; end if;
    event_action := case when set_row.status = 'DRAFT' and requested_status = 'AVAILABLE' then 'PUBLISHED' else 'UPDATED' end;
    update public.performance_review_question_sets set name = btrim(requested_name), description = btrim(coalesce(requested_description, '')),
      status = requested_status, questions = requested_questions, version = version + 1, updated_by = auth.uid(), updated_at = now()
    where id = requested_id returning * into set_row;
  end if;
  insert into public.performance_review_question_set_audit_events (tenant_id, hr_group_id, question_set_id, actor_user_id, action, version, details)
  values (set_row.tenant_id, set_row.hr_group_id, set_row.id, auth.uid(), event_action, set_row.version,
    jsonb_build_object('questionCount', jsonb_array_length(set_row.questions), 'status', set_row.status));
  return set_row;
end;
$$;

create or replace function public.duplicate_performance_review_question_set(requested_id uuid, requested_name text)
returns public.performance_review_question_sets
language plpgsql security definer set search_path = '' as $$
declare source_row public.performance_review_question_sets; clone_row public.performance_review_question_sets;
begin
  select * into source_row from public.performance_review_question_sets where id = requested_id;
  if source_row.id is null or not internal_security.performance_review_can_manage(source_row.tenant_id, source_row.hr_group_id) then raise exception 'PERFORMANCE_QUESTION_SET_NOT_FOUND'; end if;
  if not internal_security.performance_review_question_sets_enabled(source_row.tenant_id) then raise exception 'PERFORMANCE_QUESTION_SETS_MODULE_INACTIVE'; end if;
  if source_row.status = 'ARCHIVED' or length(btrim(coalesce(requested_name, ''))) not between 2 and 120 then raise exception 'PERFORMANCE_QUESTION_SET_INVALID'; end if;
  insert into public.performance_review_question_sets (tenant_id, hr_group_id, name, description, status, questions, created_by, updated_by)
  values (source_row.tenant_id, source_row.hr_group_id, btrim(requested_name), source_row.description, 'DRAFT', source_row.questions, auth.uid(), auth.uid())
  returning * into clone_row;
  insert into public.performance_review_question_set_audit_events (tenant_id, hr_group_id, question_set_id, actor_user_id, action, version, details)
  values (clone_row.tenant_id, clone_row.hr_group_id, clone_row.id, auth.uid(), 'DUPLICATED', clone_row.version,
    jsonb_build_object('sourceQuestionSetId', source_row.id, 'questionCount', jsonb_array_length(clone_row.questions)));
  return clone_row;
end;
$$;

create or replace function public.archive_performance_review_question_set(requested_id uuid, expected_version integer)
returns public.performance_review_question_sets
language plpgsql security definer set search_path = '' as $$
declare set_row public.performance_review_question_sets;
begin
  select * into set_row from public.performance_review_question_sets where id = requested_id for update;
  if set_row.id is null or not internal_security.performance_review_can_manage(set_row.tenant_id, set_row.hr_group_id) then raise exception 'PERFORMANCE_QUESTION_SET_NOT_FOUND'; end if;
  if not internal_security.performance_review_question_sets_enabled(set_row.tenant_id) then raise exception 'PERFORMANCE_QUESTION_SETS_MODULE_INACTIVE'; end if;
  if set_row.version <> expected_version then raise exception 'PERFORMANCE_QUESTION_SET_VERSION_CONFLICT'; end if;
  if set_row.status = 'ARCHIVED' then return set_row; end if;
  update public.performance_review_question_sets set status = 'ARCHIVED', version = version + 1, updated_by = auth.uid(), updated_at = now()
  where id = requested_id returning * into set_row;
  insert into public.performance_review_question_set_audit_events (tenant_id, hr_group_id, question_set_id, actor_user_id, action, version)
  values (set_row.tenant_id, set_row.hr_group_id, set_row.id, auth.uid(), 'ARCHIVED', set_row.version);
  return set_row;
end;
$$;

create or replace function public.save_performance_review_round_question_sets(
  requested_round uuid, requested_enabled boolean, requested_defaults jsonb, requested_overrides jsonb default '{}'::jsonb
)
returns public.performance_review_round_question_sets
language plpgsql security definer set search_path = '' as $$
declare round_row public.performance_review_rounds; config_row public.performance_review_round_question_sets;
  role_code text; selected_id uuid; override_record record; role_value jsonb;
begin
  select * into round_row from public.performance_review_rounds where id = requested_round for update;
  if round_row.id is null or not internal_security.performance_review_can_manage(round_row.tenant_id, round_row.hr_group_id) then raise exception 'PERFORMANCE_FORBIDDEN'; end if;
  if round_row.status <> 'DRAFT' then raise exception 'PERFORMANCE_QUESTION_SET_CONFIG_IMMUTABLE'; end if;
  if requested_enabled and not internal_security.performance_review_question_sets_enabled(round_row.tenant_id) then raise exception 'PERFORMANCE_QUESTION_SETS_MODULE_INACTIVE'; end if;
  if requested_enabled and (jsonb_typeof(requested_defaults) <> 'object' or jsonb_typeof(coalesce(requested_overrides, '{}'::jsonb)) <> 'object') then raise exception 'PERFORMANCE_QUESTION_SET_CONFIG_INVALID'; end if;
  for role_code in select unnest(array['EMPLOYEE','GV','AB']::text[]) loop
    if requested_enabled and not requested_defaults ? role_code then raise exception 'PERFORMANCE_QUESTION_SET_CONFIG_INVALID'; end if;
    if requested_enabled and requested_defaults->role_code <> 'null'::jsonb then
      if jsonb_typeof(requested_defaults->role_code) <> 'string' or (requested_defaults->>role_code) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'PERFORMANCE_QUESTION_SET_CONFIG_INVALID'; end if;
      selected_id := (requested_defaults->>role_code)::uuid;
      if not exists (select 1 from public.performance_review_question_sets question_set where question_set.id = selected_id
        and question_set.tenant_id = round_row.tenant_id and question_set.hr_group_id = round_row.hr_group_id and question_set.status = 'AVAILABLE') then
        raise exception 'PERFORMANCE_QUESTION_SET_NOT_AVAILABLE';
      end if;
    end if;
  end loop;
  if requested_enabled then
    for override_record in select key, value from jsonb_each(coalesce(requested_overrides, '{}'::jsonb)) loop
      if override_record.key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or not exists (select 1 from public.performance_review_dossiers dossier where dossier.round_id = requested_round and dossier.employee_id = override_record.key::uuid)
        or jsonb_typeof(override_record.value) <> 'object' then raise exception 'PERFORMANCE_QUESTION_SET_OVERRIDE_INVALID'; end if;
      for role_code in select jsonb_object_keys(override_record.value) loop
        role_value := override_record.value->role_code;
        if role_code not in ('EMPLOYEE','GV','AB') or (role_code = 'AB' and not exists (
          select 1 from public.performance_review_dossiers dossier where dossier.round_id = requested_round and dossier.employee_id = override_record.key::uuid and dossier.additional_reviewer_employee_id is not null
        )) then raise exception 'PERFORMANCE_QUESTION_SET_OVERRIDE_INVALID'; end if;
        if role_value->>'mode' = 'NONE' and internal_security.performance_review_jsonb_object_size(role_value) = 1 then continue; end if;
        if role_value->>'mode' <> 'SET' or (role_value->>'questionSetId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          or internal_security.performance_review_jsonb_object_size(role_value) <> 2 then raise exception 'PERFORMANCE_QUESTION_SET_OVERRIDE_INVALID'; end if;
        selected_id := (role_value->>'questionSetId')::uuid;
        if not exists (select 1 from public.performance_review_question_sets question_set where question_set.id = selected_id
          and question_set.tenant_id = round_row.tenant_id and question_set.hr_group_id = round_row.hr_group_id and question_set.status = 'AVAILABLE') then
          raise exception 'PERFORMANCE_QUESTION_SET_NOT_AVAILABLE';
        end if;
      end loop;
    end loop;
  end if;
  insert into public.performance_review_round_question_sets (round_id, tenant_id, hr_group_id, enabled, defaults, participant_overrides, updated_by)
  values (requested_round, round_row.tenant_id, round_row.hr_group_id, requested_enabled,
    case when requested_enabled then requested_defaults else jsonb_build_object('EMPLOYEE', null, 'GV', null, 'AB', null) end,
    case when requested_enabled then coalesce(requested_overrides, '{}'::jsonb) else '{}'::jsonb end, auth.uid())
  on conflict (round_id) do update set enabled = excluded.enabled, defaults = excluded.defaults,
    participant_overrides = case when not requested_enabled then excluded.participant_overrides
      when internal_security.performance_review_jsonb_object_size(coalesce(requested_overrides, '{}'::jsonb)) = 0 then public.performance_review_round_question_sets.participant_overrides
      else excluded.participant_overrides end,
    updated_by = auth.uid(), updated_at = now()
  returning * into config_row;
  insert into public.performance_review_audit_events (tenant_id, round_id, action, details)
  values (round_row.tenant_id, round_row.id, 'QUESTION_SETS_CONFIGURED',
    jsonb_build_object('enabled', config_row.enabled, 'defaultQuestionSetIds', config_row.defaults));
  return config_row;
end;
$$;

create or replace function public.save_performance_review_dossier_question_overrides(requested_dossier uuid, requested_overrides jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare dossier_row public.performance_review_dossiers; round_row public.performance_review_rounds;
  role_code text; role_value jsonb; selected_id uuid;
begin
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier for update;
  if dossier_row.id is null then raise exception 'PERFORMANCE_REVIEW_NOT_FOUND'; end if;
  select * into round_row from public.performance_review_rounds where id = dossier_row.round_id for update;
  if not internal_security.performance_review_can_manage(round_row.tenant_id, round_row.hr_group_id) then raise exception 'PERFORMANCE_FORBIDDEN'; end if;
  if round_row.status <> 'DRAFT' or jsonb_typeof(requested_overrides) <> 'object'
    or not internal_security.performance_review_question_sets_enabled(round_row.tenant_id) then raise exception 'PERFORMANCE_QUESTION_SET_CONFIG_IMMUTABLE'; end if;
  for role_code in select jsonb_object_keys(requested_overrides) loop
    role_value := requested_overrides->role_code;
    if role_code not in ('EMPLOYEE','GV','AB') or (role_code = 'AB' and dossier_row.additional_reviewer_employee_id is null) then raise exception 'PERFORMANCE_QUESTION_SET_OVERRIDE_INVALID'; end if;
    if role_value->>'mode' = 'NONE' and internal_security.performance_review_jsonb_object_size(role_value) = 1 then continue; end if;
    if role_value->>'mode' <> 'SET' or (role_value->>'questionSetId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or internal_security.performance_review_jsonb_object_size(role_value) <> 2 then raise exception 'PERFORMANCE_QUESTION_SET_OVERRIDE_INVALID'; end if;
    selected_id := (role_value->>'questionSetId')::uuid;
    if not exists (select 1 from public.performance_review_question_sets question_set where question_set.id = selected_id
      and question_set.tenant_id = round_row.tenant_id and question_set.hr_group_id = round_row.hr_group_id and question_set.status = 'AVAILABLE') then
      raise exception 'PERFORMANCE_QUESTION_SET_NOT_AVAILABLE';
    end if;
  end loop;
  update public.performance_review_round_question_sets config set participant_overrides =
    jsonb_set(config.participant_overrides, array[dossier_row.employee_id::text], requested_overrides, true),
    updated_by = auth.uid(), updated_at = now()
  where config.round_id = dossier_row.round_id and config.enabled and config.published_at is null;
  if not found then raise exception 'PERFORMANCE_QUESTION_SET_CONFIG_IMMUTABLE'; end if;
  insert into public.performance_review_audit_events (tenant_id, round_id, dossier_id, action, details)
  values (dossier_row.tenant_id, dossier_row.round_id, dossier_row.id, 'QUESTION_SET_OVERRIDE_CONFIGURED',
    jsonb_build_object('roles', (select jsonb_agg(role_code) from jsonb_object_keys(requested_overrides) as roles(role_code))));
end;
$$;

create or replace function public.add_performance_review_dossier_with_question_overrides(
  requested_round uuid, requested_employee uuid, requested_reviewer uuid, requested_administration uuid,
  requested_idempotency_key text, requested_additional_reviewer uuid, requested_overrides jsonb
)
returns public.performance_review_dossiers
language plpgsql security definer set search_path = '' as $$
declare round_row public.performance_review_rounds; result_row public.performance_review_dossiers;
  role_code text; role_value jsonb; selected_id uuid;
begin
  select * into round_row from public.performance_review_rounds where id = requested_round for update;
  if round_row.id is null or not internal_security.performance_review_can_manage(round_row.tenant_id, round_row.hr_group_id) then raise exception 'PERFORMANCE_FORBIDDEN'; end if;
  if round_row.status not in ('DRAFT','SCHEDULED','ACTIVE') or jsonb_typeof(coalesce(requested_overrides, '{}'::jsonb)) <> 'object' then raise exception 'PERFORMANCE_QUESTION_SET_OVERRIDE_INVALID'; end if;
  if round_row.status = 'DRAFT' then
    result_row := public.add_performance_review_dossier_v2(requested_round, requested_employee, requested_reviewer,
      requested_administration, requested_idempotency_key, requested_additional_reviewer);
    if internal_security.performance_review_jsonb_object_size(coalesce(requested_overrides, '{}'::jsonb)) > 0 then
      perform public.save_performance_review_dossier_question_overrides(result_row.id, requested_overrides);
    end if;
    return result_row;
  end if;
  if internal_security.performance_review_jsonb_object_size(coalesce(requested_overrides, '{}'::jsonb)) > 0 then
    if not internal_security.performance_review_question_sets_enabled(round_row.tenant_id)
      or not exists (select 1 from public.performance_review_round_question_sets config where config.round_id = requested_round and config.enabled and config.published_at is not null) then
      raise exception 'PERFORMANCE_QUESTION_SET_OVERRIDE_INVALID';
    end if;
    for role_code in select jsonb_object_keys(requested_overrides) loop
      role_value := requested_overrides->role_code;
      if role_code not in ('EMPLOYEE','GV','AB') or (role_code = 'AB' and requested_additional_reviewer is null) then raise exception 'PERFORMANCE_QUESTION_SET_OVERRIDE_INVALID'; end if;
      if role_value->>'mode' = 'NONE' and internal_security.performance_review_jsonb_object_size(role_value) = 1 then continue; end if;
      if role_value->>'mode' <> 'SET' or (role_value->>'questionSetId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or internal_security.performance_review_jsonb_object_size(role_value) <> 2 then raise exception 'PERFORMANCE_QUESTION_SET_OVERRIDE_INVALID'; end if;
      selected_id := (role_value->>'questionSetId')::uuid;
      if not exists (select 1 from public.performance_review_question_sets question_set where question_set.id = selected_id
        and question_set.tenant_id = round_row.tenant_id and question_set.hr_group_id = round_row.hr_group_id and question_set.status = 'AVAILABLE') then
        raise exception 'PERFORMANCE_QUESTION_SET_NOT_AVAILABLE';
      end if;
    end loop;
  end if;
  insert into public.performance_review_pending_question_overrides (round_id, employee_id, overrides, actor_user_id)
  values (requested_round, requested_employee, coalesce(requested_overrides, '{}'::jsonb), auth.uid())
  on conflict (round_id, employee_id) do update set overrides = excluded.overrides, actor_user_id = excluded.actor_user_id;
  result_row := public.add_performance_review_dossier_v2(requested_round, requested_employee, requested_reviewer,
    requested_administration, requested_idempotency_key, requested_additional_reviewer);
  delete from public.performance_review_pending_question_overrides where round_id = requested_round and employee_id = requested_employee;
  if internal_security.performance_review_jsonb_object_size(coalesce(requested_overrides, '{}'::jsonb)) > 0 then
    insert into public.performance_review_audit_events (tenant_id, round_id, dossier_id, action, details)
    values (round_row.tenant_id, requested_round, result_row.id, 'QUESTION_SET_OVERRIDE_CONFIGURED',
      jsonb_build_object('roles', (select jsonb_agg(key) from jsonb_object_keys(requested_overrides) as role_keys(key)), 'lateParticipant', true));
  end if;
  return result_row;
end;
$$;

create or replace function public.save_performance_review_response_with_questions(
  requested_dossier uuid, requested_role text, requested_body text, requested_answers jsonb,
  expected_version integer, submit_now boolean, requested_meeting_date date default null,
  requested_score integer default null, requested_rating_explanation text default null
)
returns public.performance_review_dossiers
language plpgsql security definer set search_path = '' as $$
declare snapshot_row public.performance_review_dossier_question_snapshots; result_row public.performance_review_dossiers;
  submission_kind text;
begin
  if requested_role not in ('EMPLOYEE','GV','AB') or jsonb_typeof(requested_answers) <> 'object'
    or not internal_security.performance_review_question_role_visible(requested_dossier, requested_role) then raise exception 'PERFORMANCE_FORBIDDEN'; end if;
  select * into snapshot_row from public.performance_review_dossier_question_snapshots where dossier_id = requested_dossier and respondent_role = requested_role;
  if snapshot_row.dossier_id is null or snapshot_row.definition_json is null then raise exception 'PERFORMANCE_QUESTION_SET_NOT_ASSIGNED'; end if;
  if not internal_security.performance_review_question_answers_valid(snapshot_row.definition_json, requested_answers, submit_now) then
    if submit_now then raise exception 'PERFORMANCE_QUESTION_ANSWERS_REQUIRED_OR_INVALID'; end if;
    raise exception 'PERFORMANCE_QUESTION_ANSWERS_INVALID';
  end if;
  submission_kind := case requested_role when 'EMPLOYEE' then 'SELF' when 'GV' then 'MANAGER' else 'ADDITIONAL_REVIEWER' end;
  if requested_role <> 'GV' and (requested_meeting_date is not null or requested_score is not null or requested_rating_explanation is not null) then raise exception 'PERFORMANCE_QUESTION_SET_ROLE_INVALID'; end if;
  perform set_config('liquidhr.performance_review.question_answers', jsonb_build_object('dossierId', requested_dossier, 'kind', submission_kind, 'answers', requested_answers)::text, true);
  if requested_role = 'EMPLOYEE' then
    result_row := public.save_performance_review_self(requested_dossier, requested_body, expected_version, submit_now);
  elsif requested_role = 'GV' then
    result_row := public.save_performance_review_manager(requested_dossier, requested_body, requested_meeting_date,
      requested_score, requested_rating_explanation, expected_version, submit_now);
  else
    result_row := public.save_performance_review_additional_reviewer(requested_dossier, requested_body, expected_version, submit_now);
  end if;
  return result_row;
end;
$$;

create or replace function internal_security.performance_review_question_set_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'PERFORMANCE_QUESTION_SET_ARCHIVE_REQUIRED'; end if;
  if new.id is distinct from old.id or new.tenant_id is distinct from old.tenant_id or new.hr_group_id is distinct from old.hr_group_id
    or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then raise exception 'PERFORMANCE_QUESTION_SET_IDENTITY_IMMUTABLE'; end if;
  return new;
end;
$$;

create or replace function internal_security.performance_review_archive_drafts(
  requested_dossier uuid,
  requested_kind text,
  requested_archived_by uuid,
  requested_reason text
)
returns integer language plpgsql security definer set search_path = '' as $$
declare dossier_row public.performance_review_dossiers; draft_row public.performance_review_submissions; archived_count integer := 0;
begin
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier for update;
  for draft_row in
    select * from public.performance_review_submissions
    where tenant_id = dossier_row.tenant_id and dossier_id = dossier_row.id
      and kind = requested_kind and submitted_at is null
    for update
  loop
    insert into public.performance_review_draft_archives (
      tenant_id, dossier_id, kind, author_user_id, body, score,
      rating_explanation, meeting_date, question_answers, version, archived_by, reason
    ) values (
      draft_row.tenant_id, draft_row.dossier_id, draft_row.kind, draft_row.author_user_id,
      draft_row.body, draft_row.score, draft_row.rating_explanation, draft_row.meeting_date,
      draft_row.question_answers, draft_row.version, requested_archived_by, btrim(requested_reason)
    );
    perform set_config('liquidhr.performance_review.archive_draft', 'on', true);
    delete from public.performance_review_submissions where id = draft_row.id;
    archived_count := archived_count + 1;
  end loop;
  return archived_count;
end;
$$;

create trigger performance_review_question_set_guard
before update or delete on public.performance_review_question_sets
for each row execute function internal_security.performance_review_question_set_guard();

create trigger performance_review_question_snapshot_immutable
before update or delete on public.performance_review_dossier_question_snapshots
for each row execute function internal_security.performance_review_question_snapshot_immutable();

create trigger performance_review_question_set_audit_immutable
before update or delete on public.performance_review_question_set_audit_events
for each row execute function internal_security.performance_review_question_snapshot_immutable();

create trigger performance_review_question_answers_guard
before insert or update on public.performance_review_submissions
for each row execute function internal_security.performance_review_question_submission_context();

create trigger performance_review_question_round_snapshot
before update of status on public.performance_review_rounds
for each row execute function internal_security.performance_review_snapshot_question_sets_for_round();

create trigger performance_review_question_dossier_snapshot
after insert on public.performance_review_dossiers
for each row execute function internal_security.performance_review_snapshot_question_sets_for_dossier();

create trigger performance_review_question_additional_reviewer_snapshot
after update of additional_reviewer_employee_id on public.performance_review_dossiers
for each row execute function internal_security.performance_review_snapshot_additional_reviewer_questions();

alter table public.performance_review_question_sets enable row level security;
alter table public.performance_review_question_set_audit_events enable row level security;
alter table public.performance_review_round_question_sets enable row level security;
alter table public.performance_review_dossier_question_snapshots enable row level security;
alter table public.performance_review_pending_question_overrides enable row level security;

create policy performance_review_question_sets_select on public.performance_review_question_sets for select to authenticated using (
  internal_security.performance_review_question_sets_enabled(tenant_id)
  and internal_security.performance_review_can_manage(tenant_id, hr_group_id)
);
create policy performance_review_question_set_audit_select on public.performance_review_question_set_audit_events for select to authenticated using (
  internal_security.performance_review_can_manage(tenant_id, hr_group_id)
);
create policy performance_review_round_question_sets_select on public.performance_review_round_question_sets for select to authenticated using (
  internal_security.performance_review_can_manage(tenant_id, hr_group_id)
);
create policy performance_review_dossier_question_snapshots_select on public.performance_review_dossier_question_snapshots for select to authenticated using (
  internal_security.performance_review_question_role_visible(dossier_id, respondent_role)
);
create policy performance_review_pending_question_overrides_deny_direct on public.performance_review_pending_question_overrides for all to authenticated using (false) with check (false);

revoke all on public.performance_review_question_sets, public.performance_review_question_set_audit_events,
  public.performance_review_round_question_sets, public.performance_review_dossier_question_snapshots,
  public.performance_review_pending_question_overrides from anon, authenticated;
grant select on public.performance_review_question_sets, public.performance_review_question_set_audit_events,
  public.performance_review_round_question_sets, public.performance_review_dossier_question_snapshots to authenticated;
grant select on public.performance_review_submissions to authenticated;

revoke all on function internal_security.performance_review_question_sets_enabled(uuid) from public, anon;
revoke all on function internal_security.performance_review_localized_label_valid(jsonb) from public, anon;
revoke all on function internal_security.performance_review_question_set_definition_valid(jsonb) from public, anon;
revoke all on function internal_security.performance_review_question_answers_valid(jsonb, jsonb, boolean) from public, anon;
revoke all on function internal_security.performance_review_question_role_visible(uuid, text) from public, anon;
revoke all on function internal_security.performance_review_jsonb_object_size(jsonb) from public, anon;
revoke all on function internal_security.performance_review_question_set_snapshot(uuid) from public, anon;
revoke all on function internal_security.performance_review_insert_dossier_question_snapshot(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function internal_security.performance_review_snapshot_question_sets_for_dossier() from public, anon, authenticated;
revoke all on function internal_security.performance_review_snapshot_question_sets_for_round() from public, anon, authenticated;
revoke all on function internal_security.performance_review_snapshot_additional_reviewer_questions() from public, anon, authenticated;
revoke all on function internal_security.performance_review_question_snapshot_immutable() from public, anon, authenticated;
revoke all on function internal_security.performance_review_question_submission_context() from public, anon, authenticated;
revoke all on function internal_security.performance_review_question_set_guard() from public, anon, authenticated;
grant execute on function internal_security.performance_review_question_sets_enabled(uuid) to authenticated;
grant execute on function internal_security.performance_review_question_role_visible(uuid, text) to authenticated;
grant execute on function internal_security.performance_review_question_answers_valid(jsonb, jsonb, boolean) to authenticated;

revoke all on function public.save_performance_review_question_set(uuid, uuid, text, text, text, jsonb, integer) from public, anon;
revoke all on function public.duplicate_performance_review_question_set(uuid, text) from public, anon;
revoke all on function public.archive_performance_review_question_set(uuid, integer) from public, anon;
revoke all on function public.save_performance_review_round_question_sets(uuid, boolean, jsonb, jsonb) from public, anon;
revoke all on function public.save_performance_review_dossier_question_overrides(uuid, jsonb) from public, anon;
revoke all on function public.add_performance_review_dossier_with_question_overrides(uuid, uuid, uuid, uuid, text, uuid, jsonb) from public, anon;
revoke all on function public.save_performance_review_response_with_questions(uuid, text, text, jsonb, integer, boolean, date, integer, text) from public, anon;
grant execute on function public.save_performance_review_question_set(uuid, uuid, text, text, text, jsonb, integer) to authenticated;
grant execute on function public.duplicate_performance_review_question_set(uuid, text) to authenticated;
grant execute on function public.archive_performance_review_question_set(uuid, integer) to authenticated;
grant execute on function public.save_performance_review_round_question_sets(uuid, boolean, jsonb, jsonb) to authenticated;
grant execute on function public.save_performance_review_dossier_question_overrides(uuid, jsonb) to authenticated;
grant execute on function public.add_performance_review_dossier_with_question_overrides(uuid, uuid, uuid, uuid, text, uuid, jsonb) to authenticated;
grant execute on function public.save_performance_review_response_with_questions(uuid, text, text, jsonb, integer, boolean, date, integer, text) to authenticated;

commit;
