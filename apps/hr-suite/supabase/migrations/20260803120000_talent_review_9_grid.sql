begin;

-- FDR-0004: campaign-based 9-grid for HR Admin and direct Managers.
create table public.talent_review_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text check (description is null or char_length(description) <= 2000),
  starts_on date not null,
  ends_on date not null,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'SCHEDULED', 'ACTIVE', 'HR_REVIEW', 'CLOSED', 'ARCHIVED')),
  previous_campaign_id uuid,
  version integer not null default 1 check (version > 0),
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  closed_at timestamptz,
  closed_by_user_id uuid references auth.users(id) on delete set null,
  reopened_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, id),
  constraint talent_review_campaigns_administration_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete cascade,
  constraint talent_review_campaigns_previous_fkey
    foreign key (tenant_id, previous_campaign_id)
    references public.talent_review_campaigns(tenant_id, id) on delete restrict,
  check (ends_on > starts_on)
);

create table public.talent_review_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid not null,
  manager_employee_id uuid not null,
  status text not null default 'NOT_STARTED'
    check (status in ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'RETURNED')),
  employee_count integer not null default 0 check (employee_count >= 0),
  scored_count integer not null default 0 check (scored_count >= 0),
  submitted_at timestamptz,
  submitted_by_user_id uuid references auth.users(id) on delete set null,
  reminder_id uuid,
  last_reminded_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, id),
  unique (tenant_id, campaign_id, manager_employee_id),
  foreign key (tenant_id, campaign_id)
    references public.talent_review_campaigns(tenant_id, id) on delete cascade,
  foreign key (tenant_id, manager_employee_id)
    references public.employees(tenant_id, id) on delete restrict,
  foreign key (tenant_id, reminder_id)
    references public.reminders(tenant_id, id) on delete set null
);

create table public.talent_review_assignment_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  assignment_id uuid not null,
  campaign_id uuid not null,
  manager_employee_id uuid not null,
  employee_id uuid not null,
  employee_snapshot jsonb not null check (jsonb_typeof(employee_snapshot) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  constraint talent_review_assignment_members_no_self_check check (employee_id <> manager_employee_id),
  unique (tenant_id, id),
  unique (tenant_id, campaign_id, employee_id),
  foreign key (tenant_id, assignment_id)
    references public.talent_review_assignments(tenant_id, id) on delete cascade,
  foreign key (tenant_id, campaign_id)
    references public.talent_review_campaigns(tenant_id, id) on delete cascade,
  foreign key (tenant_id, manager_employee_id)
    references public.employees(tenant_id, id) on delete restrict,
  foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id) on delete restrict
);

create table public.talent_review_scores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid not null,
  assignment_id uuid not null,
  employee_id uuid not null,
  manager_employee_id uuid not null,
  performance_score text check (performance_score is null or performance_score in ('LOW', 'NORMAL', 'HIGH')),
  potential_score text check (potential_score is null or potential_score in ('LOW', 'NORMAL', 'HIGH')),
  grid_cell text,
  note text check (note is null or char_length(note) <= 4000),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SUBMITTED', 'CLOSED')),
  employee_snapshot jsonb not null check (jsonb_typeof(employee_snapshot) = 'object'),
  version integer not null default 1 check (version > 0),
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint talent_review_scores_no_self_check check (employee_id <> manager_employee_id),
  unique (tenant_id, id),
  unique (tenant_id, campaign_id, employee_id),
  foreign key (tenant_id, campaign_id)
    references public.talent_review_campaigns(tenant_id, id) on delete cascade,
  foreign key (tenant_id, assignment_id)
    references public.talent_review_assignments(tenant_id, id) on delete cascade,
  foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id) on delete restrict,
  foreign key (tenant_id, manager_employee_id)
    references public.employees(tenant_id, id) on delete restrict
);

create index talent_review_campaigns_tenant_status_idx
  on public.talent_review_campaigns (tenant_id, status, starts_on desc);
