-- Remote-only contract: run against the linked LiquidHR dev/test project.
-- Every TEST-RECRUITMENT fixture is transactionally rolled back.
begin;

insert into public.tenants (id, name, slug)
values ('90000000-0000-4000-8000-000000000001', 'TEST-RECRUITMENT-TENANT', 'test-recruitment-tenant');
insert into public.hr_groups (id, tenant_id, code, name)
values ('90000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', 'TEST-RECRUITMENT-HR', 'TEST-RECRUITMENT-HR');
insert into public.tenant_modules (tenant_id, module_code, is_enabled, enabled_at)
values ('90000000-0000-4000-8000-000000000001', 'RECRUITMENT', true, timezone('utc', now()))
on conflict (tenant_id, module_code) do update set is_enabled = true, enabled_at = excluded.enabled_at;
update public.tenant_modules set is_enabled = true, enabled_at = timezone('utc', now()), disabled_at = null
where tenant_id = '07249eb9-545c-883b-b26b-d52f83b4f4a1' and module_code = 'RECRUITMENT';

insert into public.user_hr_group_access (user_id, tenant_id, hr_group_id, management_role_id, is_active) values
  ('b86f6a66-276d-4f3d-a985-230f2cca9fdb', '07249eb9-545c-883b-b26b-d52f83b4f4a1', '6ba6f1df-e376-40f2-abff-ffdf000172e1', 'dcebe348-61ca-4d42-8409-e4b2495e26d6', true),
  ('71e35860-95c9-4ba3-ac9a-6b366096d8ec', '07249eb9-545c-883b-b26b-d52f83b4f4a1', '6ba6f1df-e376-40f2-abff-ffdf000172e1', '7ca24b48-c6e5-436e-ad25-d54e14892a7d', true),
  ('f38fe229-494e-4294-822d-90c19188232f', '07249eb9-545c-883b-b26b-d52f83b4f4a1', '6ba6f1df-e376-40f2-abff-ffdf000172e1', '7ca24b48-c6e5-436e-ad25-d54e14892a7d', true),
  ('f38fe229-494e-4294-822d-90c19188232f', '07249eb9-545c-883b-b26b-d52f83b4f4a1', '9740f620-bbc6-4256-803d-05310ded77c4', 'dcebe348-61ca-4d42-8409-e4b2495e26d6', true),
  ('f38fe229-494e-4294-822d-90c19188232f', '90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002', 'dcebe348-61ca-4d42-8409-e4b2495e26d6', true)
on conflict (user_id, tenant_id, hr_group_id, management_role_id) do update set is_active = true;

insert into public.recruitment_settings (id, tenant_id, hr_group_id, retention_days)
values ('91000000-0000-4000-8000-000000000001', '07249eb9-545c-883b-b26b-d52f83b4f4a1', '6ba6f1df-e376-40f2-abff-ffdf000172e1', 28)
on conflict (tenant_id, hr_group_id) do nothing;
insert into public.recruitment_pipeline_stages (id, tenant_id, hr_group_id, code, name, sort_order, is_active) values
  ('a2000000-0000-4000-8000-000000000001', '07249eb9-545c-883b-b26b-d52f83b4f4a1', '6ba6f1df-e376-40f2-abff-ffdf000172e1', 'TEST_RECRUITMENT_CONTRACT_NEW', 'TEST-RECRUITMENT-CONTRACT-NIEUW', 10, true),
  ('a2000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002', 'TEST_RECRUITMENT_CONTRACT_OTHER', 'TEST-RECRUITMENT-CONTRACT-OTHER', 10, true);
insert into public.recruitment_vacancies (id, tenant_id, hr_group_id, title, status) values
  ('93000000-0000-4000-8000-000000000001', '07249eb9-545c-883b-b26b-d52f83b4f4a1', '6ba6f1df-e376-40f2-abff-ffdf000172e1', 'TEST-RECRUITMENT-VACATURE', 'ACTIVE'),
  ('93000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002', 'TEST-RECRUITMENT-OTHER-VACATURE', 'ACTIVE');
