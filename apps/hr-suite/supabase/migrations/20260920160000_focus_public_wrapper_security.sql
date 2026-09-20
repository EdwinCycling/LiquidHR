begin;

-- The public Focus RPCs are the only authenticated entrypoints. Their bodies
-- delegate to internal SECURITY DEFINER helpers, so the wrappers must also be
-- definer functions; the helpers retain the actual persona and scope checks.
alter function public.register_absence_confirmation(uuid, uuid) security definer;
alter function public.report_focus_employee_absence(uuid, uuid, uuid, uuid, date, date, text) security definer;
alter function public.confirm_absence_confirmation(uuid) security definer;
alter function public.request_absence_correction(uuid, text) security definer;

commit;
