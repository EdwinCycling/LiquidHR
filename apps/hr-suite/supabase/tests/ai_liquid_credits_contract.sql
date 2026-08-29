begin;

select plan(54);

select has_table('public', 'ai_credit_group_policies', 'Liquid Credits group policies bestaan.');
select has_table('public', 'ai_credit_role_quotas', 'Liquid Credits role quotas bestaan.');
select has_table('public', 'ai_credit_charge_catalog', 'Liquid Credits charge catalog bestaat.');
select has_table('public', 'ai_credit_allocations', 'Liquid Credits allocations bestaan.');
select has_table('public', 'ai_credit_reservations', 'Liquid Credits reservations bestaan.');
select has_table('public', 'ai_credit_reservation_allocations', 'Reservation-to-allocation trace bestaat.');
select has_table('public', 'ai_credit_actor_usage', 'Actor quota usage bestaat.');

select ok((select relrowsecurity from pg_class where oid = 'public.ai_credit_group_policies'::regclass), 'Group policies hebben RLS.');
select ok((select relrowsecurity from pg_class where oid = 'public.ai_credit_role_quotas'::regclass), 'Role quotas hebben RLS.');
select ok((select relrowsecurity from pg_class where oid = 'public.ai_credit_charge_catalog'::regclass), 'Charge catalog heeft RLS.');
select ok((select relrowsecurity from pg_class where oid = 'public.ai_credit_allocations'::regclass), 'Allocations hebben RLS.');
select ok((select relrowsecurity from pg_class where oid = 'public.ai_credit_reservations'::regclass), 'Reservations hebben RLS.');
select ok((select relrowsecurity from pg_class where oid = 'public.ai_credit_reservation_allocations'::regclass), 'Reservation allocations hebben RLS.');
select ok((select relrowsecurity from pg_class where oid = 'public.ai_credit_actor_usage'::regclass), 'Actor usage heeft RLS.');

select has_column('public', 'ai_credit_group_policies', 'time_zone', 'Allowance policy bewaart de timezone-basis.');
select has_column('public', 'ai_credit_allocations', 'credit_amount', 'Allocation bewaart integer credit amount.');
select has_column('public', 'ai_credit_allocations', 'available_credits', 'Allocation exposeert generated remaining accounting.');
select has_column('public', 'ai_credit_allocations', 'expires_at', 'Allocation bewaart expiry.');
select has_column('public', 'ai_credit_reservations', 'idempotency_key', 'Reservation bewaart idempotency.');
select has_column('public', 'ai_credit_reservations', 'invocation_id', 'Reservation linkt naar invocation.');
select has_column('public', 'ai_credit_reservation_allocations', 'allocated_credits', 'Reservation trace bewaart allocated amount.');
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.ai_credit_allocations'::regclass and tgname = 'ai_credit_allocations_immutable' and not tgisinternal), 'Historical allocation identity is immutable.');

select ok(exists (select 1 from pg_constraint where conrelid = 'public.ai_credit_allocations'::regclass and conname = 'ai_credit_allocations_group_fkey'), 'Allocations zijn HR-groep scoped.');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.ai_credit_reservations'::regclass and conname = 'ai_credit_reservations_invocation_scope_fkey'), 'Reservations kunnen niet naar een andere invocation-scope wijzen.');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.ai_credit_reservation_allocations'::regclass and conname = 'ai_credit_reservation_allocations_allocation_scope_fkey'), 'Reservation allocation links zijn group scoped.');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.ai_credit_reservations'::regclass and conname = 'ai_credit_reservations_idempotency_key'), 'Reservation idempotency is database-uniek.');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.ai_credit_reservations'::regclass and conname = 'ai_credit_reservations_scope_key'), 'Reservation scope is uniek voor composite foreign keys.');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.ai_credit_allocations'::regclass and conname = 'ai_credit_allocations_scope_key'), 'Allocation scope is uniek voor composite foreign keys.');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.ai_credit_allocations'::regclass and conname = 'ai_credit_allocations_period_key'), 'Monthly allocation is per group en periode uniek.');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.ai_credit_charge_catalog'::regclass and conname = 'ai_credit_charge_catalog_reference_key'), 'Charge references zijn uniek.');
select has_index('public', 'ai_credit_allocations', 'ai_credit_allocations_scope_expiry_idx', 'Consumption kan deterministic op expiry sorteren.');
select has_index('public', 'ai_credit_reservations', 'ai_credit_reservations_scope_status_idx', 'Reservation status heeft een scope-index.');
select has_index('public', 'ai_credit_reservation_allocations', 'ai_credit_reservation_allocations_reservation_idx', 'Reservation allocation trace heeft een reservation-index.');

