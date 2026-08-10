-- De invoker-wrapper moet zijn private security-definer helper kunnen aanroepen.
grant execute on function internal_security.get_process_work_projection_for_employment(uuid, uuid, uuid, text, text, text, uuid, text, text, integer, integer)
  to authenticated;
notify pgrst, 'reload schema';
