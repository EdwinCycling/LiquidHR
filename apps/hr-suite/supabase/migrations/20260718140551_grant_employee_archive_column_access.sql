grant select (is_archived) on table public.employees to authenticated;
grant update (is_archived) on table public.employees to authenticated;
notify pgrst, 'reload schema';