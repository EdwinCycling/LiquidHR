-- P4/P5 audit compatibility: use the canonical audit action vocabulary.
-- The event/form-specific action is retained in sanitized changes metadata.

create or replace function internal_security.audit_process_runtime_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_id_value uuid;
  administration_id_value uuid;
  process_instance_id_value uuid;
  correlation_id_value uuid;
  actor_user_id_value uuid;
  action_value text;
  entity_id_value uuid;
  changes_value jsonb;
begin
  if TG_TABLE_NAME = 'process_instances' then
    tenant_id_value := coalesce(NEW.tenant_id, OLD.tenant_id);
    administration_id_value := coalesce(NEW.administration_id, OLD.administration_id);
    process_instance_id_value := coalesce(NEW.id, OLD.id);
    correlation_id_value := coalesce(NEW.correlation_id, OLD.correlation_id);
    actor_user_id_value := coalesce(auth.uid(), NEW.initiator_user_id, OLD.initiator_user_id);
    entity_id_value := process_instance_id_value;
    action_value := case when TG_OP = 'INSERT' then 'CREATE' else 'UPDATE' end;
    changes_value := jsonb_build_object(
      'runtimeAction', case when TG_OP = 'INSERT' then 'PROCESS_INSTANCE_CREATED' else 'PROCESS_INSTANCE_UPDATED' end,
      'status', coalesce(NEW.status, OLD.status),
      'currentStepKey', coalesce(NEW.current_step_key, OLD.current_step_key),
      'instanceVersion', coalesce(NEW.instance_version, OLD.instance_version),
      'correlationId', correlation_id_value
    );
  elsif TG_TABLE_NAME = 'process_step_instances' then
    select instance.tenant_id, instance.administration_id, instance.id, instance.correlation_id
      into tenant_id_value, administration_id_value, process_instance_id_value, correlation_id_value
    from public.process_instances instance
    where instance.id = coalesce(NEW.process_instance_id, OLD.process_instance_id);
    actor_user_id_value := auth.uid();
    entity_id_value := coalesce(NEW.id, OLD.id);
    action_value := case when TG_OP = 'INSERT' then 'CREATE' else 'UPDATE' end;
    changes_value := jsonb_build_object(
      'runtimeAction', case
        when coalesce(NEW.status::text, OLD.status::text) = 'ACTIVE' then 'PROCESS_STEP_ACTIVATED'
        else 'PROCESS_STEP_UPDATED'
      end,
      'stepKey', coalesce(NEW.step_key, OLD.step_key),
      'status', coalesce(NEW.status, OLD.status),
      'expectedVersion', coalesce(NEW.expected_version, OLD.expected_version),
      'correlationId', correlation_id_value
    );
  elsif TG_TABLE_NAME = 'process_work_items' then
    select instance.tenant_id, instance.administration_id, instance.id, instance.correlation_id
      into tenant_id_value, administration_id_value, process_instance_id_value, correlation_id_value
    from public.process_instances instance
    where instance.id = coalesce(NEW.process_instance_id, OLD.process_instance_id);
    actor_user_id_value := coalesce(auth.uid(), NEW.claimed_by_user_id, OLD.claimed_by_user_id);
    entity_id_value := coalesce(NEW.id, OLD.id);
    action_value := case when TG_OP = 'INSERT' then 'CREATE' else 'UPDATE' end;
    changes_value := jsonb_build_object(
      'runtimeAction', case when TG_OP = 'INSERT' then 'PROCESS_WORK_ITEM_CREATED' else 'PROCESS_WORK_ITEM_UPDATED' end,
      'stepKey', coalesce(NEW.step_key, OLD.step_key),
      'status', coalesce(NEW.status, OLD.status),
      'assignmentMode', coalesce(NEW.assignment_mode, OLD.assignment_mode),
      'expectedVersion', coalesce(NEW.expected_version, OLD.expected_version),
      'correlationId', correlation_id_value
    );
  elsif TG_TABLE_NAME = 'process_events' then
    select instance.administration_id into administration_id_value
    from public.process_instances instance where instance.id = NEW.process_instance_id;
    tenant_id_value := NEW.tenant_id;
    process_instance_id_value := NEW.process_instance_id;
    correlation_id_value := NEW.correlation_id;
    actor_user_id_value := coalesce(NEW.actor_user_id, auth.uid());
    entity_id_value := NEW.id;
    action_value := 'CREATE';
    changes_value := jsonb_build_object(
      'runtimeAction', NEW.event_type,
      'sequenceNumber', NEW.sequence_number,
      'eventType', NEW.event_type,
      'correlationId', correlation_id_value
    );
  else
    return NEW;
  end if;

  insert into public.audit_logs (
    tenant_id, administration_id, entity_name, entity_id, actor_user_id, action,
    changes, correlation_id
  ) values (
    tenant_id_value, administration_id_value, replace(TG_TABLE_NAME, 'process_', 'process_'),
    entity_id_value, actor_user_id_value, action_value, changes_value, correlation_id_value
  );
  return NEW;
end;
$$;

revoke all on function internal_security.audit_process_runtime_change() from public, anon, authenticated;

create or replace function internal_security.audit_process_form_runtime_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  administration_id_value uuid;
  action_value text;
  entity_id_value uuid;
  correlation_id_value uuid;
  changes_value jsonb;
  actor_user_id_value uuid;
begin
  if TG_TABLE_NAME = 'process_form_responses' then
    select instance.administration_id into administration_id_value
    from public.process_instances instance where instance.id = NEW.process_instance_id;
    action_value := case when TG_OP = 'INSERT' then 'CREATE' else 'UPDATE' end;
    entity_id_value := NEW.id;
    correlation_id_value := NEW.correlation_id;
    actor_user_id_value := coalesce(auth.uid(), NEW.last_saved_by_user_id);
    changes_value := jsonb_build_object(
      'runtimeAction', case when TG_OP = 'INSERT' then 'PROCESS_FORM_RESPONSE_CREATED' else 'PROCESS_FORM_RESPONSE_SAVED' end,
      'responseId', NEW.id,
      'workItemId', NEW.work_item_id,
      'revision', NEW.revision,
      'expectedVersion', NEW.expected_version,
      'status', NEW.status,
      'correlationId', NEW.correlation_id
    );
  else
    select instance.administration_id into administration_id_value
    from public.process_instances instance
    join public.process_form_responses response on response.process_instance_id = instance.id
    where response.id = NEW.response_id;
    action_value := 'CREATE';
    entity_id_value := NEW.id;
    correlation_id_value := NEW.correlation_id;
    actor_user_id_value := coalesce(auth.uid(), NEW.changed_by_user_id);
    changes_value := jsonb_build_object(
      'runtimeAction', 'PROCESS_FORM_RESPONSE_REVISION_CREATED',
      'responseId', NEW.response_id,
      'revision', NEW.revision,
      'expectedVersion', NEW.expected_version,
      'correlationId', NEW.correlation_id
    );
  end if;
  insert into public.audit_logs (
    tenant_id, administration_id, entity_name, entity_id, actor_user_id, action, changes, correlation_id
  ) values (
    NEW.tenant_id, administration_id_value,
    case when TG_TABLE_NAME = 'process_form_responses' then 'process_form_response' else 'process_form_response_revision' end,
    entity_id_value, actor_user_id_value, action_value, changes_value, correlation_id_value
  );
  return NEW;
end;
$$;

revoke all on function internal_security.audit_process_form_runtime_change() from public, anon, authenticated;