create index talent_review_assignments_campaign_status_idx
  on public.talent_review_assignments (tenant_id, campaign_id, status, manager_employee_id);
create index talent_review_assignment_members_assignment_idx
  on public.talent_review_assignment_members (tenant_id, assignment_id, employee_id);
create index talent_review_scores_campaign_cell_idx
  on public.talent_review_scores (tenant_id, campaign_id, grid_cell, status);
create index talent_review_scores_employee_idx
  on public.talent_review_scores (tenant_id, employee_id, created_at desc);
create index talent_review_campaigns_administration_fk_idx
  on public.talent_review_campaigns (tenant_id, administration_id);
create index talent_review_campaigns_previous_fk_idx
  on public.talent_review_campaigns (tenant_id, previous_campaign_id);
create index talent_review_campaigns_created_by_fk_idx
  on public.talent_review_campaigns (created_by_user_id);
create index talent_review_campaigns_updated_by_fk_idx
  on public.talent_review_campaigns (updated_by_user_id);
create index talent_review_campaigns_closed_by_fk_idx
  on public.talent_review_campaigns (closed_by_user_id);
create index talent_review_assignments_manager_fk_idx
  on public.talent_review_assignments (tenant_id, manager_employee_id);
create index talent_review_assignments_submitted_by_fk_idx
  on public.talent_review_assignments (submitted_by_user_id);
create index talent_review_assignments_reminder_fk_idx
  on public.talent_review_assignments (tenant_id, reminder_id);
create index talent_review_assignment_members_manager_fk_idx
  on public.talent_review_assignment_members (tenant_id, manager_employee_id);
create index talent_review_assignment_members_employee_fk_idx
  on public.talent_review_assignment_members (tenant_id, employee_id);
create index talent_review_scores_assignment_fk_idx
  on public.talent_review_scores (tenant_id, assignment_id);
create index talent_review_scores_manager_fk_idx
  on public.talent_review_scores (tenant_id, manager_employee_id);
create index talent_review_scores_created_by_fk_idx
  on public.talent_review_scores (created_by_user_id);
create index talent_review_scores_updated_by_fk_idx
  on public.talent_review_scores (updated_by_user_id);

create or replace function internal_security.validate_talent_review_score()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  campaign_status text;
  member_assignment_id uuid;
  member_manager_id uuid;
begin
  select campaign.status into campaign_status
  from public.talent_review_campaigns campaign
  where campaign.tenant_id = new.tenant_id and campaign.id = new.campaign_id;
  if campaign_status is null then raise exception 'TALENT_REVIEW_CAMPAIGN_NOT_FOUND'; end if;
  if campaign_status in ('CLOSED', 'ARCHIVED') then raise exception 'TALENT_REVIEW_CAMPAIGN_LOCKED'; end if;

  select member.assignment_id, member.manager_employee_id
    into member_assignment_id, member_manager_id
  from public.talent_review_assignment_members member
  where member.tenant_id = new.tenant_id
    and member.campaign_id = new.campaign_id
    and member.employee_id = new.employee_id;
  if member_assignment_id is null or member_assignment_id <> new.assignment_id or member_manager_id <> new.manager_employee_id then
    raise exception 'TALENT_REVIEW_MEMBER_SCOPE_INVALID';
  end if;
  if new.employee_id = new.manager_employee_id then
    raise exception 'TALENT_REVIEW_SELF_SCOPE_INVALID';
  end if;
  if new.status = 'SUBMITTED' and (new.performance_score is null or new.potential_score is null) then
    raise exception 'TALENT_REVIEW_SCORE_INCOMPLETE';
  end if;
  if new.performance_score is null or new.potential_score is null then
    new.grid_cell := null;
  else
    new.grid_cell := new.performance_score || '_' || new.potential_score;
  end if;
  if tg_op = 'UPDATE' and new.version <> old.version + 1 then
    raise exception 'TALENT_REVIEW_VERSION_CONFLICT';
  end if;
  return new;
end;
$$;

