begin;
do $$
declare tenant uuid := md5('tenant:liquid-hr-demo-holding')::uuid; administration uuid; employee uuid; actor uuid; category uuid; department uuid; role_id uuid; created_document_id uuid; created_reminder_id uuid;
begin
  select id into actor from auth.users where lower(email)='edwin@editsolutions.nl' limit 1;
  select assignment.administration_id, assignment.employee_id into administration, employee from public.employee_administration_assignments assignment where assignment.tenant_id=tenant order by assignment.effective_from limit 1;
  select id into category from public.document_categories where tenant_id=tenant and administration_id=administration and code='GENERAL';
  select department.id into department
  from public.departments department
  join public.administrations administration_row
    on administration_row.tenant_id=department.tenant_id
   and administration_row.hr_group_id=department.hr_group_id
  where department.tenant_id=tenant
    and administration_row.id=administration
  order by department.code limit 1;
  select id into role_id from public.management_roles where code='TENANT_ADMIN' order by tenant_id nulls first limit 1;
  if actor is null or employee is null or category is null or department is null or role_id is null then raise exception 'Testbasis voor documentendossier ontbreekt.'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub',actor,'role','authenticated')::text, true);
  created_document_id := public.create_employee_document_metadata(employee, administration, jsonb_build_object(
    'categoryId',category,'storageKey',tenant||'/'||administration||'/'||employee||'/test/document.pdf','originalFilename','document.pdf','contentType','application/pdf','fileSize',100,'checksumSha256',repeat('a',64),
    'title','Testdocument','description','Dossiertest','tags',jsonb_build_array('contract'),'expiresOn','2027-12-31',
    'audiences',jsonb_build_array(jsonb_build_object('type','EMPLOYEE','targetId',employee)),
    'reminder',jsonb_build_object('remindAt','2027-12-01T09:00:00Z','targets',jsonb_build_array(jsonb_build_object('type','EMPLOYEE','targetId',employee),jsonb_build_object('type','MANAGEMENT_ROLE','targetId',role_id)))
  ));
  select expiry_reminder_id into created_reminder_id from public.employee_documents where id=created_document_id;
  if created_reminder_id is null or (select count(*) from public.document_audiences where document_id=created_document_id)<1 or (select count(*) from public.reminder_target_rules where reminder_id=created_reminder_id)<>2 then raise exception 'Documentdoelgroepen of vervalreminder ontbreken.'; end if;
  if not internal_security.can_access_document(created_document_id,'document:read') then raise exception 'Geautoriseerde doelgroep kan document niet lezen.'; end if;
end $$;
do $$
declare
  tenant uuid := md5('tenant:liquid-hr-demo-holding')::uuid;
  manager_candidate record;
  subject_record record;
  manager_user_id uuid;
  out_of_scope_employee_id uuid;
  tenant_admin_role_id uuid;
  created_document_id uuid;
  created_reminder_id uuid;
  generated_key text := replace(extensions.gen_random_uuid()::text, '-', '');
  payload jsonb;
  rejected boolean;