select is((select count(*) from public.ai_credit_role_quotas), 7::bigint, 'De Wave 1B role quota catalogus is volledig seeded.');
select is((select count(*) from public.ai_credit_charge_catalog), 3::bigint, 'De drie vaste charges van de geplande tekstcapability zijn seeded.');
select is((select monthly_quota_credits from public.ai_credit_role_quotas where role_code = 'HR_ADMIN'), 100, 'HR_ADMIN heeft de hoogste seeded quota.');
select is((select credit_amount from public.ai_credit_charge_catalog where charge_reference = 'ai.improve-existing-hr-text.efficient'), 1, 'Efficient charge is één credit.');

select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_credit_group_policies' and policyname = 'ai_credit_group_policies_select_scoped'), 'Group policy read is scoped.');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_credit_allocations' and policyname = 'ai_credit_allocations_select_scoped'), 'Allocation read is scoped.');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_credit_reservations' and policyname = 'ai_credit_reservations_select_scoped'), 'Reservation read is actor/manage scoped.');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_credit_reservation_allocations' and policyname = 'ai_credit_reservation_allocations_select_scoped'), 'Consumption trace read is scoped.');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_credit_actor_usage' and policyname = 'ai_credit_actor_usage_select_scoped'), 'Actor quota usage read is scoped.');

select ok(not has_table_privilege('authenticated', 'public.ai_credit_allocations', 'INSERT'), 'Authenticated kan allocations niet direct muteren.');
select ok(not has_table_privilege('authenticated', 'public.ai_credit_reservations', 'UPDATE'), 'Authenticated kan reservations niet direct muteren.');
select ok(not has_table_privilege('anon', 'public.ai_credit_allocations', 'SELECT'), 'Anon kan allocations niet lezen.');
select ok(not has_table_privilege('authenticated', 'public.ai_credit_role_quotas', 'SELECT'), 'Authenticated kan role quota catalogus niet direct lezen.');
select ok(has_table_privilege('service_role', 'public.ai_credit_allocations', 'INSERT'), 'Service-role kan de ledger via servercontracten schrijven.');
select ok(has_function_privilege('service_role', 'public.reserve_ai_credits(uuid,uuid,uuid,uuid,text,text,text,text)', 'EXECUTE'), 'Service-role kan reserve RPC aanroepen.');
select ok(not has_function_privilege('anon', 'public.reserve_ai_credits(uuid,uuid,uuid,uuid,text,text,text,text)', 'EXECUTE'), 'Anon kan reserve RPC niet aanroepen.');
select ok(has_function_privilege('service_role', 'public.grant_ai_controlled_test_credits(uuid,uuid,integer,text)', 'EXECUTE'), 'Alleen server test-seam kan synthetic credits aanroepen.');
select ok(not has_function_privilege('anon', 'public.grant_ai_controlled_test_credits(uuid,uuid,integer,text)', 'EXECUTE'), 'Anon kan geen synthetic credits aanroepen.');

select ok(
  has_schema_privilege('service_role', 'internal_security', 'USAGE')
  and has_function_privilege('service_role', 'internal_security.reserve_ai_credits(uuid,uuid,uuid,uuid,text,text,text,text)', 'EXECUTE')
  and has_function_privilege('service_role', 'internal_security.get_ai_group_credit_balance(uuid,uuid)', 'EXECUTE'),
  'Service-role kan security-invoker wrappers naar internal_security bereiken.'
);

select ok((select prosecdef from pg_proc where oid = to_regprocedure('internal_security.reserve_ai_credits(uuid,uuid,uuid,uuid,text,text,text,text)')), 'Interne reservefunctie lockt via security-definer serverfunctie.');
select ok(not coalesce((select prosecdef from pg_proc where oid = to_regprocedure('public.reserve_ai_credits(uuid,uuid,uuid,uuid,text,text,text,text)')), true), 'Publieke reserve-wrapper is geen security-definer endpoint.');

select * from finish();
rollback;
