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
  on conflict (tenant_id, hr_group_id, application_id, interview_id, employee_id) do update set status = 'ACTIVE', revoked_at = null, activated_at = coalesce(public.recruitment_participations.activated_at, timezone('utc', now())), updated_at = timezone('utc', now());
  insert into public.recruitment_interview_participants (tenant_id, hr_group_id, interview_id, participation_id)
  select participant.tenant_id, participant.hr_group_id, interview_row.id, participant.id from public.recruitment_participations participant where participant.interview_id = interview_row.id;
  return jsonb_build_object('id', interview_row.id, 'applicationId', interview_row.application_id, 'preparationCount', jsonb_array_length(interview_row.preparation_snapshot), 'questionCount', jsonb_array_length(interview_row.questions_snapshot), 'criteriaCount', jsonb_array_length(interview_row.criteria_snapshot));
end;
$$;
