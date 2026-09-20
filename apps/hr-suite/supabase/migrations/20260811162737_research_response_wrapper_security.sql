begin;

create or replace function public.submit_survey_response(p_invitation_id uuid, p_answers jsonb)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select internal_security.submit_survey_response(p_invitation_id, p_answers);
$$;

create or replace function public.submit_enps_response(p_invitation_id uuid, p_answers jsonb)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select internal_security.submit_enps_response(p_invitation_id, p_answers);
$$;

commit;