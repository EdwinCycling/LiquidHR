-- Guided Recruitment stap 3a: vaste begeleide content, interviews en assessments.

create or replace function internal_recruitment.guard_system_content()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, internal_recruitment
as $$
begin
  if old.owner_type = 'SYSTEM' then
    raise exception 'RECRUITMENT_SYSTEM_CONTENT_IMMUTABLE' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function internal_recruitment.guard_system_content() from public, anon, authenticated;

drop trigger if exists recruitment_library_system_content_guard on public.recruitment_library_items;
create trigger recruitment_library_system_content_guard
before update or delete on public.recruitment_library_items
for each row execute function internal_recruitment.guard_system_content();

drop trigger if exists recruitment_set_system_content_guard on public.recruitment_sets;
create trigger recruitment_set_system_content_guard
before update or delete on public.recruitment_sets
for each row execute function internal_recruitment.guard_system_content();

insert into public.recruitment_characteristics (tenant_id, hr_group_id, stable_code, name, description)
select groups.tenant_id, groups.id, characteristics.stable_code, characteristics.name, characteristics.description
from public.hr_groups groups
cross join (values
  ('COMMUNICATION', 'Communicatie', 'Helder, zorgvuldig en doelgericht communiceren.'),
  ('OWNERSHIP', 'Eigenaarschap', 'Verantwoordelijkheid nemen en afspraken opvolgen.'),
  ('COLLABORATION', 'Samenwerken', 'Constructief samenwerken met verschillende rollen.'),
  ('ANALYTICAL_ABILITY', 'Analytisch vermogen', 'Informatie structureren en tot inzicht komen.'),
  ('CUSTOMER_FOCUS', 'Klantgerichtheid', 'Waarde creëren vanuit de behoefte van de klant.'),
  ('LEARNING_AGILITY', 'Leervermogen', 'Feedback benutten en nieuwe kennis toepassen.'),
  ('LEADERSHIP', 'Leiderschap', 'Richting geven, verbinden en besluitvaardig handelen.'),
  ('ADAPTABILITY', 'Aanpassingsvermogen', 'Effectief blijven bij verandering en onzekerheid.')
) as characteristics(stable_code, name, description)
on conflict (tenant_id, hr_group_id, stable_code) do update
set name = excluded.name, description = excluded.description, is_active = true;

insert into public.recruitment_library_items (tenant_id, hr_group_id, owner_type, item_type, stable_code, title, content)
select groups.tenant_id, groups.id, 'SYSTEM', 'APPLICATION_QUESTION', format('SYSTEM_APPLICATION_QUESTION_%s', lpad(series.value::text, 2, '0')),
  format('Sollicitatievraag %s', lpad(series.value::text, 2, '0')),
  jsonb_build_object('prompt', format('Wat spreekt je aan in deze functie en waarom?', series.value), 'inputType', 'TEXTAREA')
from public.hr_groups groups cross join generate_series(1, 25) series
on conflict (tenant_id, hr_group_id, stable_code, version) do nothing;

insert into public.recruitment_library_items (tenant_id, hr_group_id, owner_type, item_type, stable_code, title, content)
select groups.tenant_id, groups.id, 'SYSTEM', 'INTERVIEW_QUESTION', format('SYSTEM_INTERVIEW_QUESTION_%s', lpad(series.value::text, 3, '0')),
  format('Gespreksvraag %s', lpad(series.value::text, 3, '0')),
  jsonb_build_object('prompt', format('Kun je een concreet voorbeeld geven van je aanpak in een vergelijkbare situatie? (%s)', series.value), 'answerMode', 'NOTE')
from public.hr_groups groups cross join generate_series(1, 84) series
on conflict (tenant_id, hr_group_id, stable_code, version) do nothing;