begin
  for manager_candidate in
    select distinct access.user_id
    from public.user_access access
    join public.management_roles role on role.id = access.management_role_id
    where access.tenant_id = tenant
      and access.is_active
      and role.code = 'DIRECT_MANAGER'
      and role.is_active
      and role.deleted_at is null
    order by access.user_id
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', manager_candidate.user_id, 'role', 'authenticated')::text, true);
    select assignment.employee_id, assignment.administration_id, employee.hr_group_id, category.id as category_id
    into subject_record
    from public.employee_administration_assignments assignment
    join public.employees employee
      on employee.id = assignment.employee_id
     and employee.tenant_id = assignment.tenant_id
    join public.document_categories category
      on category.tenant_id = employee.tenant_id
     and category.administration_id = assignment.administration_id
     and category.code = 'GENERAL'
     and category.is_active
     and not category.requires_salary_permission
    where assignment.tenant_id = tenant
      and employee.is_active
      and not employee.is_archived
      and employee.deleted_at is null
      and internal_security.can_manage_employee(employee.id, 'document:write')
      and not internal_security.current_user_has_permission(tenant, assignment.administration_id, 'reminder:write')
    order by assignment.employee_id
    limit 1;

    if subject_record.employee_id is not null then
      select assignment.employee_id
      into out_of_scope_employee_id
      from public.employee_administration_assignments assignment
      join public.employees employee
        on employee.id = assignment.employee_id
       and employee.tenant_id = assignment.tenant_id
      where assignment.tenant_id = tenant
        and assignment.administration_id = subject_record.administration_id
        and employee.hr_group_id = subject_record.hr_group_id
        and employee.id <> subject_record.employee_id
        and employee.is_active
        and not employee.is_archived
        and employee.deleted_at is null
        and not internal_security.can_manage_employee(employee.id, 'document:write')
      order by assignment.employee_id
      limit 1;

      if out_of_scope_employee_id is not null then
        manager_user_id := manager_candidate.user_id;
        exit;
      end if;
    end if;
  end loop;

  if manager_user_id is null or subject_record.employee_id is null or out_of_scope_employee_id is null then
    raise exception 'D01_MANAGER_SCOPE_FIXTURES_REQUIRED';
  end if;
  if not internal_security.tenant_module_enabled(tenant, 'REMINDERS') then
    raise exception 'D01_REMINDERS_MODULE_FIXTURE_REQUIRED';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', manager_user_id, 'role', 'authenticated')::text, true);
  select role.id into tenant_admin_role_id
  from public.management_roles role
  where role.code = 'TENANT_ADMIN'
    and role.is_active
    and role.deleted_at is null
  order by role.tenant_id nulls first
  limit 1;
  if tenant_admin_role_id is null then
    raise exception 'D01_MANAGER_REMINDER_NEGATIVE_FIXTURE_REQUIRED';
  end if;

  payload := jsonb_build_object(
    'categoryId', subject_record.category_id,
    'storageKey', tenant::text || '/' || subject_record.administration_id::text || '/' || subject_record.employee_id::text || '/' || generated_key || '/manager-scope-regression.pdf',
    'originalFilename', 'manager-scope-regression.pdf',
    'contentType', 'application/pdf',
    'fileSize', 100,
    'checksumSha256', repeat('b', 64),
    'title', 'D01 Manager reminder regression ' || generated_key,
    'description', 'D01 SQL security regression',
    'tags', jsonb_build_array('d01'),
    'expiresOn', '2099-12-31',
    'audiences', jsonb_build_array(jsonb_build_object('type', 'EMPLOYEE', 'targetId', subject_record.employee_id)),
    'reminder', jsonb_build_object(
      'remindAt', '2099-12-01T09:00:00Z',
      'targets', jsonb_build_array(jsonb_build_object('type', 'EMPLOYEE', 'targetId', subject_record.employee_id))
    )
  );

  created_document_id := public.create_employee_document_metadata(
    subject_record.employee_id,
    subject_record.administration_id,
    payload
  );
  select document.expiry_reminder_id into created_reminder_id
  from public.employee_documents document
  where document.id = created_document_id
    and document.expires_on = '2099-12-31';
  if created_reminder_id is null
    or not exists (
      select 1 from public.reminders reminder
      where reminder.id = created_reminder_id
        and reminder.created_by_user_id = manager_user_id
        and reminder.reminder_type = 'HR'
        and reminder.status = 'PUBLISHED'
        and reminder.remind_at = '2099-12-01T09:00:00Z'::timestamptz
    )
    or (select count(*) from public.reminder_target_rules rule where rule.reminder_id = created_reminder_id) <> 1
    or not exists (
      select 1 from public.reminder_target_rules rule
      where rule.reminder_id = created_reminder_id
        and rule.target_type = 'EMPLOYEE'
        and rule.target_employee_id = subject_record.employee_id
    ) then
    raise exception 'D01_MANAGER_DOCUMENT_REMINDER_REGRESSION';
  end if;

  payload := payload || jsonb_build_object('title', 'D01 Manager role reminder denied ' || generated_key);
  payload := jsonb_set(payload, '{storageKey}', to_jsonb(tenant::text || '/' || subject_record.administration_id::text || '/' || subject_record.employee_id::text || '/' || generated_key || '/manager-role-denied.pdf'));
  payload := jsonb_set(payload, '{reminder,targets}', jsonb_build_array(
    jsonb_build_object('type', 'EMPLOYEE', 'targetId', subject_record.employee_id),
    jsonb_build_object('type', 'MANAGEMENT_ROLE', 'targetId', tenant_admin_role_id)
  ));
  rejected := false;
  begin
    perform public.create_employee_document_metadata(subject_record.employee_id, subject_record.administration_id, payload);
  exception when others then
    if sqlstate = 'P0001' and sqlerrm = 'REMINDER_FORBIDDEN' then
      rejected := true;
    else
      raise;
    end if;
  end;
  if not rejected
    or exists (select 1 from public.employee_documents document where document.title = payload->>'title')
    or exists (select 1 from public.reminders reminder where reminder.title = payload->>'title') then
    raise exception 'D01_MANAGER_REMINDER_SCOPE_NEGATIVE_REGRESSION';
  end if;

  payload := payload || jsonb_build_object('title', 'D01 Manager wrong reminder person denied ' || generated_key);
  payload := jsonb_set(payload, '{storageKey}', to_jsonb(tenant::text || '/' || subject_record.administration_id::text || '/' || subject_record.employee_id::text || '/' || generated_key || '/manager-wrong-person-denied.pdf'));
  payload := jsonb_set(payload, '{reminder,targets}', jsonb_build_array(
    jsonb_build_object('type', 'EMPLOYEE', 'targetId', out_of_scope_employee_id)
  ));
  rejected := false;
  begin
    perform public.create_employee_document_metadata(subject_record.employee_id, subject_record.administration_id, payload);
  exception when others then
    if sqlstate = 'P0001' and sqlerrm = 'REMINDER_FORBIDDEN' then
      rejected := true;
    else
      raise;
    end if;
  end;
  if not rejected
    or exists (select 1 from public.employee_documents document where document.title = payload->>'title')
    or exists (select 1 from public.reminders reminder where reminder.title = payload->>'title') then
    raise exception 'D01_MANAGER_REMINDER_PERSON_NEGATIVE_REGRESSION';
  end if;

  payload := payload || jsonb_build_object('title', 'D01 Manager out-of-scope upload denied ' || generated_key);
  payload := jsonb_set(payload, '{storageKey}', to_jsonb(tenant::text || '/' || subject_record.administration_id::text || '/' || out_of_scope_employee_id::text || '/' || generated_key || '/manager-out-of-scope-denied.pdf'));
  payload := jsonb_set(payload, '{audiences}', jsonb_build_array(jsonb_build_object('type', 'EMPLOYEE', 'targetId', out_of_scope_employee_id)));
  payload := jsonb_set(payload, '{reminder,targets}', jsonb_build_array(jsonb_build_object('type', 'EMPLOYEE', 'targetId', out_of_scope_employee_id)));
  rejected := false;
  begin
    perform public.create_employee_document_metadata(out_of_scope_employee_id, subject_record.administration_id, payload);
  exception when others then
    if sqlstate = 'P0001' and sqlerrm = 'FORBIDDEN' then
      rejected := true;
    else
      raise;
    end if;
  end;
  if not rejected
    or exists (select 1 from public.employee_documents document where document.title = payload->>'title')
    or exists (select 1 from public.reminders reminder where reminder.title = payload->>'title') then
    raise exception 'D01_MANAGER_EMPLOYEE_SCOPE_NEGATIVE_REGRESSION';
  end if;
