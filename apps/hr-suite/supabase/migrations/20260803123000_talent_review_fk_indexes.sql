create index talent_review_campaigns_administration_fk_idx
  on public.talent_review_campaigns (tenant_id, administration_id);
create index talent_review_campaigns_previous_fk_idx
  on public.talent_review_campaigns (tenant_id, previous_campaign_id);
create index talent_review_campaigns_created_by_fk_idx
  on public.talent_review_campaigns (created_by_user_id);
create index talent_review_campaigns_updated_by_fk_idx
  on public.talent_review_campaigns (updated_by_user_id);
create index talent_review_campaigns_closed_by_fk_idx
  on public.talent_review_campaigns (closed_by_user_id);
create index talent_review_assignments_manager_fk_idx
  on public.talent_review_assignments (tenant_id, manager_employee_id);
create index talent_review_assignments_submitted_by_fk_idx
  on public.talent_review_assignments (submitted_by_user_id);
create index talent_review_assignments_reminder_fk_idx
  on public.talent_review_assignments (tenant_id, reminder_id);
create index talent_review_assignment_members_manager_fk_idx
  on public.talent_review_assignment_members (tenant_id, manager_employee_id);
create index talent_review_assignment_members_employee_fk_idx
  on public.talent_review_assignment_members (tenant_id, employee_id);
create index talent_review_scores_assignment_fk_idx
  on public.talent_review_scores (tenant_id, assignment_id);
create index talent_review_scores_manager_fk_idx
  on public.talent_review_scores (tenant_id, manager_employee_id);
create index talent_review_scores_created_by_fk_idx
  on public.talent_review_scores (created_by_user_id);
create index talent_review_scores_updated_by_fk_idx
  on public.talent_review_scores (updated_by_user_id);