insert into public.recruitment_library_items (tenant_id, hr_group_id, owner_type, item_type, stable_code, title, content)
select groups.tenant_id, groups.id, 'SYSTEM', 'CRITERION', format('SYSTEM_CRITERION_%s', lpad(series.value::text, 2, '0')),
  format('Beoordelingscriterium %s', lpad(series.value::text, 2, '0')),
  jsonb_build_object(
    'characteristicCode', (array['COMMUNICATION','OWNERSHIP','COLLABORATION','ANALYTICAL_ABILITY','CUSTOMER_FOCUS','LEARNING_AGILITY','LEADERSHIP','ADAPTABILITY'])[((series.value - 1) % 8) + 1],
    'anchors', jsonb_build_object('1', 'Onvoldoende zichtbaar', '2', 'Beperkt zichtbaar', '3', 'Passend zichtbaar', '4', 'Sterk zichtbaar', '5', 'Uitmuntend zichtbaar')
  )
from public.hr_groups groups cross join generate_series(1, 45) series
on conflict (tenant_id, hr_group_id, stable_code, version) do nothing;

insert into public.recruitment_library_items (tenant_id, hr_group_id, owner_type, item_type, stable_code, title, content)
select groups.tenant_id, groups.id, 'SYSTEM', 'PREPARATION', format('SYSTEM_PREPARATION_%s', lpad(series.value::text, 2, '0')),
  format('Voorbereidingsitem %s', lpad(series.value::text, 2, '0')),
  jsonb_build_object('prompt', 'Bereid een concreet voorbeeld voor dat je tijdens het gesprek kunt toelichten.', 'answerMode', 'EXTERNAL_COPY')
from public.hr_groups groups cross join generate_series(1, 35) series
on conflict (tenant_id, hr_group_id, stable_code, version) do nothing;

insert into public.recruitment_library_item_states (tenant_id, hr_group_id, library_item_id, is_enabled)
select item.tenant_id, item.hr_group_id, item.id, true
from public.recruitment_library_items item
where item.owner_type = 'SYSTEM'
on conflict (tenant_id, hr_group_id, library_item_id) do nothing;

insert into public.recruitment_sets (tenant_id, hr_group_id, owner_type, stable_code, name, description)
select groups.tenant_id, groups.id, 'SYSTEM', sets.stable_code, sets.name, sets.description
from public.hr_groups groups
cross join (values
  ('SYSTEM_SET_FIRST_MEETING', 'Eerste kennismaking', 'Een rustige eerste verkenning van motivatie en context.'),
  ('SYSTEM_SET_SECOND_MEETING', 'Tweede gesprek', 'Verdieping op voorbeelden, samenwerking en eigenaarschap.'),
  ('SYSTEM_SET_CUSTOMER_CONTACT', 'Klantcontact', 'Voor rollen met veel contact, luisteren en adviseren.'),
  ('SYSTEM_SET_COMMERCIAL', 'Commerciële functie', 'Voor commerciële gesprekken met klantwaarde en resultaat.'),
  ('SYSTEM_SET_LEADERSHIP', 'Leidinggevend', 'Voor richting geven, besluitvorming en ontwikkeling.'),
  ('SYSTEM_SET_STARTER', 'Starter', 'Een toegankelijke set voor beginnende professionals.'),
  ('SYSTEM_SET_SPECIALIST', 'Specialist', 'Voor vakinhoudelijke verdieping en analytische vragen.'),
  ('SYSTEM_SET_SENIOR', 'Senior professional', 'Voor brede verantwoordelijkheid en beïnvloeding.'),
  ('SYSTEM_SET_TEAMWORK', 'Samenwerken', 'Voor samenwerking, feedback en gezamenlijke resultaten.'),
  ('SYSTEM_SET_PROBLEM_SOLVING', 'Probleemoplossing', 'Voor analyse, keuzes en leren van situaties.'),
  ('SYSTEM_SET_CULTURE', 'Werkstijl en waarden', 'Voor verwachtingen, werkstijl en passende samenwerking.'),
  ('SYSTEM_SET_FINAL', 'Afrondend gesprek', 'Voor terugblik, vragen en gezamenlijke vervolgstap.')
) as sets(stable_code, name, description)
on conflict (tenant_id, hr_group_id, stable_code, version) do nothing;

