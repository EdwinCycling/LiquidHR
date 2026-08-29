begin;

select plan(28);

select has_table('public', 'ai_invocations', 'AI invocations bestaan.');
select has_table('public', 'ai_technical_usage', 'Technische AI usage bestaat apart.');
select has_table('public', 'ai_business_audit', 'Business AI audit bestaat apart.');

select ok((select relrowsecurity from pg_class where oid = 'public.ai_invocations'::regclass), 'RLS staat aan voor invocations.');
select ok((select relrowsecurity from pg_class where oid = 'public.ai_technical_usage'::regclass), 'RLS staat aan voor technische usage.');
select ok((select relrowsecurity from pg_class where oid = 'public.ai_business_audit'::regclass), 'RLS staat aan voor business audit.');

select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_invocations' and policyname = 'ai_invocations_select_scoped'), 'Invocations hebben een scoped read-policy.');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_technical_usage' and policyname = 'ai_technical_usage_select_scoped'), 'Technische usage heeft een permission-policy.');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_business_audit' and policyname = 'ai_business_audit_select_scoped'), 'Business audit heeft een permission-policy.');

select ok(not has_table_privilege('authenticated', 'public.ai_invocations', 'SELECT'), 'Authenticated heeft geen directe invocation-read.');
select ok(not has_table_privilege('authenticated', 'public.ai_technical_usage', 'SELECT'), 'Authenticated heeft geen directe technical-usage-read.');
select ok(not has_table_privilege('authenticated', 'public.ai_business_audit', 'SELECT'), 'Authenticated heeft geen directe business-audit-read.');

select ok(not has_table_privilege('anon', 'public.ai_invocations', 'SELECT'), 'Anon mag invocations niet lezen.');
select ok(not has_table_privilege('anon', 'public.ai_technical_usage', 'SELECT'), 'Anon mag technical usage niet lezen.');
select ok(not has_table_privilege('anon', 'public.ai_business_audit', 'SELECT'), 'Anon mag business audit niet lezen.');

select ok(has_table_privilege('service_role', 'public.ai_invocations', 'INSERT'), 'Alleen service-role kan invocations schrijven.');
select ok(has_table_privilege('service_role', 'public.ai_technical_usage', 'INSERT'), 'Alleen service-role kan technical usage schrijven.');
select ok(has_table_privilege('service_role', 'public.ai_business_audit', 'INSERT'), 'Alleen service-role kan business audit schrijven.');
select ok(not has_table_privilege('authenticated', 'public.ai_invocations', 'UPDATE'), 'Authenticated kan invocation state niet direct schrijven.');
select ok(not has_table_privilege('authenticated', 'public.ai_invocations', 'DELETE'), 'Authenticated kan invocations niet direct verwijderen.');

select ok(exists (select 1 from pg_constraint where conrelid = 'public.ai_invocations'::regclass and conname = 'ai_invocations_idempotency_key_key'), 'Invocation-idempotency is database-uniek binnen tenant, HR-groep en actor.');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.ai_technical_usage'::regclass and conname = 'ai_technical_usage_invocation_scope_fkey'), 'Technical usage kan niet naar een andere HR-groep wijzen.');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.ai_business_audit'::regclass and conname = 'ai_business_audit_invocation_scope_fkey'), 'Business audit kan niet naar een andere HR-groep wijzen.');

select ok(exists (select 1 from pg_trigger where tgrelid = 'public.ai_technical_usage'::regclass and tgname = 'ai_technical_usage_append_only' and not tgisinternal), 'Technical usage is append-only.');
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.ai_business_audit'::regclass and tgname = 'ai_business_audit_append_only' and not tgisinternal), 'Business audit is append-only.');

select ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name in ('ai_invocations', 'ai_technical_usage', 'ai_business_audit') and column_name in ('raw_prompt', 'raw_response', 'authorized_context')), 'AI-tabellen bewaren geen raw prompt, response of context.');
select ok(exists (select 1 from public.permissions where code = 'ai:use') and exists (select 1 from public.permissions where code = 'ai:credits-manage'), 'Canonical AI-permissions bestaan.');
select ok(exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ai_invocations' and column_name = 'feedback_outcome'), 'Invocation reserveert feedbackOutcome voor een latere feedbackslice.');

select * from finish();
rollback;
