begin;

select plan(10);

select has_type('public', 'platform_support_session_status', 'Supportsessiestatus bestaat.');
select has_table('public', 'platform_support_sessions', 'Supportsessies bestaan.');
select has_function('public', 'start_platform_support_session', array['uuid', 'text', 'integer'], 'Start-RPC bestaat.');
select has_function('public', 'get_platform_support_read_model', array['uuid'], 'Leesmodel-RPC bestaat.');
select has_function('public', 'end_platform_support_session', array['uuid'], 'Eind-RPC bestaat.');
select row_security_active('public', 'platform_support_sessions', 'RLS staat aan voor supportsessies.');
select ok(not has_table_privilege('anon', 'public.platform_support_sessions', 'SELECT'), 'Anon heeft geen directe supportsessieread.');
select ok(not has_table_privilege('authenticated', 'public.platform_support_sessions', 'SELECT'), 'Authenticated heeft geen directe supportsessieread.');
select ok(has_function_privilege('authenticated', 'public.get_platform_support_read_model(uuid)', 'EXECUTE'), 'Authenticated mag alleen het leesmodel via RPC opvragen.');
select ok(not has_function_privilege('anon', 'public.get_platform_support_read_model(uuid)', 'EXECUTE'), 'Anon kan het supportleesmodel niet aanroepen.');

select * from finish();
rollback;
