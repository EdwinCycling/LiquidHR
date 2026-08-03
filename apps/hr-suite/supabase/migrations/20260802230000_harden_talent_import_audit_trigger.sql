begin;

create or replace function internal_security.audit_talent_import_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_data jsonb;
  old_data jsonb;
  tenant uuid;
  entity_id uuid;
  audit_action text;
begin
  if tg_op = 'DELETE' then
    row_data := '{}'::jsonb;
    old_data := to_jsonb(old);
    tenant := old.tenant_id;
    entity_id := old.id;
    audit_action := 'DELETE';
  else
    row_data := to_jsonb(new);
    old_data := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
    tenant := new.tenant_id;
    entity_id := new.id;
    audit_action := case when tg_op = 'INSERT' then 'CREATE' else 'UPDATE' end;
  end if;

  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (
    tenant,
    tg_argv[0],
    entity_id,
    auth.uid(),
    audit_action,
    jsonb_build_object('before', old_data, 'after', row_data)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function internal_security.audit_talent_import_change() from public, anon, authenticated;

commit;
