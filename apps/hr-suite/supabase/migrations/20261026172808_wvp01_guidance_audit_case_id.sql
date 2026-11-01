begin;

-- WVP-tabellen hebben een casesleutel en geen gedeelde auditrijvorm met NEW.id.
-- Houd de generieke audithelper voor alle andere modules ongewijzigd.
create or replace function internal_security.audit_wvp_guidance_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  row_document jsonb;
  old_document jsonb;
  row_data jsonb;
  old_data jsonb;
  audit_tenant uuid;
  audit_administration uuid;
  audit_entity_id uuid;
  audit_action text;
  audit_entity text := tg_argv[0];
  audit_case_id uuid;
  allowed_fields text[];
begin
  if audit_entity is null or audit_entity not in ('absence_guidance', 'absence_guidance_event') then
    raise exception 'WVP_AUDIT_ENTITY_INVALID';
  end if;

  if tg_op = 'DELETE' then
    row_document := to_jsonb(old);
    old_document := '{}'::jsonb;
    audit_action := 'DELETE';
  else
    row_document := to_jsonb(new);
    old_document := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
    audit_action := case
      when tg_op = 'INSERT' then 'CREATE'
      when (row_document ->> 'deleted_at') is not null
        and (old_document ->> 'deleted_at') is null then 'ARCHIVE'
      else 'UPDATE'
    end;
  end if;

  audit_case_id := (row_document ->> 'case_id')::uuid;
  if audit_entity = 'absence_guidance' then
    audit_entity_id := audit_case_id;
    audit_tenant := (row_document ->> 'tenant_id')::uuid;
    audit_administration := (row_document ->> 'administration_id')::uuid;
    allowed_fields := array[
      'case_id', 'tenant_id', 'hr_group_id', 'administration_id',
      'process_instance_id', 'closed_at', 'created_at'
    ];
  else
    audit_entity_id := (row_document ->> 'id')::uuid;
    select guidance.tenant_id, guidance.administration_id
      into audit_tenant, audit_administration
      from public.absence_guidance guidance
      where guidance.case_id = audit_case_id;
    if audit_tenant is null or audit_administration is null then
      raise exception 'WVP_AUDIT_CASE_SCOPE_MISSING';
    end if;
    allowed_fields := array[
      'id', 'case_id', 'event_type', 'occurred_on', 'task_id',
      'agreement_code', 'review_on', 'agreement_id', 'actor_user_id',
      'idempotency_key', 'created_at'
    ];
  end if;

  select coalesce(jsonb_object_agg(field.key, field.value), '{}'::jsonb)
    into row_data
    from jsonb_each(row_document) as field(key, value)
    where field.key = any(allowed_fields);
  select coalesce(jsonb_object_agg(field.key, field.value), '{}'::jsonb)
    into old_data
    from jsonb_each(old_document) as field(key, value)
    where field.key = any(allowed_fields);

  insert into public.audit_logs (
    tenant_id, administration_id, entity_name, entity_id,
    actor_user_id, action, changes
  ) values (
    audit_tenant, audit_administration, audit_entity, audit_entity_id,
    auth.uid(), audit_action,
    jsonb_build_object('before', old_data, 'after', row_data)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function internal_security.audit_wvp_guidance_change() from public, anon, authenticated;

drop trigger if exists audit_absence_guidance on public.absence_guidance;
create trigger audit_absence_guidance
after insert or update on public.absence_guidance
for each row execute function internal_security.audit_wvp_guidance_change('absence_guidance');

drop trigger if exists audit_absence_guidance_events on public.absence_guidance_events;
create trigger audit_absence_guidance_events
after insert on public.absence_guidance_events
for each row execute function internal_security.audit_wvp_guidance_change('absence_guidance_event');

commit;
