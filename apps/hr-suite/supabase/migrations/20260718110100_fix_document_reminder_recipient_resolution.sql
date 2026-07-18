create or replace function public.create_employee_document_metadata(requested_employee_id uuid, requested_administration_id uuid, requested_payload jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare tenant uuid; created_document_id uuid; created_reminder_id uuid; audience jsonb; target jsonb; actor_employee uuid;
begin
  select administration.tenant_id into tenant from public.administrations administration where administration.id = requested_administration_id;
  if tenant is null or not internal_security.can_manage_employee(requested_employee_id, 'document:write') then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  insert into public.employee_documents (tenant_id, administration_id, employee_id, category_id, storage_key, original_filename, content_type, file_size, checksum_sha256, title, description, tags, expires_on)
  values (tenant, requested_administration_id, requested_employee_id, (requested_payload->>'categoryId')::uuid, requested_payload->>'storageKey', requested_payload->>'originalFilename', requested_payload->>'contentType', (requested_payload->>'fileSize')::bigint, requested_payload->>'checksumSha256', requested_payload->>'title', nullif(requested_payload->>'description',''), array(select jsonb_array_elements_text(requested_payload->'tags')), nullif(requested_payload->>'expiresOn','')::date) returning id into created_document_id;
  for audience in select value from jsonb_array_elements(requested_payload->'audiences') loop
    insert into public.document_audiences (tenant_id, administration_id, document_id, target_type, target_employee_id, target_management_role_id, target_department_id)
    values (tenant, requested_administration_id, created_document_id, (audience->>'type')::public.document_target_type, case when audience->>'type'='EMPLOYEE' then (audience->>'targetId')::uuid end, case when audience->>'type'='MANAGEMENT_ROLE' then (audience->>'targetId')::uuid end, case when audience->>'type'='DEPARTMENT_BRANCH' then (audience->>'targetId')::uuid end) on conflict do nothing;
  end loop;
  select id into actor_employee from public.employees where tenant_id=tenant and auth_user_id=auth.uid() and deleted_at is null limit 1;
  if actor_employee is not null then insert into public.document_audiences (tenant_id, administration_id, document_id, target_type, target_employee_id) values (tenant, requested_administration_id, created_document_id, 'EMPLOYEE', actor_employee) on conflict do nothing; end if;
  if requested_payload->'reminder' is not null and requested_payload->'reminder'<>'null'::jsonb then
    if not internal_security.current_user_has_permission(tenant, requested_administration_id, 'reminder:write') then raise exception 'REMINDER_FORBIDDEN' using errcode='P0001'; end if;
    insert into public.reminders (tenant_id, administration_id, created_by_user_id, reminder_type, target_type, title, description, remind_at, status, published_at)
    values (tenant, requested_administration_id, auth.uid(), 'HR', 'EMPLOYEES', requested_payload->>'title', 'Document verloopt op '||(requested_payload->>'expiresOn'), (requested_payload#>>'{reminder,remindAt}')::timestamptz, 'PUBLISHED', timezone('utc',now())) returning id into created_reminder_id;
    for target in select value from jsonb_array_elements(requested_payload#>'{reminder,targets}') loop
      insert into public.reminder_target_rules (tenant_id, administration_id, reminder_id, target_type, target_employee_id, target_management_role_id, target_department_id)
      values (tenant, requested_administration_id, created_reminder_id, (target->>'type')::public.document_target_type, case when target->>'type'='EMPLOYEE' then (target->>'targetId')::uuid end, case when target->>'type'='MANAGEMENT_ROLE' then (target->>'targetId')::uuid end, case when target->>'type'='DEPARTMENT_BRANCH' then (target->>'targetId')::uuid end);
    end loop;
    insert into public.reminder_recipients (tenant_id, reminder_id, user_id, employee_id, effective_remind_at)
    select distinct tenant, created_reminder_id, employee.auth_user_id, employee.id, (requested_payload#>>'{reminder,remindAt}')::timestamptz from public.employees employee
    where employee.tenant_id=tenant and employee.auth_user_id is not null and employee.deleted_at is null and (
      exists (select 1 from public.reminder_target_rules rule where rule.reminder_id=created_reminder_id and rule.target_type='EMPLOYEE' and rule.target_employee_id=employee.id)
      or exists (select 1 from public.reminder_target_rules rule join public.user_access access on access.management_role_id=rule.target_management_role_id and access.user_id=employee.auth_user_id and access.is_active where rule.reminder_id=created_reminder_id and rule.target_type='MANAGEMENT_ROLE')
      or exists (with recursive branch as (select rule.target_department_id id from public.reminder_target_rules rule where rule.reminder_id=created_reminder_id and rule.target_type='DEPARTMENT_BRANCH' union all select department.id from public.departments department join branch on department.parent_id=branch.id) select 1 from public.employee_organizations organization where organization.employee_id=employee.id and organization.department_id in (select id from branch) and organization.effective_from<=current_date and (organization.effective_to is null or organization.effective_to>=current_date))
    ) on conflict (reminder_id,user_id) do nothing;
    update public.employee_documents set expiry_reminder_id=created_reminder_id where id=created_document_id;
  end if;
  return created_document_id;
end; $$;