with ranked_items as (
  select item.tenant_id, item.hr_group_id, item.id, item.item_type,
    row_number() over (partition by item.tenant_id, item.hr_group_id, item.item_type order by item.stable_code) as item_number
  from public.recruitment_library_items item
  where item.owner_type = 'SYSTEM' and item.item_type <> 'APPLICATION_QUESTION'
)
insert into public.recruitment_set_items (tenant_id, hr_group_id, set_id, library_item_id, sort_order)
select set_row.tenant_id, set_row.hr_group_id, set_row.id, ranked.id,
  case ranked.item_type when 'INTERVIEW_QUESTION' then 10 else case ranked.item_type when 'CRITERION' then 20 else 30 end end + ranked.item_number
from public.recruitment_sets set_row
join ranked_items ranked on ranked.tenant_id = set_row.tenant_id and ranked.hr_group_id = set_row.hr_group_id
where set_row.owner_type = 'SYSTEM' and ranked.item_number <= 2
on conflict (tenant_id, hr_group_id, set_id, library_item_id) do nothing;

create or replace function public.create_recruitment_library_item(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_item_type text,
  requested_stable_code text,
  requested_title text,
  requested_content jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, internal_security
as $$
declare created public.recruitment_library_items;
begin
  if not internal_security.recruitment_hr_can(requested_tenant_id, requested_hr_group_id, 'recruitment-settings:manage') then
    raise exception 'RECRUITMENT_FORBIDDEN' using errcode = '42501';
  end if;
  if requested_item_type not in ('APPLICATION_QUESTION','INTERVIEW_QUESTION','CRITERION','PREPARATION') then
    raise exception 'RECRUITMENT_LIBRARY_TYPE_INVALID' using errcode = '22023';
  end if;
  insert into public.recruitment_library_items (tenant_id, hr_group_id, owner_type, item_type, stable_code, title, content, created_by_user_id, updated_by_user_id)
  values (requested_tenant_id, requested_hr_group_id, 'HR_GROUP', requested_item_type, upper(btrim(requested_stable_code)), btrim(requested_title), requested_content, auth.uid(), auth.uid())
  returning * into created;
  return jsonb_build_object('id', created.id, 'version', created.version, 'ownerType', created.owner_type);
end;
$$;

create or replace function public.update_recruitment_library_item(
  requested_item_id uuid,
  requested_title text,
  requested_content jsonb,
  requested_is_active boolean,
  requested_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, internal_security
as $$
declare updated public.recruitment_library_items;
begin
  update public.recruitment_library_items item
  set title = btrim(requested_title), content = requested_content, is_active = requested_is_active,
      version = item.version + 1, updated_at = timezone('utc', now()), updated_by_user_id = auth.uid()
  where item.id = requested_item_id and item.owner_type = 'HR_GROUP'
    and internal_security.recruitment_hr_can(item.tenant_id, item.hr_group_id, 'recruitment-settings:manage')
    and item.version = requested_expected_version
  returning * into updated;
  if not found then raise exception 'RECRUITMENT_LIBRARY_UPDATE_CONFLICT' using errcode = '40001'; end if;
  return jsonb_build_object('id', updated.id, 'version', updated.version);
end;
$$;

create or replace function public.set_recruitment_library_item_enabled(requested_item_id uuid, requested_is_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, internal_security
as $$
declare item_row public.recruitment_library_items;
begin
  select item.* into item_row from public.recruitment_library_items item where item.id = requested_item_id;
  if not found or not internal_security.recruitment_hr_can(item_row.tenant_id, item_row.hr_group_id, 'recruitment-settings:manage') then
    raise exception 'RECRUITMENT_LIBRARY_NOT_FOUND' using errcode = '42501';
  end if;
  insert into public.recruitment_library_item_states (tenant_id, hr_group_id, library_item_id, is_enabled)
  values (item_row.tenant_id, item_row.hr_group_id, item_row.id, requested_is_enabled)
  on conflict (tenant_id, hr_group_id, library_item_id) do update set is_enabled = excluded.is_enabled, updated_at = timezone('utc', now());
  return jsonb_build_object('id', item_row.id, 'isEnabled', requested_is_enabled);
end;
$$;

create or replace function public.create_recruitment_set(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_stable_code text,
  requested_name text,
  requested_description text,
  requested_item_ids jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, internal_security
as $$
declare created public.recruitment_sets;
declare requested_count integer;
declare valid_count integer;
begin
  if not internal_security.recruitment_hr_can(requested_tenant_id, requested_hr_group_id, 'recruitment-settings:manage') then
    raise exception 'RECRUITMENT_FORBIDDEN' using errcode = '42501';
  end if;
  requested_count := jsonb_array_length(requested_item_ids);
  select count(*) into valid_count from public.recruitment_library_items item
  where item.tenant_id = requested_tenant_id and item.hr_group_id = requested_hr_group_id
    and item.id in (select value::uuid from jsonb_array_elements_text(requested_item_ids))
    and item.item_type <> 'APPLICATION_QUESTION' and item.is_active;
  if requested_count = 0 or valid_count <> requested_count then raise exception 'RECRUITMENT_SET_ITEMS_INVALID' using errcode = '22023'; end if;
  insert into public.recruitment_sets (tenant_id, hr_group_id, owner_type, stable_code, name, description, created_by_user_id, updated_by_user_id)
  values (requested_tenant_id, requested_hr_group_id, 'HR_GROUP', upper(btrim(requested_stable_code)), btrim(requested_name), nullif(btrim(requested_description), ''), auth.uid(), auth.uid())
  returning * into created;
  insert into public.recruitment_set_items (tenant_id, hr_group_id, set_id, library_item_id, sort_order)
  select requested_tenant_id, requested_hr_group_id, created.id, value::uuid, ordinality::integer
  from jsonb_array_elements_text(requested_item_ids) with ordinality;
  return jsonb_build_object('id', created.id, 'version', created.version);
end;
$$;

create or replace function public.update_recruitment_set(
  requested_set_id uuid,
  requested_name text,
  requested_description text,
  requested_is_active boolean,
  requested_item_ids jsonb,
  requested_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, internal_security
as $$
declare set_row public.recruitment_sets;
declare requested_count integer;
declare valid_count integer;
begin
  select item.* into set_row from public.recruitment_sets item where item.id = requested_set_id and item.owner_type = 'HR_GROUP';
  if not found or not internal_security.recruitment_hr_can(set_row.tenant_id, set_row.hr_group_id, 'recruitment-settings:manage') then raise exception 'RECRUITMENT_SET_NOT_FOUND' using errcode = '42501'; end if;
  requested_count := jsonb_array_length(requested_item_ids);
  select count(*) into valid_count from public.recruitment_library_items item
  where item.tenant_id = set_row.tenant_id and item.hr_group_id = set_row.hr_group_id and item.id in (select value::uuid from jsonb_array_elements_text(requested_item_ids)) and item.item_type <> 'APPLICATION_QUESTION' and item.is_active;
  if requested_count = 0 or valid_count <> requested_count then raise exception 'RECRUITMENT_SET_ITEMS_INVALID' using errcode = '22023'; end if;
  update public.recruitment_sets set name = btrim(requested_name), description = nullif(btrim(requested_description), ''), is_active = requested_is_active, version = version + 1, updated_at = timezone('utc', now()), updated_by_user_id = auth.uid()
  where id = requested_set_id and version = requested_expected_version;
  if not found then raise exception 'RECRUITMENT_SET_UPDATE_CONFLICT' using errcode = '40001'; end if;
  delete from public.recruitment_set_items where set_id = requested_set_id;
  insert into public.recruitment_set_items (tenant_id, hr_group_id, set_id, library_item_id, sort_order)
  select set_row.tenant_id, set_row.hr_group_id, requested_set_id, value::uuid, ordinality::integer from jsonb_array_elements_text(requested_item_ids) with ordinality;
  return jsonb_build_object('id', requested_set_id, 'version', requested_expected_version + 1);
end;
$$;

create or replace function public.create_recruitment_interview(
  requested_application_id uuid,
  requested_title text,
  requested_scheduled_at timestamptz,
  requested_set_id uuid,
  requested_participant_employee_ids jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, internal_security
as $$
declare application_row public.recruitment_applications;
declare interview_row public.recruitment_interviews;
declare participant_row public.recruitment_participations;
begin
  select application.* into application_row from public.recruitment_applications application where application.id = requested_application_id;
  if not found or application_row.terminal_outcome is not null or not internal_security.recruitment_hr_can(application_row.tenant_id, application_row.hr_group_id, 'recruitment-candidate:write') then raise exception 'RECRUITMENT_APPLICATION_NOT_FOUND' using errcode = '42501'; end if;
  if jsonb_array_length(requested_participant_employee_ids) < 1 then raise exception 'RECRUITMENT_PARTICIPANTS_REQUIRED' using errcode = '22023'; end if;
  insert into public.recruitment_interviews (tenant_id, hr_group_id, application_id, set_id, title, scheduled_at, preparation_snapshot, questions_snapshot, criteria_snapshot)
  values (
    application_row.tenant_id, application_row.hr_group_id, application_row.id, requested_set_id, btrim(requested_title), requested_scheduled_at,
    coalesce((select jsonb_agg(jsonb_build_object('title', item.title, 'content', item.content) order by set_item.sort_order) filter (where item.item_type = 'PREPARATION') from public.recruitment_set_items set_item join public.recruitment_library_items item on item.tenant_id = set_item.tenant_id and item.hr_group_id = set_item.hr_group_id and item.id = set_item.library_item_id where set_item.set_id = requested_set_id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('title', item.title, 'content', item.content) order by set_item.sort_order) filter (where item.item_type = 'INTERVIEW_QUESTION') from public.recruitment_set_items set_item join public.recruitment_library_items item on item.tenant_id = set_item.tenant_id and item.hr_group_id = set_item.hr_group_id and item.id = set_item.library_item_id where set_item.set_id = requested_set_id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('title', item.title, 'content', item.content, 'characteristicId', characteristic.id) order by set_item.sort_order) filter (where item.item_type = 'CRITERION') from public.recruitment_set_items set_item join public.recruitment_library_items item on item.tenant_id = set_item.tenant_id and item.hr_group_id = set_item.hr_group_id and item.id = set_item.library_item_id left join public.recruitment_characteristics characteristic on characteristic.tenant_id = item.tenant_id and characteristic.hr_group_id = item.hr_group_id and characteristic.stable_code = item.content ->> 'characteristicCode' where set_item.set_id = requested_set_id), '[]'::jsonb)
  ) returning * into interview_row;
  insert into public.recruitment_participations (tenant_id, hr_group_id, application_id, interview_id, employee_id, status, capabilities, activated_at)
  select application_row.tenant_id, application_row.hr_group_id, application_row.id, interview_row.id, value::uuid, 'ACTIVE', array['APPLICATION_READ','DOCUMENT_READ','INTERVIEW_READ','ASSESSMENT_READ','ASSESSMENT_WRITE']::text[], timezone('utc', now())
  from jsonb_array_elements_text(requested_participant_employee_ids)
  on conflict (tenant_id, hr_group_id, interview_id, employee_id) do update set status = 'ACTIVE', revoked_at = null, activated_at = coalesce(public.recruitment_participations.activated_at, timezone('utc', now())), updated_at = timezone('utc', now());
  insert into public.recruitment_interview_participants (tenant_id, hr_group_id, interview_id, participation_id)
  select participant.tenant_id, participant.hr_group_id, interview_row.id, participant.id from public.recruitment_participations participant where participant.interview_id = interview_row.id;
  return jsonb_build_object('id', interview_row.id, 'applicationId', interview_row.application_id, 'preparationCount', jsonb_array_length(interview_row.preparation_snapshot), 'questionCount', jsonb_array_length(interview_row.questions_snapshot), 'criteriaCount', jsonb_array_length(interview_row.criteria_snapshot));
end;
$$;

create or replace function public.upsert_recruitment_assessment_draft(requested_interview_id uuid, requested_scores jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, internal_security
as $$
declare interview_row public.recruitment_interviews;
declare assessment_row public.recruitment_assessments;
declare reviewer_id uuid;
declare participation_id uuid;
begin
  select interview.* into interview_row from public.recruitment_interviews interview where interview.id = requested_interview_id;
  if not found then raise exception 'RECRUITMENT_INTERVIEW_NOT_FOUND' using errcode = '42501'; end if;
  reviewer_id := internal_security.current_recruitment_employee_id(interview_row.tenant_id, interview_row.hr_group_id);
  select participation.id into participation_id from public.recruitment_participations participation where participation.tenant_id = interview_row.tenant_id and participation.hr_group_id = interview_row.hr_group_id and participation.interview_id = interview_row.id and participation.employee_id = reviewer_id and participation.status in ('ASSIGNED','ACTIVE') and 'ASSESSMENT_WRITE' = any(participation.capabilities);
  if participation_id is null and not internal_security.recruitment_hr_can(interview_row.tenant_id, interview_row.hr_group_id, 'recruitment-assessment:write') then raise exception 'RECRUITMENT_ASSESSMENT_FORBIDDEN' using errcode = '42501'; end if;
  select assessment.* into assessment_row from public.recruitment_assessments assessment where assessment.interview_id = interview_row.id and (assessment.reviewer_employee_id = reviewer_id or internal_security.recruitment_hr_can(assessment.tenant_id, assessment.hr_group_id, 'recruitment-assessment:write')) and assessment.status = 'DRAFT' order by assessment.revision desc limit 1;
  if not found then
    insert into public.recruitment_assessments (tenant_id, hr_group_id, application_id, interview_id, participation_id, reviewer_employee_id) values (interview_row.tenant_id, interview_row.hr_group_id, interview_row.application_id, interview_row.id, coalesce(participation_id, (select id from public.recruitment_participations where interview_id = interview_row.id limit 1)), reviewer_id) returning * into assessment_row;
  end if;
  delete from public.recruitment_assessment_scores where assessment_id = assessment_row.id;
  insert into public.recruitment_assessment_scores (tenant_id, hr_group_id, assessment_id, characteristic_id, score, note)
  select assessment_row.tenant_id, assessment_row.hr_group_id, assessment_row.id, score.characteristic_id, score.score, score.note
  from jsonb_to_recordset(requested_scores) as score(characteristic_id uuid, score smallint, note text);
  return jsonb_build_object('id', assessment_row.id, 'status', assessment_row.status, 'version', assessment_row.version, 'reviewerEmployeeId', assessment_row.reviewer_employee_id);
end;
$$;

create or replace function public.submit_recruitment_assessment(requested_assessment_id uuid, requested_expected_version integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, internal_security
as $$
declare assessment_row public.recruitment_assessments;
declare reviewer_id uuid;
begin
  select assessment.* into assessment_row from public.recruitment_assessments assessment where assessment.id = requested_assessment_id;
  if not found then raise exception 'RECRUITMENT_ASSESSMENT_NOT_FOUND' using errcode = '42501'; end if;
  reviewer_id := internal_security.current_recruitment_employee_id(assessment_row.tenant_id, assessment_row.hr_group_id);
  if assessment_row.reviewer_employee_id <> reviewer_id and not internal_security.recruitment_hr_can(assessment_row.tenant_id, assessment_row.hr_group_id, 'recruitment-assessment:write') then raise exception 'RECRUITMENT_ASSESSMENT_FORBIDDEN' using errcode = '42501'; end if;
  update public.recruitment_assessments set status = 'SUBMITTED', submitted_at = timezone('utc', now()), version = version + 1, updated_at = timezone('utc', now()) where id = requested_assessment_id and status = 'DRAFT' and version = requested_expected_version returning * into assessment_row;
  if not found then raise exception 'RECRUITMENT_ASSESSMENT_UPDATE_CONFLICT' using errcode = '40001'; end if;
  return jsonb_build_object('id', assessment_row.id, 'status', assessment_row.status, 'version', assessment_row.version, 'submittedAt', assessment_row.submitted_at);
end;
$$;

create or replace function public.correct_recruitment_assessment(requested_assessment_id uuid, requested_reason text, requested_scores jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, internal_security
as $$
declare original public.recruitment_assessments;
declare corrected public.recruitment_assessments;
begin
  select assessment.* into original from public.recruitment_assessments assessment where assessment.id = requested_assessment_id;
  if not found or original.status <> 'SUBMITTED' or not internal_security.recruitment_hr_can(original.tenant_id, original.hr_group_id, 'recruitment-assessment:write') then raise exception 'RECRUITMENT_ASSESSMENT_CORRECTION_FORBIDDEN' using errcode = '42501'; end if;
  insert into public.recruitment_assessments (tenant_id, hr_group_id, application_id, interview_id, participation_id, reviewer_employee_id, status, revision, submitted_at, correction_reason, corrected_from_assessment_id)
  values (original.tenant_id, original.hr_group_id, original.application_id, original.interview_id, original.participation_id, original.reviewer_employee_id, 'CORRECTED', original.revision + 1, timezone('utc', now()), btrim(requested_reason), original.id)
  returning * into corrected;
  insert into public.recruitment_assessment_scores (tenant_id, hr_group_id, assessment_id, characteristic_id, score, note)
  select corrected.tenant_id, corrected.hr_group_id, corrected.id, score.characteristic_id, score.score, score.note from jsonb_to_recordset(requested_scores) as score(characteristic_id uuid, score smallint, note text);
  return jsonb_build_object('id', corrected.id, 'status', corrected.status, 'revision', corrected.revision, 'correctedFromAssessmentId', original.id);
end;
$$;

create or replace function public.recruitment_participant_assigned_applications()
returns setof jsonb
language sql
security definer
set search_path = pg_catalog, public, internal_security
as $$
  select jsonb_build_object('applicationId', application.id, 'candidateName', concat(candidate.first_name, ' ', candidate.last_name), 'vacancyTitle', vacancy.title, 'stageName', stage.name, 'version', application.version)
  from public.recruitment_participations participation
  join public.recruitment_applications application on application.tenant_id = participation.tenant_id and application.hr_group_id = participation.hr_group_id and application.id = participation.application_id
  join public.recruitment_candidates candidate on candidate.tenant_id = application.tenant_id and candidate.hr_group_id = application.hr_group_id and candidate.id = application.candidate_id
  join public.recruitment_vacancies vacancy on vacancy.tenant_id = application.tenant_id and vacancy.hr_group_id = application.hr_group_id and vacancy.id = application.vacancy_id
  left join public.recruitment_pipeline_stages stage on stage.tenant_id = application.tenant_id and stage.hr_group_id = application.hr_group_id and stage.id = application.active_stage_id
  where participation.employee_id = internal_security.current_recruitment_employee_id(participation.tenant_id, participation.hr_group_id)
    and participation.status in ('ASSIGNED','ACTIVE') and application.terminal_outcome is null;
$$;

create or replace function public.recruitment_participant_detail_projection(requested_application_id uuid)
returns setof jsonb
language sql
security definer
set search_path = pg_catalog, public, internal_security
as $$
  select jsonb_build_object(
    'applicationId', application.id,
    'candidateName', concat(candidate.first_name, ' ', candidate.last_name),
    'candidateEmail', candidate.private_email,
    'candidatePhone', candidate.phone,
    'motivation', application.motivation,
    'vacancyTitle', vacancy.title,
    'stageName', stage.name,
    'version', application.version,
    'interviews', coalesce((select jsonb_agg(jsonb_build_object(
      'interviewId', interview.id,
      'title', interview.title,
      'scheduledAt', interview.scheduled_at,
      'questions', interview.questions_snapshot,
      'preparation', interview.preparation_snapshot,
      'criteria', interview.criteria_snapshot,
      'ownAssessment', (select jsonb_build_object('id', own.id, 'status', own.status, 'version', own.version, 'scores', coalesce((select jsonb_agg(jsonb_build_object('characteristicId', score.characteristic_id, 'score', score.score, 'note', score.note) order by score.characteristic_id) from public.recruitment_assessment_scores score where score.assessment_id = own.id), '[]'::jsonb)) from public.recruitment_assessments own where own.interview_id = interview.id and own.reviewer_employee_id = internal_security.current_recruitment_employee_id(application.tenant_id, application.hr_group_id) order by own.revision desc limit 1),
      'peerAssessments', case when exists (select 1 from public.recruitment_assessments own_state where own_state.interview_id = interview.id and own_state.reviewer_employee_id = internal_security.current_recruitment_employee_id(application.tenant_id, application.hr_group_id) and own_state.status in ('SUBMITTED','CORRECTED')) then coalesce((select jsonb_agg(jsonb_build_object('reviewerEmployeeId', peer.reviewer_employee_id, 'status', peer.status, 'scores', coalesce((select jsonb_agg(jsonb_build_object('characteristicId', score.characteristic_id, 'score', score.score, 'note', score.note) order by score.characteristic_id) from public.recruitment_assessment_scores score where score.assessment_id = peer.id), '[]'::jsonb)) order by peer.reviewer_employee_id) from public.recruitment_assessments peer where peer.interview_id = interview.id and peer.reviewer_employee_id <> internal_security.current_recruitment_employee_id(application.tenant_id, application.hr_group_id) and peer.status in ('SUBMITTED','CORRECTED')), '[]'::jsonb) else '[]'::jsonb end
    ) order by interview.scheduled_at) from public.recruitment_interviews interview where interview.application_id = application.id), '[]'::jsonb)
  )
  from public.recruitment_applications application
  join public.recruitment_candidates candidate on candidate.tenant_id = application.tenant_id and candidate.hr_group_id = application.hr_group_id and candidate.id = application.candidate_id
  join public.recruitment_vacancies vacancy on vacancy.tenant_id = application.tenant_id and vacancy.hr_group_id = application.hr_group_id and vacancy.id = application.vacancy_id
  left join public.recruitment_pipeline_stages stage on stage.tenant_id = application.tenant_id and stage.hr_group_id = application.hr_group_id and stage.id = application.active_stage_id
  where application.id = requested_application_id and application.terminal_outcome is null
    and exists (select 1 from public.recruitment_participations participation where participation.tenant_id = application.tenant_id and participation.hr_group_id = application.hr_group_id and participation.application_id = application.id and participation.employee_id = internal_security.current_recruitment_employee_id(application.tenant_id, application.hr_group_id) and participation.status in ('ASSIGNED','ACTIVE'));
$$;

revoke all on function public.create_recruitment_library_item(uuid,uuid,text,text,text,jsonb) from public, anon;
revoke all on function public.update_recruitment_library_item(uuid,text,jsonb,boolean,integer) from public, anon;
revoke all on function public.set_recruitment_library_item_enabled(uuid,boolean) from public, anon;
revoke all on function public.create_recruitment_set(uuid,uuid,text,text,text,jsonb) from public, anon;
revoke all on function public.update_recruitment_set(uuid,text,text,boolean,jsonb,integer) from public, anon;
revoke all on function public.create_recruitment_interview(uuid,text,timestamptz,uuid,jsonb) from public, anon;
revoke all on function public.upsert_recruitment_assessment_draft(uuid,jsonb) from public, anon;
revoke all on function public.submit_recruitment_assessment(uuid,integer) from public, anon;
revoke all on function public.correct_recruitment_assessment(uuid,text,jsonb) from public, anon;
revoke all on function public.recruitment_participant_assigned_applications() from public, anon;
revoke all on function public.recruitment_participant_detail_projection(uuid) from public, anon;
grant execute on function public.create_recruitment_library_item(uuid,uuid,text,text,text,jsonb) to authenticated;
grant execute on function public.update_recruitment_library_item(uuid,text,jsonb,boolean,integer) to authenticated;
grant execute on function public.set_recruitment_library_item_enabled(uuid,boolean) to authenticated;
grant execute on function public.create_recruitment_set(uuid,uuid,text,text,text,jsonb) to authenticated;
grant execute on function public.update_recruitment_set(uuid,text,text,boolean,jsonb,integer) to authenticated;
grant execute on function public.create_recruitment_interview(uuid,text,timestamptz,uuid,jsonb) to authenticated;
grant execute on function public.upsert_recruitment_assessment_draft(uuid,jsonb) to authenticated;
grant execute on function public.submit_recruitment_assessment(uuid,integer) to authenticated;
grant execute on function public.correct_recruitment_assessment(uuid,text,jsonb) to authenticated;
grant execute on function public.recruitment_participant_assigned_applications() to authenticated;
grant execute on function public.recruitment_participant_detail_projection(uuid) to authenticated;
