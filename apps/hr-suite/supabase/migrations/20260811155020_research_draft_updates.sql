begin;

create or replace function internal_security.update_survey_draft(
  requested_campaign_id uuid,
  requested_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  campaign public.surveys%rowtype;
  question jsonb;
  row_payload jsonb;
  option_label text;
  question_id uuid;
  question_index integer := 0;
  option_index integer;
  row_index integer;
  question_type text;
  target_ids uuid[];
begin
  if jsonb_typeof(requested_payload) <> 'object'
     or jsonb_typeof(requested_payload -> 'questions') <> 'array'
     or jsonb_array_length(requested_payload -> 'questions') < 1
     or jsonb_array_length(requested_payload -> 'questions') > 100
     or jsonb_typeof(requested_payload -> 'targetIds') <> 'array' then
    raise exception 'RESEARCH_DRAFT_PAYLOAD_INVALID' using errcode = '22023';
  end if;

  select * into campaign
  from public.surveys
  where id = requested_campaign_id
  for update;

  if campaign.id is null then
    raise exception 'RESEARCH_CAMPAIGN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not internal_security.current_user_has_hr_group_permission(campaign.tenant_id, campaign.hr_group_id, 'research:write') then
    raise exception 'RESEARCH_CAMPAIGN_FORBIDDEN' using errcode = '42501';
  end if;
  if campaign.status <> 'DRAFT' then
    raise exception 'RESEARCH_CAMPAIGN_NOT_DRAFT' using errcode = '22023';
  end if;

  select coalesce(array_agg(value::uuid), '{}') into target_ids
  from jsonb_array_elements_text(requested_payload -> 'targetIds');
  if (requested_payload ->> 'targetMode') = 'ALL' and cardinality(target_ids) <> 0 then
    raise exception 'TARGET_ALL_WITH_IDS' using errcode = '22023';
  end if;
  if (requested_payload ->> 'targetMode') <> 'ALL' and cardinality(target_ids) = 0 then
    raise exception 'TARGET_SELECTION_REQUIRED' using errcode = '22023';
  end if;

  update public.surveys
  set title = btrim(requested_payload ->> 'title'),
      description = coalesce(requested_payload ->> 'description', ''),
      starts_at = (requested_payload ->> 'startsAt')::timestamptz,
      ends_at = (requested_payload ->> 'endsAt')::timestamptz,
      is_anonymous = (requested_payload ->> 'isAnonymous')::boolean,
      target_mode = requested_payload ->> 'targetMode',
      target_ids = target_ids
  where id = campaign.id;

  delete from public.survey_questions where survey_id = campaign.id;

  for question in select value from jsonb_array_elements(requested_payload -> 'questions') loop
    question_index := question_index + 1;
    question_type := question ->> 'type';
    if question_type in ('SINGLE_CHOICE', 'MULTI_CHOICE', 'MATRIX')
       and jsonb_array_length(coalesce(question -> 'options', '[]'::jsonb)) < 2 then
      raise exception 'QUESTION_OPTIONS_REQUIRED' using errcode = '22023';
    end if;
    if question_type = 'MATRIX' and jsonb_array_length(coalesce(question -> 'rows', '[]'::jsonb)) = 0 then
      raise exception 'MATRIX_CONFIGURATION_REQUIRED' using errcode = '22023';
    end if;
    if exists (
      select 1
      from jsonb_array_elements_text(coalesce(question -> 'options', '[]'::jsonb)) option_value
      group by lower(option_value)
      having count(*) > 1
    ) then
      raise exception 'QUESTION_OPTION_DUPLICATE' using errcode = '22023';
    end if;

    insert into public.survey_questions (
      tenant_id, hr_group_id, survey_id, question_text, question_type, is_required, order_index
    ) values (
      campaign.tenant_id,
      campaign.hr_group_id,
      campaign.id,
      btrim(question ->> 'text'),
      question_type,
      coalesce((question ->> 'required')::boolean, false),
      question_index - 1
    ) returning id into question_id;

    option_index := 0;
    for option_label in select value from jsonb_array_elements_text(coalesce(question -> 'options', '[]'::jsonb)) loop
      option_index := option_index + 1;
      insert into public.survey_question_options (
        tenant_id, hr_group_id, survey_id, question_id, option_label, order_index
      ) values (
        campaign.tenant_id, campaign.hr_group_id, campaign.id, question_id, btrim(option_label),
        option_index - 1
      );
    end loop;

    row_index := 0;
    for row_payload in select value from jsonb_array_elements(coalesce(question -> 'rows', '[]'::jsonb)) loop
      row_index := row_index + 1;
      insert into public.survey_matrix_rows (
        tenant_id, hr_group_id, survey_id, question_id, row_label, is_required, order_index
      ) values (
        campaign.tenant_id,
        campaign.hr_group_id,
        campaign.id,
        question_id,
        btrim(row_payload ->> 'label'),
        coalesce((row_payload ->> 'required')::boolean, false),
        row_index - 1
      );
    end loop;
  end loop;

  return campaign.id;
end;
$$;

create or replace function internal_security.update_enps_draft(
  requested_campaign_id uuid,
  requested_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  campaign public.enps_campaigns%rowtype;
  question jsonb;
  bank_question public.enps_question_bank%rowtype;
  category public.enps_question_bank_categories%rowtype;
  question_count integer;
  mandatory_count integer;
  question_type text;
  target_ids uuid[];
begin
  if jsonb_typeof(requested_payload) <> 'object'
     or jsonb_typeof(requested_payload -> 'questions') <> 'array'
     or jsonb_array_length(requested_payload -> 'questions') < 1
     or jsonb_array_length(requested_payload -> 'questions') > 150
     or jsonb_typeof(requested_payload -> 'targetIds') <> 'array' then
    raise exception 'RESEARCH_DRAFT_PAYLOAD_INVALID' using errcode = '22023';
  end if;

  select * into campaign
  from public.enps_campaigns
  where id = requested_campaign_id
  for update;

  if campaign.id is null then
    raise exception 'RESEARCH_CAMPAIGN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not internal_security.current_user_has_hr_group_permission(campaign.tenant_id, campaign.hr_group_id, 'research:write') then
    raise exception 'RESEARCH_CAMPAIGN_FORBIDDEN' using errcode = '42501';
  end if;
  if campaign.status <> 'DRAFT' then
    raise exception 'RESEARCH_CAMPAIGN_NOT_DRAFT' using errcode = '22023';
  end if;

  select coalesce(array_agg(value::uuid), '{}') into target_ids
  from jsonb_array_elements_text(requested_payload -> 'targetIds');
  if (requested_payload ->> 'targetMode') = 'ALL' and cardinality(target_ids) <> 0 then
    raise exception 'TARGET_ALL_WITH_IDS' using errcode = '22023';
  end if;
  if (requested_payload ->> 'targetMode') <> 'ALL' and cardinality(target_ids) = 0 then
    raise exception 'TARGET_SELECTION_REQUIRED' using errcode = '22023';
  end if;

  select count(*) into question_count
  from jsonb_array_elements(requested_payload -> 'questions');
  select count(*) into mandatory_count
  from jsonb_array_elements(requested_payload -> 'questions') value
  where (value ->> 'mandatory')::boolean;
  if mandatory_count <> 1 then
    raise exception 'ENPS_MANDATORY_QUESTION_INVALID' using errcode = '22023';
  end if;

  update public.enps_campaigns
  set title = btrim(requested_payload ->> 'title'),
      starts_at = (requested_payload ->> 'startsAt')::timestamptz,
      ends_at = (requested_payload ->> 'endsAt')::timestamptz,
      scale_type = requested_payload ->> 'scaleType',
      target_mode = requested_payload ->> 'targetMode',
      target_ids = target_ids,
      reminder_interval_days = (requested_payload ->> 'reminderIntervalDays')::integer
  where id = campaign.id;

  delete from public.enps_questions where campaign_id = campaign.id;

  for question in select value from jsonb_array_elements(requested_payload -> 'questions') loop
    select * into bank_question
    from public.enps_question_bank
    where id = (question ->> 'bankQuestionId')::uuid;
    if bank_question.id is null
       or (not bank_question.is_system and (bank_question.tenant_id <> campaign.tenant_id or bank_question.hr_group_id <> campaign.hr_group_id)) then
      raise exception 'ENPS_QUESTION_BANK_INVALID' using errcode = '22023';
    end if;
    select * into category from public.enps_question_bank_categories where id = bank_question.category_id;
    if category.id is null then
      raise exception 'ENPS_QUESTION_BANK_INVALID' using errcode = '22023';
    end if;
    if (question ->> 'mandatory')::boolean
       and ((question ->> 'order')::integer <> 1 or not bank_question.is_mandatory_enps) then
      raise exception 'ENPS_MANDATORY_QUESTION_INVALID' using errcode = '22023';
    end if;
    question_type := case when (question ->> 'mandatory')::boolean then 'SCALE_10' else question ->> 'type' end;
    insert into public.enps_questions (
      tenant_id, hr_group_id, campaign_id, bank_question_id, category_name, question_text,
      question_type, is_mandatory, is_enabled, order_index
    ) values (
      campaign.tenant_id, campaign.hr_group_id, campaign.id, bank_question.id, category.name,
      bank_question.question_text, question_type, (question ->> 'mandatory')::boolean,
      (question ->> 'enabled')::boolean, (question ->> 'order')::integer
    );
  end loop;

  if question_count <> (select count(*) from public.enps_questions where campaign_id = campaign.id) then
    raise exception 'ENPS_QUESTIONS_INVALID' using errcode = '22023';
  end if;
  return campaign.id;
end;
$$;

create or replace function public.update_survey_draft(p_campaign_id uuid, p_payload jsonb)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select internal_security.update_survey_draft(p_campaign_id, p_payload);
$$;

create or replace function public.update_enps_draft(p_campaign_id uuid, p_payload jsonb)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select internal_security.update_enps_draft(p_campaign_id, p_payload);
$$;

revoke all on function internal_security.update_survey_draft(uuid, jsonb) from public, anon, authenticated;
revoke all on function internal_security.update_enps_draft(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.update_survey_draft(uuid, jsonb) from public, anon;
revoke all on function public.update_enps_draft(uuid, jsonb) from public, anon;
grant execute on function public.update_survey_draft(uuid, jsonb) to authenticated;
grant execute on function public.update_enps_draft(uuid, jsonb) to authenticated;

commit;
