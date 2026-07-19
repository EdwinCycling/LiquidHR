begin;

do $$
declare
  tenant uuid := md5('tenant:liquid-hr-demo-holding')::uuid;
  administration uuid;
  employee uuid;
  job_group uuid;
  actor uuid;
  tag uuid;
  assessment uuid;
begin
  select id into actor from auth.users where lower(email) = 'edwin@editsolutions.nl' limit 1;
  select id into administration from public.administrations where tenant_id = tenant order by code limit 1;
  select assignment.employee_id into employee
  from public.employee_administration_assignments assignment
  where assignment.tenant_id = tenant and assignment.administration_id = administration
  order by assignment.effective_from limit 1;
  if actor is null or administration is null or employee is null then
    raise exception 'Testbasis voor Star Performers ontbreekt.';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);

  insert into public.job_groups (tenant_id, administration_id, code, name)
  values (tenant, administration, 'STAR_PERFORMER_TEST', 'Star Performer testgroep')
  returning id into job_group;

  insert into public.star_performer_tags (tenant_id, name)
  values (tenant, 'Kritieke expertise test')
  returning id into tag;

  assessment := public.upsert_star_performer_assessment(
    administration,
    jsonb_build_object('employeeId', employee, 'jobGroupId', job_group, 'criticalityLevel', 5, 'tagIds', jsonb_build_array(tag))
  );

  if assessment is null
     or not exists (select 1 from public.star_performer_assessment_tags where assessment_id = assessment and tag_id = tag) then
    raise exception 'Star Performer-beoordeling of expertise-tag ontbreekt.';
  end if;

  if not exists (select 1 from public.star_performer_assessments where id = assessment and criticality_level = 5) then
    raise exception 'Star Performer-beoordeling is niet RLS-leesbaar voor de geautoriseerde actor.';
  end if;
end $$;

rollback;
