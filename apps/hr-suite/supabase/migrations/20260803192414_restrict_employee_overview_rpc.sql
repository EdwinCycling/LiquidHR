revoke all on function public.list_employee_overviews(uuid, uuid, date, text) from anon;
grant execute on function public.list_employee_overviews(uuid, uuid, date, text) to authenticated;
