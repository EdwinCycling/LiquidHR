begin;

create or replace function public.update_survey_draft(p_campaign_id uuid, p_payload jsonb)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select internal_security.update_survey_draft(p_campaign_id, p_payload);
$$;

create or replace function public.update_enps_draft(p_campaign_id uuid, p_payload jsonb)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select internal_security.update_enps_draft(p_campaign_id, p_payload);
$$;

commit;