insert into public.recruitment_candidates (id, tenant_id, hr_group_id, first_name, last_name, private_email, normalized_email) values
  ('94000000-0000-4000-8000-000000000001', '07249eb9-545c-883b-b26b-d52f83b4f4a1', '6ba6f1df-e376-40f2-abff-ffdf000172e1', 'TEST', 'RECRUITMENT-REJECT', 'test-recruitment-reject@example.invalid', 'test-recruitment-reject@example.invalid'),
  ('94000000-0000-4000-8000-000000000002', '07249eb9-545c-883b-b26b-d52f83b4f4a1', '6ba6f1df-e376-40f2-abff-ffdf000172e1', 'TEST', 'RECRUITMENT-HIRE', 'test-recruitment-hire@example.invalid', 'test-recruitment-hire@example.invalid'),
  ('94000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002', 'TEST', 'RECRUITMENT-OTHER', null, null);
insert into public.recruitment_applications (id, tenant_id, hr_group_id, vacancy_id, candidate_id, active_stage_id) values
  ('95000000-0000-4000-8000-000000000001', '07249eb9-545c-883b-b26b-d52f83b4f4a1', '6ba6f1df-e376-40f2-abff-ffdf000172e1', '93000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001'),
  ('95000000-0000-4000-8000-000000000002', '07249eb9-545c-883b-b26b-d52f83b4f4a1', '6ba6f1df-e376-40f2-abff-ffdf000172e1', '93000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001'),
  ('95000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000002', '94000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000002');
insert into public.recruitment_participations (id, tenant_id, hr_group_id, application_id, employee_id, status, activated_at, capabilities) values
  ('96000000-0000-4000-8000-000000000001', '07249eb9-545c-883b-b26b-d52f83b4f4a1', '6ba6f1df-e376-40f2-abff-ffdf000172e1', '95000000-0000-4000-8000-000000000001', '9048f02b-4fdc-3c4c-e1aa-fd339660029c', 'ACTIVE', timezone('utc', now()), array['APPLICATION_READ','DOCUMENT_READ']),
  ('96000000-0000-4000-8000-000000000002', '07249eb9-545c-883b-b26b-d52f83b4f4a1', '6ba6f1df-e376-40f2-abff-ffdf000172e1', '95000000-0000-4000-8000-000000000002', '9048f02b-4fdc-3c4c-e1aa-fd339660029c', 'ACTIVE', timezone('utc', now()), array['APPLICATION_READ']);
insert into public.recruitment_documents (id, tenant_id, hr_group_id, application_id, storage_key, original_filename, mime_type, file_size, checksum_sha256, scan_status, scanner_reference, scanned_at)
values ('97000000-0000-4000-8000-000000000001', '07249eb9-545c-883b-b26b-d52f83b4f4a1', '6ba6f1df-e376-40f2-abff-ffdf000172e1', '95000000-0000-4000-8000-000000000001', 'TEST-RECRUITMENT/quarantine/test.pdf', 'test.pdf', 'application/pdf', 4, repeat('a', 64), 'CLEAN', 'TEST-RECRUITMENT-SCAN', timezone('utc', now()));
insert into public.recruitment_publications (id, tenant_id, hr_group_id, vacancy_id, slug, status, published_title, opened_at, closed_at) values
  ('98000000-0000-4000-8000-000000000001', '07249eb9-545c-883b-b26b-d52f83b4f4a1', '6ba6f1df-e376-40f2-abff-ffdf000172e1', '93000000-0000-4000-8000-000000000001', 'test-recruitment-open', 'OPEN', 'TEST-RECRUITMENT-OPEN', timezone('utc', now()), null),
  ('98000000-0000-4000-8000-000000000002', '07249eb9-545c-883b-b26b-d52f83b4f4a1', '6ba6f1df-e376-40f2-abff-ffdf000172e1', '93000000-0000-4000-8000-000000000001', 'test-recruitment-closed', 'CLOSED', 'TEST-RECRUITMENT-CLOSED', null, timezone('utc', now()));