revoke all on function internal_security.validate_talent_review_score() from public, anon, authenticated;
create trigger validate_talent_review_score
before insert or update on public.talent_review_scores
for each row execute function internal_security.validate_talent_review_score();

create or replace function internal_security.sync_talent_review_assignment_progress()
returns trigger
language plpgsql
security invoker
set search_path = public, auth, pg_temp
as $$
declare
  target_assignment_id uuid := coalesce(new.assignment_id, old.assignment_id);
  tenant_value uuid := coalesce(new.tenant_id, old.tenant_id);
  target_count integer;
  complete_count integer;
  current_status text;
begin
  if tg_op = 'DELETE' then
    target_assignment_id := old.assignment_id;
    tenant_value := old.tenant_id;
  end if;
  select count(*) into target_count
  from public.talent_review_assignment_members member
  where member.tenant_id = tenant_value and member.assignment_id = target_assignment_id;
  select count(*) into complete_count
  from public.talent_review_scores score
  where score.tenant_id = tenant_value
    and score.assignment_id = target_assignment_id
    and score.performance_score is not null
    and score.potential_score is not null;
  select assignment.status into current_status
  from public.talent_review_assignments assignment
  where assignment.tenant_id = tenant_value
    and assignment.id = target_assignment_id;
  if current_status is null or current_status in ('SUBMITTED', 'RETURNED') then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  update public.talent_review_assignments
  set employee_count = target_count,
      scored_count = complete_count,
      status = case when complete_count = 0 then 'NOT_STARTED' else 'IN_PROGRESS' end,
      updated_at = timezone('utc', now())
  where tenant_id = tenant_value and id = target_assignment_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function internal_security.sync_talent_review_assignment_progress() from public, anon, authenticated;
create trigger sync_talent_review_assignment_progress
after insert or update or delete on public.talent_review_scores
for each row execute function internal_security.sync_talent_review_assignment_progress();

create or replace function internal_security.audit_talent_review_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  audit_action text := case when tg_op = 'INSERT' then 'CREATE' when tg_op = 'DELETE' then 'DELETE' else 'UPDATE' end;
  before_data jsonb := case when tg_op = 'UPDATE' or tg_op = 'DELETE' then to_jsonb(old) else '{}'::jsonb end;
  after_data jsonb := case when tg_op = 'INSERT' or tg_op = 'UPDATE' then to_jsonb(new) else '{}'::jsonb end;
  tenant_value uuid := coalesce(new.tenant_id, old.tenant_id);
  entity_value uuid := coalesce(new.id, old.id);
begin
  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (tenant_value, tg_table_name, entity_value, (select auth.uid()), audit_action,
    jsonb_build_object('before', before_data, 'after', after_data, 'source', 'TALENT_REVIEW'));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function internal_security.audit_talent_review_change() from public, anon, authenticated;
create trigger audit_talent_review_campaigns after insert or update or delete on public.talent_review_campaigns for each row execute function internal_security.audit_talent_review_change();
create trigger audit_talent_review_assignments after insert or update or delete on public.talent_review_assignments for each row execute function internal_security.audit_talent_review_change();
create trigger audit_talent_review_scores after insert or update or delete on public.talent_review_scores for each row execute function internal_security.audit_talent_review_change();

create trigger set_talent_review_campaigns_updated_at before update on public.talent_review_campaigns for each row execute function internal_security.set_updated_at();
create trigger set_talent_review_assignments_updated_at before update on public.talent_review_assignments for each row execute function internal_security.set_updated_at();
create trigger set_talent_review_scores_updated_at before update on public.talent_review_scores for each row execute function internal_security.set_updated_at();

alter table public.talent_review_campaigns enable row level security;
alter table public.talent_review_assignments enable row level security;
alter table public.talent_review_assignment_members enable row level security;
alter table public.talent_review_scores enable row level security;

revoke all on public.talent_review_campaigns, public.talent_review_assignments, public.talent_review_assignment_members, public.talent_review_scores from public, anon;

