begin;

create table public.talent_development_goals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null,
  capability_id uuid,
  title text not null check (length(btrim(title)) between 1 and 160),
  description text check (description is null or length(description) <= 4000),
  period_start date not null default current_date,
  period_end date,
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED')),
  source_type text not null default 'SELF_ENTERED' check (source_type in ('SELF_ENTERED', 'MANAGER_ENTERED', 'HR_ENTERED')),
  version integer not null default 1 check (version > 0),
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, id),
  check (period_end is null or period_end > period_start),
  foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id) on delete cascade,
  foreign key (tenant_id, capability_id)
    references public.talent_capabilities(tenant_id, id) on delete set null
);

create index talent_development_goals_employee_idx
  on public.talent_development_goals (tenant_id, employee_id, status, period_start desc);
create index talent_development_goals_capability_idx
  on public.talent_development_goals (tenant_id, capability_id, status)
  where capability_id is not null;
create index talent_development_goals_status_idx
  on public.talent_development_goals (tenant_id, status, period_end);
create index talent_development_goals_created_by_idx
  on public.talent_development_goals (created_by_user_id)
  where created_by_user_id is not null;
create index talent_development_goals_updated_by_idx
  on public.talent_development_goals (updated_by_user_id)
  where updated_by_user_id is not null;

create or replace function internal_security.validate_talent_development_goal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.title := btrim(new.title);
  new.description := nullif(btrim(new.description), '');
  if tg_op = 'UPDATE' then
    if new.version <> old.version + 1 then
      raise exception 'TALENT_GOAL_VERSION_CONFLICT';
    end if;
    if old.status = 'ARCHIVED' then
      raise exception 'TALENT_GOAL_ARCHIVED_LOCKED';
    end if;
    if old.status = 'COMPLETED' and new.status not in ('COMPLETED', 'ARCHIVED') then
      raise exception 'TALENT_GOAL_COMPLETED_LOCKED';
    end if;
    if old.status = 'CANCELLED' and new.status not in ('CANCELLED', 'ARCHIVED') then
      raise exception 'TALENT_GOAL_CANCELLED_LOCKED';
    end if;
    if old.status = 'DRAFT' and new.status not in ('DRAFT', 'ACTIVE', 'CANCELLED', 'ARCHIVED') then
      raise exception 'TALENT_GOAL_TRANSITION_INVALID';
    end if;
    if old.status = 'ACTIVE' and new.status not in ('ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED') then
      raise exception 'TALENT_GOAL_TRANSITION_INVALID';
    end if;
  end if;
  if new.status = 'COMPLETED' and (tg_op = 'INSERT' or old.status is distinct from 'COMPLETED') then
    new.completed_at := coalesce(new.completed_at, timezone('utc', now()));
  end if;
  if new.status = 'ARCHIVED' and (tg_op = 'INSERT' or old.status is distinct from 'ARCHIVED') then
    new.archived_at := coalesce(new.archived_at, timezone('utc', now()));
  end if;
  return new;
end;
$$;

revoke all on function internal_security.validate_talent_development_goal() from public, anon, authenticated;

create trigger validate_talent_development_goal
before insert or update on public.talent_development_goals
for each row execute function internal_security.validate_talent_development_goal();

create trigger set_talent_development_goals_updated_at
before update on public.talent_development_goals
for each row execute function internal_security.set_updated_at();

create or replace function internal_security.audit_talent_development_goal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  before_data jsonb;
  after_data jsonb;
  audit_action text;
