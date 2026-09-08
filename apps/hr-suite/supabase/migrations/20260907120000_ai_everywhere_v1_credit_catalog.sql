-- AI Everywhere v1 gebruikt dezelfde bestaande Liquid Credits-catalogus.
-- Deze migration voegt uitsluitend de twaalf vaste feature/profile-prijzen toe.
insert into public.ai_credit_charge_catalog (
  feature_code, quality_profile, charge_reference, credit_amount, config_version
)
values
  ('EMPLOYEE_SUMMARY', 'EFFICIENT', 'ai.employee-summary.efficient', 1, 'ai-everywhere-v1.20260907.1'),
  ('EMPLOYEE_SUMMARY', 'BALANCED', 'ai.employee-summary.balanced', 2, 'ai-everywhere-v1.20260907.1'),
  ('EMPLOYEE_SUMMARY', 'IN_DEPTH', 'ai.employee-summary.in-depth', 3, 'ai-everywhere-v1.20260907.1'),
  ('CONVERSATION_PREPARATION', 'EFFICIENT', 'ai.conversation-preparation.efficient', 1, 'ai-everywhere-v1.20260907.1'),
  ('CONVERSATION_PREPARATION', 'BALANCED', 'ai.conversation-preparation.balanced', 2, 'ai-everywhere-v1.20260907.1'),
  ('CONVERSATION_PREPARATION', 'IN_DEPTH', 'ai.conversation-preparation.in-depth', 3, 'ai-everywhere-v1.20260907.1'),
  ('DEVELOPMENT_GOAL_SMART', 'EFFICIENT', 'ai.development-goal-smart.efficient', 1, 'ai-everywhere-v1.20260907.1'),
  ('DEVELOPMENT_GOAL_SMART', 'BALANCED', 'ai.development-goal-smart.balanced', 2, 'ai-everywhere-v1.20260907.1'),
  ('DEVELOPMENT_GOAL_SMART', 'IN_DEPTH', 'ai.development-goal-smart.in-depth', 3, 'ai-everywhere-v1.20260907.1'),
  ('VACANCY_DRAFT', 'EFFICIENT', 'ai.vacancy-draft.efficient', 1, 'ai-everywhere-v1.20260907.1'),
  ('VACANCY_DRAFT', 'BALANCED', 'ai.vacancy-draft.balanced', 2, 'ai-everywhere-v1.20260907.1'),
  ('VACANCY_DRAFT', 'IN_DEPTH', 'ai.vacancy-draft.in-depth', 3, 'ai-everywhere-v1.20260907.1')
on conflict (feature_code, quality_profile) do update
set charge_reference = excluded.charge_reference,
    credit_amount = excluded.credit_amount,
    config_version = excluded.config_version;
