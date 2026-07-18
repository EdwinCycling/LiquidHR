create function public.create_job_with_revision(
  requested_administration_id uuid,
  requested_payload jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  context_tenant_id uuid;
  created_job_id uuid;
begin
  select administration.tenant_id into context_tenant_id
  from public.administrations administration where administration.id = requested_administration_id;
  if context_tenant_id is null or not internal_security.current_user_has_permission(context_tenant_id, requested_administration_id, 'job-catalog:write') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  insert into public.jobs (tenant_id, administration_id, job_group_id, code)
  values (context_tenant_id, requested_administration_id, (requested_payload->>'jobGroupId')::uuid, upper(btrim(requested_payload->>'code')))
  returning id into created_job_id;
  insert into public.job_revisions (tenant_id, administration_id, job_id, name, description, valid_from, valid_until)
  values (context_tenant_id, requested_administration_id, created_job_id, btrim(requested_payload->>'name'), nullif(btrim(requested_payload->>'description'), ''),
    (requested_payload->>'validFrom')::date, nullif(requested_payload->>'validUntil', '')::date);
  return created_job_id;
end; $$;

create function public.publish_salary_scale_revision(
  requested_administration_id uuid,
  requested_payload jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  context_tenant_id uuid;
  scale_record public.salary_scales%rowtype;
  created_revision_id uuid;
  next_revision_number integer;
  step jsonb;
begin
  select administration.tenant_id into context_tenant_id
  from public.administrations administration where administration.id = requested_administration_id;
  if context_tenant_id is null
     or not internal_security.current_user_has_permission(context_tenant_id, requested_administration_id, 'salary-structure:write')
     or not internal_security.current_user_has_permission(context_tenant_id, requested_administration_id, 'salary:write') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  select * into scale_record from public.salary_scales
  where id = (requested_payload->>'scaleId')::uuid and tenant_id = context_tenant_id and administration_id = requested_administration_id
  for update;
  if not found then raise exception 'SALARY_SCALE_NOT_FOUND' using errcode = 'P0001'; end if;
  select coalesce(max(revision_number), 0) + 1 into next_revision_number
  from public.salary_scale_revisions where salary_scale_id = scale_record.id;
  insert into public.salary_scale_revisions (
    tenant_id, administration_id, salary_scale_id, revision_number, status, description, valid_from, valid_until
  ) values (
    context_tenant_id, requested_administration_id, scale_record.id, next_revision_number, 'DRAFT',
    nullif(btrim(requested_payload->>'description'), ''), (requested_payload->>'validFrom')::date,
    nullif(requested_payload->>'validUntil', '')::date
  ) returning id into created_revision_id;
  for step in select value from jsonb_array_elements(requested_payload->'steps') loop
    insert into public.salary_scale_steps (
      tenant_id, administration_id, salary_scale_id, salary_scale_revision_id, step_code, step_name,
      sequence_number, fulltime_amount, hourly_amount, step_kind, currency_code, valid_from, valid_until
    ) values (
      context_tenant_id, requested_administration_id, scale_record.id, created_revision_id,
      btrim(step->>'stepCode'), btrim(step->>'stepName'), (step->>'sequenceNumber')::integer,
      (step->>'fulltimeAmount')::numeric, nullif(step->>'hourlyAmount', '')::numeric,
      (step->>'stepKind')::public.salary_step_kind, 'EUR', (requested_payload->>'validFrom')::date,
      nullif(requested_payload->>'validUntil', '')::date
    );
  end loop;
  update public.salary_scale_revisions set status = 'PUBLISHED', published_at = timezone('utc', now()), published_by_user_id = auth.uid()
  where id = created_revision_id;
  return created_revision_id;
end; $$;

revoke all on function public.create_job_with_revision(uuid, jsonb) from public, anon;
revoke all on function public.publish_salary_scale_revision(uuid, jsonb) from public, anon;
grant execute on function public.create_job_with_revision(uuid, jsonb) to authenticated;
grant execute on function public.publish_salary_scale_revision(uuid, jsonb) to authenticated;
