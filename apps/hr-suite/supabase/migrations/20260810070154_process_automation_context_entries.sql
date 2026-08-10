begin;

-- Contextuele werkkaarten mogen alleen een bestaande, server-geautoriseerde
-- werkprojectie vernauwen. De onderliggende projectie blijft verantwoordelijk
-- voor tenant-, scope-, kandidaat- en work-itemrechten.
create or replace function internal_security.get_process_work_projection_for_employment(
  requested_hr_group_id uuid,
  requested_employment_id uuid,
  requested_administration_id uuid default null,
  requested_tab text default 'ALL',
  requested_search text default null,
  requested_status text default null,
  requested_process_definition_id uuid default null,
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
  tenant_id_value uuid;
  employee_id_value uuid;
  projection jsonb;
  filtered_items jsonb;
begin
  select employment.tenant_id, employment.employee_id
    into tenant_id_value, employee_id_value
  from public.employments employment
  where employment.id = requested_employment_id
    and employment.hr_group_id = requested_hr_group_id
    and employment.deleted_at is null;

  if tenant_id_value is null or employee_id_value is null then
    return jsonb_build_object('items', '[]'::jsonb, 'total', 0, 'hasMore', false);
  end if;

  projection := internal_security.get_process_work_projection_with_administration(
    requested_hr_group_id,
    requested_administration_id,
    requested_tab,
    requested_search,
    requested_status,
    requested_process_definition_id,
    employee_id_value,
    requested_language,
    requested_sort,
    requested_limit,
    requested_offset
  );

  select coalesce(jsonb_agg(item.value order by item.ordinality), '[]'::jsonb)
    into filtered_items
  from jsonb_array_elements(coalesce(projection -> 'items', '[]'::jsonb)) with ordinality item(value, ordinality)
  where exists (
    select 1
    from public.process_work_items work_item
    join public.process_employment_subjects subject
      on subject.tenant_id = work_item.tenant_id
     and subject.hr_group_id = work_item.hr_group_id
     and subject.process_instance_id = work_item.process_instance_id
    where work_item.tenant_id = tenant_id_value
      and work_item.hr_group_id = requested_hr_group_id
      and work_item.id = (item.value ->> 'workItemId')::uuid
      and subject.employment_id = requested_employment_id
  );

  return jsonb_build_object(
    'items', filtered_items,
    'total', jsonb_array_length(filtered_items),
    'hasMore', false
  );
end;
$$;

revoke all on function internal_security.get_process_work_projection_for_employment(uuid, uuid, uuid, text, text, text, uuid, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function internal_security.get_process_work_projection_for_employment(uuid, uuid, uuid, text, text, text, uuid, text, text, integer, integer)
  to authenticated;

create or replace function public.get_process_work_projection_for_employment(
  requested_hr_group_id uuid,
  requested_employment_id uuid,
  requested_administration_id uuid default null,
  requested_tab text default 'ALL',
  requested_search text default null,
  requested_status text default null,
  requested_process_definition_id uuid default null,
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
  select internal_security.get_process_work_projection_for_employment(
    requested_hr_group_id,
    requested_employment_id,
    requested_administration_id,
    requested_tab,
    requested_search,
    requested_status,
    requested_process_definition_id,
    requested_language,
    requested_sort,
    requested_limit,
    requested_offset
  );
$$;

revoke all on function public.get_process_work_projection_for_employment(uuid, uuid, uuid, text, text, text, uuid, text, text, integer, integer)
  from public, anon;
grant execute on function public.get_process_work_projection_for_employment(uuid, uuid, uuid, text, text, text, uuid, text, text, integer, integer)
  to authenticated;

commit;
