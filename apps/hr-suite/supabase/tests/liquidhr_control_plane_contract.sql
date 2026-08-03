begin;

select plan(14);

select has_type('public', 'platform_operator_role', 'Platformrollen bestaan.');
select has_type('public', 'tenant_lifecycle_status', 'Tenant lifecycle bestaat.');
select has_table('public', 'platform_operators', 'Gesloten platformbeheerders bestaan.');
select has_table('public', 'tenant_lifecycle', 'Tenant lifecycle is apart gemodelleerd.');
select has_table('public', 'tenant_usage_snapshots', 'Gebruikssnapshots bestaan.');
select has_table('public', 'platform_audit_logs', 'Platformaudit bestaat.');
select has_function('public', 'get_platform_control_snapshot', array['uuid'], 'Snapshot-RPC bestaat.');
select has_function('public', 'onboard_platform_tenant', array['text', 'text', 'administration_mode', 'text', 'jsonb'], 'Onboarding-RPC bestaat.');
select has_function('public', 'change_tenant_lifecycle', array['uuid', 'tenant_lifecycle_status', 'text'], 'Lifecycle-RPC bestaat.');
select has_function('public', 'capture_tenant_usage_snapshot', array['uuid'], 'Gebruikssnapshot-RPC bestaat.');
select row_security_active('public', 'platform_operators', 'RLS staat aan voor platformbeheerders.');
select row_security_active('public', 'tenant_lifecycle', 'RLS staat aan voor lifecycle.');
select row_security_active('public', 'tenant_usage_snapshots', 'RLS staat aan voor gebruikssnapshots.');
select row_security_active('public', 'platform_audit_logs', 'RLS staat aan voor audit.');

select * from finish();
rollback;
