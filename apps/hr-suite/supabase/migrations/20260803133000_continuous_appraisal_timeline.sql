begin;

-- Doorlopende beoordeling: één transparante, tenant-owned timeline per medewerker.
-- De actuele manager bepaalt de toegang; administration_id is bewust geen eigendomsgrens.
create table public.continuous_appraisal_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null,
  manager_employee_id uuid,
  created_by_employee_id uuid not null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  owner_employee_id uuid,
  created_by_label text not null check (char_length(btrim(created_by_label)) between 1 and 160),
  created_by_avatar_url text,
  owner_label text,
  item_type text not null check (item_type in ('NOTE', 'ACTION', 'AGREEMENT', 'FEEDBACK', 'GOAL', 'MEETING_SUMMARY', 'SYSTEM_EVENT')),
  goal_kind text check (goal_kind is null or goal_kind in ('GOAL', 'DEVELOPMENT')),
  feedback_direction text check (feedback_direction is null or feedback_direction = 'MANAGER_TO_EMPLOYEE'),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  occurred_on date not null,
  due_on date,
  next_meeting_on date,
  item_status text not null default 'OPEN' check (item_status in ('PLANNED', 'OPEN', 'WAITING', 'ACTIVE', 'DONE', 'CANCELLED', 'ARCHIVED')),
  priority text check (priority is null or priority in ('LOW', 'MEDIUM', 'HIGH')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, id),
  foreign key (tenant_id, employee_id) references public.employees(tenant_id, id) on delete restrict,
  foreign key (tenant_id, manager_employee_id) references public.employees(tenant_id, id) on delete set null,
  foreign key (tenant_id, created_by_employee_id) references public.employees(tenant_id, id) on delete restrict,
  foreign key (tenant_id, owner_employee_id) references public.employees(tenant_id, id) on delete set null,
  constraint continuous_appraisal_item_type_fields_check check (
    (item_type = 'GOAL' and goal_kind is not null) or (item_type <> 'GOAL' and goal_kind is null)
  ),
  constraint continuous_appraisal_feedback_fields_check check (
    (item_type = 'FEEDBACK' and feedback_direction = 'MANAGER_TO_EMPLOYEE') or (item_type <> 'FEEDBACK' and feedback_direction is null)
  ),
  constraint continuous_appraisal_due_date_check check (due_on is null or due_on >= occurred_on)
);

create table public.continuous_appraisal_item_comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  item_id uuid not null,
  author_employee_id uuid not null,
  author_user_id uuid references auth.users(id) on delete set null,
  author_label text not null check (char_length(btrim(author_label)) between 1 and 160),
  author_avatar_url text,
  body text not null check (char_length(btrim(body)) between 1 and 100),
  created_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, id),
  foreign key (tenant_id, item_id) references public.continuous_appraisal_items(tenant_id, id) on delete restrict,
  foreign key (tenant_id, author_employee_id) references public.employees(tenant_id, id) on delete restrict
);

create index continuous_appraisal_items_employee_date_idx
  on public.continuous_appraisal_items (tenant_id, employee_id, occurred_on desc, created_at desc);
create index continuous_appraisal_items_manager_idx
  on public.continuous_appraisal_items (tenant_id, manager_employee_id, occurred_on desc);
create index continuous_appraisal_items_type_status_idx
  on public.continuous_appraisal_items (tenant_id, item_type, item_status, occurred_on desc);
create index continuous_appraisal_items_creator_idx
  on public.continuous_appraisal_items (tenant_id, created_by_employee_id, occurred_on desc);
create index continuous_appraisal_items_created_by_user_idx
  on public.continuous_appraisal_items (created_by_user_id);
create index continuous_appraisal_comments_item_idx
  on public.continuous_appraisal_item_comments (tenant_id, item_id, created_at);
create index continuous_appraisal_comments_author_idx
  on public.continuous_appraisal_item_comments (tenant_id, author_employee_id);
create index continuous_appraisal_comments_author_user_idx
  on public.continuous_appraisal_item_comments (author_user_id);
create index continuous_appraisal_items_owner_idx
  on public.continuous_appraisal_items (tenant_id, owner_employee_id, item_status, due_on);

