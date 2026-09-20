alter function public.publish_salary_structure_revision(uuid, integer)
  security definer;

revoke all on function public.publish_salary_structure_revision(uuid, integer)
  from public, anon;
grant execute on function public.publish_salary_structure_revision(uuid, integer)
  to authenticated;