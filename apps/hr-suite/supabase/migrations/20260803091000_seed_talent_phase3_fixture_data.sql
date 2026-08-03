begin;

create or replace function internal_security.validate_talent_goal_check_in()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  goal_employee_id uuid;
begin
  select goal.employee_id into goal_employee_id
  from public.talent_development_goals goal
  where goal.tenant_id = new.tenant_id
    and goal.id = new.goal_id;
  if goal_employee_id is null then
    raise exception 'TALENT_GOAL_NOT_FOUND';
  end if;
  new.employee_id := goal_employee_id;
  new.body := btrim(new.body);
  new.follow_up_title := nullif(btrim(new.follow_up_title), '');
  if (select auth.uid()) is not null and new.author_user_id is distinct from (select auth.uid()) then
    raise exception 'TALENT_CHECKIN_AUTHOR_IMMUTABLE';
  end if;
  if tg_op = 'UPDATE' then
    if new.tenant_id is distinct from old.tenant_id
      or new.goal_id is distinct from old.goal_id
      or new.employee_id is distinct from old.employee_id
      or new.entry_type is distinct from old.entry_type
      or new.author_user_id is distinct from old.author_user_id
      or new.author_employee_id is distinct from old.author_employee_id
      or new.created_at is distinct from old.created_at then
      raise exception 'TALENT_CHECKIN_IDENTITY_IMMUTABLE';
    end if;
    if new.version <> old.version + 1 then
      raise exception 'TALENT_CHECKIN_VERSION_CONFLICT';
    end if;
  end if;
  if new.status = 'COMPLETED' and (tg_op = 'INSERT' or old.status is distinct from 'COMPLETED') then
    new.completed_at := coalesce(new.completed_at, timezone('utc', now()));
  end if;
  return new;
end;
$$;

do $$
declare
  v_tenant_id uuid;
  v_employee_id uuid;
  v_employee_user_id uuid;
  v_manager_id uuid;
  v_manager_user_id uuid;
  v_hr_user_id uuid;
  v_current_goal_id uuid;
  v_current_check_in_id uuid;
  v_import_id uuid;
  v_expiring_record_id uuid;
  v_capability_id uuid;
  v_level_id uuid;
