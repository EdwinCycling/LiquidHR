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

-- Exercise the effective authenticated RLS/storage path with existing D01 fixtures.
-- All fixture identifiers are discovered from the run-labelled records above/below;
-- this contract is read-only and the enclosing transaction is rolled back.
do $$
declare
  d01_tenant_id uuid := md5('tenant:liquid-hr-demo-holding')::uuid;
  salary_document record;
  employee_document record;
  other_employee_document record;
  candidate record;
  out_of_scope_employee_id uuid;
  cross_group_employee_id uuid;
  manager_user_id uuid;
begin
  select document.id, document.employee_id, employee.auth_user_id,
    document.storage_key, category.id as category_id
  into salary_document
  from public.employee_documents document
  join public.employees employee on employee.id = document.employee_id
  join public.document_categories category on category.id = document.category_id
  where document.tenant_id = d01_tenant_id
    and document.title ilike 'D01%'
    and category.code like 'd01_salary_%'
    and category.requires_salary_permission
    and document.deleted_at is null
  order by document.created_at
  limit 1;

  select document.id, document.employee_id, employee.auth_user_id,
    employee.hr_group_id, document.administration_id, document.category_id,
    document.storage_key
  into employee_document
  from public.employee_documents document
  join public.employees employee on employee.id = document.employee_id
  join public.document_categories category on category.id = document.category_id
  where document.tenant_id = d01_tenant_id
    and document.title ilike 'D01%'
    and category.code like 'd01_%'
    and not category.requires_salary_permission
    and document.deleted_at is null
    and document.custom_fields ? 'd01_internal_context'
    and exists (
      select 1 from public.document_audiences audience
      where audience.document_id = document.id
        and audience.target_type = 'EMPLOYEE'
        and audience.target_employee_id = document.employee_id
    )
  order by document.created_at
  limit 1;

  if salary_document.id is null or salary_document.auth_user_id is null
    or employee_document.id is null or employee_document.auth_user_id is null then
    raise exception 'D01_AUTHENTICATED_DOCUMENT_FIXTURE_REQUIRED';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', employee_document.auth_user_id, 'role', 'authenticated')::text, true);
  if not internal_security.can_access_document(employee_document.id, 'document:read') then
    raise exception 'D01_EMPLOYEE_DOCUMENT_POSITIVE_FIXTURE_REQUIRED';
  end if;

  select document.id, document.employee_id, document.storage_key
  into other_employee_document
  from public.employee_documents document
  join public.document_categories category on category.id = document.category_id
  where document.tenant_id = d01_tenant_id
    and document.employee_id <> employee_document.employee_id
    and document.title not ilike 'D01%'
    and not category.requires_salary_permission
    and document.deleted_at is null
  order by document.created_at
  limit 1;
  if other_employee_document.id is null
    or internal_security.can_access_document(other_employee_document.id, 'document:read') then
    raise exception 'D01_OTHER_EMPLOYEE_DOCUMENT_NEGATIVE_FIXTURE_REQUIRED';
  end if;

  for candidate in
    select distinct access.user_id
    from public.user_access access
    join public.management_roles role on role.id = access.management_role_id
    where access.tenant_id = d01_tenant_id
      and access.is_active
      and role.code = 'DIRECT_MANAGER'
      and role.is_active
      and role.deleted_at is null
    order by access.user_id
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', candidate.user_id, 'role', 'authenticated')::text, true);
    if internal_security.can_manage_employee(employee_document.employee_id, 'document:write') then
      select employee.id into out_of_scope_employee_id
      from public.employees employee
      where employee.tenant_id = d01_tenant_id
        and employee.hr_group_id = employee_document.hr_group_id
        and employee.id <> employee_document.employee_id
        and employee.is_active
        and not employee.is_archived
        and employee.deleted_at is null
        and not internal_security.can_manage_employee(employee.id, 'document:write')
      order by employee.id
      limit 1;

      select employee.id into cross_group_employee_id
      from public.employees employee
      where employee.tenant_id = d01_tenant_id
        and employee.hr_group_id <> employee_document.hr_group_id
        and employee.is_active
        and not employee.is_archived
        and employee.deleted_at is null
        and not internal_security.can_manage_employee(employee.id, 'document:write')
      order by employee.id
      limit 1;

      if out_of_scope_employee_id is not null and cross_group_employee_id is not null then
        manager_user_id := candidate.user_id;
        exit;
      end if;
    end if;
  end loop;
  if manager_user_id is null then
    raise exception 'D01_MANAGER_IN_AND_OUT_OF_SCOPE_FIXTURE_REQUIRED';
  end if;

  perform set_config('d01.security.salary_document_id', salary_document.id::text, true);
  perform set_config('d01.security.salary_category_id', salary_document.category_id::text, true);
  perform set_config('d01.security.salary_storage_key', salary_document.storage_key, true);
  perform set_config('d01.security.employee_document_id', employee_document.id::text, true);
  perform set_config('d01.security.employee_document_employee_id', employee_document.employee_id::text, true);
  perform set_config('d01.security.employee_document_category_id', employee_document.category_id::text, true);
  perform set_config('d01.security.employee_document_storage_key', employee_document.storage_key, true);
  perform set_config('d01.security.other_employee_document_id', other_employee_document.id::text, true);
  perform set_config('d01.security.other_employee_document_storage_key', other_employee_document.storage_key, true);
  perform set_config('d01.security.employee_actor_id', employee_document.auth_user_id::text, true);
  perform set_config('d01.security.manager_actor_id', manager_user_id::text, true);
  perform set_config('d01.security.out_of_scope_employee_id', out_of_scope_employee_id::text, true);
  perform set_config('d01.security.cross_group_employee_id', cross_group_employee_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', employee_document.auth_user_id, 'role', 'authenticated')::text, true);
end $$;

set local role authenticated;
do $$
declare
  salary_document_id uuid := current_setting('d01.security.salary_document_id')::uuid;
  salary_category_id uuid := current_setting('d01.security.salary_category_id')::uuid;
  salary_storage_key text := current_setting('d01.security.salary_storage_key');
  employee_document_id uuid := current_setting('d01.security.employee_document_id')::uuid;
  employee_document_storage_key text := current_setting('d01.security.employee_document_storage_key');
  other_employee_document_id uuid := current_setting('d01.security.other_employee_document_id')::uuid;
  other_employee_document_storage_key text := current_setting('d01.security.other_employee_document_storage_key');
  visible_custom_fields jsonb;
begin
  if internal_security.can_access_document(salary_document_id, 'document:read')
    or exists (select 1 from public.employee_documents where id = salary_document_id)
    or exists (select 1 from public.document_categories where id = salary_category_id)
    or exists (
      select 1 from public.get_accessible_employee_document_custom_fields(array[salary_document_id])
      where document_id = salary_document_id
    )
    or exists (
      select 1 from storage.objects
      where bucket_id = 'employee-documents' and name = salary_storage_key
    ) then
    raise exception 'D01_EMPLOYEE_SALARY_DOCUMENT_OR_STORAGE_LEAK';
  end if;

  select fields.custom_fields into visible_custom_fields
  from public.get_accessible_employee_document_custom_fields(array[employee_document_id]) fields;
  if visible_custom_fields is null
    or visible_custom_fields ? 'd01_internal_context'
    or visible_custom_fields ? 'd01_hr_only_note' then
    raise exception 'D01_EMPLOYEE_HIDDEN_CUSTOM_FIELD_LEAK';
  end if;
  if exists (
    select 1 from storage.objects
    where bucket_id = 'employee-documents' and name = employee_document_storage_key
  ) = false then
    raise exception 'D01_EMPLOYEE_DOCUMENT_STORAGE_POSITIVE_READBACK_REQUIRED';
  end if;

  if internal_security.can_access_document(other_employee_document_id, 'document:read')
    or exists (select 1 from public.employee_documents where id = other_employee_document_id)
    or exists (
      select 1 from public.get_accessible_employee_document_custom_fields(array[other_employee_document_id])
      where document_id = other_employee_document_id
    )
    or exists (
      select 1 from storage.objects
      where bucket_id = 'employee-documents' and name = other_employee_document_storage_key
    ) then
    raise exception 'D01_EMPLOYEE_OTHER_EMPLOYEE_DOCUMENT_OR_STORAGE_LEAK';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('d01.security.manager_actor_id')::uuid, 'role', 'authenticated')::text, true);
  if not internal_security.can_manage_employee(current_setting('d01.security.employee_document_employee_id')::uuid, 'document:write')
    or internal_security.can_manage_employee(current_setting('d01.security.out_of_scope_employee_id')::uuid, 'document:write')
    or internal_security.can_manage_employee(current_setting('d01.security.cross_group_employee_id')::uuid, 'document:write') then
    raise exception 'D01_MANAGER_DOCUMENT_SCOPE_REGRESSION';
  end if;

  begin
    perform public.update_employee_document_metadata_atomic(
      current_setting('d01.security.out_of_scope_employee_id')::uuid,
      employee_document_id,
      jsonb_build_object(
        'categoryId', current_setting('d01.security.employee_document_category_id'),
        'title', 'D01 unauthorized metadata mutation regression',
        'description', 'Rollback-only authorization contract',
        'tags', jsonb_build_array('d01'),
        'expiresOn', null,
        'audiences', jsonb_build_array(jsonb_build_object('type', 'EMPLOYEE', 'targetId', current_setting('d01.security.out_of_scope_employee_id'))),
        'customFields', '{}'::jsonb
      )
    );
    raise exception 'D01_MANAGER_FORGED_EMPLOYEE_DOCUMENT_MUTATION_ALLOWED';
  exception when sqlstate '42501' then
    if sqlerrm <> 'FORBIDDEN' then
      raise;
    end if;
  end;

  if exists (select 1 from public.employee_documents where id = employee_document_id and title = 'D01 unauthorized metadata mutation regression') then
    raise exception 'D01_MANAGER_FORGED_EMPLOYEE_DOCUMENT_MUTATION_PERSISTED';
  end if;
end $$;
reset role;
rollback;
