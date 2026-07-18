begin;

do $$
declare
  tenant uuid := md5('tenant:liquid-hr-demo-holding')::uuid;
  administration uuid;
  actor uuid;
  group_id uuid;
  created_job_id uuid;
  scale_id uuid;
  revision_id uuid;
begin
  select id into actor from auth.users where lower(email) = 'edwin@editsolutions.nl' limit 1;
  select id into administration from public.administrations where tenant_id = tenant order by created_at limit 1;
  if actor is null or administration is null then raise exception 'Testbasis ontbreekt.'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);

  insert into public.job_groups (tenant_id, administration_id, code, name)
  values (tenant, administration, 'TEST-GROUP', 'Testgroep') returning id into group_id;
  created_job_id := public.create_job_with_revision(administration, jsonb_build_object(
    'jobGroupId', group_id, 'code', 'TEST-JOB', 'name', 'Testfunctie',
    'description', '', 'validFrom', '2026-07-01', 'validUntil', ''
  ));
  if (select count(*) from public.job_revisions where job_id = created_job_id) <> 1 then raise exception 'Functierevisie ontbreekt.'; end if;

  insert into public.salary_scales (tenant_id, administration_id, code, name)
  values (tenant, administration, 'TEST-SCALE', 'Testschaal') returning id into scale_id;
  revision_id := public.publish_salary_scale_revision(administration, jsonb_build_object(
    'scaleId', scale_id, 'validFrom', '2026-07-01', 'validUntil', '', 'description', 'Test',
    'steps', jsonb_build_array(
      jsonb_build_object('stepCode', '0', 'stepName', 'Trede 0', 'sequenceNumber', 0, 'fulltimeAmount', 3000, 'hourlyAmount', '', 'stepKind', 'START'),
      jsonb_build_object('stepCode', '1', 'stepName', 'Trede 1', 'sequenceNumber', 1, 'fulltimeAmount', 3200, 'hourlyAmount', '', 'stepKind', 'MAXIMUM')
    )
  ));
  if (select status from public.salary_scale_revisions where id = revision_id) <> 'PUBLISHED'
     or (select count(*) from public.salary_scale_steps where salary_scale_revision_id = revision_id) <> 2 then
    raise exception 'Schaalrevisie is niet volledig gepubliceerd.';
  end if;
  begin
    update public.salary_scale_revisions set description = 'Niet toegestaan' where id = revision_id;
    raise exception 'Gepubliceerde revisie was wijzigbaar.';
  exception when sqlstate 'P0001' then null;
  end;
end $$;

rollback;
