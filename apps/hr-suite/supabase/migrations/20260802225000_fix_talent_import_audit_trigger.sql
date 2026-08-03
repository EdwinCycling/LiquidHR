begin;

create or replace function internal_security.audit_talent_import_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_data jsonb := to_jsonb(new);
  old_data jsonb := to_jsonb(old);
  tenant uuid := coalesce(new.tenant_id, old.tenant_id);
  entity_id uuid := coalesce(new.id, old.id);
begin
  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (
    tenant,
    tg_argv[0],
    entity_id,
    auth.uid(),
    lower(tg_op),
    jsonb_build_object(
      'status', coalesce(row_data ->> 'status', old_data ->> 'status'),
      'rowCount', coalesce(row_data -> 'row_count', old_data -> 'row_count'),
      'batchId', coalesce(row_data ->> 'batch_id', old_data ->> 'batch_id'),
      'rowNumber', coalesce(row_data -> 'row_number', old_data -> 'row_number')
    )
  );
  return coalesce(new, old);
end;
$$;

revoke all on function internal_security.audit_talent_import_change() from public, anon, authenticated;

commit;
