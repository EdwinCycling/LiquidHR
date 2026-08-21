begin;

do $$
declare
  hr_actor uuid;
  employee_actor uuid;
  target_employee uuid;
  tenant uuid;
  administration uuid;
  category uuid;
  tenant_admin_role uuid;
  created_document_id uuid;
  unshared_document_id uuid := md5('document:metadata-rls-no-audience')::uuid;
  visible_count integer;
begin
  select auth_user.id
  into hr_actor
  from auth.users auth_user
  where lower(auth_user.email) = 'hradmin.fixture@liquidhr.test'
  limit 1;

  select employee.id, employee.auth_user_id
  into target_employee, employee_actor
  from public.employees employee
  where employee.employee_number = 'DEMO-035'
    and employee.deleted_at is null;

  select assignment.tenant_id, assignment.administration_id
  into tenant, administration
  from public.employee_administration_assignments assignment
  where assignment.employee_id = target_employee
    and assignment.effective_from <= current_date
    and (assignment.effective_to is null or assignment.effective_to >= current_date)
  order by assignment.effective_from desc
  limit 1;

  select document_category.id
  into category
  from public.document_categories document_category
  where document_category.tenant_id = tenant
    and document_category.administration_id = administration
    and document_category.code = 'GENERAL';

  select role.id
  into tenant_admin_role
  from public.user_access access
  join public.management_roles role on role.id = access.management_role_id
  where access.user_id = hr_actor
    and access.tenant_id = tenant
    and access.is_active
    and role.code = 'TENANT_ADMIN'
  limit 1;

  if hr_actor is null or employee_actor is null or target_employee is null or tenant is null
     or administration is null or category is null or tenant_admin_role is null then
    raise exception 'Document metadata RLS-fixture ontbreekt.';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', hr_actor, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  created_document_id := public.create_employee_document_metadata(
    target_employee,
    administration,
    jsonb_build_object(
      'categoryId', category,
      'storageKey', tenant || '/' || administration || '/' || target_employee || '/test/metadata-rls.pdf',
      'originalFilename', 'metadata-rls.pdf',
      'contentType', 'application/pdf',
      'fileSize', 100,
      'checksumSha256', repeat('b', 64),
      'title', 'Metadata RLS test',
      'description', 'Tijdelijke RLS-regressietest',
      'tags', jsonb_build_array('test'),
      'expiresOn', '2027-12-31',
      'audiences', jsonb_build_array(
        jsonb_build_object('type', 'EMPLOYEE', 'targetId', target_employee),
        jsonb_build_object('type', 'MANAGEMENT_ROLE', 'targetId', tenant_admin_role)
      )
    )
  );

  if not exists (
    select 1
    from public.document_audiences audience
    where audience.document_id = created_document_id
      and audience.target_employee_id = target_employee
  ) then
    raise exception 'Een geautoriseerde document:write actor kan geen audience aanmaken.';
  end if;

  select count(*)
  into visible_count
  from public.employee_documents document
  where document.id = created_document_id;

  if visible_count <> 1 then
    raise exception 'Een geautoriseerde actor kan het resultaat niet lezen volgens de normale audience-regels.';
  end if;

  execute 'set local role postgres';
  insert into public.employee_documents (
    id,
    tenant_id,
    administration_id,
    employee_id,
    category_id,
    storage_key,
    original_filename,
    content_type,
    file_size,
    checksum_sha256,
    title,
    added_by_user_id
  )
  values (
    unshared_document_id,
    tenant,
    administration,
    target_employee,
    category,
    tenant || '/' || administration || '/' || target_employee || '/test/metadata-rls-no-audience.pdf',
    'metadata-rls-no-audience.pdf',
    'application/pdf',
    100,
    repeat('c', 64),
    'Metadata RLS no-audience test',
    hr_actor
  );

  execute 'set local role authenticated';
  select count(*)
  into visible_count
  from public.employee_documents document
  where document.id = unshared_document_id;

  if visible_count <> 0 then
    raise exception 'Een document zonder toegestane audience is algemeen leesbaar geworden.';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', employee_actor, 'role', 'authenticated')::text,
    true
  );

  begin
    perform public.create_employee_document_metadata(
      target_employee,
      administration,
      jsonb_build_object(
        'categoryId', category,
        'storageKey', tenant || '/' || administration || '/' || target_employee || '/test/metadata-rls-denied.pdf',
        'originalFilename', 'metadata-rls-denied.pdf',
        'contentType', 'application/pdf',
        'fileSize', 100,
        'checksumSha256', repeat('d', 64),
        'title', 'Metadata RLS denied test',
        'tags', jsonb_build_array('test'),
        'expiresOn', '2027-12-31',
        'audiences', jsonb_build_array(jsonb_build_object('type', 'EMPLOYEE', 'targetId', target_employee))
      )
    );
    raise exception 'Een actor zonder document:write kon een document maken.';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'FORBIDDEN' then
        raise;
      end if;
  end;
end;
$$;

rollback;