begin
  select tenant.id into v_tenant_id from public.tenants tenant where tenant.slug = 'liquid-hr-demo-holding';
  select employee.id, employee.auth_user_id into v_employee_id, v_employee_user_id
  from public.employees employee
  where employee.tenant_id = v_tenant_id and employee.auth_user_id = (select id from auth.users where email = 'employee.fixture@liquidhr.test')
  limit 1;
  select employee.id, employee.auth_user_id into v_manager_id, v_manager_user_id
  from public.employees employee
  where employee.tenant_id = v_tenant_id and employee.auth_user_id = (select id from auth.users where email = 'manager.fixture@liquidhr.test')
  limit 1;
  select id into v_hr_user_id from auth.users where email = 'hradmin.fixture@liquidhr.test';
  if v_tenant_id is null or v_employee_id is null or v_employee_user_id is null or v_manager_id is null or v_manager_user_id is null or v_hr_user_id is null then
    raise exception 'Talent fixture accounts or demo tenant are missing';
  end if;

  select capability.id into v_capability_id from public.talent_capabilities capability where capability.tenant_id = v_tenant_id and capability.code = 'ADAPTABILITY' limit 1;
  select level.id into v_level_id from public.talent_levels level where level.tenant_id = v_tenant_id and level.code = 'L1' limit 1;
  insert into public.talent_employee_capability_records (
    tenant_id, employee_id, capability_id, talent_level_id, source_type, valid_from, valid_until, status,
    created_by_user_id, updated_by_user_id
  )
  select v_tenant_id, v_employee_id, v_capability_id, v_level_id, 'HR_ENTERED', '2026-01-01', '2026-06-30', 'RELEASED', v_hr_user_id, v_hr_user_id
  where v_capability_id is not null and v_level_id is not null
    and not exists (
      select 1 from public.talent_employee_capability_records record
      where record.tenant_id = v_tenant_id and record.employee_id = v_employee_id
        and record.capability_id = v_capability_id and record.valid_from = '2026-01-01'
    );

  select capability.id into v_capability_id from public.talent_capabilities capability where capability.tenant_id = v_tenant_id and capability.code = 'COACHING' limit 1;
  select level.id into v_level_id from public.talent_levels level where level.tenant_id = v_tenant_id and level.code = 'L2' limit 1;
  insert into public.talent_employee_capability_records (
    tenant_id, employee_id, capability_id, talent_level_id, source_type, valid_from, valid_until, status,
    created_by_user_id, updated_by_user_id
  )
  select v_tenant_id, v_employee_id, v_capability_id, v_level_id, 'MANAGER_ENTERED', '2026-07-01', null, 'RELEASED', v_manager_user_id, v_manager_user_id
  where v_capability_id is not null and v_level_id is not null
    and not exists (
      select 1 from public.talent_employee_capability_records record
      where record.tenant_id = v_tenant_id and record.employee_id = v_employee_id
        and record.capability_id = v_capability_id and record.valid_from = '2026-07-01'
    );

  select capability.id into v_capability_id from public.talent_capabilities capability where capability.tenant_id = v_tenant_id and capability.code = 'LEADERSHIP' limit 1;
  select level.id into v_level_id from public.talent_levels level where level.tenant_id = v_tenant_id and level.code = 'L1' limit 1;
  insert into public.talent_employee_capability_records (
    tenant_id, employee_id, capability_id, talent_level_id, source_type, valid_from, valid_until, status,
    created_by_user_id, updated_by_user_id
  )
  select v_tenant_id, v_employee_id, v_capability_id, v_level_id, 'HR_ENTERED', '2027-01-01', '2027-12-31', 'RELEASED', v_hr_user_id, v_hr_user_id
  where v_capability_id is not null and v_level_id is not null
    and not exists (
      select 1 from public.talent_employee_capability_records record
      where record.tenant_id = v_tenant_id and record.employee_id = v_employee_id
        and record.capability_id = v_capability_id and record.valid_from = '2027-01-01'
    );

  insert into public.talent_development_goals (
    tenant_id, employee_id, title, description, period_start, period_end, progress_percent, status, source_type,
    created_by_user_id, updated_by_user_id
  )
  select v_tenant_id, v_employee_id, 'P3 historisch reflectiedoel', 'Historisch afgerond doel voor rapportagehistorie.', '2026-01-01', '2026-03-31', 100, 'COMPLETED', 'HR_ENTERED', v_hr_user_id, v_hr_user_id
  where not exists (select 1 from public.talent_development_goals goal where goal.tenant_id = v_tenant_id and goal.employee_id = v_employee_id and goal.title = 'P3 historisch reflectiedoel');

  insert into public.talent_development_goals (
    tenant_id, employee_id, title, description, period_start, period_end, progress_percent, status, source_type,
    created_by_user_id, updated_by_user_id
  )
  select v_tenant_id, v_employee_id, 'P3 huidig ontwikkeldoel', 'Actief doel voor managercheck-in en opvolging.', '2026-07-01', '2026-12-31', 45, 'ACTIVE', 'MANAGER_ENTERED', v_manager_user_id, v_manager_user_id
  where not exists (select 1 from public.talent_development_goals goal where goal.tenant_id = v_tenant_id and goal.employee_id = v_employee_id and goal.title = 'P3 huidig ontwikkeldoel');

  insert into public.talent_development_goals (
    tenant_id, employee_id, title, description, period_start, period_end, progress_percent, status, source_type,
    created_by_user_id, updated_by_user_id
  )
  select v_tenant_id, v_employee_id, 'P3 toekomstig leerdoel', 'Toekomstig doel om de periodefilter te kunnen testen.', '2027-01-01', '2027-06-30', 0, 'DRAFT', 'HR_ENTERED', v_hr_user_id, v_hr_user_id
  where not exists (select 1 from public.talent_development_goals goal where goal.tenant_id = v_tenant_id and goal.employee_id = v_employee_id and goal.title = 'P3 toekomstig leerdoel');

  select goal.id into v_current_goal_id from public.talent_development_goals goal where goal.tenant_id = v_tenant_id and goal.employee_id = v_employee_id and goal.title = 'P3 huidig ontwikkeldoel' limit 1;
  insert into public.talent_goal_check_ins (
    tenant_id, goal_id, employee_id, entry_type, author_user_id, author_employee_id, body
  )
  select v_tenant_id, v_current_goal_id, v_employee_id, 'EMPLOYEE_REFLECTION', v_employee_user_id, v_employee_id, 'Ik heb de eerste stappen gezet en wil de volgende oefening voorbereiden.'
  where v_current_goal_id is not null
    and not exists (select 1 from public.talent_goal_check_ins check_in where check_in.tenant_id = v_tenant_id and check_in.goal_id = v_current_goal_id and check_in.entry_type = 'EMPLOYEE_REFLECTION');

  insert into public.talent_goal_check_ins (
    tenant_id, goal_id, employee_id, entry_type, author_user_id, author_employee_id, body
  )
  select v_tenant_id, v_current_goal_id, v_employee_id, 'MANAGER_OBSERVATION', v_manager_user_id, v_manager_id, 'De medewerker heeft aantoonbaar voortgang geboekt; bespreek de volgende praktijksituatie.'
  where v_current_goal_id is not null
    and not exists (select 1 from public.talent_goal_check_ins check_in where check_in.tenant_id = v_tenant_id and check_in.goal_id = v_current_goal_id and check_in.entry_type = 'MANAGER_OBSERVATION');

  insert into public.talent_goal_check_ins (
    tenant_id, goal_id, employee_id, entry_type, author_user_id, author_employee_id, body, follow_up_title, follow_up_due_on
  )
  select v_tenant_id, v_current_goal_id, v_employee_id, 'FOLLOW_UP', v_manager_user_id, v_manager_id, 'Plan een vervolggesprek over de volgende praktijksituatie.', 'Vervolggesprek plannen', current_date + 14
  where v_current_goal_id is not null
    and not exists (select 1 from public.talent_goal_check_ins check_in where check_in.tenant_id = v_tenant_id and check_in.goal_id = v_current_goal_id and check_in.entry_type = 'FOLLOW_UP');
  select check_in.id into v_current_check_in_id from public.talent_goal_check_ins check_in where check_in.tenant_id = v_tenant_id and check_in.goal_id = v_current_goal_id and check_in.entry_type = 'FOLLOW_UP' limit 1;

  select batch.id into v_import_id from public.talent_import_batches batch where batch.tenant_id = v_tenant_id order by batch.created_at desc limit 1;
  select record.id into v_expiring_record_id from public.talent_employee_capability_records record where record.tenant_id = v_tenant_id and record.employee_id = v_employee_id and record.valid_from = '2026-07-01' limit 1;

  insert into public.talent_notifications (
    tenant_id, recipient_user_id, recipient_employee_id, event_type, title, summary, source_entity_id
  )
  select v_tenant_id, v_employee_user_id, v_employee_id, 'GOAL_OPEN', 'Open ontwikkeldoel', 'Er staat een ontwikkeldoel klaar om te bekijken of bij te werken.', v_current_goal_id
  where v_current_goal_id is not null
  on conflict (tenant_id, event_type, source_entity_id, recipient_employee_id) where source_entity_id is not null do update set updated_at = timezone('utc', now());

  insert into public.talent_notifications (
    tenant_id, recipient_user_id, recipient_employee_id, event_type, title, summary, source_entity_id
  )
  select v_tenant_id, v_manager_user_id, v_manager_id, 'ASSESSMENT_PENDING', 'Assessment opvolgen', 'Er staat een Talentonderdeel klaar om in de teamscope te controleren.', md5('p3-assessment-pending')::uuid
  on conflict (tenant_id, event_type, source_entity_id, recipient_employee_id) where source_entity_id is not null do update set updated_at = timezone('utc', now());

  insert into public.talent_notifications (
    tenant_id, recipient_user_id, recipient_employee_id, event_type, title, summary, source_entity_id
  )
  select v_tenant_id, v_manager_user_id, v_manager_id, 'IMPORT_COMPLETED', 'Import afgerond', 'Een Talentimport is afgerond en kan worden gecontroleerd.', v_import_id
  where v_import_id is not null
  on conflict (tenant_id, event_type, source_entity_id, recipient_employee_id) where source_entity_id is not null do update set updated_at = timezone('utc', now());

  insert into public.talent_notifications (
    tenant_id, recipient_user_id, recipient_employee_id, event_type, title, summary, source_entity_id
  )
  select v_tenant_id, v_employee_user_id, v_employee_id, 'QUALIFICATION_EXPIRING', 'Geldigheid controleren', 'Een capabilityregistratie heeft een einddatum die gecontroleerd moet worden.', v_expiring_record_id
  where v_expiring_record_id is not null
  on conflict (tenant_id, event_type, source_entity_id, recipient_employee_id) where source_entity_id is not null do update set updated_at = timezone('utc', now());

  insert into public.talent_notifications (
    tenant_id, recipient_user_id, recipient_employee_id, event_type, title, summary, source_entity_id
  )
  select v_tenant_id, v_manager_user_id, v_manager_id, 'CHECKIN_DUE', 'Opvolgactie gepland', 'Er staat een opvolgactie bij een doelgesprek gepland.', v_current_check_in_id
  where v_current_check_in_id is not null
  on conflict (tenant_id, event_type, source_entity_id, recipient_employee_id) where source_entity_id is not null do update set updated_at = timezone('utc', now());
end;
$$;

commit;
