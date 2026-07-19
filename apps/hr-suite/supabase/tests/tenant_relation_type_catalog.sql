begin;

select plan(7);

select has_table('public', 'relation_types', 'relation type catalog exists');
select has_column('public', 'relation_types', 'tenant_id', 'catalog is tenant scoped');
select has_column('public', 'relation_types', 'is_active', 'catalog supports activation');
select has_index('public', 'relation_types', 'relation_types_tenant_code_key', 'codes are unique per tenant');
select policies_are('public', 'relation_types', array[
  'relation_types_read', 'relation_types_insert', 'relation_types_update', 'relation_types_delete'
], 'catalog has read/write RLS policies');
select ok((select count(*) from public.relation_types) >= 7, 'default relation types are seeded');
select ok((select relrowsecurity from pg_class where oid = 'public.relation_types'::regclass), 'RLS is enabled');

select * from finish();
rollback;