create or replace function internal_security.validate_continuous_appraisal_item()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.item_type = 'SYSTEM_EVENT' then
      return new;
    end if;
    if new.created_by_employee_id <> internal_security.current_employee_id()
      and not internal_security.current_user_has_permission(new.tenant_id, null, 'continuous-appraisal:manage') then
      raise exception 'CONTINUOUS_APPRAISAL_CREATOR_INVALID';
    end if;
    if new.item_type = 'FEEDBACK'
      and not (
        internal_security.current_user_has_permission(new.tenant_id, null, 'continuous-appraisal:manage')
        or internal_security.can_manage_employee(new.employee_id, 'continuous-appraisal:write')
      ) then
      raise exception 'CONTINUOUS_APPRAISAL_FEEDBACK_MANAGER_ONLY';
    end if;
    return new;
  end if;

  if new.tenant_id <> old.tenant_id
    or new.employee_id <> old.employee_id
    or new.created_by_employee_id <> old.created_by_employee_id
    or new.item_type <> old.item_type
    or new.occurred_on <> old.occurred_on then
    raise exception 'CONTINUOUS_APPRAISAL_IDENTITY_IMMUTABLE';
  end if;

  if old.occurred_on < current_date and (
    new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.due_on is distinct from old.due_on
    or new.next_meeting_on is distinct from old.next_meeting_on
    or new.item_status is distinct from old.item_status
    or new.priority is distinct from old.priority
    or new.owner_employee_id is distinct from old.owner_employee_id
    or new.owner_label is distinct from old.owner_label
  ) then
    raise exception 'CONTINUOUS_APPRAISAL_PAST_IMMUTABLE';
  end if;

  if new.version <> old.version + 1 then
    raise exception 'CONTINUOUS_APPRAISAL_VERSION_CONFLICT';
  end if;
  return new;
end;
$$;

revoke all on function internal_security.validate_continuous_appraisal_item() from public, anon, authenticated;
create trigger validate_continuous_appraisal_item
before insert or update on public.continuous_appraisal_items
for each row execute function internal_security.validate_continuous_appraisal_item();

create trigger set_continuous_appraisal_items_updated_at
before update on public.continuous_appraisal_items
for each row execute function internal_security.set_updated_at();

create or replace function internal_security.audit_continuous_appraisal_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  tenant_value uuid := coalesce(new.tenant_id, old.tenant_id);
  entity_value uuid := coalesce(new.id, old.id);
  action_value text := case when tg_op = 'INSERT' then 'CREATE' when tg_op = 'DELETE' then 'DELETE' else 'UPDATE' end;
