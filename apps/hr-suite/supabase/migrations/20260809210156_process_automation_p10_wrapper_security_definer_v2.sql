begin;

create or replace function public.get_employee_document_acknowledgements(
  requested_employee_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.get_employee_document_acknowledgements_internal(requested_employee_id);
$$;

revoke all on function public.get_employee_document_acknowledgements(uuid) from public, anon;
grant execute on function public.get_employee_document_acknowledgements(uuid) to authenticated;

create or replace function public.start_document_acknowledgement(
  requested_process_definition_id uuid,
  requested_subject_employee_id uuid,
  requested_document_id uuid,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.start_document_acknowledgement_internal(
    requested_process_definition_id,
    requested_subject_employee_id,
    requested_document_id,
    requested_idempotency_key,
    requested_correlation_id
  );
$$;

revoke all on function public.start_document_acknowledgement(uuid, uuid, uuid, text, uuid) from public, anon;
grant execute on function public.start_document_acknowledgement(uuid, uuid, uuid, text, uuid) to authenticated;

create or replace function public.acknowledge_document_process_work_item(
  requested_work_item_id uuid,
  requested_expected_version bigint,
  requested_step_expected_version bigint,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.acknowledge_document_process_work_item_internal(
    requested_work_item_id,
    requested_expected_version,
    requested_step_expected_version,
    requested_idempotency_key,
    requested_correlation_id
  );
$$;

revoke all on function public.acknowledge_document_process_work_item(uuid, bigint, bigint, text, uuid) from public, anon;
grant execute on function public.acknowledge_document_process_work_item(uuid, bigint, bigint, text, uuid) to authenticated;

create or replace function public.get_document_acknowledgement_document(
  requested_work_item_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.get_document_acknowledgement_document_internal(requested_work_item_id);
$$;

revoke all on function public.get_document_acknowledgement_document(uuid) from public, anon;
grant execute on function public.get_document_acknowledgement_document(uuid) to authenticated;

commit;