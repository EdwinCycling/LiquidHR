create or replace function internal_security.audit_continuous_appraisal_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  row_before jsonb;
  row_after jsonb;
  row_identity jsonb;
  tenant_value uuid;
  entity_value uuid;
  action_value text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    row_before := to_jsonb(old);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    row_after := to_jsonb(new);
  end if;

  row_identity := coalesce(row_after, row_before);
  tenant_value := (row_identity ->> 'tenant_id')::uuid;
  entity_value := (row_identity ->> 'id')::uuid;

  action_value := case
    when tg_op = 'INSERT' then 'CREATE'
    when tg_op = 'DELETE' then 'DELETE'
    when tg_table_name = 'continuous_appraisal_items'
      and tg_op = 'UPDATE'
      and (row_before ->> 'deleted_at') is null
      and (row_after ->> 'deleted_at') is not null then 'SOFT_DELETE'
    when tg_table_name = 'continuous_appraisal_items'
      and tg_op = 'UPDATE'
      and (row_after ->> 'item_status') is distinct from (row_before ->> 'item_status') then 'STATUS_TRANSITION'
    else 'UPDATE'
  end;

  insert into public.audit_logs (
    tenant_id, entity_name, entity_id, actor_user_id, action, changes
  )
  values (
    tenant_value,
    tg_table_name,
    entity_value,
    (select auth.uid()),
    action_value,
    jsonb_build_object(
      'before', coalesce(row_before, '{}'::jsonb),
      'after', coalesce(row_after, '{}'::jsonb),
      'source', 'CONTINUOUS_APPRAISAL'
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;
