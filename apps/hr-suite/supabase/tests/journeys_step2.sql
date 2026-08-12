begin;

create extension if not exists pgtap with schema public;
set local search_path = public, extensions;
select plan(12);

select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('journeys','journey_phases','journey_participants','journey_participant_changes','journey_moments','journey_topics','journey_topic_assignments','journey_reminder_links') and c.relrowsecurity),
  8,
  'RLS staat aan op alle acht runtime-tabellen'
);
select is((select count(*)::integer from information_schema.role_table_grants where grantee='anon' and table_name in ('journeys','journey_phases','journey_participants','journey_participant_changes','journey_moments','journey_topics','journey_topic_assignments','journey_reminder_links')), 0, 'anon heeft geen runtime-tabelgrants');
select is((select count(*)::integer from information_schema.role_table_grants where grantee='authenticated' and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES') and table_name in ('journeys','journey_phases','journey_participants','journey_participant_changes','journey_moments','journey_topics','journey_topic_assignments','journey_reminder_links')), 0, 'authenticated heeft geen directe runtime-schrijfgrants');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('activate_journey','transition_journey','replace_journey_participant')), 3, 'drie publieke runtime-wrappers bestaan');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('activate_journey','transition_journey','replace_journey_participant') and not p.prosecdef), 3, 'publieke runtime-wrappers zijn security invoker');

insert into auth.users (id) values
  ('11000000-0000-0000-0000-000000000001'),
  ('11000000-0000-0000-0000-000000000002');
insert into public.tenants (id,name,slug) values
  ('21000000-0000-0000-0000-000000000001','Journey runtime tenant A','journey-runtime-a'),
  ('21000000-0000-0000-0000-000000000002','Journey runtime tenant B','journey-runtime-b');
insert into public.hr_groups (id,tenant_id,code,name) values
  ('31000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','RA','Runtime A'),
  ('31000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000002','RB','Runtime B');
insert into public.tenant_modules (tenant_id,module_code,is_enabled) values
  ('21000000-0000-0000-0000-000000000001','JOURNEYS',true),
  ('21000000-0000-0000-0000-000000000002','JOURNEYS',true)
on conflict (tenant_id,module_code) do update set is_enabled=excluded.is_enabled;
insert into public.management_roles (id,code,name,tenant_id) values
  ('41000000-0000-0000-0000-000000000001','JOURNEY_RUNTIME_A','Runtime reader A','21000000-0000-0000-0000-000000000001'),
  ('41000000-0000-0000-0000-000000000002','JOURNEY_RUNTIME_B','Runtime reader B','21000000-0000-0000-0000-000000000002');
insert into public.role_permissions (management_role_id,permission_id)
select role.id,permission.id from public.management_roles role cross join public.permissions permission
where role.id in ('41000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000002') and permission.code='journey:read';
insert into public.user_hr_group_access (user_id,tenant_id,hr_group_id,management_role_id) values
  ('11000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001'),
  ('11000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000002','31000000-0000-0000-0000-000000000002','41000000-0000-0000-0000-000000000002');
insert into public.employees (id,tenant_id,hr_group_id,employee_number,first_name,birth_name,gender,name_usage) values
  ('51000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','JY-A','Journey','A','PREFER_NOT_TO_SAY','BIRTH_NAME'),
  ('51000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000002','31000000-0000-0000-0000-000000000002','JY-B','Journey','B','PREFER_NOT_TO_SAY','BIRTH_NAME');
insert into public.journey_templates (id,tenant_id,hr_group_id,key,name,description,journey_type,lifecycle,created_by_user_id,updated_by_user_id) values
  ('61000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','runtime-a','{"nl":"Runtime A","en":"Runtime A"}','{"nl":"Test","en":"Test"}','CUSTOM','PUBLISHED','11000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001'),
  ('61000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000002','31000000-0000-0000-0000-000000000002','runtime-b','{"nl":"Runtime B","en":"Runtime B"}','{"nl":"Test","en":"Test"}','CUSTOM','PUBLISHED','11000000-0000-0000-0000-000000000002','11000000-0000-0000-0000-000000000002');
insert into public.journey_template_versions (id,tenant_id,hr_group_id,template_id,status,version_number,revision,anchor_rule,published_at,published_by_user_id,created_by_user_id,updated_by_user_id) values
  ('71000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','PUBLISHED',1,1,'MANUAL_DATE',now(),'11000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000002','31000000-0000-0000-0000-000000000002','61000000-0000-0000-0000-000000000002','PUBLISHED',1,1,'MANUAL_DATE',now(),'11000000-0000-0000-0000-000000000002','11000000-0000-0000-0000-000000000002','11000000-0000-0000-0000-000000000002');
update public.journey_templates set current_published_version_id=case when id='61000000-0000-0000-0000-000000000001' then '71000000-0000-0000-0000-000000000001'::uuid else '71000000-0000-0000-0000-000000000002'::uuid end
where id in ('61000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000002');
insert into public.journeys (id,tenant_id,hr_group_id,template_id,template_version_id,template_version_number,template_name,target_employee_id,anchor_date,status,idempotency_key,created_by_user_id,updated_by_user_id) values
  ('81000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001',1,'{"nl":"Runtime A","en":"Runtime A"}','51000000-0000-0000-0000-000000000001',current_date,'ACTIVE','runtime-tenant-a','11000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001'),
  ('81000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000002','31000000-0000-0000-0000-000000000002','61000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000002',1,'{"nl":"Runtime B","en":"Runtime B"}','51000000-0000-0000-0000-000000000002',current_date,'ACTIVE','runtime-tenant-b','11000000-0000-0000-0000-000000000002','11000000-0000-0000-0000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-0000-0000-000000000001',true);
select is((select count(*)::integer from public.journeys),1,'tenant A ziet precies een runtimejourney');
select is((select id from public.journeys),'81000000-0000-0000-0000-000000000001'::uuid,'tenant A ziet uitsluitend het eigen record');
select is((select count(*)::integer from public.journey_participants),0,'lege childset lekt geen records');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-0000-0000-000000000002',true);
select is((select count(*)::integer from public.journeys),1,'tenant B ziet precies een runtimejourney');
select is((select id from public.journeys),'81000000-0000-0000-0000-000000000002'::uuid,'tenant B ziet uitsluitend het eigen record');
select throws_ok($test$delete from public.journeys where id='81000000-0000-0000-0000-000000000001'$test$,'42501',null,'authenticated kan runtime niet direct muteren');
reset role;

select is((select count(distinct tablename)::integer from pg_indexes where schemaname='public' and tablename in ('journeys','journey_phases','journey_participants','journey_participant_changes','journey_moments','journey_topics','journey_topic_assignments','journey_reminder_links') and indexdef ilike '%tenant_id%'),8,'iedere runtime-tabel heeft een tenant-scope-index');

select * from finish();
rollback;