create policy talent_review_campaigns_select on public.talent_review_campaigns for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, administration_id, 'talent-review:manage'))
  or (
    (select internal_security.current_user_has_permission(tenant_id, administration_id, 'talent-review:read'))
    and exists (select 1 from public.talent_review_assignments assignment where assignment.tenant_id = talent_review_campaigns.tenant_id and assignment.campaign_id = talent_review_campaigns.id and assignment.manager_employee_id = (select internal_security.current_employee_id()))
  )
);
create policy talent_review_campaigns_insert on public.talent_review_campaigns for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'talent-review:manage')));
create policy talent_review_campaigns_update on public.talent_review_campaigns for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'talent-review:manage')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'talent-review:manage')));

create policy talent_review_assignments_select on public.talent_review_assignments for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-review:manage'))
  or (manager_employee_id = (select internal_security.current_employee_id()) and (select internal_security.current_user_has_permission(tenant_id, null, 'talent-review:read')))
);
create policy talent_review_assignments_update on public.talent_review_assignments for update to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-review:manage'))
  or (manager_employee_id = (select internal_security.current_employee_id()) and (select internal_security.current_user_has_permission(tenant_id, null, 'talent-review:write')))
)
with check (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-review:manage'))
  or (manager_employee_id = (select internal_security.current_employee_id()) and (select internal_security.current_user_has_permission(tenant_id, null, 'talent-review:write')))
);

create policy talent_review_assignment_members_select on public.talent_review_assignment_members for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-review:manage'))
  or (manager_employee_id = (select internal_security.current_employee_id())
    and employee_id <> (select internal_security.current_employee_id())
    and (select internal_security.current_user_has_permission(tenant_id, null, 'talent-review:read')))
);

create policy talent_review_scores_select on public.talent_review_scores for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-review:manage'))
  or (manager_employee_id = (select internal_security.current_employee_id())
    and employee_id <> (select internal_security.current_employee_id())
    and (select internal_security.current_user_has_permission(tenant_id, null, 'talent-review:read')))
  or (
    (select internal_security.current_user_has_permission(tenant_id, null, 'talent-review:read'))
    and employee_id <> (select internal_security.current_employee_id())
    and exists (
      select 1
      from public.talent_review_assignment_members current_member
      join public.talent_review_assignments current_assignment on current_assignment.tenant_id = current_member.tenant_id and current_assignment.id = current_member.assignment_id
      where current_member.tenant_id = talent_review_scores.tenant_id
        and current_member.employee_id = talent_review_scores.employee_id
        and current_member.employee_id <> (select internal_security.current_employee_id())
        and current_assignment.manager_employee_id = (select internal_security.current_employee_id())
        and current_assignment.campaign_id <> talent_review_scores.campaign_id
    )
  )
);
create policy talent_review_scores_insert on public.talent_review_scores for insert to authenticated
with check (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-review:manage'))
  or (manager_employee_id = (select internal_security.current_employee_id())
    and employee_id <> (select internal_security.current_employee_id())
    and (select internal_security.current_user_has_permission(tenant_id, null, 'talent-review:write')))
);
create policy talent_review_scores_update on public.talent_review_scores for update to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-review:manage'))
  or (manager_employee_id = (select internal_security.current_employee_id())
    and employee_id <> (select internal_security.current_employee_id())
    and (select internal_security.current_user_has_permission(tenant_id, null, 'talent-review:write')))
)
with check (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-review:manage'))
  or (manager_employee_id = (select internal_security.current_employee_id())
    and employee_id <> (select internal_security.current_employee_id())
    and (select internal_security.current_user_has_permission(tenant_id, null, 'talent-review:write')))
);

grant select, insert, update on public.talent_review_campaigns to authenticated;
grant select, update on public.talent_review_assignments to authenticated;
grant select on public.talent_review_assignment_members to authenticated;
grant select, insert, update on public.talent_review_scores to authenticated;

