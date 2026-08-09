begin;

create or replace function internal_security.add_process_output_document_audiences(requested_output_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  output_row public.process_outputs%rowtype;
  actor_employee_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  select output.* into output_row from public.process_outputs output where output.id = requested_output_id;
  if output_row.id is null then raise exception 'PROCESS_OUTPUT_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.process_scope_has_permission(
    output_row.tenant_id, output_row.hr_group_id,
    (select instance.scope_type from public.process_instances instance where instance.id = output_row.process_instance_id),
    output_row.administration_id, 'process-operations:write'
  ) or not internal_security.can_manage_employee(output_row.subject_employee_id, 'document:write') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if output_row.document_id is null then raise exception 'PROCESS_OUTPUT_DOCUMENT_NOT_FOUND' using errcode = 'P0002'; end if;

  select employee.id into actor_employee_id
  from public.employees employee
  where employee.tenant_id = output_row.tenant_id
    and employee.hr_group_id = output_row.hr_group_id
    and employee.auth_user_id = auth.uid()
    and employee.deleted_at is null
  limit 1;
  if actor_employee_id is not null then
    insert into public.document_audiences (
      tenant_id, administration_id, document_id, target_type, target_employee_id
    ) values (
      output_row.tenant_id, output_row.administration_id, output_row.document_id,
      'EMPLOYEE'::public.document_target_type, actor_employee_id
    ) on conflict do nothing;
  end if;

  return jsonb_build_object('outputId', output_row.id, 'documentId', output_row.document_id, 'granted', true);
end;
$$;

revoke all on function internal_security.add_process_output_document_audiences(uuid) from public, anon, authenticated;

create or replace function public.add_process_output_document_audiences(requested_output_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.add_process_output_document_audiences(requested_output_id);
$$;

revoke all on function public.add_process_output_document_audiences(uuid) from public, anon;
grant execute on function public.add_process_output_document_audiences(uuid) to authenticated;

commit;
