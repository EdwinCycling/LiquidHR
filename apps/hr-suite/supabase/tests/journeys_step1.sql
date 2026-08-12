begin;

create extension if not exists pgtap with schema public;
set local search_path = public, extensions;
select plan(18);

insert into auth.users (id) values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000004');

insert into public.tenants (id, name, slug) values
  ('20000000-0000-0000-0000-000000000001', 'Journey tenant A', 'journey-tenant-a'),
  ('20000000-0000-0000-0000-000000000002', 'Journey tenant B', 'journey-tenant-b');
insert into public.hr_groups (id, tenant_id, code, name) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'A1', 'Groep A1'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'A2', 'Groep A2'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'B1', 'Groep B1');
insert into public.tenant_modules (tenant_id, module_code, is_enabled) values
  ('20000000-0000-0000-0000-000000000001', 'JOURNEYS', true),
  ('20000000-0000-0000-0000-000000000002', 'JOURNEYS', true)
on conflict (tenant_id, module_code) do update set is_enabled = excluded.is_enabled;

insert into public.management_roles (id, code, name, tenant_id) values
  ('40000000-0000-0000-0000-000000000001', 'JOURNEY_ADMIN_TEST', 'Journey admin test', '20000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002', 'JOURNEY_WRITER_TEST', 'Journey writer test', '20000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000003', 'JOURNEY_READER_TEST', 'Journey reader test', '20000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000004', 'JOURNEY_OTHER_TEST', 'Journey other test', '20000000-0000-0000-0000-000000000002');
insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id from public.management_roles role cross join public.permissions permission
where (role.id = '40000000-0000-0000-0000-000000000001' and permission.code in ('journey-template:read','journey-template:write','journey-template:publish'))
   or (role.id = '40000000-0000-0000-0000-000000000002' and permission.code in ('journey-template:read','journey-template:write'))
   or (role.id in ('40000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000004') and permission.code = 'journey-template:read');
insert into public.user_hr_group_access (user_id, tenant_id, hr_group_id, management_role_id) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000004');

-- Eigen record in tenant B maakt de isolatiecontrole betekenisvol: zien we alleen
-- het eigen record, in plaats van nul records omdat daar toevallig geen data stond?
insert into public.journey_templates (
  id, tenant_id, hr_group_id, key, name, description, journey_type,
  created_by_user_id, updated_by_user_id
) values (
  '50000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000003',
  'tenant-b-template',
  '{"nl":"Tenant B template","en":"Tenant B template"}',
  '{"nl":"Isolatiecontrole","en":"Isolation check"}',
  'CUSTOM',
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000004'
);

select is((select count(*)::integer from public.permissions where code like '%journey%'), 9, 'alle canonieke Journey-permissions zijn geseed');
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='public' and c.relname like 'journey_template%' and c.relrowsecurity), 7, 'RLS staat aan op alle zeven configuratietabellen');
select is((select count(*)::integer from information_schema.role_table_grants where grantee='anon' and table_name like 'journey_template%'), 0, 'anon heeft geen tabelgrants');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select lives_ok($test$
  select public.create_journey_template_draft(
    '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'test-onboarding',
    '{"name":{"nl":"Test onboarding","en":"Test onboarding"},"description":{"nl":"Testdata stap 1","en":"Step 1 test data"},"journeyType":"ONBOARDING","anchorRule":"EMPLOYMENT_START_DATE","phases":[{"key":"start","name":{"nl":"Start","en":"Start"},"sortOrder":10}],"roles":[{"key":"employee","name":{"nl":"Medewerker","en":"Employee"},"required":true,"cardinality":"ONE","resolverType":"TARGET_EMPLOYEE","resolverRoleCode":null,"resolverEmployeeId":null,"sortOrder":10}],"moments":[{"key":"welcome","phaseKey":"start","name":{"nl":"Welkom","en":"Welcome"},"dateOffsetDays":0,"availabilityOffsetDays":-7,"sortOrder":10}],"topics":[{"key":"intro","momentKey":"welcome","ownerRoleKey":"employee","topicType":"INFORMATION","title":{"nl":"Introductie","en":"Introduction"},"body":{"nl":"Testinhoud","en":"Test content"},"actionUrl":null,"required":true,"sortOrder":10,"audienceRoleKeys":["employee"]}]}'::jsonb
  )
$test$, 'writer kan een geldige draft maken');
select is((select count(*)::integer from public.journey_template_phases where tenant_id='20000000-0000-0000-0000-000000000001'), 1, 'draft bevat een genormaliseerde fase');
select is((select count(*)::integer from public.journey_template_topic_audiences where tenant_id='20000000-0000-0000-0000-000000000001'), 1, 'topic-audience is expliciet genormaliseerd');

select throws_ok(
  format('select public.publish_journey_template(%L, 1)', (select id from public.journey_template_versions where status='DRAFT' and tenant_id='20000000-0000-0000-0000-000000000001')),
  '42501', 'JOURNEY_TEMPLATE_FORBIDDEN', 'writer zonder publishpermission kan niet publiceren'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select lives_ok(
  format('select public.publish_journey_template(%L, 1)', (select id from public.journey_template_versions where status='DRAFT' and tenant_id='20000000-0000-0000-0000-000000000001')),
  'admin publiceert een immutable versie'
);
select is((select count(*)::integer from public.journey_template_versions where status='PUBLISHED' and version_number=1 and tenant_id='20000000-0000-0000-0000-000000000001'), 1, 'publicatie maakt precies versie 1');
select throws_ok(
  format('select public.publish_journey_template(%L, 1)', (select id from public.journey_template_versions where status='DRAFT' and tenant_id='20000000-0000-0000-0000-000000000001')),
  '55000', 'JOURNEY_TEMPLATE_ALREADY_PUBLISHED', 'ongewijzigde draft kan niet dubbel worden gepubliceerd'
);
select is((select count(*)::integer from public.journey_template_topics topic join public.journey_template_versions version on version.id=topic.template_version_id where version.status='PUBLISHED' and version.tenant_id='20000000-0000-0000-0000-000000000001'), 1, 'publicatie kopieert topics naar de gepubliceerde versie');
select is((select count(*)::integer from public.journey_templates where tenant_id='20000000-0000-0000-0000-000000000001'), 1, 'zelfde HR-groep ziet template');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.journey_templates), 0, 'andere HR-groep ziet geen template');
select throws_ok(
  $test$select public.create_journey_template_draft('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','forbidden','{}'::jsonb)$test$,
  '42501', 'JOURNEY_TEMPLATE_FORBIDDEN', 'read-only gebruiker kan geen draft maken'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select is((select count(*)::integer from public.journey_templates), 1, 'andere tenant ziet alleen de eigen template');
reset role;

select throws_ok(
  format('update public.journey_template_versions set revision=99 where id=%L', (select id from public.journey_template_versions where status='PUBLISHED' and tenant_id='20000000-0000-0000-0000-000000000001')),
  '55000', 'JOURNEY_TEMPLATE_PUBLISHED_IMMUTABLE', 'gepubliceerde versie is immutable'
);
select ok(
  exists (select 1 from public.audit_logs where entity_name='journey_template' and changes ->> 'event'='JOURNEY_TEMPLATE_PUBLISHED')
  and not exists (select 1 from public.audit_logs where entity_name='journey_template' and changes::text like '%Testinhoud%'),
  'publicatieaudit bestaat zonder topicinhoud'
);
select is((select current_published_version_id is not null from public.journey_templates where tenant_id='20000000-0000-0000-0000-000000000001' limit 1), true, 'template pint de actuele gepubliceerde versie');

select * from finish();
rollback;