insert into public.recruitment_public_intake_limits (id, publication_id, tenant_id, hr_group_id, bucket_key_hash, proof_hash, window_started_at, verified_at, expires_at)
values ('99000000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000001', '07249eb9-545c-883b-b26b-d52f83b4f4a1', '6ba6f1df-e376-40f2-abff-ffdf000172e1', repeat('b', 64), encode(extensions.digest('TEST-RECRUITMENT-PROOF-000000000000', 'sha256'), 'hex'), timezone('utc', now()), timezone('utc', now()), timezone('utc', now()) + interval '10 minutes');

-- HR actor: own HR-group rows only; other tenant remains zero.
select set_config('request.jwt.claim.sub', 'b86f6a66-276d-4f3d-a985-230f2cca9fdb', true);
set local role authenticated;
select 1 / ((select count(*) from public.recruitment_applications where tenant_id = '07249eb9-545c-883b-b26b-d52f83b4f4a1' and hr_group_id = '6ba6f1df-e376-40f2-abff-ffdf000172e1') >= 2)::integer;
select 1 / ((select count(*) from public.recruitment_applications where tenant_id = '90000000-0000-4000-8000-000000000001') = 0)::integer;
reset role;

-- Concrete participant gets only the bounded projection and document claim, never raw dossiers/storage keys.
select set_config('request.jwt.claim.sub', '71e35860-95c9-4ba3-ac9a-6b366096d8ec', true);
set local role authenticated;
select 1 / ((select count(*) from public.recruitment_applications where id = '95000000-0000-4000-8000-000000000001') = 0)::integer;
select 1 / ((select count(*) from public.recruitment_participant_application_projection('95000000-0000-4000-8000-000000000001')) = 1)::integer;
select 1 / ((select count(*) from public.recruitment_documents where id = '97000000-0000-4000-8000-000000000001') = 0)::integer;
select 1 / ((select count(*) from public.recruitment_document_download_claim('97000000-0000-4000-8000-000000000001')) = 1)::integer;
reset role;

-- Unrelated employee / actor with another HR-group and another tenant gets zero.
select set_config('request.jwt.claim.sub', 'f38fe229-494e-4294-822d-90c19188232f', true);
set local role authenticated;
select 1 / ((select count(*) from public.recruitment_participant_application_projection('95000000-0000-4000-8000-000000000001')) = 0)::integer;
select 1 / ((select count(*) from public.recruitment_applications where tenant_id = '07249eb9-545c-883b-b26b-d52f83b4f4a1' and hr_group_id = '6ba6f1df-e376-40f2-abff-ffdf000172e1') = 0)::integer;
select 1 / ((select count(*) from public.recruitment_applications where tenant_id = '90000000-0000-4000-8000-000000000001') = 1)::integer;
reset role;

-- Anon can read one OPEN publication and consume one verified proof, but has no table access.
set local role anon;
select 1 / ((select count(*) from public.recruitment_public_vacancy('98000000-0000-4000-8000-000000000001', 'test-recruitment-open')) = 1)::integer;
select 1 / ((select count(*) from public.recruitment_public_vacancy('98000000-0000-4000-8000-000000000002', 'test-recruitment-closed')) = 0)::integer;
select 1 / (not has_table_privilege(current_user, 'public.recruitment_applications', 'select'))::integer;
select 1 / (public.recruitment_submit_public_application(
  '98000000-0000-4000-8000-000000000001', 'test-recruitment-open',
  '{"firstName":"TEST","lastName":"RECRUITMENT-PUBLIC","email":"test-recruitment-public@example.invalid"}'::jsonb,
  'TEST-RECRUITMENT-PROOF-000000000000'
) is not null)::integer;
reset role;

