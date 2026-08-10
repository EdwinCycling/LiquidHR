-- Houd iedere SELECT op research-tabellen bij één policy en dek alle nieuwe foreign keys af.

drop policy if exists survey_questions_write on public.survey_questions;
create policy survey_questions_insert on public.survey_questions for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));
create policy survey_questions_update on public.survey_questions for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));
create policy survey_questions_delete on public.survey_questions for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));

drop policy if exists survey_question_options_write on public.survey_question_options;
create policy survey_question_options_insert on public.survey_question_options for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));
create policy survey_question_options_update on public.survey_question_options for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));
create policy survey_question_options_delete on public.survey_question_options for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));

drop policy if exists survey_matrix_rows_write on public.survey_matrix_rows;
create policy survey_matrix_rows_insert on public.survey_matrix_rows for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));
create policy survey_matrix_rows_update on public.survey_matrix_rows for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));
create policy survey_matrix_rows_delete on public.survey_matrix_rows for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));

drop policy if exists survey_invitations_hr_write on public.survey_invitations;
create policy survey_invitations_hr_insert on public.survey_invitations for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));
create policy survey_invitations_hr_update on public.survey_invitations for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));
create policy survey_invitations_hr_delete on public.survey_invitations for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));

drop policy if exists enps_question_bank_categories_hr_write on public.enps_question_bank_categories;
create policy enps_question_bank_categories_hr_insert on public.enps_question_bank_categories for insert to authenticated
with check (
  not is_system
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write'))
);
create policy enps_question_bank_categories_hr_update on public.enps_question_bank_categories for update to authenticated
using (
  not is_system
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write'))
)
with check (
  not is_system
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write'))
);
create policy enps_question_bank_categories_hr_delete on public.enps_question_bank_categories for delete to authenticated
using (
  not is_system
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write'))
);

drop policy if exists enps_question_bank_hr_write on public.enps_question_bank;
create policy enps_question_bank_hr_insert on public.enps_question_bank for insert to authenticated
with check (
  not is_system
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write'))
);
create policy enps_question_bank_hr_update on public.enps_question_bank for update to authenticated
using (
  not is_system
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write'))
)
with check (
  not is_system
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write'))
);
create policy enps_question_bank_hr_delete on public.enps_question_bank for delete to authenticated
using (
  not is_system
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write'))
);

drop policy if exists enps_questions_write on public.enps_questions;
create policy enps_questions_insert on public.enps_questions for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));
create policy enps_questions_update on public.enps_questions for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));
create policy enps_questions_delete on public.enps_questions for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));

drop policy if exists enps_invitations_hr_write on public.enps_invitations;
create policy enps_invitations_hr_insert on public.enps_invitations for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));
create policy enps_invitations_hr_update on public.enps_invitations for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));
create policy enps_invitations_hr_delete on public.enps_invitations for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'research:write')));

create index surveys_created_by_fk_idx on public.surveys (created_by);
create index enps_campaigns_created_by_fk_idx on public.enps_campaigns (created_by);
create index survey_question_options_question_fk_idx
  on public.survey_question_options (tenant_id, hr_group_id, survey_id, question_id);
create index survey_matrix_rows_question_fk_idx
  on public.survey_matrix_rows (tenant_id, hr_group_id, survey_id, question_id);
create index survey_responses_employee_fk_idx
  on public.survey_responses (tenant_id, hr_group_id, respondent_employee_id);
create index survey_answers_question_fk_idx
  on public.survey_answers (tenant_id, hr_group_id, survey_id, question_id);
create index survey_answers_response_fk_idx
  on public.survey_answers (tenant_id, hr_group_id, survey_id, response_id);
create index survey_answers_matrix_row_fk_idx
  on public.survey_answers (question_id, matrix_row_id);
create index enps_questions_bank_question_fk_idx
  on public.enps_questions (bank_question_id);
create index enps_answers_question_fk_idx
  on public.enps_answers (tenant_id, hr_group_id, campaign_id, question_id);
create index enps_answers_response_fk_idx
  on public.enps_answers (tenant_id, hr_group_id, campaign_id, response_id);
