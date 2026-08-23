begin;

-- Assessment-auditregels gebruiken het bestaande generieke auditcontract.
-- Een assessment heeft geen employment change set; een willekeurige UUID zou
-- de audit_logs foreign key breken en de response-transactie terugrollen.
create or replace function internal_security.audit_talent_assessment_response()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  audit_action text;
  before_data jsonb := '{}'::jsonb;
  after_data jsonb := '{}'::jsonb;
begin
  if tg_op = 'DELETE' then
    audit_action := 'DELETE';
    before_data := jsonb_build_object(
      'status', old.status,
      'response_type', old.response_type,
      'subject_employee_id', old.subject_employee_id,
      'version', old.version
    );
  else
    audit_action := case when tg_op = 'INSERT' then 'CREATE' else 'UPDATE' end;
    before_data := case
      when tg_op = 'UPDATE' then jsonb_build_object('status', old.status, 'version', old.version)
      else '{}'::jsonb
    end;
    after_data := jsonb_build_object(
      'status', new.status,
      'response_type', new.response_type,
      'subject_employee_id', new.subject_employee_id,
      'version', new.version,
      'source_channel', 'WEB',
      'correlation_id', new.id
    );
  end if;

  insert into public.audit_logs (
    tenant_id, entity_name, entity_id, actor_user_id, subject_employee_id,
    action, changes, change_set_id
  )
  values (
    coalesce(new.tenant_id, old.tenant_id),
    'talent_assessment_response',
    coalesce(new.id, old.id),
    auth.uid(),
    coalesce(new.subject_employee_id, old.subject_employee_id),
    audit_action,
    jsonb_build_object('before', before_data, 'after', after_data),
    null
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function internal_security.audit_talent_assessment_response() from public, anon, authenticated;

commit;
