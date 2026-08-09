begin;

create or replace function internal_security.get_process_output_download_context(
  requested_process_instance_id uuid,
  requested_output_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  instance_row public.process_instances%rowtype;
  output_row public.process_outputs%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  select instance.* into instance_row from public.process_instances instance where instance.id = requested_process_instance_id;
  select output.* into output_row from public.process_outputs output where output.id = requested_output_id and output.process_instance_id = requested_process_instance_id;
  if instance_row.id is null or output_row.id is null then raise exception 'PROCESS_OUTPUT_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.process_instance_can_read(instance_row.tenant_id, instance_row.hr_group_id, instance_row.id)
    and not internal_security.process_scope_has_permission(instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type, instance_row.administration_id, 'process-operations:read') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if output_row.document_id is null or output_row.status <> 'AVAILABLE'::public.process_output_status then
    raise exception 'PROCESS_OUTPUT_DOCUMENT_NOT_AVAILABLE' using errcode = 'P0001';
  end if;
  return jsonb_build_object('processInstanceId', instance_row.id, 'subjectEmployeeId', output_row.subject_employee_id, 'documentId', output_row.document_id);
end;
$$;

revoke all on function internal_security.get_process_output_download_context(uuid, uuid) from public, anon, authenticated;

create or replace function public.get_process_output_download_context(
  requested_process_instance_id uuid,
  requested_output_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.get_process_output_download_context(requested_process_instance_id, requested_output_id);
$$;

revoke all on function public.get_process_output_download_context(uuid, uuid) from public, anon;
grant execute on function public.get_process_output_download_context(uuid, uuid) to authenticated;

commit;
