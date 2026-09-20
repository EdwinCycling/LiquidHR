-- SEC-012 CONTRACT: disable the legacy public submit overload only after the
-- new application version has been deployed and verified.

create or replace function public.recruitment_submit_public_application(
  requested_publication_id uuid,
  requested_slug text,
  requested_payload jsonb,
  requested_intake_proof text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'RECRUITMENT_PUBLIC_PROOF_INVALID' using errcode = '42501';
end;
$$;

revoke all on function public.recruitment_submit_public_application(uuid, text, jsonb, text) from public, anon, authenticated, service_role;
