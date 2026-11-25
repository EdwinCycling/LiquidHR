begin;

-- Review submissions are immutable domain rows. PMUX owns assignment, claim,
-- authorization, audit and the phase transition, but must not validate a
-- duplicate PMUX form for the two product-owned input steps.
-- Preserve the original PMUX validation function for every other workflow.
do $$
begin
  if pg_catalog.to_regprocedure(
    'internal_security.prepare_process_form_action_before_reviews(uuid,text)'
  ) is null then
    execute 'alter function internal_security.prepare_process_form_action(uuid, text) '
      || 'rename to prepare_process_form_action_before_reviews';
  end if;
end;
$$;

create or replace function internal_security.prepare_process_form_action(
  requested_work_item_id uuid,
  requested_action text
)
returns void
language plpgsql
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
    return;
  end if;

  perform internal_security.prepare_process_form_action_before_reviews(
    requested_work_item_id,
    requested_action
  );
end;
$$;

revoke all on function internal_security.prepare_process_form_action(uuid, text)
  from public, anon, authenticated;

commit;
