-- Fix Step 3 retention kernel variable/column ambiguity.
create or replace function internal_recruitment.anonymize_application(requested_application_id uuid, requested_category text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare application_row public.recruitment_applications;
declare application_candidate_id uuid;
declare storage_keys jsonb;
begin
  select application.* into application_row
  from public.recruitment_applications application
  where application.id = requested_application_id and application.anonymized_at is null;
  if not found then return jsonb_build_object('processed', false, 'storageKeys', '[]'::jsonb); end if;
  select coalesce(jsonb_agg(document.storage_key), '[]'::jsonb) into storage_keys
  from public.recruitment_documents document where document.application_id = application_row.id;
  application_candidate_id := application_row.candidate_id;
  delete from public.recruitment_documents where application_id = application_row.id;
  delete from public.recruitment_application_answers where application_id = application_row.id;
  delete from public.recruitment_assessment_scores where assessment_id in (select id from public.recruitment_assessments where application_id = application_row.id);
  delete from public.recruitment_assessments where application_id = application_row.id;
  delete from public.recruitment_interview_participants where interview_id in (select id from public.recruitment_interviews where application_id = application_row.id);
  delete from public.recruitment_participations where application_id = application_row.id;
  delete from public.recruitment_interviews where application_id = application_row.id;
  update public.recruitment_applications
  set motivation = null, terminal_reason = null, terminal_note = null, anonymized_at = timezone('utc', now()), retention_due_at = null, updated_at = timezone('utc', now())
  where id = application_row.id;
  if not exists (select 1 from public.recruitment_applications other where other.candidate_id = application_candidate_id and other.id <> application_row.id and other.anonymized_at is null) then
    update public.recruitment_candidates
    set first_name = 'Verwijderd', last_name = 'Kandidaat', private_email = null, normalized_email = null, phone = null, updated_at = timezone('utc', now())
    where id = application_candidate_id;
  end if;
  insert into public.recruitment_events (tenant_id, hr_group_id, application_id, event_type, actor_user_id, payload)
  values (application_row.tenant_id, application_row.hr_group_id, application_row.id, 'RECRUITMENT_DATA_ANONYMIZED', auth.uid(), jsonb_build_object('category', requested_category, 'processedAt', timezone('utc', now())));
  return jsonb_build_object('processed', true, 'applicationId', application_row.id, 'storageKeys', storage_keys);
end;
$$;

revoke all on function internal_recruitment.anonymize_application(uuid, text) from public, anon, authenticated;