begin
  if tg_op = 'DELETE' then
    before_data := to_jsonb(old);
    after_data := '{}'::jsonb;
    audit_action := 'DELETE';
  else
    before_data := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
    after_data := to_jsonb(new);
    audit_action := case
      when tg_op = 'INSERT' then 'CREATE'
      when new.status = 'ARCHIVED' and (tg_op = 'INSERT' or old.status <> 'ARCHIVED') then 'ARCHIVE'
      else 'UPDATE'
    end;
  end if;

  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (
    coalesce(new.tenant_id, old.tenant_id),
    'talent_development_goal',
    coalesce(new.id, old.id),
    auth.uid(),
    audit_action,
    jsonb_build_object(
      'before', before_data - array['description'],
      'after', after_data - array['description'],
      'source_channel', 'WEB'
    )
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function internal_security.audit_talent_development_goal() from public, anon, authenticated;

create trigger audit_talent_development_goals
after insert or update or delete on public.talent_development_goals
for each row execute function internal_security.audit_talent_development_goal();

alter table public.talent_development_goals enable row level security;

create policy talent_development_goals_select
on public.talent_development_goals for select to authenticated
using (
  (
    (select internal_security.current_user_has_permission(tenant_id, null, 'talent-goal:read'))
    and (
      (select internal_security.current_user_has_permission(tenant_id, null, 'talent-goal:manage'))
      or (select internal_security.can_manage_employee(employee_id, 'talent-goal:read'))
    )
  )
  or (
    employee_id = (select internal_security.current_employee_id())
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-goal:read'))
  )
);

create policy talent_development_goals_insert
on public.talent_development_goals for insert to authenticated
with check (
  (
    (select internal_security.current_user_has_permission(tenant_id, null, 'talent-goal:manage'))
    and source_type = 'HR_ENTERED'
  )
  or (
    employee_id = (select internal_security.current_employee_id())
    and source_type = 'SELF_ENTERED'
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-goal:write'))
  )
  or (
    source_type = 'MANAGER_ENTERED'
    and (select internal_security.can_manage_employee(employee_id, 'talent-goal:write'))
    and (select internal_security.current_user_has_permission(tenant_id, null, 'talent-goal:write'))
  )
);

create policy talent_development_goals_update
on public.talent_development_goals for update to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-goal:manage'))
  or (
    employee_id = (select internal_security.current_employee_id())
    and source_type = 'SELF_ENTERED'
    and status in ('DRAFT', 'ACTIVE')
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-goal:write'))
  )
  or (
    source_type = 'MANAGER_ENTERED'
    and status in ('DRAFT', 'ACTIVE')
    and (select internal_security.can_manage_employee(employee_id, 'talent-goal:write'))
    and (select internal_security.current_user_has_permission(tenant_id, null, 'talent-goal:write'))
  )
)
with check (
  (
    (select internal_security.current_user_has_permission(tenant_id, null, 'talent-goal:manage'))
  )
  or (
    employee_id = (select internal_security.current_employee_id())
    and source_type = 'SELF_ENTERED'
    and status in ('DRAFT', 'ACTIVE')
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-goal:write'))
  )
  or (
    source_type = 'MANAGER_ENTERED'
    and status in ('DRAFT', 'ACTIVE')
    and (select internal_security.can_manage_employee(employee_id, 'talent-goal:write'))
    and (select internal_security.current_user_has_permission(tenant_id, null, 'talent-goal:write'))
  )
);

revoke all on table public.talent_development_goals from public, anon, authenticated;
grant select, insert, update on table public.talent_development_goals to authenticated;

insert into public.permissions (code, name, description, category)
values
  ('talent-goal:manage', 'Talentdoelen beheren', 'Beheert tenantbrede ontwikkeldoelen en auditbare status.', 'Talent'),
  ('talent-goal:read', 'Talentdoelen lezen', 'Leest ontwikkeldoelen binnen de actuele managementscope.', 'Talent'),
  ('talent-goal:write', 'Talentdoelen schrijven', 'Schrijft ontwikkeldoelen binnen de actuele managementscope.', 'Talent'),
  ('self:talent-goal:read', 'Eigen Talentdoelen lezen', 'Leest eigen ontwikkeldoelen.', 'Talent'),
  ('self:talent-goal:write', 'Eigen Talentdoelen schrijven', 'Schrijft eigen ontwikkeldoelen.', 'Talent')
on conflict (code) do update set name = excluded.name, description = excluded.description, category = excluded.category;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.tenant_id is null
  and (
    (role.code = 'TENANT_ADMIN' and permission.code in ('talent-goal:manage', 'talent-goal:read'))
    or (role.code = 'DIRECT_MANAGER' and permission.code in ('talent-goal:read', 'talent-goal:write'))
    or (role.code = 'EMPLOYEE' and permission.code in ('self:talent-goal:read', 'self:talent-goal:write'))
  )
on conflict do nothing;

commit;
