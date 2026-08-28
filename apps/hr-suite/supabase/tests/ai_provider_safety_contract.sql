begin;

select plan(20);

select has_table('public', 'ai_provider_safety_environments', 'Provider safety environments bestaan.');
select has_table('public', 'ai_provider_execution_leases', 'Provider execution leases bestaan.');
select ok((select relrowsecurity from pg_class where oid = 'public.ai_provider_safety_environments'::regclass), 'Safety environments hebben RLS.');
select ok((select relrowsecurity from pg_class where oid = 'public.ai_provider_execution_leases'::regclass), 'Execution leases hebben RLS.');
select has_column('public', 'ai_provider_execution_leases', 'environment', 'Lease bewaart environment.');
select has_column('public', 'ai_provider_execution_leases', 'invocation_id', 'Lease bewaart invocation-id.');
select has_column('public', 'ai_provider_execution_leases', 'reserved_at', 'Lease bewaart reserveringstijd.');
select has_column('public', 'ai_provider_execution_leases', 'expires_at', 'Lease bewaart vervaltijd.');
select has_column('public', 'ai_provider_execution_leases', 'status', 'Lease bewaart completion-status.');
select ok(not has_column('public', 'ai_provider_execution_leases', 'prompt'), 'Lease bewaart geen prompt.');
select ok(not has_column('public', 'ai_provider_execution_leases', 'response'), 'Lease bewaart geen response.');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.ai_provider_execution_leases'::regclass and conname = 'ai_provider_execution_leases_invocation_key'), 'Invocation heeft maximaal één lease.');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.ai_provider_execution_leases'::regclass and conname = 'ai_provider_execution_leases_invocation_scope_fkey'), 'Lease is invocation-scope gebonden.');
select has_index('public', 'ai_provider_execution_leases', 'ai_provider_execution_leases_environment_reserved_idx', 'Volume-query heeft environment/tijd-index.');
select has_index('public', 'ai_provider_execution_leases', 'ai_provider_execution_leases_environment_active_idx', 'Concurrency-query heeft active/expiry-index.');
select ok(not has_table_privilege('anon', 'public.ai_provider_execution_leases', 'SELECT'), 'Anon kan leases niet lezen.');
select ok(not has_table_privilege('authenticated', 'public.ai_provider_execution_leases', 'INSERT'), 'Authenticated kan leases niet schrijven.');
select ok(has_table_privilege('service_role', 'public.ai_provider_execution_leases', 'INSERT'), 'Service-role kan leases reserveren.');
select ok(has_function_privilege('service_role', 'public.reserve_ai_provider_execution(text,uuid,uuid,uuid,uuid,integer,integer,integer,integer,integer,integer,integer,integer,integer,boolean)', 'EXECUTE'), 'Service-role kan safety reserve RPC aanroepen.');
select ok(not has_function_privilege('anon', 'public.reserve_ai_provider_execution(text,uuid,uuid,uuid,uuid,integer,integer,integer,integer,integer,integer,integer,integer,integer,boolean)', 'EXECUTE'), 'Anon kan safety reserve RPC niet aanroepen.');

select * from finish();
rollback;
