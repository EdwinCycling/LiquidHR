begin;

select plan(15);

with protected(signature) as (
  values
    ('public.get_process_recipe_catalog()'),
    ('public.get_process_recipe_start_context(uuid,uuid,text)'),
    ('public.activate_process_recipe(uuid,uuid,uuid,public.access_scope_type,uuid,text)'),
    ('public.get_internal_transfer_preview(uuid)'),
    ('public.commit_internal_transfer(uuid,bigint,bigint,text,uuid)'),
    ('public.request_process_work_item_changes(uuid,bigint,bigint,text,uuid,text)')
)
select ok((select count(*) from protected where to_regprocedure(signature) is not null) = 6, 'Alle zes interne process-wrappers bestaan met de canonieke signatures.');

with protected(signature) as (
  values
    ('public.get_process_recipe_catalog()'),
    ('public.get_process_recipe_start_context(uuid,uuid,text)'),
    ('public.activate_process_recipe(uuid,uuid,uuid,public.access_scope_type,uuid,text)'),
    ('public.get_internal_transfer_preview(uuid)'),
    ('public.commit_internal_transfer(uuid,bigint,bigint,text,uuid)'),
    ('public.request_process_work_item_changes(uuid,bigint,bigint,text,uuid,text)')
)
select ok((select count(*) from protected join pg_proc p on p.oid = to_regprocedure(signature) where p.prosecdef) = 6, 'De wrappers blijven security-definer boundaries naar internal_security.');

with protected(signature) as (
  values
    ('public.get_process_recipe_catalog()'),
    ('public.get_process_recipe_start_context(uuid,uuid,text)'),
    ('public.activate_process_recipe(uuid,uuid,uuid,public.access_scope_type,uuid,text)'),
    ('public.get_internal_transfer_preview(uuid)'),
    ('public.commit_internal_transfer(uuid,bigint,bigint,text,uuid)'),
    ('public.request_process_work_item_changes(uuid,bigint,bigint,text,uuid,text)')
)
select ok((select count(*) from protected where not has_function_privilege('public', signature, 'EXECUTE')) = 6, 'PUBLIC heeft geen EXECUTE op interne wrappers.');

with protected(signature) as (
  values
    ('public.get_process_recipe_catalog()'),
    ('public.get_process_recipe_start_context(uuid,uuid,text)'),
    ('public.activate_process_recipe(uuid,uuid,uuid,public.access_scope_type,uuid,text)'),
    ('public.get_internal_transfer_preview(uuid)'),
    ('public.commit_internal_transfer(uuid,bigint,bigint,text,uuid)'),
    ('public.request_process_work_item_changes(uuid,bigint,bigint,text,uuid,text)')
)
select ok((select count(*) from protected where not has_function_privilege('anon', signature, 'EXECUTE')) = 6, 'Anon heeft geen EXECUTE op interne wrappers.');

with protected(signature) as (
  values
    ('public.get_process_recipe_catalog()'),
    ('public.get_process_recipe_start_context(uuid,uuid,text)'),
    ('public.activate_process_recipe(uuid,uuid,uuid,public.access_scope_type,uuid,text)'),
    ('public.get_internal_transfer_preview(uuid)'),
    ('public.commit_internal_transfer(uuid,bigint,bigint,text,uuid)'),
    ('public.request_process_work_item_changes(uuid,bigint,bigint,text,uuid,text)')
)
select ok((select count(*) from protected where has_function_privilege('authenticated', signature, 'EXECUTE')) = 6, 'Authenticated behoudt EXECUTE op de applicatiewrappers.');

with protected(signature) as (
  values
    ('public.get_process_recipe_catalog()'),
    ('public.get_process_recipe_start_context(uuid,uuid,text)'),
    ('public.activate_process_recipe(uuid,uuid,uuid,public.access_scope_type,uuid,text)'),
    ('public.get_internal_transfer_preview(uuid)'),
    ('public.commit_internal_transfer(uuid,bigint,bigint,text,uuid)'),
    ('public.request_process_work_item_changes(uuid,bigint,bigint,text,uuid,text)')
)
select ok((select count(*) from protected where has_function_privilege('service_role', signature, 'EXECUTE')) = 6, 'Service-role behoudt de bestaande expliciete EXECUTE-grants.');

