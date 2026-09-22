-- T01 exposed that review activation deduplicated placements per manager.
-- Select one deterministic current placement per employee before deriving
-- manager assignments so a conflicted organization timeline cannot materialize
-- the same employee into two assignment batches.
create or replace function public.start_talent_review_campaign(requested_campaign_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, auth, pg_temp
as $$
declare
  campaign_row public.talent_review_campaigns;
  assignment_row record;
  current_placement record;
  created_assignment_id uuid;
  created_reminder_id uuid;
  planned_reminder_at timestamptz;
  deadline_reminder_at timestamptz;
  seven_day_reminder_at timestamptz;
  next_status text;
begin
  select * into campaign_row
  from public.talent_review_campaigns
  where id = requested_campaign_id
  for update;
  if campaign_row.id is null then raise exception 'TALENT_REVIEW_CAMPAIGN_NOT_FOUND'; end if;
  if not internal_security.current_user_has_permission(campaign_row.tenant_id, campaign_row.administration_id, 'talent-review:manage') then raise exception 'TALENT_REVIEW_FORBIDDEN'; end if;
  if campaign_row.status <> 'DRAFT' then raise exception 'TALENT_REVIEW_CAMPAIGN_ALREADY_STARTED'; end if;

  next_status := case when campaign_row.starts_on > current_date then 'SCHEDULED' else 'ACTIVE' end;
  update public.talent_review_campaigns
  set status = next_status, started_at = timezone('utc', now()), version = version + 1, updated_by_user_id = (select auth.uid())
  where tenant_id = campaign_row.tenant_id and id = campaign_row.id;

  for assignment_row in
    with current_placements as (
      select distinct on (placement.employee_id)
        placement.employee_id,
        placement.direct_manager_id
      from public.employee_organizations placement
      join public.employees employee
        on employee.tenant_id = placement.tenant_id
       and employee.id = placement.employee_id
      where placement.tenant_id = campaign_row.tenant_id
        and placement.direct_manager_id is not null
        and placement.employee_id <> placement.direct_manager_id
        and (campaign_row.administration_id is null or placement.administration_id = campaign_row.administration_id)
        and placement.effective_from <= current_date
        and (placement.effective_to is null or placement.effective_to >= current_date)
        and employee.is_active
        and not employee.is_archived
        and employee.deleted_at is null
      order by placement.employee_id, placement.effective_from desc, placement.updated_at desc, placement.id desc
    )
    select distinct current_placements.direct_manager_id as manager_employee_id
    from current_placements
  loop
    insert into public.talent_review_assignments (tenant_id, campaign_id, manager_employee_id)
    values (campaign_row.tenant_id, campaign_row.id, assignment_row.manager_employee_id)
    returning id into created_assignment_id;

    for current_placement in
      with current_placements as (
        select distinct on (placement.employee_id)
          placement.employee_id,
          placement.direct_manager_id,
          placement.job_title,
          placement.department_id,
          employee.first_name,
          employee.birth_name,
          employee.employee_number,
          employee.avatar_url
        from public.employee_organizations placement
        join public.employees employee
          on employee.tenant_id = placement.tenant_id
         and employee.id = placement.employee_id
        where placement.tenant_id = campaign_row.tenant_id
          and placement.employee_id <> placement.direct_manager_id
          and (campaign_row.administration_id is null or placement.administration_id = campaign_row.administration_id)
          and placement.effective_from <= current_date
          and (placement.effective_to is null or placement.effective_to >= current_date)
          and employee.is_active
          and not employee.is_archived
          and employee.deleted_at is null
        order by placement.employee_id, placement.effective_from desc, placement.updated_at desc, placement.id desc
      )
      select *
      from current_placements
      where current_placements.direct_manager_id = assignment_row.manager_employee_id
    loop
      insert into public.talent_review_assignment_members (tenant_id, assignment_id, campaign_id, manager_employee_id, employee_id, employee_snapshot)
      values (
        campaign_row.tenant_id, created_assignment_id, campaign_row.id, assignment_row.manager_employee_id, current_placement.employee_id,
        jsonb_build_object('first_name', current_placement.first_name, 'birth_name', current_placement.birth_name, 'employee_number', current_placement.employee_number, 'avatar_url', current_placement.avatar_url, 'job_title', current_placement.job_title, 'department_id', current_placement.department_id)
      );
    end loop;

    update public.talent_review_assignments assignment
    set employee_count = (select count(*) from public.talent_review_assignment_members member where member.tenant_id = campaign_row.tenant_id and member.assignment_id = created_assignment_id)
    where assignment.tenant_id = campaign_row.tenant_id and assignment.id = created_assignment_id;

    select ((campaign_row.ends_on - 7)::date + time '09:00:00') at time zone 'Europe/Amsterdam' into seven_day_reminder_at;
    select (campaign_row.ends_on::date + time '09:00:00') at time zone 'Europe/Amsterdam' into deadline_reminder_at;
    planned_reminder_at := case when seven_day_reminder_at < ((campaign_row.starts_on::date + time '00:00:00') at time zone 'Europe/Amsterdam') then deadline_reminder_at else seven_day_reminder_at end;
    if planned_reminder_at <= timezone('utc', now()) then planned_reminder_at := timezone('utc', now()) + interval '1 minute'; end if;

    if exists (select 1 from public.employees manager where manager.tenant_id = campaign_row.tenant_id and manager.id = assignment_row.manager_employee_id and manager.auth_user_id is not null and manager.deleted_at is null) then
      insert into public.reminders (tenant_id, administration_id, created_by_user_id, reminder_type, target_type, title, description, remind_at, status)
      values (campaign_row.tenant_id, campaign_row.administration_id, (select auth.uid()), 'HR', 'EMPLOYEES', 'Vlootschouw invullen: ' || campaign_row.name, 'Vul de 9-grid voor je team in vóór ' || to_char(campaign_row.ends_on, 'DD-MM-YYYY') || '.', planned_reminder_at, 'DRAFT')
      returning id into created_reminder_id;
      insert into public.reminder_targets (tenant_id, administration_id, reminder_id, employee_id)
      values (campaign_row.tenant_id, campaign_row.administration_id, created_reminder_id, assignment_row.manager_employee_id);
      perform public.publish_reminder(created_reminder_id);
      update public.talent_review_assignments
      set reminder_id = created_reminder_id
      where tenant_id = campaign_row.tenant_id and id = created_assignment_id;
    end if;
  end loop;

  return campaign_row.id;
end;
$$;

revoke all on function public.start_talent_review_campaign(uuid) from public, anon;
grant execute on function public.start_talent_review_campaign(uuid) to authenticated;
