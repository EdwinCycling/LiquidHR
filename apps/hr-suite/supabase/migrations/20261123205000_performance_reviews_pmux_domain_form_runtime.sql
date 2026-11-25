begin;

-- PMUX gathers form values before validating a form action. Review phases use
-- the separately authorized immutable Performance Review submission RPC, so
-- return no PMUX fields for those two exact workflow steps. Other PMUX forms
-- continue through the existing runtime implementation unchanged.
do $$
begin
  if pg_catalog.to_regprocedure(
    'internal_security.process_form_runtime_fields_before_reviews(uuid)'
  ) is null then
    execute 'alter function internal_security.process_form_runtime_fields(uuid) '
      || 'rename to process_form_runtime_fields_before_reviews';
  end if;
end;
$$;

create or replace function internal_security.process_form_runtime_fields(
  requested_work_item_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.process_work_items item
    join public.process_instances instance
      on instance.tenant_id = item.tenant_id
     and instance.hr_group_id = item.hr_group_id
     and instance.id = item.process_instance_id
    join public.process_definitions definition
      on definition.tenant_id = instance.tenant_id
     and definition.hr_group_id = instance.hr_group_id
     and definition.id = instance.process_definition_id
    where item.id = requested_work_item_id
      and definition.key = 'performance-review-mvp'
      and item.step_key in ('self-reflection', 'manager-response')
  ) then
    return '{}'::jsonb;
  end if;

  return internal_security.process_form_runtime_fields_before_reviews(
    requested_work_item_id
  );
end;
$$;

revoke all on function internal_security.process_form_runtime_fields(uuid)
  from public, anon, authenticated;

commit;
