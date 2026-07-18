begin;
do $$
declare tenant uuid := md5('tenant:liquid-hr-demo-holding')::uuid; administration uuid; employee uuid; actor uuid; category uuid; department uuid; role_id uuid; created_document_id uuid; created_reminder_id uuid;
begin
  select id into actor from auth.users where lower(email)='edwin@editsolutions.nl' limit 1;
  select assignment.administration_id, assignment.employee_id into administration, employee from public.employee_administration_assignments assignment where assignment.tenant_id=tenant order by assignment.effective_from limit 1;
  select id into category from public.document_categories where tenant_id=tenant and administration_id=administration and code='GENERAL';
  select id into department from public.departments where tenant_id=tenant and administration_id=administration order by code limit 1;
  select id into role_id from public.management_roles where code='TENANT_ADMIN' order by tenant_id nulls first limit 1;
  if actor is null or employee is null or category is null or department is null or role_id is null then raise exception 'Testbasis voor documentendossier ontbreekt.'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub',actor,'role','authenticated')::text, true);
  created_document_id := public.create_employee_document_metadata(employee, administration, jsonb_build_object(
    'categoryId',category,'storageKey',tenant||'/'||administration||'/'||employee||'/test/document.pdf','originalFilename','document.pdf','contentType','application/pdf','fileSize',100,'checksumSha256',repeat('a',64),
    'title','Testdocument','description','Dossiertest','tags',jsonb_build_array('contract'),'expiresOn','2027-12-31',
    'audiences',jsonb_build_array(jsonb_build_object('type','EMPLOYEE','targetId',employee)),
    'reminder',jsonb_build_object('remindAt','2027-12-01T09:00:00Z','targets',jsonb_build_array(jsonb_build_object('type','EMPLOYEE','targetId',employee),jsonb_build_object('type','MANAGEMENT_ROLE','targetId',role_id),jsonb_build_object('type','DEPARTMENT_BRANCH','targetId',department)))
  ));
  select expiry_reminder_id into created_reminder_id from public.employee_documents where id=created_document_id;
  if created_reminder_id is null or (select count(*) from public.document_audiences where document_id=created_document_id)<1 or (select count(*) from public.reminder_target_rules where reminder_id=created_reminder_id)<>3 then raise exception 'Documentdoelgroepen of vervalreminder ontbreken.'; end if;
  if not internal_security.can_access_document(created_document_id,'document:read') then raise exception 'Geautoriseerde doelgroep kan document niet lezen.'; end if;
end $$;
rollback;