insert into public.permissions (code, name, category, description)
values
  ('talent-review:manage', 'Vlootschouw beheren', 'Talent', 'Maakt, start, sluit en heropent 9-gridcampagnes en ziet tenantbrede voortgang.'),
  ('talent-review:read', 'Vlootschouw lezen', 'Talent', 'Leest toegewezen 9-gridcampagnes en het eigen team.'),
  ('talent-review:write', 'Vlootschouw invullen', 'Talent', 'Slaat 9-gridscores op voor het eigen toegewezen team.')
on conflict (code) do update set name = excluded.name, category = excluded.category, description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code in ('TENANT_ADMIN', 'HR_ADMIN')
  and permission.code in ('talent-review:manage', 'talent-review:read', 'talent-review:write')
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'DIRECT_MANAGER'
  and permission.code in ('talent-review:read', 'talent-review:write')
on conflict do nothing;

create or replace function internal_security.activate_due_talent_review_campaigns(requested_tenant_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  activated_count integer;
begin
  update public.talent_review_campaigns campaign
  set status = 'ACTIVE', version = version + 1, updated_by_user_id = (select auth.uid()), updated_at = timezone('utc', now())
  where campaign.tenant_id = requested_tenant_id
    and campaign.status = 'SCHEDULED'
    and campaign.starts_on <= current_date
    and (
      internal_security.current_user_has_permission(campaign.tenant_id, campaign.administration_id, 'talent-review:manage')
      or exists (
        select 1
        from public.talent_review_assignments assignment
        where assignment.tenant_id = campaign.tenant_id
          and assignment.campaign_id = campaign.id
          and assignment.manager_employee_id = internal_security.current_employee_id()
          and internal_security.current_user_has_permission(campaign.tenant_id, campaign.administration_id, 'talent-review:read')
      )
    );
  get diagnostics activated_count = row_count;
  return activated_count;
end;
$$;

revoke all on function internal_security.activate_due_talent_review_campaigns(uuid) from public, anon, authenticated;
grant execute on function internal_security.activate_due_talent_review_campaigns(uuid) to authenticated;

create or replace function public.activate_due_talent_review_campaigns(requested_tenant_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public, internal_security, auth, pg_temp
as $$
begin
  return internal_security.activate_due_talent_review_campaigns(requested_tenant_id);
end;
$$;

revoke all on function public.activate_due_talent_review_campaigns(uuid) from public, anon;
grant execute on function public.activate_due_talent_review_campaigns(uuid) to authenticated;

create or replace function public.start_talent_review_campaign(requested_campaign_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public, auth, pg_temp
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
    select distinct placement.direct_manager_id as manager_employee_id
    from public.employee_organizations placement
    join public.employees employee on employee.tenant_id = placement.tenant_id and employee.id = placement.employee_id
    where placement.tenant_id = campaign_row.tenant_id
      and placement.direct_manager_id is not null
      and placement.employee_id <> placement.direct_manager_id
      and (campaign_row.administration_id is null or placement.administration_id = campaign_row.administration_id)
      and placement.effective_from <= current_date
      and (placement.effective_to is null or placement.effective_to >= current_date)
      and employee.is_active
      and not employee.is_archived
      and employee.deleted_at is null
  loop
    insert into public.talent_review_assignments (tenant_id, campaign_id, manager_employee_id)
    values (campaign_row.tenant_id, campaign_row.id, assignment_row.manager_employee_id)
    returning id into created_assignment_id;

    for current_placement in
      select distinct on (placement.employee_id)
        placement.employee_id, placement.direct_manager_id, placement.job_title, placement.department_id,
        employee.first_name, employee.birth_name, employee.employee_number, employee.avatar_url
      from public.employee_organizations placement
      join public.employees employee on employee.tenant_id = placement.tenant_id and employee.id = placement.employee_id
      where placement.tenant_id = campaign_row.tenant_id
        and placement.direct_manager_id = assignment_row.manager_employee_id
        and placement.employee_id <> assignment_row.manager_employee_id
        and (campaign_row.administration_id is null or placement.administration_id = campaign_row.administration_id)
        and placement.effective_from <= current_date
        and (placement.effective_to is null or placement.effective_to >= current_date)
        and employee.is_active and not employee.is_archived and employee.deleted_at is null
      order by placement.employee_id, placement.effective_from desc, placement.updated_at desc
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

create or replace function public.close_talent_review_campaign(requested_campaign_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public, auth, pg_temp
as $$
declare
  campaign_row public.talent_review_campaigns;
begin
  select * into campaign_row from public.talent_review_campaigns where id = requested_campaign_id for update;
  if campaign_row.id is null then raise exception 'TALENT_REVIEW_CAMPAIGN_NOT_FOUND'; end if;
  if not internal_security.current_user_has_permission(campaign_row.tenant_id, campaign_row.administration_id, 'talent-review:manage') then raise exception 'TALENT_REVIEW_FORBIDDEN'; end if;
  if campaign_row.status not in ('ACTIVE', 'HR_REVIEW') then raise exception 'TALENT_REVIEW_CAMPAIGN_CLOSE_INVALID'; end if;
  if exists (select 1 from public.talent_review_assignments assignment where assignment.tenant_id = campaign_row.tenant_id and assignment.campaign_id = campaign_row.id and assignment.status <> 'SUBMITTED') then raise exception 'TALENT_REVIEW_ASSIGNMENTS_INCOMPLETE'; end if;
  if exists (select 1 from public.talent_review_assignment_members member left join public.talent_review_scores score on score.tenant_id = member.tenant_id and score.campaign_id = member.campaign_id and score.employee_id = member.employee_id where member.tenant_id = campaign_row.tenant_id and member.campaign_id = campaign_row.id and (score.id is null or score.performance_score is null or score.potential_score is null)) then raise exception 'TALENT_REVIEW_SCORES_INCOMPLETE'; end if;
  update public.talent_review_scores set status = 'CLOSED', version = version + 1, updated_by_user_id = (select auth.uid()) where tenant_id = campaign_row.tenant_id and campaign_id = campaign_row.id;
  update public.talent_review_campaigns set status = 'CLOSED', closed_at = timezone('utc', now()), closed_by_user_id = (select auth.uid()), version = version + 1, updated_by_user_id = (select auth.uid()) where tenant_id = campaign_row.tenant_id and id = campaign_row.id;
  return campaign_row.id;
end;
$$;

revoke all on function public.close_talent_review_campaign(uuid) from public, anon;
grant execute on function public.close_talent_review_campaign(uuid) to authenticated;

create or replace function public.reopen_talent_review_campaign(requested_campaign_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public, auth, pg_temp
as $$
declare
  campaign_row public.talent_review_campaigns;
begin
  select * into campaign_row from public.talent_review_campaigns where id = requested_campaign_id for update;
  if campaign_row.id is null then raise exception 'TALENT_REVIEW_CAMPAIGN_NOT_FOUND'; end if;
  if not internal_security.current_user_has_permission(campaign_row.tenant_id, campaign_row.administration_id, 'talent-review:manage') then raise exception 'TALENT_REVIEW_FORBIDDEN'; end if;
  if campaign_row.status <> 'CLOSED' then raise exception 'TALENT_REVIEW_CAMPAIGN_REOPEN_INVALID'; end if;
  update public.talent_review_assignments set status = 'RETURNED', version = version + 1, updated_at = timezone('utc', now()) where tenant_id = campaign_row.tenant_id and campaign_id = campaign_row.id;
  update public.talent_review_campaigns set status = 'ACTIVE', reopened_at = timezone('utc', now()), closed_at = null, closed_by_user_id = null, version = version + 1, updated_by_user_id = (select auth.uid()) where tenant_id = campaign_row.tenant_id and id = campaign_row.id;
  update public.talent_review_scores set status = 'SUBMITTED', version = version + 1, updated_by_user_id = (select auth.uid()) where tenant_id = campaign_row.tenant_id and campaign_id = campaign_row.id;
  return campaign_row.id;
end;
$$;

revoke all on function public.reopen_talent_review_campaign(uuid) from public, anon;
grant execute on function public.reopen_talent_review_campaign(uuid) to authenticated;

commit;
