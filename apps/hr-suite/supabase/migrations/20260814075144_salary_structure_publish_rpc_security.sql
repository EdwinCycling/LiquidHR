-- Publishing must call a non-public internal validator. The RPC already requires
-- auth.uid(), locks the requested draft, and checks both actor permissions against
-- that draft's tenant and HR group before any mutation. SECURITY DEFINER supplies
-- only the internal execute privilege; the explicit actor checks remain decisive.
alter function public.publish_salary_structure_revision(uuid, integer)
  security definer;

revoke all on function public.publish_salary_structure_revision(uuid, integer)
  from public, anon;
grant execute on function public.publish_salary_structure_revision(uuid, integer)
  to authenticated;
