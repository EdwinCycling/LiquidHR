-- PAYTEST-PERSONAS-CLOSEOUT: exact, one-time Core TEST data repair.
-- No functions, RPCs, grants or RLS changes. Existing access sync trigger is retained.
do $closeout$
declare
  v_tenant_id constant uuid := '07249eb9-545c-883b-b26b-d52f83b4f4a1';
  v_group_id constant uuid := '6ba6f1df-e376-40f2-abff-ffdf000172e1';
  v_administration_id constant uuid := '8483abc9-f275-c80b-5a23-fedc54ce9f0a';
  v_role_id uuid;
  v_actor_id uuid;
  target record;
  v_linked_user_id uuid;
  v_access_id uuid;
begin
  lock table public.user_access in share row exclusive mode;
  if not exists (select 1 from public.administrations a
    where a.id=v_administration_id and a.tenant_id=v_tenant_id and a.hr_group_id=v_group_id
      and a.name='Jupiter BV' and a.is_active)
    or not exists (select 1 from public.hr_groups g
      where g.id=v_group_id and g.tenant_id=v_tenant_id and g.name='Planeten' and g.is_active) then
    raise exception 'PERSONA_CLOSEOUT_SCOPE_CONFLICT';
  end if;
  select r.id into strict v_role_id from public.management_roles r
    where r.code='EMPLOYEE' and r.tenant_id is null and r.is_active and r.deleted_at is null;
  select u.id into strict v_actor_id from auth.users u
    where lower(u.email)='hradmin.fixture@liquidhr.test' and u.email_confirmed_at is not null;

  -- Validate both targets before the first insert; the DO statement is atomic.
  for target in select * from (values
    ('jaap.test@liquidhr.test','dd9bde02-76bb-4f7c-8add-db544a148f3f'::uuid,'29058c73-5cfa-409d-b9d4-80dd30f36962'::uuid),
    ('frits.test@liquidhr.test','79091d14-ef66-41fe-a2d5-92df108727e5'::uuid,'d19bace9-bb97-4822-a462-eed22821ed05'::uuid)
  ) as expected(email,employee_id,employment_id) loop
    select u.id into strict v_linked_user_id from auth.users u
      join public.employees e on e.auth_user_id=u.id
      join public.employments em on em.employee_id=e.id
      where lower(u.email)=target.email and u.email_confirmed_at is not null
        and not coalesce(u.is_anonymous,false)
        and e.id=target.employee_id and e.tenant_id=v_tenant_id and e.hr_group_id=v_group_id
        and e.is_active and not e.is_archived and e.deleted_at is null
        and em.id=target.employment_id and em.tenant_id=v_tenant_id and em.hr_group_id=v_group_id
        and em.administration_id=v_administration_id and em.record_status='CONFIRMED' and em.deleted_at is null;
    if (select count(*) from public.employees e where e.auth_user_id=v_linked_user_id and e.deleted_at is null) <> 1
      or exists (select 1 from public.user_access a where a.user_id=v_linked_user_id and
        (not a.is_active or a.tenant_id<>v_tenant_id or a.hr_group_id is distinct from v_group_id
         or a.administration_id is distinct from v_administration_id or a.scope_type<>'ADMINISTRATION'
         or a.management_role_id<>v_role_id))
      or (select count(*) from public.user_access a where a.user_id=v_linked_user_id)>1
      or exists (select 1 from public.user_hr_group_access a where a.user_id=v_linked_user_id and
        (not a.is_active or a.tenant_id<>v_tenant_id or a.hr_group_id<>v_group_id or a.management_role_id<>v_role_id)) then
      raise exception 'PERSONA_CLOSEOUT_IDENTITY_OR_ACCESS_CONFLICT';
    end if;
  end loop;

  for target in select * from (values
    ('jaap.test@liquidhr.test','dd9bde02-76bb-4f7c-8add-db544a148f3f'::uuid),
    ('frits.test@liquidhr.test','79091d14-ef66-41fe-a2d5-92df108727e5'::uuid)
  ) as expected(email,employee_id) loop
    select u.id into strict v_linked_user_id from auth.users u where lower(u.email)=target.email;
    select a.id into v_access_id from public.user_access a where a.user_id=v_linked_user_id and a.is_active;
    if v_access_id is null then
      insert into public.user_access(user_id,tenant_id,hr_group_id,management_role_id,scope_type,administration_id,is_active)
        values(v_linked_user_id,v_tenant_id,v_group_id,v_role_id,'ADMINISTRATION',v_administration_id,true)
        returning id into v_access_id;
      insert into public.audit_logs(tenant_id,entity_name,entity_id,actor_user_id,action,changes,subject_employee_id)
        values(v_tenant_id,'user_access',v_access_id,v_actor_id,'CREATE',
          jsonb_build_object('provenance','PAYTEST-PERSONAS-CLOSEOUT','migration','20261015080000',
            'authorization_source','EXPLICIT_USER_APPROVAL','role','EMPLOYEE','scope_type','ADMINISTRATION',
            'administration_id',v_administration_id),target.employee_id);
    elsif not exists (select 1 from public.audit_logs a where a.entity_name='user_access'
      and a.entity_id=v_access_id and a.changes->>'provenance'='PAYTEST-PERSONAS-CLOSEOUT') then
      raise exception 'PERSONA_CLOSEOUT_EXISTING_ACCESS_PROVENANCE_CONFLICT';
    end if;
    if (select count(*) from public.user_hr_group_access a where a.user_id=v_linked_user_id
      and a.tenant_id=v_tenant_id and a.hr_group_id=v_group_id and a.management_role_id=v_role_id and a.is_active)<>1 then
      raise exception 'PERSONA_CLOSEOUT_GROUP_SYNC_FAILED';
    end if;
  end loop;
end;
$closeout$;
