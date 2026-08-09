begin;

create or replace function internal_security.get_process_work_projection_with_administration(
  requested_hr_group_id uuid,
  requested_administration_id uuid default null,
  requested_tab text default 'TODO',
  requested_search text default null,
  requested_status text default null,
  requested_process_definition_id uuid default null,
  requested_subject_employee_id uuid default null,
  requested_language text default 'nl',
  requested_sort text default 'NEEDS_ACTION',
  requested_limit integer default 100,
  requested_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  projection jsonb;
  filtered_items jsonb;
  filtered_total integer;
begin
  projection := internal_security.get_process_work_projection(
    requested_hr_group_id, requested_tab, requested_search, requested_status,
    requested_process_definition_id, requested_subject_employee_id, requested_language,
    requested_sort, requested_limit, requested_offset
  );
  if requested_administration_id is null then return projection; end if;

  select coalesce(jsonb_agg(item.value order by item.ordinality), '[]'::jsonb)
  into filtered_items
  from jsonb_array_elements(coalesce(projection -> 'items', '[]'::jsonb)) with ordinality item(value, ordinality)
  where exists (
    select 1
    from public.process_instances instance
    where instance.id = (item.value ->> 'processInstanceId')::uuid
      and instance.tenant_id = (select group_row.tenant_id from public.hr_groups group_row where group_row.id = requested_hr_group_id)
      and instance.hr_group_id = requested_hr_group_id
      and instance.administration_id = requested_administration_id
  );
  filtered_total := jsonb_array_length(filtered_items);
  return jsonb_build_object('items', filtered_items, 'total', filtered_total, 'hasMore', false);
end;
$$;

revoke all on function internal_security.get_process_work_projection_with_administration(uuid, uuid, text, text, text, uuid, uuid, text, text, integer, integer)
  from public, anon, authenticated;

create or replace function public.get_process_work_projection_with_administration(
  requested_hr_group_id uuid,
  requested_administration_id uuid default null,
  requested_tab text default 'TODO',
  requested_search text default null,
  requested_status text default null,
  requested_process_definition_id uuid default null,
  requested_subject_employee_id uuid default null,
  requested_language text default 'nl',
  requested_sort text default 'NEEDS_ACTION',
  requested_limit integer default 100,
  requested_offset integer default 0
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.get_process_work_projection_with_administration(
    requested_hr_group_id, requested_administration_id, requested_tab, requested_search,
    requested_status, requested_process_definition_id, requested_subject_employee_id,
    requested_language, requested_sort, requested_limit, requested_offset
  );
$$;

revoke all on function public.get_process_work_projection_with_administration(uuid, uuid, text, text, text, uuid, uuid, text, text, integer, integer)
  from public, anon;
grant execute on function public.get_process_work_projection_with_administration(uuid, uuid, text, text, text, uuid, uuid, text, text, integer, integer)
  to authenticated;

commit;