with protected(signature) as (
  values
    ('public.get_process_recipe_catalog()'),
    ('public.get_process_recipe_start_context(uuid,uuid,text)'),
    ('public.activate_process_recipe(uuid,uuid,uuid,public.access_scope_type,uuid,text)'),
    ('public.get_internal_transfer_preview(uuid)'),
    ('public.commit_internal_transfer(uuid,bigint,bigint,text,uuid)'),
    ('public.request_process_work_item_changes(uuid,bigint,bigint,text,uuid,text)')
)
select ok((select count(*) from protected join pg_proc p on p.oid = to_regprocedure(signature) where p.proconfig @> array['search_path=""']::text[] and pg_get_functiondef(p.oid) like '%internal_security.%') = 6, 'De wrappers behouden de bestaande lege search_path en internal_security-delegatie.');

with public_recruitment(signature) as (
  values
    ('public.recruitment_public_vacancy(uuid,text)'),
    ('public.recruitment_public_vacancy_state(uuid,text)'),
    ('public.recruitment_submit_public_application(uuid,text,jsonb,text,text)')
)
select ok((select count(*) from public_recruitment where has_function_privilege('anon', signature, 'EXECUTE')) = 3, 'De drie bewust publieke Recruitment-functies behouden anon EXECUTE.');

with public_recruitment(signature) as (
  values
    ('public.recruitment_public_vacancy(uuid,text)'),
    ('public.recruitment_public_vacancy_state(uuid,text)'),
    ('public.recruitment_submit_public_application(uuid,text,jsonb,text,text)')
)
select ok((select count(*) from public_recruitment where not has_function_privilege('public', signature, 'EXECUTE')) = 3, 'De drie Recruitment-functies blijven expliciet van PUBLIC onderscheiden.');

with public_recruitment(signature) as (
  values
    ('public.recruitment_public_vacancy(uuid,text)'),
    ('public.recruitment_public_vacancy_state(uuid,text)'),
    ('public.recruitment_submit_public_application(uuid,text,jsonb,text,text)')
)
select ok((select count(*) from public_recruitment where has_function_privilege('authenticated', signature, 'EXECUTE')) = 3, 'Authenticated behoudt Recruitment EXECUTE.');

with public_recruitment(signature) as (
  values
    ('public.recruitment_public_vacancy(uuid,text)'),
    ('public.recruitment_public_vacancy_state(uuid,text)'),
    ('public.recruitment_submit_public_application(uuid,text,jsonb,text,text)')
)
select ok((select count(*) from public_recruitment where has_function_privilege('service_role', signature, 'EXECUTE')) = 3, 'Service-role behoudt Recruitment EXECUTE.');

with protected(signature) as (
  values ('public.recruitment_claim_public_intake(uuid,text,text)')
)
select ok((select count(*) from protected join pg_proc p on p.oid = to_regprocedure(signature) where p.prosecdef and p.proconfig @> array['search_path=""']::text[]) = 1, 'SEC-012 claim blijft een security-definer boundary met lege search_path.');

with protected(signature) as (
  values ('public.recruitment_claim_public_intake(uuid,text,text)')
)
select ok((select count(*) from protected where not has_function_privilege('public', signature, 'EXECUTE') and not has_function_privilege('anon', signature, 'EXECUTE') and not has_function_privilege('authenticated', signature, 'EXECUTE')) = 1, 'SEC-012 claim is niet uitvoerbaar door browserrollen.');

with service_only(signature) as (
  values
    ('public.recruitment_claim_public_intake(uuid,text,text)'),
    ('public.recruitment_cleanup_public_intake(integer)')
)
select ok((select count(*) from service_only where has_function_privilege('service_role', signature, 'EXECUTE')) = 2, 'SEC-012 claim en cleanup zijn expliciet service-role callable.');

with legacy(signature) as (
  values ('public.recruitment_submit_public_application(uuid,text,jsonb,text)')
)
select ok((select count(*) from legacy where not has_function_privilege('public', signature, 'EXECUTE') and not has_function_privilege('anon', signature, 'EXECUTE') and not has_function_privilege('authenticated', signature, 'EXECUTE') and not has_function_privilege('service_role', signature, 'EXECUTE')) = 1, 'De oude vier-argument submit-overload blijft voor iedere caller inert.');

select * from finish();
rollback;
