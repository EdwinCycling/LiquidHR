-- Expliciete deny-policy voor service-only intakebewijs en covering indexes uit de remote advisors.

create policy recruitment_public_intake_limits_deny_all
on public.recruitment_public_intake_limits
for all to anon, authenticated
using (false)
with check (false);

create index recruitment_answers_question_fk_idx
  on public.recruitment_application_answers(tenant_id, hr_group_id, vacancy_question_id);
create index recruitment_applications_converted_by_fk_idx on public.recruitment_applications(converted_by_user_id);
create index recruitment_applications_created_by_fk_idx on public.recruitment_applications(created_by_user_id);
create index recruitment_applications_conversion_fk_idx
  on public.recruitment_applications(tenant_id, administration_id, employee_id, employment_id);
create index recruitment_applications_administration_fk_idx on public.recruitment_applications(tenant_id, administration_id);
create index recruitment_applications_employee_fk_idx on public.recruitment_applications(tenant_id, employee_id);
create index recruitment_applications_stage_fk_idx on public.recruitment_applications(tenant_id, hr_group_id, active_stage_id);
create index recruitment_applications_candidate_fk_idx on public.recruitment_applications(tenant_id, hr_group_id, candidate_id);
create index recruitment_applications_updated_by_fk_idx on public.recruitment_applications(updated_by_user_id);
create index recruitment_scores_characteristic_fk_idx
  on public.recruitment_assessment_scores(tenant_id, hr_group_id, characteristic_id);
create index recruitment_assessments_correction_fk_idx
  on public.recruitment_assessments(tenant_id, hr_group_id, corrected_from_assessment_id);
create index recruitment_assessments_interview_fk_idx
  on public.recruitment_assessments(tenant_id, hr_group_id, interview_id);
create index recruitment_assessments_participation_fk_idx
  on public.recruitment_assessments(tenant_id, hr_group_id, participation_id);
create index recruitment_assessments_reviewer_fk_idx on public.recruitment_assessments(tenant_id, reviewer_employee_id);
create index recruitment_events_actor_fk_idx on public.recruitment_events(actor_user_id);
create index recruitment_events_application_fk_idx on public.recruitment_events(tenant_id, hr_group_id, application_id);
create index recruitment_interview_participation_fk_idx
  on public.recruitment_interview_participants(tenant_id, hr_group_id, participation_id);
create index recruitment_interviews_set_fk_idx on public.recruitment_interviews(tenant_id, hr_group_id, set_id);
create index recruitment_library_created_by_fk_idx on public.recruitment_library_items(created_by_user_id);
create index recruitment_library_updated_by_fk_idx on public.recruitment_library_items(updated_by_user_id);
create index recruitment_participations_employee_fk_idx on public.recruitment_participations(tenant_id, employee_id);
create index recruitment_stages_created_by_fk_idx on public.recruitment_pipeline_stages(created_by_user_id);
create index recruitment_stages_updated_by_fk_idx on public.recruitment_pipeline_stages(updated_by_user_id);
create index recruitment_intake_publication_fk_idx
  on public.recruitment_public_intake_limits(tenant_id, hr_group_id, publication_id);
create index recruitment_publications_vacancy_fk_idx
  on public.recruitment_publications(tenant_id, hr_group_id, vacancy_id);
create index recruitment_set_items_library_fk_idx
  on public.recruitment_set_items(tenant_id, hr_group_id, library_item_id);
create index recruitment_settings_created_by_fk_idx on public.recruitment_settings(created_by_user_id);
create index recruitment_settings_updated_by_fk_idx on public.recruitment_settings(updated_by_user_id);
create index recruitment_vacancies_created_by_fk_idx on public.recruitment_vacancies(created_by_user_id);
create index recruitment_vacancies_job_fk_idx on public.recruitment_vacancies(tenant_id, hr_group_id, job_id);
create index recruitment_vacancies_updated_by_fk_idx on public.recruitment_vacancies(updated_by_user_id);
create index recruitment_questions_definition_fk_idx
  on public.recruitment_vacancy_questions(tenant_id, hr_group_id, definition_id);
