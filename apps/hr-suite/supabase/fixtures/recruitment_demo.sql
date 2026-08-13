-- Synthetische Guided Recruitment-demo voor dev/test. Geen echte persoonsgegevens.
do $$
declare
  demo_tenant uuid;
  demo_group uuid;
  demo_stage uuid;
  demo_vacancy uuid;
  active_candidate uuid;
  terminal_candidate uuid;
  active_application uuid;
  terminal_application uuid;
  demo_employee uuid;
  demo_set uuid;
  demo_interview uuid;
  demo_participation uuid;
begin
  select tenant_id, id into demo_tenant, demo_group from public.hr_groups order by created_at limit 1;
  if demo_group is null then raise exception 'RECRUITMENT_DEMO_NO_HR_GROUP'; end if;

  insert into public.recruitment_pipeline_stages (tenant_id, hr_group_id, code, name, sort_order)
  values (demo_tenant, demo_group, 'DEMO_SCREENING', 'Demo screening', 5)
  on conflict (tenant_id, hr_group_id, code) do update set is_active = true
  returning id into demo_stage;

  select id into demo_vacancy from public.recruitment_vacancies where tenant_id = demo_tenant and hr_group_id = demo_group and title = 'TEST-RECRUITMENT-Guided vacancy' limit 1;
  if demo_vacancy is null then
    insert into public.recruitment_vacancies (tenant_id, hr_group_id, title, location_label, status)
    values (demo_tenant, demo_group, 'TEST-RECRUITMENT-Guided vacancy', 'Testlocatie', 'ACTIVE') returning id into demo_vacancy;
  end if;

  select id into active_candidate from public.recruitment_candidates where tenant_id = demo_tenant and hr_group_id = demo_group and normalized_email = 'test-recruitment-active@example.invalid' limit 1;
  if active_candidate is null then
    insert into public.recruitment_candidates (tenant_id, hr_group_id, first_name, last_name, private_email, normalized_email, phone)
    values (demo_tenant, demo_group, 'Test', 'Recruitment Active', 'test-recruitment-active@example.invalid', 'test-recruitment-active@example.invalid', '+31000000001') returning id into active_candidate;
  end if;

  select id into active_application from public.recruitment_applications where tenant_id = demo_tenant and hr_group_id = demo_group and vacancy_id = demo_vacancy and candidate_id = active_candidate limit 1;
  if active_application is null then
    insert into public.recruitment_applications (tenant_id, hr_group_id, vacancy_id, candidate_id, active_stage_id, source, motivation)
    values (demo_tenant, demo_group, demo_vacancy, active_candidate, demo_stage, 'MANUAL', 'Synthetische demo-motivatie voor Guided Recruitment.') returning id into active_application;
  end if;

  select id into terminal_candidate from public.recruitment_candidates where tenant_id = demo_tenant and hr_group_id = demo_group and normalized_email = 'test-recruitment-retention@example.invalid' limit 1;
  if terminal_candidate is null then
    insert into public.recruitment_candidates (tenant_id, hr_group_id, first_name, last_name, private_email, normalized_email)
    values (demo_tenant, demo_group, 'Test', 'Recruitment Retention', 'test-recruitment-retention@example.invalid', 'test-recruitment-retention@example.invalid') returning id into terminal_candidate;
  end if;

  select id into terminal_application from public.recruitment_applications where tenant_id = demo_tenant and hr_group_id = demo_group and vacancy_id = demo_vacancy and candidate_id = terminal_candidate limit 1;
  if terminal_application is null then
    insert into public.recruitment_applications (tenant_id, hr_group_id, vacancy_id, candidate_id, terminal_outcome, source, terminal_at, retention_due_at)
    values (demo_tenant, demo_group, demo_vacancy, terminal_candidate, 'AFGEWEZEN', 'MANUAL', timezone('utc', now()) - interval '40 days', timezone('utc', now()) - interval '12 days') returning id into terminal_application;
  end if;

  select id into demo_employee from public.employees where tenant_id = demo_tenant and hr_group_id = demo_group and deleted_at is null order by id limit 1;
  select id into demo_set from public.recruitment_sets where tenant_id = demo_tenant and hr_group_id = demo_group and owner_type = 'SYSTEM' order by stable_code limit 1;
  if demo_employee is not null and demo_set is not null then
    select id into demo_interview from public.recruitment_interviews where tenant_id = demo_tenant and hr_group_id = demo_group and application_id = active_application and title = 'TEST-RECRUITMENT-Demo gesprek' limit 1;
    if demo_interview is null then
      insert into public.recruitment_interviews (tenant_id, hr_group_id, application_id, set_id, title, scheduled_at)
      values (demo_tenant, demo_group, active_application, demo_set, 'TEST-RECRUITMENT-Demo gesprek', timezone('utc', now()) + interval '2 days') returning id into demo_interview;
    end if;
    insert into public.recruitment_participations (tenant_id, hr_group_id, application_id, interview_id, employee_id, status, capabilities, activated_at)
    values (demo_tenant, demo_group, active_application, demo_interview, demo_employee, 'ACTIVE', array['APPLICATION_READ','INTERVIEW_READ','ASSESSMENT_READ','ASSESSMENT_WRITE']::text[], timezone('utc', now()))
    on conflict (tenant_id, hr_group_id, application_id, interview_id, employee_id) do update set status = 'ACTIVE', revoked_at = null, activated_at = coalesce(public.recruitment_participations.activated_at, excluded.activated_at);
    select id into demo_participation from public.recruitment_participations where tenant_id = demo_tenant and hr_group_id = demo_group and application_id = active_application and interview_id = demo_interview and employee_id = demo_employee limit 1;
    insert into public.recruitment_interview_participants (tenant_id, hr_group_id, interview_id, participation_id)
    values (demo_tenant, demo_group, demo_interview, demo_participation)
    on conflict do nothing;
  end if;
end;
$$;
