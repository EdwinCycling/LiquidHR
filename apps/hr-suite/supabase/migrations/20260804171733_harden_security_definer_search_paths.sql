-- Do not include pg_temp in SECURITY DEFINER search paths. A caller can create
-- temporary objects, so keeping pg_temp here could allow name shadowing.

alter function public.activate_job_profile_version(uuid, uuid)
  set search_path = public, auth;

alter function public.copy_job_profile_version_to_draft(uuid, uuid, uuid)
  set search_path = public, auth;

alter function public.create_employee_address_change_reminders(uuid, uuid, uuid, text, jsonb, jsonb)
  set search_path = public, internal_security, auth;

alter function public.create_employee_address_with_reminders(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text,
  text, text, date, date, text, text, text[]
)
  set search_path = public, internal_security, auth;

alter function public.get_employee_directory_access(uuid, uuid)
  set search_path = public, internal_security, auth;

alter function public.get_employee_directory_detail(uuid, uuid, uuid, date)
  set search_path = public, internal_security, auth;

alter function public.get_employee_directory_visibility(uuid, uuid)
  set search_path = public, internal_security, auth;

alter function public.list_employee_overviews(uuid, uuid, date, text)
  set search_path = public, internal_security, auth;
