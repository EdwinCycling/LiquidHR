-- Guided Recruitment Stap 3 remote releasecontract.
-- Volledig transactioneel: synthetische records worden altijd teruggerold.
begin;

do $seed$
declare
  application_questions integer;
  interview_questions integer;
  criteria integer;
  preparation integer;
  system_sets integer;
begin
  select count(*) into application_questions from public.recruitment_library_items where owner_type = 'SYSTEM' and item_type = 'APPLICATION_QUESTION';
  select count(*) into interview_questions from public.recruitment_library_items where owner_type = 'SYSTEM' and item_type = 'INTERVIEW_QUESTION';
  select count(*) into criteria from public.recruitment_library_items where owner_type = 'SYSTEM' and item_type = 'CRITERION';
  select count(*) into preparation from public.recruitment_library_items where owner_type = 'SYSTEM' and item_type = 'PREPARATION';
  select count(*) into system_sets from public.recruitment_sets where owner_type = 'SYSTEM';
  if application_questions < 25 or interview_questions < 84 or criteria < 45 or preparation < 35 or system_sets < 12 then raise exception 'TEST_RECRUITMENT_STEP3_SEED_COUNTS'; end if;
  if exists (select 1 from public.recruitment_set_items set_item join public.recruitment_library_items item on item.id = set_item.library_item_id where item.item_type = 'APPLICATION_QUESTION') then raise exception 'TEST_RECRUITMENT_APPLICATION_QUESTION_IN_SET'; end if;
end
$seed$;

-- Existing synthetic Planeten application, with two concrete reviewers.
insert into public.recruitment_interviews (id, tenant_id, hr_group_id, application_id, set_id, title, scheduled_at, preparation_snapshot, questions_snapshot, criteria_snapshot)
values ('a6000000-0000-4000-8000-000000000001','07249eb9-545c-883b-b26b-d52f83b4f4a1','6ba6f1df-e376-40f2-abff-ffdf000172e1','a5000000-0000-4000-8000-000000000001','cc0b2e5a-4c8f-4f85-b031-5fdf6e43bbdd','TEST-RECRUITMENT-STEP3-Interview',timezone('utc',now()) + interval '1 day','[]'::jsonb,'[]'::jsonb,jsonb_build_array(jsonb_build_object('characteristicId','9809b444-cd82-41f2-8eb7-dc7498b23fcb')));
insert into public.recruitment_participations (id, tenant_id, hr_group_id, application_id, interview_id, employee_id, status, capabilities, activated_at)
values
 ('a6100000-0000-4000-8000-000000000001','07249eb9-545c-883b-b26b-d52f83b4f4a1','6ba6f1df-e376-40f2-abff-ffdf000172e1','a5000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001','9048f02b-4fdc-3c4c-e1aa-fd339660029c','ACTIVE',array['APPLICATION_READ','INTERVIEW_READ','ASSESSMENT_READ','ASSESSMENT_WRITE']::text[],timezone('utc',now())),
 ('a6100000-0000-4000-8000-000000000002','07249eb9-545c-883b-b26b-d52f83b4f4a1','6ba6f1df-e376-40f2-abff-ffdf000172e1','a5000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001','c6b1c7a9-c250-3d19-b1a0-87e317e80b13','ACTIVE',array['APPLICATION_READ','INTERVIEW_READ','ASSESSMENT_READ','ASSESSMENT_WRITE']::text[],timezone('utc',now()));
insert into public.recruitment_interview_participants (tenant_id, hr_group_id, interview_id, participation_id)
values ('07249eb9-545c-883b-b26b-d52f83b4f4a1','6ba6f1df-e376-40f2-abff-ffdf000172e1','a6000000-0000-4000-8000-000000000001','a6100000-0000-4000-8000-000000000001'), ('07249eb9-545c-883b-b26b-d52f83b4f4a1','6ba6f1df-e376-40f2-abff-ffdf000172e1','a6000000-0000-4000-8000-000000000001','a6100000-0000-4000-8000-000000000002');