begin
  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (
    tenant_value,
    tg_table_name,
    entity_value,
    (select auth.uid()),
    action_value,
    jsonb_build_object(
      'before', case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else '{}'::jsonb end,
      'after', case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else '{}'::jsonb end,
      'source', 'CONTINUOUS_APPRAISAL'
    )
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function internal_security.audit_continuous_appraisal_change() from public, anon, authenticated;
create trigger audit_continuous_appraisal_items
after insert or update on public.continuous_appraisal_items
for each row execute function internal_security.audit_continuous_appraisal_change();
create trigger audit_continuous_appraisal_comments
after insert on public.continuous_appraisal_item_comments
for each row execute function internal_security.audit_continuous_appraisal_change();

-- A manager change is visible as a normal shared system event. It does not expose
-- the old timeline to the new manager; the item policy only releases active/future context.
create or replace function internal_security.create_continuous_appraisal_manager_event()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  old_manager_name text;
  new_manager_name text;
begin
  if tg_op <> 'UPDATE' or new.direct_manager_id is not distinct from old.direct_manager_id or new.direct_manager_id is null then
    return new;
  end if;

  select concat_ws(' ', first_name, birth_name) into old_manager_name
  from public.employees where tenant_id = new.tenant_id and id = old.direct_manager_id;
  select concat_ws(' ', first_name, birth_name) into new_manager_name
  from public.employees where tenant_id = new.tenant_id and id = new.direct_manager_id;

  insert into public.continuous_appraisal_items (
    tenant_id, employee_id, manager_employee_id, created_by_employee_id, created_by_user_id,
    created_by_label, item_type, title, body, occurred_on, item_status
  )
  select
    new.tenant_id,
    new.employee_id,
    new.direct_manager_id,
    new.direct_manager_id,
    (select auth.uid()),
    coalesce(new_manager_name, 'Liquid HR'),
    'SYSTEM_EVENT',
    'Manager gewijzigd',
    'Manager gewijzigd van ' || coalesce(nullif(old_manager_name, ''), 'onbekend') || ' naar ' || coalesce(nullif(new_manager_name, ''), 'onbekend') || '.',
    greatest(new.effective_from, current_date),
    'PLANNED';
  return new;
end;
$$;

revoke all on function internal_security.create_continuous_appraisal_manager_event() from public, anon, authenticated;
create trigger create_continuous_appraisal_manager_event
after update on public.employee_organizations
for each row execute function internal_security.create_continuous_appraisal_manager_event();

alter table public.continuous_appraisal_items enable row level security;
alter table public.continuous_appraisal_item_comments enable row level security;
revoke all on public.continuous_appraisal_items, public.continuous_appraisal_item_comments from public, anon;

create policy continuous_appraisal_items_select
on public.continuous_appraisal_items for select to authenticated
using (
  (
    employee_id = (select internal_security.current_employee_id())
    and (select internal_security.current_employee_has_permission('self:continuous-appraisal:read'))
  )
  or (select internal_security.current_user_has_permission(tenant_id, null, 'continuous-appraisal:manage'))
  or (
    (select internal_security.can_manage_employee(employee_id, 'continuous-appraisal:read'))
    and exists (
      select 1
      from public.employee_organizations placement
      where placement.tenant_id = continuous_appraisal_items.tenant_id
        and placement.employee_id = continuous_appraisal_items.employee_id
        and placement.direct_manager_id = (select internal_security.current_employee_id())
        and placement.effective_from <= current_date
        and (placement.effective_to is null or placement.effective_to >= current_date)
        and (
          continuous_appraisal_items.occurred_on >= placement.effective_from
          or (
            continuous_appraisal_items.item_type in ('ACTION', 'AGREEMENT', 'GOAL')
            and continuous_appraisal_items.item_status in ('PLANNED', 'OPEN', 'WAITING', 'ACTIVE')
          )
        )
    )
  )
);

create policy continuous_appraisal_items_insert
on public.continuous_appraisal_items for insert to authenticated
with check (
  (
    employee_id = (select internal_security.current_employee_id())
    and created_by_employee_id = (select internal_security.current_employee_id())
    and (select internal_security.current_employee_has_permission('self:continuous-appraisal:write'))
  )
  or (
    created_by_employee_id = (select internal_security.current_employee_id())
    and (
      (select internal_security.current_user_has_permission(tenant_id, null, 'continuous-appraisal:manage'))
      or (select internal_security.can_manage_employee(employee_id, 'continuous-appraisal:write'))
    )
  )
);

create policy continuous_appraisal_items_update
on public.continuous_appraisal_items for update to authenticated
using (
  created_by_employee_id = (select internal_security.current_employee_id())
  and occurred_on >= current_date
  and (
    (employee_id = (select internal_security.current_employee_id()) and (select internal_security.current_employee_has_permission('self:continuous-appraisal:write')))
    or (select internal_security.current_user_has_permission(tenant_id, null, 'continuous-appraisal:manage'))
    or (select internal_security.can_manage_employee(employee_id, 'continuous-appraisal:write'))
  )
)
with check (
  created_by_employee_id = (select internal_security.current_employee_id())
  and occurred_on >= current_date
  and (
    (employee_id = (select internal_security.current_employee_id()) and (select internal_security.current_employee_has_permission('self:continuous-appraisal:write')))
    or (select internal_security.current_user_has_permission(tenant_id, null, 'continuous-appraisal:manage'))
    or (select internal_security.can_manage_employee(employee_id, 'continuous-appraisal:write'))
  )
);

create policy continuous_appraisal_comments_select
on public.continuous_appraisal_item_comments for select to authenticated
using (
  exists (
    select 1 from public.continuous_appraisal_items item
    where item.tenant_id = continuous_appraisal_item_comments.tenant_id
      and item.id = continuous_appraisal_item_comments.item_id
  )
);

create policy continuous_appraisal_comments_insert
on public.continuous_appraisal_item_comments for insert to authenticated
with check (
  author_employee_id = (select internal_security.current_employee_id())
  and exists (
    select 1 from public.continuous_appraisal_items item
    where item.tenant_id = continuous_appraisal_item_comments.tenant_id
      and item.id = continuous_appraisal_item_comments.item_id
  )
  and (
    (select internal_security.current_employee_has_permission('self:continuous-appraisal:write'))
    or (select internal_security.current_user_has_permission(tenant_id, null, 'continuous-appraisal:write'))
    or exists (
      select 1 from public.continuous_appraisal_items item
      where item.tenant_id = continuous_appraisal_item_comments.tenant_id
        and item.id = continuous_appraisal_item_comments.item_id
        and (select internal_security.can_manage_employee(item.employee_id, 'continuous-appraisal:write'))
    )
  )
);

grant select, insert, update on public.continuous_appraisal_items to authenticated;
grant select, insert on public.continuous_appraisal_item_comments to authenticated;

insert into public.permissions (code, name, category, description)
values
  ('continuous-appraisal:manage', 'Doorlopende beoordeling beheren', 'Workforce', 'Beheert de gedeelde medewerker-manager timelines binnen de tenant.'),
  ('continuous-appraisal:read', 'Doorlopende beoordeling lezen', 'Workforce', 'Leest timelines binnen de actuele managementscope.'),
  ('continuous-appraisal:write', 'Doorlopende beoordeling schrijven', 'Workforce', 'Maakt en wijzigt eigen toekomstige timeline-items binnen de managementscope.'),
  ('self:continuous-appraisal:read', 'Eigen doorlopende beoordeling lezen', 'Persoonlijk', 'Leest de eigen gedeelde timeline.'),
  ('self:continuous-appraisal:write', 'Eigen doorlopende beoordeling schrijven', 'Persoonlijk', 'Maakt en wijzigt eigen toekomstige timeline-items.')
on conflict (code) do update
set name = excluded.name, category = excluded.category, description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code in ('TENANT_ADMIN', 'HR_ADMIN')
  and permission.code in ('continuous-appraisal:manage', 'continuous-appraisal:read', 'continuous-appraisal:write')
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'DIRECT_MANAGER'
  and permission.code in ('continuous-appraisal:read', 'continuous-appraisal:write')
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'EMPLOYEE'
  and permission.code in ('self:continuous-appraisal:read', 'self:continuous-appraisal:write')
on conflict do nothing;

commit;
