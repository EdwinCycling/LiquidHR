-- Sluit de Teamkompas foreign-key-indexadviezen na de eerste remote uitrol.
-- IF NOT EXISTS houdt deze migratie veilig voor nieuwe omgevingen waar de
-- basismigratie dezelfde indexen al aanmaakt.

create index if not exists team_compass_campaigns_questionnaire_version_idx
  on public.team_compass_campaigns (questionnaire_version_id);

create index if not exists team_compass_campaigns_created_by_user_idx
  on public.team_compass_campaigns (created_by_user_id);

create index if not exists team_compass_campaigns_updated_by_user_idx
  on public.team_compass_campaigns (updated_by_user_id);

create index if not exists team_compass_campaign_targets_campaign_idx
  on public.team_compass_campaign_targets (tenant_id, hr_group_id, campaign_id);

create index if not exists team_compass_answers_question_idx
  on public.team_compass_answers (question_id);
