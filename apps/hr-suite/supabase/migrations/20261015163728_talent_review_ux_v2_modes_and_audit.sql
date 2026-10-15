begin;

alter table public.talent_review_campaigns
  add column review_mode text not null default 'MANAGER_ONLY'
    check (review_mode in ('MANAGER_ONLY', 'HR_ONLY', 'HYBRID'));

alter table public.talent_review_assignments
  add column return_reason text check (return_reason is null or char_length(btrim(return_reason)) between 1 and 1000),
  add column returned_at timestamptz,
  add column returned_by_user_id uuid references auth.users(id) on delete set null;

create index if not exists talent_review_assignments_returned_by_user_id_idx
  on public.talent_review_assignments (returned_by_user_id);

alter table public.talent_review_scores
  add column acting_reason text check (acting_reason is null or char_length(acting_reason) <= 1000);

create or replace function internal_security.can_access_talent_review_assignment(
  requested_tenant_id uuid,
  requested_campaign_id uuid,
  requested_assignment_id uuid,
  requested_action text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and requested_action in ('READ', 'WRITE', 'REMIND')
    and exists (
      select 1
      from public.talent_review_campaigns campaign
      join public.talent_review_assignments assignment
        on assignment.tenant_id = campaign.tenant_id
       and assignment.campaign_id = campaign.id
      where campaign.tenant_id = requested_tenant_id
        and campaign.id = requested_campaign_id
        and campaign.administration_id is not null
        and assignment.id = requested_assignment_id
        and case requested_action
          when 'READ' then
            internal_security.current_user_has_permission(campaign.tenant_id, campaign.administration_id, 'talent-review:manage')
            or (
              campaign.review_mode <> 'HR_ONLY'
              and assignment.manager_employee_id = internal_security.current_employee_id()
              and internal_security.current_user_has_permission(campaign.tenant_id, campaign.administration_id, 'talent-review:read')
            )
          when 'WRITE' then
            campaign.status = 'ACTIVE'
            and assignment.status <> 'SUBMITTED'
            and (
              (
                campaign.review_mode in ('HR_ONLY', 'HYBRID')
                and internal_security.current_user_has_permission(campaign.tenant_id, campaign.administration_id, 'talent-review:manage')
              )
              or (
                campaign.review_mode in ('MANAGER_ONLY', 'HYBRID')
                and assignment.manager_employee_id = internal_security.current_employee_id()
                and internal_security.current_user_has_permission(campaign.tenant_id, campaign.administration_id, 'talent-review:write')
              )
            )
          when 'REMIND' then
            campaign.review_mode <> 'HR_ONLY'
            and campaign.status in ('SCHEDULED', 'ACTIVE', 'HR_REVIEW')
            and assignment.status <> 'SUBMITTED'
            and internal_security.current_user_has_permission(campaign.tenant_id, campaign.administration_id, 'talent-review:manage')
          else false
        end
    );
$$;

create or replace function internal_security.can_read_talent_review_history(
  requested_tenant_id uuid,
  requested_campaign_id uuid,
  requested_employee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.talent_review_campaigns historical_campaign
      where historical_campaign.tenant_id = requested_tenant_id
        and historical_campaign.id = requested_campaign_id
        and historical_campaign.administration_id is not null
        and (
          internal_security.current_user_has_permission(historical_campaign.tenant_id, historical_campaign.administration_id, 'talent-review:manage')
          or (
            requested_employee_id <> internal_security.current_employee_id()
            and internal_security.current_user_has_permission(historical_campaign.tenant_id, historical_campaign.administration_id, 'talent-review:read')
            and exists (
              select 1
              from public.talent_review_campaigns current_campaign
              join public.talent_review_assignments assignment
                on assignment.tenant_id = current_campaign.tenant_id
               and assignment.campaign_id = current_campaign.id
              join public.talent_review_assignment_members member
                on member.tenant_id = assignment.tenant_id
               and member.assignment_id = assignment.id
              where current_campaign.tenant_id = requested_tenant_id
                and current_campaign.administration_id = historical_campaign.administration_id
                and current_campaign.id <> historical_campaign.id
                and current_campaign.review_mode <> 'HR_ONLY'
                and assignment.manager_employee_id = internal_security.current_employee_id()
                and member.employee_id = requested_employee_id
                and internal_security.current_user_has_permission(current_campaign.tenant_id, current_campaign.administration_id, 'talent-review:read')
            )
          )
        )
    );
$$;

revoke all on function internal_security.can_access_talent_review_assignment(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function internal_security.can_read_talent_review_history(uuid, uuid, uuid) from public, anon, authenticated;
grant usage on schema internal_security to authenticated;
grant execute on function internal_security.can_access_talent_review_assignment(uuid, uuid, uuid, text) to authenticated;
grant execute on function internal_security.can_read_talent_review_history(uuid, uuid, uuid) to authenticated;

create or replace function internal_security.guard_talent_review_campaign_mode()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if new.review_mode is distinct from old.review_mode and old.status <> 'DRAFT' then
    raise exception 'TALENT_REVIEW_MODE_LOCKED';
  end if;
  return new;
end;
$$;

create or replace function internal_security.guard_talent_review_actor_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'TALENT_REVIEW_FORBIDDEN'; end if;
  if tg_op = 'INSERT' then
    new.created_by_user_id := (select auth.uid());
  elsif new.created_by_user_id is distinct from old.created_by_user_id then
    raise exception 'TALENT_REVIEW_ACTOR_IMMUTABLE';
  end if;
  new.updated_by_user_id := (select auth.uid());
  return new;
end;
$$;

revoke all on function internal_security.guard_talent_review_actor_fields() from public, anon, authenticated;
drop trigger if exists guard_talent_review_campaign_actor_fields on public.talent_review_campaigns;
create trigger guard_talent_review_campaign_actor_fields
before insert or update on public.talent_review_campaigns
for each row execute function internal_security.guard_talent_review_actor_fields();

revoke all on function internal_security.guard_talent_review_campaign_mode() from public, anon, authenticated;
drop trigger if exists guard_talent_review_campaign_mode on public.talent_review_campaigns;
create trigger guard_talent_review_campaign_mode
before update of review_mode on public.talent_review_campaigns
for each row execute function internal_security.guard_talent_review_campaign_mode();

drop policy if exists talent_review_campaigns_select on public.talent_review_campaigns;
create policy talent_review_campaigns_select on public.talent_review_campaigns for select to authenticated
using (
  administration_id is not null
  and (
    (select internal_security.current_user_has_permission(tenant_id, administration_id, 'talent-review:manage'))
    or (
      review_mode <> 'HR_ONLY'
      and (select internal_security.current_user_has_permission(tenant_id, administration_id, 'talent-review:read'))
      and exists (
        select 1
        from public.talent_review_assignments assignment
        where assignment.tenant_id = talent_review_campaigns.tenant_id
          and assignment.campaign_id = talent_review_campaigns.id
          and assignment.manager_employee_id = (select internal_security.current_employee_id())
      )
    )
  )
);

drop policy if exists talent_review_campaigns_insert on public.talent_review_campaigns;
create policy talent_review_campaigns_insert on public.talent_review_campaigns for insert to authenticated
with check (
  administration_id is not null
  and (select internal_security.current_user_has_permission(tenant_id, administration_id, 'talent-review:manage'))
);

drop policy if exists talent_review_campaigns_update on public.talent_review_campaigns;
create policy talent_review_campaigns_update on public.talent_review_campaigns for update to authenticated
using (
  status = 'DRAFT'
  and administration_id is not null
  and (select internal_security.current_user_has_permission(tenant_id, administration_id, 'talent-review:manage'))
)
with check (
  status = 'DRAFT'
  and administration_id is not null
  and (select internal_security.current_user_has_permission(tenant_id, administration_id, 'talent-review:manage'))
);

drop policy if exists talent_review_assignments_select on public.talent_review_assignments;
create policy talent_review_assignments_select on public.talent_review_assignments for select to authenticated
using (
  (select internal_security.can_access_talent_review_assignment(tenant_id, campaign_id, id, 'READ'))
);

drop policy if exists talent_review_assignments_update on public.talent_review_assignments;
create policy talent_review_assignments_update on public.talent_review_assignments for update to authenticated
using (
  (select internal_security.can_access_talent_review_assignment(tenant_id, campaign_id, id, 'REMIND'))
)
with check (
  (select internal_security.can_access_talent_review_assignment(tenant_id, campaign_id, id, 'REMIND'))
);

drop policy if exists talent_review_assignment_members_select on public.talent_review_assignment_members;
create policy talent_review_assignment_members_select on public.talent_review_assignment_members for select to authenticated
using (
  (select internal_security.can_access_talent_review_assignment(tenant_id, campaign_id, assignment_id, 'READ'))
  and (
    employee_id <> (select internal_security.current_employee_id())
    or (select internal_security.current_user_has_permission(tenant_id, null, 'talent-review:manage'))
  )
);

drop policy if exists talent_review_scores_select on public.talent_review_scores;
create policy talent_review_scores_select on public.talent_review_scores for select to authenticated
using (
  (
    (select internal_security.can_access_talent_review_assignment(tenant_id, campaign_id, assignment_id, 'READ'))
    and (
      employee_id <> (select internal_security.current_employee_id())
      or (select internal_security.current_user_has_permission(tenant_id, null, 'talent-review:manage'))
    )
  )
  or (select internal_security.can_read_talent_review_history(tenant_id, campaign_id, employee_id))
);

drop policy if exists talent_review_scores_insert on public.talent_review_scores;
create policy talent_review_scores_insert on public.talent_review_scores for insert to authenticated
with check (
  (select internal_security.can_access_talent_review_assignment(tenant_id, campaign_id, assignment_id, 'WRITE'))
  and (
    employee_id <> (select internal_security.current_employee_id())
    or (select internal_security.current_user_has_permission(tenant_id, null, 'talent-review:manage'))
  )
);

drop policy if exists talent_review_scores_update on public.talent_review_scores;
create policy talent_review_scores_update on public.talent_review_scores for update to authenticated
using (
  (select internal_security.can_access_talent_review_assignment(tenant_id, campaign_id, assignment_id, 'WRITE'))
  and (
    employee_id <> (select internal_security.current_employee_id())
    or (select internal_security.current_user_has_permission(tenant_id, null, 'talent-review:manage'))
  )
)
with check (
  (select internal_security.can_access_talent_review_assignment(tenant_id, campaign_id, assignment_id, 'WRITE'))
  and (
    employee_id <> (select internal_security.current_employee_id())
    or (select internal_security.current_user_has_permission(tenant_id, null, 'talent-review:manage'))
  )
);

revoke insert, update on public.talent_review_campaigns from authenticated;
grant insert (tenant_id, administration_id, name, description, starts_on, ends_on, previous_campaign_id, review_mode, created_by_user_id, updated_by_user_id)
  on public.talent_review_campaigns to authenticated;
grant update (name, description, starts_on, ends_on, previous_campaign_id, review_mode, version, updated_by_user_id)
  on public.talent_review_campaigns to authenticated;

revoke update on public.talent_review_assignments from authenticated;
grant update (reminder_id, last_reminded_at, version)
  on public.talent_review_assignments to authenticated;

revoke insert, update on public.talent_review_scores from authenticated;
grant insert (tenant_id, campaign_id, assignment_id, employee_id, manager_employee_id, performance_score, potential_score, grid_cell, note, employee_snapshot, created_by_user_id, updated_by_user_id, acting_reason)
  on public.talent_review_scores to authenticated;
grant update (performance_score, potential_score, grid_cell, note, version, updated_by_user_id, acting_reason)
  on public.talent_review_scores to authenticated;

create or replace function internal_security.validate_talent_review_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  campaign_row public.talent_review_campaigns;
  assignment_row public.talent_review_assignments;
  member_assignment_id uuid;
  member_manager_id uuid;
  is_hr boolean;
  is_manager boolean;
  is_closing boolean := false;
begin
  select campaign.* into campaign_row
  from public.talent_review_campaigns campaign
  where campaign.tenant_id = new.tenant_id and campaign.id = new.campaign_id;
  if campaign_row.id is null then raise exception 'TALENT_REVIEW_CAMPAIGN_NOT_FOUND'; end if;
  if tg_op = 'UPDATE' then
    is_closing := new.status = 'CLOSED'
      and old.status = 'SUBMITTED'
      and campaign_row.status in ('ACTIVE', 'HR_REVIEW');
  end if;
  if campaign_row.status <> 'ACTIVE' and not is_closing then raise exception 'TALENT_REVIEW_CAMPAIGN_LOCKED'; end if;

  select assignment.* into assignment_row
  from public.talent_review_assignments assignment
  where assignment.tenant_id = new.tenant_id
    and assignment.campaign_id = new.campaign_id
    and assignment.id = new.assignment_id;
  if assignment_row.id is null then raise exception 'TALENT_REVIEW_ASSIGNMENT_NOT_FOUND'; end if;
  if assignment_row.status = 'SUBMITTED' and not is_closing then raise exception 'TALENT_REVIEW_ASSIGNMENT_ALREADY_SUBMITTED'; end if;

  select member.assignment_id, member.manager_employee_id
    into member_assignment_id, member_manager_id
  from public.talent_review_assignment_members member
  where member.tenant_id = new.tenant_id
    and member.campaign_id = new.campaign_id
    and member.employee_id = new.employee_id;
  if member_assignment_id is null or member_assignment_id <> new.assignment_id or member_manager_id <> new.manager_employee_id then
    raise exception 'TALENT_REVIEW_MEMBER_SCOPE_INVALID';
  end if;
  if new.employee_id = new.manager_employee_id then raise exception 'TALENT_REVIEW_SELF_SCOPE_INVALID'; end if;
  if (select auth.uid()) is null then raise exception 'TALENT_REVIEW_FORBIDDEN'; end if;
  if tg_op = 'INSERT' then
    new.created_by_user_id := (select auth.uid());
  elsif new.created_by_user_id is distinct from old.created_by_user_id then
    raise exception 'TALENT_REVIEW_ACTOR_IMMUTABLE';
  end if;
  new.updated_by_user_id := (select auth.uid());

  is_hr := internal_security.current_user_has_permission(campaign_row.tenant_id, campaign_row.administration_id, 'talent-review:manage');
  is_manager := assignment_row.manager_employee_id = internal_security.current_employee_id()
    and internal_security.current_user_has_permission(campaign_row.tenant_id, campaign_row.administration_id, 'talent-review:write');
  if not (
    (campaign_row.review_mode = 'HR_ONLY' and is_hr)
    or (campaign_row.review_mode = 'MANAGER_ONLY' and is_manager)
    or (campaign_row.review_mode = 'HYBRID' and (is_hr or is_manager))
  ) then raise exception 'TALENT_REVIEW_FORBIDDEN'; end if;

  if tg_op = 'INSERT' and new.status <> 'DRAFT' then raise exception 'TALENT_REVIEW_STATUS_TRANSITION_INVALID'; end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'SUBMITTED'
      and old.status = 'DRAFT'
      and assignment_row.status = 'SUBMITTED'
      and assignment_row.submitted_by_user_id = (select auth.uid())
      and assignment_row.submitted_at = transaction_timestamp() then
      null;
    elsif new.status = 'CLOSED'
      and old.status = 'SUBMITTED'
      and assignment_row.status = 'SUBMITTED'
      and is_hr then
      null;
    elsif new.status = 'DRAFT'
      and old.status in ('SUBMITTED', 'CLOSED')
      and assignment_row.status = 'RETURNED'
      and assignment_row.returned_by_user_id = (select auth.uid())
      and assignment_row.returned_at = transaction_timestamp() then
      null;
    else
      raise exception 'TALENT_REVIEW_STATUS_TRANSITION_INVALID';
    end if;
  end if;
  if new.performance_score is null or new.potential_score is null then
    new.grid_cell := null;
  else
    new.grid_cell := new.performance_score || '_' || new.potential_score;
  end if;
  if tg_op = 'UPDATE' and new.version <> old.version + 1 then raise exception 'TALENT_REVIEW_VERSION_CONFLICT'; end if;
  return new;
end;
$$;

drop function if exists public.activate_due_talent_review_campaigns(uuid);
create function public.activate_due_talent_review_campaigns(
  requested_tenant_id uuid,
  requested_administration_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  activated_count integer;
begin
  if (select auth.uid()) is null
    or not internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, 'talent-review:read') then
    raise exception 'TALENT_REVIEW_FORBIDDEN';
  end if;
  update public.talent_review_campaigns campaign
  set status = 'ACTIVE', version = version + 1, updated_by_user_id = (select auth.uid()), updated_at = timezone('utc', now())
  where campaign.tenant_id = requested_tenant_id
    and campaign.administration_id = requested_administration_id
    and campaign.status = 'SCHEDULED'
    and campaign.starts_on <= current_date
    and (
      internal_security.current_user_has_permission(campaign.tenant_id, campaign.administration_id, 'talent-review:manage')
      or (
        campaign.review_mode <> 'HR_ONLY'
        and exists (
          select 1 from public.talent_review_assignments assignment
          where assignment.tenant_id = campaign.tenant_id
            and assignment.campaign_id = campaign.id
            and assignment.manager_employee_id = internal_security.current_employee_id()
            and internal_security.current_user_has_permission(campaign.tenant_id, campaign.administration_id, 'talent-review:read')
        )
      )
    );
  get diagnostics activated_count = row_count;
  return activated_count;
end;
$$;

revoke all on function public.activate_due_talent_review_campaigns(uuid, uuid) from public, anon;
grant execute on function public.activate_due_talent_review_campaigns(uuid, uuid) to authenticated;

-- Keep the pre-V2 server RPC callable while narrowing it to administraties the
-- authenticated caller can already read. The exact RPC above rechecks access.
create or replace function public.activate_due_talent_review_campaigns(requested_tenant_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_administration_id uuid;
  activated_total integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'TALENT_REVIEW_FORBIDDEN';
  end if;
  for target_administration_id in
    select distinct campaign.administration_id
    from public.talent_review_campaigns campaign
    where campaign.tenant_id = requested_tenant_id
      and campaign.administration_id is not null
      and campaign.status = 'SCHEDULED'
      and campaign.starts_on <= current_date
  loop
    activated_total := activated_total + public.activate_due_talent_review_campaigns(requested_tenant_id, target_administration_id);
  end loop;
  return activated_total;
end;
$$;

revoke all on function public.activate_due_talent_review_campaigns(uuid) from public, anon;
grant execute on function public.activate_due_talent_review_campaigns(uuid) to authenticated;

create or replace function public.start_talent_review_campaign(requested_campaign_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
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
  if campaign_row.administration_id is null then raise exception 'TALENT_REVIEW_ADMINISTRATION_REQUIRED'; end if;
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
        and placement.administration_id = campaign_row.administration_id
        and placement.direct_manager_id is not null
        and placement.employee_id <> placement.direct_manager_id
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
          and placement.administration_id = campaign_row.administration_id
          and placement.employee_id <> placement.direct_manager_id
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

    if campaign_row.review_mode <> 'HR_ONLY' then
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
    end if;
  end loop;

  return campaign_row.id;
end;
$$;

revoke all on function public.start_talent_review_campaign(uuid) from public, anon;
grant execute on function public.start_talent_review_campaign(uuid) to authenticated;

create or replace function public.submit_talent_review_assignment(
  requested_campaign_id uuid,
  requested_assignment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  campaign_row public.talent_review_campaigns;
  assignment_row public.talent_review_assignments;
  member_count integer;
  complete_count integer;
  is_hr boolean;
  is_manager boolean;
begin
  select * into campaign_row
  from public.talent_review_campaigns campaign
  where campaign.id = requested_campaign_id
  for update;
  if campaign_row.id is null then raise exception 'TALENT_REVIEW_CAMPAIGN_NOT_FOUND'; end if;
  if campaign_row.administration_id is null then raise exception 'TALENT_REVIEW_ADMINISTRATION_REQUIRED'; end if;
  if campaign_row.status <> 'ACTIVE' then raise exception 'TALENT_REVIEW_CAMPAIGN_LOCKED'; end if;

  select * into assignment_row
  from public.talent_review_assignments assignment
  where assignment.tenant_id = campaign_row.tenant_id
    and assignment.campaign_id = campaign_row.id
    and assignment.id = requested_assignment_id
  for update;
  if assignment_row.id is null then raise exception 'TALENT_REVIEW_ASSIGNMENT_NOT_FOUND'; end if;
  if assignment_row.status = 'SUBMITTED' then raise exception 'TALENT_REVIEW_ASSIGNMENT_ALREADY_SUBMITTED'; end if;

  is_hr := internal_security.current_user_has_permission(campaign_row.tenant_id, campaign_row.administration_id, 'talent-review:manage');
  is_manager := assignment_row.manager_employee_id = internal_security.current_employee_id()
    and internal_security.current_user_has_permission(campaign_row.tenant_id, campaign_row.administration_id, 'talent-review:write');
  if not (
    (campaign_row.review_mode = 'HR_ONLY' and is_hr)
    or (campaign_row.review_mode = 'MANAGER_ONLY' and is_manager)
    or (campaign_row.review_mode = 'HYBRID' and (is_hr or is_manager))
  ) then raise exception 'TALENT_REVIEW_FORBIDDEN'; end if;

  select count(*) into member_count
  from public.talent_review_assignment_members member
  where member.tenant_id = campaign_row.tenant_id and member.assignment_id = assignment_row.id;
  if member_count = 0 then raise exception 'TALENT_REVIEW_ASSIGNMENT_INCOMPLETE'; end if;
  select count(*) into complete_count
  from public.talent_review_assignment_members member
  join public.talent_review_scores score
    on score.tenant_id = member.tenant_id
   and score.assignment_id = member.assignment_id
   and score.employee_id = member.employee_id
  where member.tenant_id = campaign_row.tenant_id
    and member.assignment_id = assignment_row.id
    and score.performance_score is not null
    and score.potential_score is not null;
  if complete_count <> member_count then raise exception 'TALENT_REVIEW_SCORES_INCOMPLETE'; end if;

  update public.talent_review_assignments
  set status = 'SUBMITTED', submitted_at = transaction_timestamp(), submitted_by_user_id = (select auth.uid()),
      return_reason = null, returned_at = null, returned_by_user_id = null, version = version + 1
  where tenant_id = campaign_row.tenant_id and id = assignment_row.id;
  update public.talent_review_scores
  set status = 'SUBMITTED', version = version + 1, updated_by_user_id = (select auth.uid())
  where tenant_id = campaign_row.tenant_id and assignment_id = assignment_row.id;

  if not exists (
    select 1 from public.talent_review_assignments assignment
    where assignment.tenant_id = campaign_row.tenant_id
      and assignment.campaign_id = campaign_row.id
      and assignment.status <> 'SUBMITTED'
  ) then
    update public.talent_review_campaigns
    set status = 'HR_REVIEW', version = version + 1, updated_by_user_id = (select auth.uid())
    where tenant_id = campaign_row.tenant_id and id = campaign_row.id;
  end if;
  return assignment_row.id;
end;
$$;

revoke all on function public.submit_talent_review_assignment(uuid, uuid) from public, anon;
grant execute on function public.submit_talent_review_assignment(uuid, uuid) to authenticated;

create or replace function public.return_talent_review_assignment(
  requested_campaign_id uuid,
  requested_assignment_id uuid,
  requested_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  campaign_row public.talent_review_campaigns;
  assignment_row public.talent_review_assignments;
begin
  if requested_reason is null or char_length(btrim(requested_reason)) not between 1 and 1000 then
    raise exception 'TALENT_REVIEW_RETURN_REASON_REQUIRED';
  end if;
  select * into campaign_row
  from public.talent_review_campaigns campaign
  where campaign.id = requested_campaign_id
  for update;
  if campaign_row.id is null then raise exception 'TALENT_REVIEW_CAMPAIGN_NOT_FOUND'; end if;
  if campaign_row.administration_id is null then raise exception 'TALENT_REVIEW_ADMINISTRATION_REQUIRED'; end if;
  if not internal_security.current_user_has_permission(campaign_row.tenant_id, campaign_row.administration_id, 'talent-review:manage') then raise exception 'TALENT_REVIEW_FORBIDDEN'; end if;
  if campaign_row.status not in ('ACTIVE', 'HR_REVIEW') then raise exception 'TALENT_REVIEW_CAMPAIGN_LOCKED'; end if;

  select * into assignment_row
  from public.talent_review_assignments assignment
  where assignment.tenant_id = campaign_row.tenant_id
    and assignment.campaign_id = campaign_row.id
    and assignment.id = requested_assignment_id
  for update;
  if assignment_row.id is null then raise exception 'TALENT_REVIEW_ASSIGNMENT_NOT_FOUND'; end if;
  if assignment_row.status <> 'SUBMITTED' then raise exception 'TALENT_REVIEW_ASSIGNMENT_RETURN_INVALID'; end if;

  update public.talent_review_campaigns
  set status = 'ACTIVE', version = version + 1, updated_by_user_id = (select auth.uid())
  where tenant_id = campaign_row.tenant_id and id = campaign_row.id and status = 'HR_REVIEW';
  update public.talent_review_assignments
  set status = 'RETURNED', return_reason = btrim(requested_reason), returned_at = transaction_timestamp(),
      returned_by_user_id = (select auth.uid()), version = version + 1
  where tenant_id = campaign_row.tenant_id and id = assignment_row.id;
  update public.talent_review_scores
  set status = 'DRAFT', version = version + 1, updated_by_user_id = (select auth.uid())
  where tenant_id = campaign_row.tenant_id and assignment_id = assignment_row.id;
  return assignment_row.id;
end;
$$;

revoke all on function public.return_talent_review_assignment(uuid, uuid, text) from public, anon;
grant execute on function public.return_talent_review_assignment(uuid, uuid, text) to authenticated;

create or replace function public.close_talent_review_campaign(requested_campaign_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  campaign_row public.talent_review_campaigns;
  assignment_count integer;
begin
  select * into campaign_row
  from public.talent_review_campaigns campaign
  where campaign.id = requested_campaign_id
  for update;
  if campaign_row.id is null then raise exception 'TALENT_REVIEW_CAMPAIGN_NOT_FOUND'; end if;
  if campaign_row.administration_id is null then raise exception 'TALENT_REVIEW_ADMINISTRATION_REQUIRED'; end if;
  if not internal_security.current_user_has_permission(campaign_row.tenant_id, campaign_row.administration_id, 'talent-review:manage') then raise exception 'TALENT_REVIEW_FORBIDDEN'; end if;
  if campaign_row.status not in ('ACTIVE', 'HR_REVIEW') then raise exception 'TALENT_REVIEW_CAMPAIGN_CLOSE_INVALID'; end if;

  select count(*) into assignment_count
  from public.talent_review_assignments assignment
  where assignment.tenant_id = campaign_row.tenant_id and assignment.campaign_id = campaign_row.id;
  if assignment_count = 0 then raise exception 'TALENT_REVIEW_ASSIGNMENTS_INCOMPLETE'; end if;
  if exists (
    select 1 from public.talent_review_assignments assignment
    where assignment.tenant_id = campaign_row.tenant_id
      and assignment.campaign_id = campaign_row.id
      and assignment.status <> 'SUBMITTED'
  ) then raise exception 'TALENT_REVIEW_ASSIGNMENTS_INCOMPLETE'; end if;
  if exists (
    select 1
    from public.talent_review_assignment_members member
    left join public.talent_review_scores score
      on score.tenant_id = member.tenant_id
     and score.assignment_id = member.assignment_id
     and score.employee_id = member.employee_id
    where member.tenant_id = campaign_row.tenant_id
      and member.campaign_id = campaign_row.id
      and (score.id is null or score.performance_score is null or score.potential_score is null or score.status <> 'SUBMITTED')
  ) then raise exception 'TALENT_REVIEW_SCORES_INCOMPLETE'; end if;

  update public.talent_review_scores
  set status = 'CLOSED', version = version + 1, updated_by_user_id = (select auth.uid())
  where tenant_id = campaign_row.tenant_id and campaign_id = campaign_row.id;
  update public.talent_review_campaigns
  set status = 'CLOSED', closed_at = transaction_timestamp(), closed_by_user_id = (select auth.uid()),
      version = version + 1, updated_by_user_id = (select auth.uid())
  where tenant_id = campaign_row.tenant_id and id = campaign_row.id;
  return campaign_row.id;
end;
$$;

revoke all on function public.close_talent_review_campaign(uuid) from public, anon;
grant execute on function public.close_talent_review_campaign(uuid) to authenticated;

create or replace function public.reopen_talent_review_campaign(requested_campaign_id uuid, requested_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  campaign_row public.talent_review_campaigns;
begin
  if requested_reason is null or char_length(btrim(requested_reason)) not between 1 and 1000 then
    raise exception 'TALENT_REVIEW_RETURN_REASON_REQUIRED';
  end if;
  select * into campaign_row
  from public.talent_review_campaigns campaign
  where campaign.id = requested_campaign_id
  for update;
  if campaign_row.id is null then raise exception 'TALENT_REVIEW_CAMPAIGN_NOT_FOUND'; end if;
  if campaign_row.administration_id is null then raise exception 'TALENT_REVIEW_ADMINISTRATION_REQUIRED'; end if;
  if not internal_security.current_user_has_permission(campaign_row.tenant_id, campaign_row.administration_id, 'talent-review:manage') then raise exception 'TALENT_REVIEW_FORBIDDEN'; end if;
  if campaign_row.status <> 'CLOSED' then raise exception 'TALENT_REVIEW_CAMPAIGN_REOPEN_INVALID'; end if;

  update public.talent_review_campaigns
  set status = 'ACTIVE', reopened_at = transaction_timestamp(), closed_at = null, closed_by_user_id = null,
      version = version + 1, updated_by_user_id = (select auth.uid())
  where tenant_id = campaign_row.tenant_id and id = campaign_row.id;
  update public.talent_review_assignments
  set status = 'RETURNED', return_reason = btrim(requested_reason), returned_at = transaction_timestamp(),
      returned_by_user_id = (select auth.uid()), version = version + 1
  where tenant_id = campaign_row.tenant_id and campaign_id = campaign_row.id;
  update public.talent_review_scores
  set status = 'DRAFT', version = version + 1, updated_by_user_id = (select auth.uid())
  where tenant_id = campaign_row.tenant_id and campaign_id = campaign_row.id;
  return campaign_row.id;
end;
$$;

revoke all on function public.reopen_talent_review_campaign(uuid, text) from public, anon;
grant execute on function public.reopen_talent_review_campaign(uuid, text) to authenticated;

-- Older app servers cannot send the new reason argument. Preserve that RPC with
-- a truthful audit reason while delegating all authorization to the V2 command.
create or replace function public.reopen_talent_review_campaign(requested_campaign_id uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select public.reopen_talent_review_campaign(
    requested_campaign_id,
    'Legacy client requested reopen without a supplied reason.'
  );
$$;

revoke all on function public.reopen_talent_review_campaign(uuid) from public, anon;
grant execute on function public.reopen_talent_review_campaign(uuid) to authenticated;

commit;
