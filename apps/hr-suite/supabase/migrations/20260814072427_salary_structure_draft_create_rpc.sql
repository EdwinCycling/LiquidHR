create or replace function public.create_salary_structure_draft(
  requested_structure_id uuid,
  requested_payload jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select public.save_salary_structure_draft(
    requested_structure_id,
    null,
    null,
    requested_payload
  );
$$;

revoke all on function public.create_salary_structure_draft(uuid, jsonb) from public, anon;
grant execute on function public.create_salary_structure_draft(uuid, jsonb) to authenticated;
