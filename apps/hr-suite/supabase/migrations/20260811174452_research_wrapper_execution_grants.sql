begin;

alter function public.update_survey_draft(uuid, jsonb) security definer;
alter function public.update_enps_draft(uuid, jsonb) security definer;
alter function public.submit_survey_response(uuid, jsonb) security definer;
alter function public.submit_enps_response(uuid, jsonb) security definer;

revoke all on function internal_security.update_survey_draft(uuid, jsonb) from public, anon, authenticated;
revoke all on function internal_security.update_enps_draft(uuid, jsonb) from public, anon, authenticated;
revoke all on function internal_security.submit_survey_response(uuid, jsonb) from public, anon, authenticated;
revoke all on function internal_security.submit_enps_response(uuid, jsonb) from public, anon, authenticated;

revoke all on function public.update_survey_draft(uuid, jsonb) from public, anon;
revoke all on function public.update_enps_draft(uuid, jsonb) from public, anon;
revoke all on function public.submit_survey_response(uuid, jsonb) from public, anon;
revoke all on function public.submit_enps_response(uuid, jsonb) from public, anon;

grant execute on function public.update_survey_draft(uuid, jsonb) to authenticated;
grant execute on function public.update_enps_draft(uuid, jsonb) to authenticated;
grant execute on function public.submit_survey_response(uuid, jsonb) to authenticated;
grant execute on function public.submit_enps_response(uuid, jsonb) to authenticated;

commit;
