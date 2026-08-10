begin;

-- P9 dynamic manager selectors resolve from process fields. Keep the submitted
-- certified transfer form available to the runtime router without exposing a
-- generic form-to-domain write path.
create or replace function internal_security.sync_internal_transfer_process_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.form_key <> 'internal-transfer-form' then
    return new;
  end if;

  if not exists (
    select 1
    from public.process_definitions definition
    where definition.tenant_id = new.tenant_id
      and definition.hr_group_id = new.hr_group_id
      and definition.id = (
        select instance.process_definition_id
        from public.process_instances instance
        where instance.tenant_id = new.tenant_id
          and instance.hr_group_id = new.hr_group_id
          and instance.id = new.process_instance_id
      )
      and definition.key like 'internal-transfer-%'
  ) then
    return new;
  end if;

  update public.process_instances instance
  set metadata = jsonb_set(
    coalesce(instance.metadata, '{}'::jsonb),
    '{fields}',
    coalesce(instance.metadata -> 'fields', '{}'::jsonb)
      || coalesce(new.current_values, '{}'::jsonb)
      || coalesce(new.new_values, '{}'::jsonb),
    true
  )
  where instance.tenant_id = new.tenant_id
    and instance.hr_group_id = new.hr_group_id
    and instance.id = new.process_instance_id;

  return new;
end;
$$;

revoke all on function internal_security.sync_internal_transfer_process_fields() from public, anon, authenticated;

drop trigger if exists sync_internal_transfer_process_fields_after_response on public.process_form_responses;
create trigger sync_internal_transfer_process_fields_after_response
after insert or update of current_values, new_values on public.process_form_responses
for each row execute function internal_security.sync_internal_transfer_process_fields();

-- Backfill only already-saved P9 transfer responses, including the browser
-- instance that was started before this compatibility guard was installed.
update public.process_instances instance
set metadata = jsonb_set(
  coalesce(instance.metadata, '{}'::jsonb),
  '{fields}',
  coalesce(instance.metadata -> 'fields', '{}'::jsonb)
    || coalesce(response.current_values, '{}'::jsonb)
    || coalesce(response.new_values, '{}'::jsonb),
  true
)
from public.process_form_responses response
join public.process_definitions definition
  on definition.tenant_id = response.tenant_id
 and definition.hr_group_id = response.hr_group_id
 and definition.key like 'internal-transfer-%'
join public.process_instances response_instance
  on response_instance.tenant_id = response.tenant_id
 and response_instance.hr_group_id = response.hr_group_id
 and response_instance.id = response.process_instance_id
 and response_instance.process_definition_id = definition.id
where instance.tenant_id = response.tenant_id
  and instance.hr_group_id = response.hr_group_id
  and instance.id = response.process_instance_id
  and response.form_key = 'internal-transfer-form';

commit;