-- Reviewer A: draft is private, then submits.
select set_config('request.jwt.claim.sub','71e35860-95c9-4ba3-ac9a-6b366096d8ec',true); set local role authenticated;
select public.upsert_recruitment_assessment_draft('a6000000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_build_object('characteristic_id','9809b444-cd82-41f2-8eb7-dc7498b23fcb','score',4,'note','TEST-RECRUITMENT-A-DRAFT')));
select 1 / ((select coalesce(jsonb_array_length(value->'interviews'->0->'peerAssessments'),0) from public.recruitment_participant_detail_projection('a5000000-0000-4000-8000-000000000001') value limit 1) = 0)::integer;
with draft as (select public.upsert_recruitment_assessment_draft('a6000000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_build_object('characteristic_id','9809b444-cd82-41f2-8eb7-dc7498b23fcb','score',4,'note','TEST-RECRUITMENT-A-SUBMIT')) ) payload) select public.submit_recruitment_assessment((payload->>'id')::uuid,(payload->>'version')::integer) from draft;
-- B cannot see A before own submit (and own draft also stays private).
select set_config('request.jwt.claim.sub','f38fe229-494e-4294-822d-90c19188232f',true);
select 1 / ((select coalesce(jsonb_array_length(value->'interviews'->0->'peerAssessments'),0) from public.recruitment_participant_detail_projection('a5000000-0000-4000-8000-000000000001') value limit 1) = 0)::integer;
select public.upsert_recruitment_assessment_draft('a6000000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_build_object('characteristic_id','9809b444-cd82-41f2-8eb7-dc7498b23fcb','score',2,'note','TEST-RECRUITMENT-B-DRAFT')));
select 1 / ((select coalesce(jsonb_array_length(value->'interviews'->0->'peerAssessments'),0) from public.recruitment_participant_detail_projection('a5000000-0000-4000-8000-000000000001') value limit 1) = 0)::integer;
with draft as (select public.upsert_recruitment_assessment_draft('a6000000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_build_object('characteristic_id','9809b444-cd82-41f2-8eb7-dc7498b23fcb','score',2,'note','TEST-RECRUITMENT-B-SUBMIT')) ) payload) select public.submit_recruitment_assessment((payload->>'id')::uuid,(payload->>'version')::integer) from draft;

-- HR correction preserves the submitted revision and writes correction audit metadata.
select set_config('request.jwt.claim.sub','b86f6a66-276d-4f3d-a985-230f2cca9fdb',true);
select public.correct_recruitment_assessment((select id from public.recruitment_assessments where application_id='a5000000-0000-4000-8000-000000000001' and reviewer_employee_id='9048f02b-4fdc-3c4c-e1aa-fd339660029c' and revision=1),'TEST-RECRUITMENT-CORRECTION-REASON',jsonb_build_array(jsonb_build_object('characteristic_id','9809b444-cd82-41f2-8eb7-dc7498b23fcb','score',5,'note','TEST-RECRUITMENT-CORRECTED')));
select 1 / ((select count(*) from public.recruitment_assessments corrected where corrected.corrected_from_assessment_id=(select original.id from public.recruitment_assessments original where original.application_id='a5000000-0000-4000-8000-000000000001' and original.reviewer_employee_id='9048f02b-4fdc-3c4c-e1aa-fd339660029c' and original.revision=1) and corrected.status='CORRECTED' and corrected.correction_reason='TEST-RECRUITMENT-CORRECTION-REASON')=1)::integer;
select 1 / ((select count(*) from public.recruitment_assessments where application_id='a5000000-0000-4000-8000-000000000001' and reviewer_employee_id='9048f02b-4fdc-3c4c-e1aa-fd339660029c' and revision=1 and status='SUBMITTED')=1)::integer;

-- System content is immutable.
reset role;
do $immutable$
begin
  begin
    update public.recruitment_library_items set title=title || ' TEST-RECRUITMENT-MUTATION' where id=(select id from public.recruitment_library_items where owner_type='SYSTEM' and tenant_id='07249eb9-545c-883b-b26b-d52f83b4f4a1' and hr_group_id='6ba6f1df-e376-40f2-abff-ffdf000172e1' order by stable_code limit 1);
    raise exception 'TEST_RECRUITMENT_EXPECTED_IMMUTABILITY';
  exception when others then if sqlerrm <> 'RECRUITMENT_SYSTEM_CONTENT_IMMUTABLE' then raise; end if;
  end;
end
$immutable$;

-- Retention recompute, aggregate-only analytics, manual anonymize and service cron kernel.
set local role authenticated;
select public.update_recruitment_settings('07249eb9-545c-883b-b26b-d52f83b4f4a1','6ba6f1df-e376-40f2-abff-ffdf000172e1',33,(select public_branding from public.recruitment_settings where tenant_id='07249eb9-545c-883b-b26b-d52f83b4f4a1' and hr_group_id='6ba6f1df-e376-40f2-abff-ffdf000172e1'),(select publication_defaults from public.recruitment_settings where tenant_id='07249eb9-545c-883b-b26b-d52f83b4f4a1' and hr_group_id='6ba6f1df-e376-40f2-abff-ffdf000172e1'),(select version from public.recruitment_settings where tenant_id='07249eb9-545c-883b-b26b-d52f83b4f4a1' and hr_group_id='6ba6f1df-e376-40f2-abff-ffdf000172e1'));
select 1 / ((select retention_due_at=terminal_at+make_interval(days=>33) from public.recruitment_applications where id='a5000000-0000-4000-8000-000000000003')::integer);
with analytics as (select public.recruitment_analytics_projection('07249eb9-545c-883b-b26b-d52f83b4f4a1','6ba6f1df-e376-40f2-abff-ffdf000172e1') payload) select 1 / ((select (payload?'global') and (payload?'byVacancy') and not(payload?'candidateName') and not(payload?'candidateEmail') and payload::text not like '%@%' from analytics)::integer);

reset role;
insert into public.recruitment_candidates (id,tenant_id,hr_group_id,first_name,last_name,private_email,normalized_email) values ('b4100000-0000-4000-8000-000000000001','07249eb9-545c-883b-b26b-d52f83b4f4a1','6ba6f1df-e376-40f2-abff-ffdf000172e1','TEST','RECRUITMENT-MANUAL','test-recruitment-manual@example.invalid','test-recruitment-manual@example.invalid'),('b4100000-0000-4000-8000-000000000002','07249eb9-545c-883b-b26b-d52f83b4f4a1','6ba6f1df-e376-40f2-abff-ffdf000172e1','TEST','RECRUITMENT-CRON','test-recruitment-cron@example.invalid','test-recruitment-cron@example.invalid');
insert into public.recruitment_applications (id,tenant_id,hr_group_id,vacancy_id,candidate_id,terminal_outcome,terminal_reason,terminal_at,retention_due_at,source) values ('b4000000-0000-4000-8000-000000000001','07249eb9-545c-883b-b26b-d52f83b4f4a1','6ba6f1df-e376-40f2-abff-ffdf000172e1','a2000000-0000-4000-8000-000000000001','b4100000-0000-4000-8000-000000000001','AFGEWEZEN','TEST-RECRUITMENT-MANUAL',timezone('utc',now())-interval '40 days',timezone('utc',now())-interval '1 day','MANUAL'),('b4000000-0000-4000-8000-000000000002','07249eb9-545c-883b-b26b-d52f83b4f4a1','6ba6f1df-e376-40f2-abff-ffdf000172e1','a2000000-0000-4000-8000-000000000001','b4100000-0000-4000-8000-000000000002','AFGEWEZEN','TEST-RECRUITMENT-CRON',timezone('utc',now())-interval '40 days',timezone('utc',now())-interval '1 day','MANUAL');
insert into public.recruitment_documents (id,tenant_id,hr_group_id,application_id,storage_key,original_filename,mime_type,file_size,checksum_sha256,scan_status,scanner_reference,scanned_at) values ('b4200000-0000-4000-8000-000000000001','07249eb9-545c-883b-b26b-d52f83b4f4a1','6ba6f1df-e376-40f2-abff-ffdf000172e1','b4000000-0000-4000-8000-000000000001','TEST-RECRUITMENT/manual-cleanup.pdf','manual-cleanup.pdf','application/pdf',4,repeat('c',64),'CLEAN','TEST-RECRUITMENT-MANUAL',timezone('utc',now())),('b4200000-0000-4000-8000-000000000002','07249eb9-545c-883b-b26b-d52f83b4f4a1','6ba6f1df-e376-40f2-abff-ffdf000172e1','b4000000-0000-4000-8000-000000000002','TEST-RECRUITMENT/cron-cleanup.pdf','cron-cleanup.pdf','application/pdf',4,repeat('d',64),'CLEAN','TEST-RECRUITMENT-CRON',timezone('utc',now()));
set local role authenticated; select set_config('request.jwt.claim.sub','b86f6a66-276d-4f3d-a985-230f2cca9fdb',true);
with result as (select public.recruitment_anonymize_application('b4000000-0000-4000-8000-000000000001') payload) select 1 / ((select (payload->>'processed')::boolean and payload->'storageKeys' @> '["TEST-RECRUITMENT/manual-cleanup.pdf"]'::jsonb from result)::integer);
select 1 / ((select count(*)=0 from public.recruitment_documents where application_id='b4000000-0000-4000-8000-000000000001')::integer);
select 1 / ((select private_email is null and normalized_email is null from public.recruitment_candidates where id='b4100000-0000-4000-8000-000000000001')::integer);
reset role; set local role service_role; select set_config('request.jwt.claim.role','service_role',true);
with result as (select public.recruitment_run_retention(100) payload) select 1 / ((select (payload->>'processed')::integer >= 1 and payload->'storageKeys' @> '["TEST-RECRUITMENT/cron-cleanup.pdf"]'::jsonb from result)::integer);
select 1 / ((select count(*)=0 from public.recruitment_documents where application_id='b4000000-0000-4000-8000-000000000002')::integer);
select 1 / ((select private_email is null and normalized_email is null from public.recruitment_candidates where id='b4100000-0000-4000-8000-000000000002')::integer);

rollback;
select 'recruitment_step3_release_contract_ok' as result;