-- Reject/hire revoke immediately; reopen never restores old participant rows; retention is recomputed.
select set_config('request.jwt.claim.sub', 'b86f6a66-276d-4f3d-a985-230f2cca9fdb', true);
set local role authenticated;
select public.terminal_transition_recruitment_application('95000000-0000-4000-8000-000000000001', 'AFGEWEZEN', 'TEST-RECRUITMENT-REASON', 1, 'TEST-RECRUITMENT-REJECT-1');
select public.terminal_transition_recruitment_application('95000000-0000-4000-8000-000000000002', 'AANGENOMEN', 'TEST-RECRUITMENT-HIRE', 1, 'TEST-RECRUITMENT-HIRE-1');
select 1 / (((public.terminal_transition_recruitment_application('95000000-0000-4000-8000-000000000001', 'AFGEWEZEN', 'TEST-RECRUITMENT-REASON', 1, 'TEST-RECRUITMENT-REJECT-1')->>'idempotentReplay')::boolean))::integer;
select 1 / (((public.terminal_transition_recruitment_application('95000000-0000-4000-8000-000000000001', 'AFGEWEZEN', 'TEST-RECRUITMENT-REASON', 1, 'TEST-RECRUITMENT-REJECT-1')->>'version')::integer = 2))::integer;
reset role;
select 1 / ((select count(*) from public.recruitment_participations where application_id in ('95000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000002') and status <> 'REVOKED') = 0)::integer;

select set_config('request.jwt.claim.sub', '71e35860-95c9-4ba3-ac9a-6b366096d8ec', true);
set local role authenticated;
select 1 / ((select count(*) from public.recruitment_participant_application_projection('95000000-0000-4000-8000-000000000001')) = 0)::integer;
select 1 / ((select count(*) from public.recruitment_document_download_claim('97000000-0000-4000-8000-000000000001')) = 0)::integer;
reset role;

select set_config('request.jwt.claim.sub', 'b86f6a66-276d-4f3d-a985-230f2cca9fdb', true);
set local role authenticated;
select public.reopen_recruitment_application('95000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 2, 'TEST-RECRUITMENT-REOPEN-1');
select public.update_recruitment_retention_settings('07249eb9-545c-883b-b26b-d52f83b4f4a1', '6ba6f1df-e376-40f2-abff-ffdf000172e1', 40, 1);
reset role;
select 1 / ((select count(*) from public.recruitment_participations where application_id = '95000000-0000-4000-8000-000000000001' and status = 'REVOKED') = 1)::integer;
select 1 / ((select retention_due_at = terminal_at + interval '40 days' from public.recruitment_applications where id = '95000000-0000-4000-8000-000000000002'))::integer;

select set_config('request.jwt.claim.sub', '71e35860-95c9-4ba3-ac9a-6b366096d8ec', true);
set local role authenticated;
select 1 / ((select count(*) from public.recruitment_participant_application_projection('95000000-0000-4000-8000-000000000001')) = 0)::integer;
reset role;

-- The only active stage cannot be deactivated.
select set_config('request.jwt.claim.sub', 'f38fe229-494e-4294-822d-90c19188232f', true);
do $minimum_stage$
begin
  begin
    perform public.set_recruitment_pipeline_stage_active('a2000000-0000-4000-8000-000000000002', false, 1);
    raise exception 'TEST_RECRUITMENT_EXPECTED_STAGE_GUARD';
  exception
    when check_violation then
      if sqlerrm <> 'RECRUITMENT_PIPELINE_REQUIRES_ACTIVE_STAGE' then raise; end if;
  end;
end
$minimum_stage$;

rollback;

select
  (select count(*) from public.recruitment_vacancies where title like 'TEST-RECRUITMENT-%') as remaining_vacancies,
  (select count(*) from public.tenants where id = '90000000-0000-4000-8000-000000000001') as remaining_tenants,
  (select count(*) from public.recruitment_documents where storage_key like 'TEST-RECRUITMENT/%') as remaining_documents;