end $$;
set local role authenticated;
do $$
begin
  if not exists (
    select 1
    from public.document_categories
    where tenant_id = md5('tenant:liquid-hr-demo-holding')::uuid
      and code = 'GENERAL'
  ) then
    raise exception 'D01_DOCUMENT_CATEGORY_RLS_RECURSION_REGRESSION';
  end if;
end $$;
reset role;
do $$
declare function_definition text;
begin
  select pg_get_functiondef('public.create_employee_document_metadata_atomic(uuid, uuid, jsonb)'::regprocedure)
  into function_definition;
  if position('document_reminder_id' in function_definition) = 0
    or position('target.reminder_id = reminder_id' in function_definition) > 0 then
    raise exception 'D01_DOCUMENT_REMINDER_ID_AMBIGUITY_REGRESSION';
  end if;
end ;
$$;
do $$
declare
  function_definition text;
  normalized_definition text;
begin
  select pg_get_functiondef('public.create_employee_document_metadata(uuid, uuid, jsonb)'::regprocedure)
  into function_definition;
  normalized_definition := regexp_replace(lower(function_definition), '\s+', '', 'g');
  if position('actor.tenant_id=tenant' in normalized_definition) = 0
    or position('actor.hr_group_id=target_employee.hr_group_id' in normalized_definition) = 0
    or position('actor.is_active' in normalized_definition) = 0
    or position('notactor.is_archived' in normalized_definition) = 0 then
    raise exception 'D01_DOCUMENT_ACTOR_AUDIENCE_SCOPE_REGRESSION';
  end if;
end;
$$;
rollback;
