begin;

select plan(6);

do $$
declare
  hr_actor uuid;
  unauthorized_actor uuid;
  tenant uuid;
  hr_group uuid;
  document_id uuid := md5('company-document-soft-delete-rls')::uuid;
  deleted_at_value timestamptz;
  visible_count integer;
begin
  select id
  into hr_actor
  from auth.users
  where lower(email) = 'hradmin.fixture@liquidhr.test'
  limit 1;

  select id
  into unauthorized_actor
  from auth.users
  where lower(email) = 'employee.fixture@liquidhr.test'
  limit 1;

  select access.tenant_id, access.hr_group_id
  into tenant, hr_group
  from public.user_hr_group_access access
  where access.user_id = hr_actor
    and access.is_active
  order by access.tenant_id, access.hr_group_id
  limit 1;

  if hr_actor is null or unauthorized_actor is null or tenant is null or hr_group is null then
    raise exception 'Company-document soft-delete RLS-fixture ontbreekt.';
  end if;

  execute 'set local role postgres';
  insert into public.company_documents (
    id,
    tenant_id,
    hr_group_id,
    administration_id,
    title,
    original_filename,
    storage_key,
    file_size,
    content_type,
    checksum_sha256,
    uploaded_by_user_id
  )
  values (
    document_id,
    tenant,
    hr_group,
    null,
    'Company document soft-delete RLS test',
    'company-document-soft-delete-rls.txt',
    tenant || '/' || hr_group || '/test/company-document-soft-delete-rls.txt',
    1,
    'text/plain',
    repeat('a', 64),
    hr_actor
  );

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', hr_actor, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  if not exists (
    select 1
    from public.company_documents document
    where document.id = document_id
      and document.deleted_at is null
  ) then
    raise exception 'HR kan het actieve company-document niet lezen.';
  end if;

  perform public.soft_delete_company_document(document_id);

  execute 'set local role postgres';
  select document.deleted_at
  into deleted_at_value
  from public.company_documents document
  where document.id = document_id;

  if deleted_at_value is null then
    raise exception 'HR soft-delete heeft deleted_at niet gezet.';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', hr_actor, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  select count(*)
  into visible_count
  from public.company_documents document
  where document.id = document_id;

  if visible_count <> 0 then
    raise exception 'De read-policy exposeert een soft-deleted company-document.';
  end if;

  execute 'set local role postgres';
  update public.company_documents
  set deleted_at = null
  where id = document_id;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', unauthorized_actor, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  begin
    perform public.soft_delete_company_document(document_id);
    raise exception 'Een actor zonder company-document:delete kon het document verwijderen.';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'COMPANY_DOCUMENT_FORBIDDEN' then
        raise;
      end if;
  end;

  execute 'set local role postgres';
  select document.deleted_at
  into deleted_at_value
  from public.company_documents document
  where document.id = document_id;

  if deleted_at_value is not null then
    raise exception 'Een geweigerde actor heeft het document toch gewijzigd.';
  end if;
end;
$$;

select has_function(
  'public',
  'soft_delete_company_document',
  ARRAY['uuid'],
  'Company-document soft-delete gebruikt een smalle RPC.'
);
select ok(
  (select prosecdef from pg_proc where oid = 'public.soft_delete_company_document(uuid)'::regprocedure),
  'De RPC kan de soft-delete uitvoeren zonder de read-policy te verbreden.'
);
select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'company_documents'
      and policyname = 'company_documents_read_group_scoped'
      and qual ilike '%deleted_at%is null%'
  ),
  'De actieve company-document read-policy blijft op deleted_at IS NULL begrensd.'
);
select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'company_documents'
      and cmd = 'SELECT'
      and policyname <> 'company_documents_read_group_scoped'
  ),
  'Er is geen extra brede company-document read-policy toegevoegd.'
);
select ok(
  not has_function_privilege('anon', 'public.soft_delete_company_document(uuid)', 'EXECUTE'),
  'Anon kan de soft-delete RPC niet uitvoeren.'
);
select ok(
  has_function_privilege('authenticated', 'public.soft_delete_company_document(uuid)', 'EXECUTE'),
  'Authenticated kan alleen de server-side geautoriseerde soft-delete RPC aanroepen.'
);

select * from finish();
rollback;
