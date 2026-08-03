begin;

-- M2.3/M2.4: assessment cycles, scoped responses and a read-only team projection.
-- The tables stay tenant-owned. Private notes and assessment answers are separate
-- from the team projection, and no aggregate score is stored or calculated here.
create table public.talent_assessment_cycles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  opens_on date not null,
  closes_on date not null,
  result_release_policy text not null default 'FINALIZED'
    check (result_release_policy in ('FINALIZED')),
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED')),
  version integer not null default 1 check (version > 0),
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, id),
  unique (tenant_id, code),
  check (length(btrim(code)) between 1 and 80),
  check (length(btrim(name)) between 1 and 160),
  check (closes_on > opens_on)
);

create table public.talent_assessment_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cycle_id uuid not null,
  capability_id uuid,
  title text not null,
  prompt text not null,
  sort_order integer not null default 1 check (sort_order > 0),
  max_score smallint not null default 5 check (max_score between 1 and 10),
  is_required boolean not null default true,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, id),
  unique (cycle_id, sort_order),
  check (length(btrim(title)) between 1 and 160),
  check (length(btrim(prompt)) between 1 and 2000),
  foreign key (tenant_id, cycle_id)
    references public.talent_assessment_cycles(tenant_id, id) on delete cascade,
  foreign key (tenant_id, capability_id)
    references public.talent_capabilities(tenant_id, id) on delete restrict
);

create table public.talent_assessment_responses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cycle_id uuid not null,
  subject_employee_id uuid not null,
  assessor_employee_id uuid not null,
  response_type text not null check (response_type in ('SELF', 'MANAGER')),
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'SUBMITTED', 'LOCKED', 'FINALIZED')),
  version integer not null default 1 check (version > 0),
  submitted_at timestamptz,
  locked_at timestamptz,
  finalized_at timestamptz,
  reopened_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, id),
  unique (tenant_id, cycle_id, subject_employee_id, assessor_employee_id, response_type),
  foreign key (tenant_id, cycle_id)
    references public.talent_assessment_cycles(tenant_id, id) on delete cascade,
  foreign key (tenant_id, subject_employee_id)
    references public.employees(tenant_id, id) on delete cascade,
  foreign key (tenant_id, assessor_employee_id)
    references public.employees(tenant_id, id) on delete cascade
);

create table public.talent_assessment_answers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  response_id uuid not null,
  item_id uuid not null,
  score smallint,
  answer_text text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, id),
  unique (tenant_id, response_id, item_id),
  check (score is not null or nullif(btrim(answer_text), '') is not null),
  foreign key (tenant_id, response_id)
    references public.talent_assessment_responses(tenant_id, id) on delete cascade,
  foreign key (tenant_id, item_id)
    references public.talent_assessment_items(tenant_id, id) on delete cascade
);

create table public.talent_assessment_private_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  response_id uuid not null,
  note_text text not null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, response_id),
  check (length(btrim(note_text)) between 1 and 4000),
  foreign key (tenant_id, response_id)
    references public.talent_assessment_responses(tenant_id, id) on delete cascade
);

create index talent_assessment_cycles_tenant_status_idx
  on public.talent_assessment_cycles (tenant_id, status, opens_on desc);
create index talent_assessment_items_cycle_order_idx
  on public.talent_assessment_items (tenant_id, cycle_id, sort_order);
create index talent_assessment_responses_subject_status_idx
  on public.talent_assessment_responses (tenant_id, subject_employee_id, status, response_type);
create index talent_assessment_responses_assessor_status_idx
  on public.talent_assessment_responses (tenant_id, assessor_employee_id, status, response_type);
create index talent_assessment_answers_response_idx
  on public.talent_assessment_answers (tenant_id, response_id, item_id);
create index talent_assessment_private_notes_response_idx
  on public.talent_assessment_private_notes (tenant_id, response_id);

create or replace function internal_security.validate_talent_assessment_cycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.code := btrim(new.code);
  new.name := btrim(new.name);
  if tg_op = 'UPDATE' and new.status <> old.status then
    if not (
      (old.status = 'DRAFT' and new.status in ('OPEN', 'ARCHIVED'))
      or (old.status = 'OPEN' and new.status in ('CLOSED', 'ARCHIVED'))
      or (old.status = 'CLOSED' and new.status = 'ARCHIVED')
    ) then
      raise exception 'TALENT_ASSESSMENT_CYCLE_TRANSITION_INVALID';
    end if;
  end if;
  if new.status = 'OPEN' and (current_date < new.opens_on or current_date >= new.closes_on) then
    raise exception 'TALENT_ASSESSMENT_CYCLE_OUTSIDE_WINDOW';
  end if;
  return new;
end;
$$;

revoke all on function internal_security.validate_talent_assessment_cycle() from public, anon, authenticated;

create trigger validate_talent_assessment_cycle
before insert or update on public.talent_assessment_cycles
for each row execute function internal_security.validate_talent_assessment_cycle();

create or replace function internal_security.validate_talent_assessment_response()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cycle_status text;
  cycle_opens_on date;
  cycle_closes_on date;
  actor_can_manage boolean;
begin
  select cycle.status, cycle.opens_on, cycle.closes_on
    into cycle_status, cycle_opens_on, cycle_closes_on
  from public.talent_assessment_cycles cycle
  where cycle.tenant_id = new.tenant_id
    and cycle.id = new.cycle_id;

  if cycle_status is null then
    raise exception 'TALENT_ASSESSMENT_CYCLE_NOT_FOUND';
  end if;

  if new.response_type = 'SELF' and new.assessor_employee_id <> new.subject_employee_id then
    raise exception 'TALENT_SELF_ASSESSOR_INVALID';
  end if;
  if new.response_type = 'MANAGER' and new.assessor_employee_id = new.subject_employee_id then
    raise exception 'TALENT_MANAGER_ASSESSOR_INVALID';
  end if;

  actor_can_manage := coalesce((select internal_security.current_user_has_permission(new.tenant_id, null, 'talent-assessment:manage')), false);

  if new.status in ('DRAFT', 'SUBMITTED')
    and (cycle_status <> 'OPEN' or current_date < cycle_opens_on or current_date >= cycle_closes_on) then
    raise exception 'TALENT_ASSESSMENT_CYCLE_CLOSED';
  end if;

  if tg_op = 'UPDATE' then
    if new.version <> old.version + 1 then
      raise exception 'TALENT_ASSESSMENT_VERSION_CONFLICT';
    end if;
    if old.status = 'FINALIZED' and new.status <> old.status then
      raise exception 'TALENT_ASSESSMENT_FINALIZED_LOCKED';
    end if;
    if old.status = 'DRAFT' and new.status = 'SUBMITTED' then
      new.submitted_at := coalesce(new.submitted_at, timezone('utc', now()));
    elsif old.status = 'SUBMITTED' and new.status = 'LOCKED' then
      if not actor_can_manage then raise exception 'TALENT_ASSESSMENT_LOCK_FORBIDDEN'; end if;
      new.locked_at := coalesce(new.locked_at, timezone('utc', now()));
    elsif old.status = 'LOCKED' and new.status = 'FINALIZED' then
      if not actor_can_manage then raise exception 'TALENT_ASSESSMENT_FINALIZE_FORBIDDEN'; end if;
      new.finalized_at := coalesce(new.finalized_at, timezone('utc', now()));
    elsif old.status = 'SUBMITTED' and new.status = 'DRAFT' then
      if not actor_can_manage or new.reopened_at is null or new.reopened_at <= coalesce(old.reopened_at, old.updated_at) then
        raise exception 'TALENT_ASSESSMENT_REOPEN_FORBIDDEN';
      end if;
    elsif old.status <> new.status and not actor_can_manage then
      raise exception 'TALENT_ASSESSMENT_TRANSITION_FORBIDDEN';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function internal_security.validate_talent_assessment_response() from public, anon, authenticated;

create trigger validate_talent_assessment_response
before insert or update on public.talent_assessment_responses
for each row execute function internal_security.validate_talent_assessment_response();

create or replace function internal_security.validate_talent_assessment_answer()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item_max_score smallint;
  response_cycle_id uuid;
  response_status text;
begin
  select item.max_score into item_max_score
  from public.talent_assessment_items item
  where item.tenant_id = new.tenant_id and item.id = new.item_id;
  select response.cycle_id, response.status into response_cycle_id, response_status
  from public.talent_assessment_responses response
  where response.tenant_id = new.tenant_id and response.id = new.response_id;
  if item_max_score is null or response_cycle_id is null then
    raise exception 'TALENT_ASSESSMENT_ANSWER_SCOPE_INVALID';
  end if;
  if not exists (
    select 1 from public.talent_assessment_items item
    where item.tenant_id = new.tenant_id and item.id = new.item_id and item.cycle_id = response_cycle_id
  ) then
    raise exception 'TALENT_ASSESSMENT_ANSWER_ITEM_INVALID';
  end if;
  if new.score is not null and (new.score < 0 or new.score > item_max_score) then
    raise exception 'TALENT_ASSESSMENT_SCORE_INVALID';
  end if;
  if response_status in ('LOCKED', 'FINALIZED') then
    raise exception 'TALENT_ASSESSMENT_RESPONSE_LOCKED';
  end if;
  new.answer_text := nullif(btrim(new.answer_text), '');
  return new;
end;
$$;

revoke all on function internal_security.validate_talent_assessment_answer() from public, anon, authenticated;

create trigger validate_talent_assessment_answer
before insert or update on public.talent_assessment_answers
for each row execute function internal_security.validate_talent_assessment_answer();

create or replace function internal_security.validate_talent_assessment_private_note()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  response_type text;
begin
  select response.response_type into response_type
  from public.talent_assessment_responses response
  where response.tenant_id = new.tenant_id and response.id = new.response_id;
  if response_type is distinct from 'MANAGER' then
    raise exception 'TALENT_PRIVATE_NOTE_RESPONSE_INVALID';
  end if;
  new.note_text := btrim(new.note_text);
  return new;
end;
$$;

revoke all on function internal_security.validate_talent_assessment_private_note() from public, anon, authenticated;

create trigger validate_talent_assessment_private_note
before insert or update on public.talent_assessment_private_notes
for each row execute function internal_security.validate_talent_assessment_private_note();

create or replace function internal_security.audit_talent_assessment_response()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  audit_action text;
  before_data jsonb := '{}'::jsonb;
  after_data jsonb := '{}'::jsonb;
begin
  if tg_op = 'DELETE' then
    audit_action := 'DELETE';
    before_data := jsonb_build_object('status', old.status, 'response_type', old.response_type, 'subject_employee_id', old.subject_employee_id, 'version', old.version);
  else
    audit_action := case
      when tg_op = 'INSERT' then 'CREATE'
      when new.status = 'SUBMITTED' and (tg_op = 'INSERT' or old.status <> 'SUBMITTED') then 'SUBMIT'
      when new.status = 'LOCKED' and old.status <> 'LOCKED' then 'LOCK'
      when new.status = 'FINALIZED' and old.status <> 'FINALIZED' then 'FINALIZE'
      when new.status = 'DRAFT' and tg_op = 'UPDATE' and old.status = 'SUBMITTED' then 'REOPEN'
      else 'UPDATE'
    end;
    before_data := case when tg_op = 'UPDATE' then jsonb_build_object('status', old.status, 'version', old.version) else '{}'::jsonb end;
    after_data := jsonb_build_object('status', new.status, 'response_type', new.response_type, 'subject_employee_id', new.subject_employee_id, 'version', new.version, 'source_channel', 'WEB', 'correlation_id', gen_random_uuid());
  end if;
  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, subject_employee_id, action, changes, change_set_id)
  values (coalesce(new.tenant_id, old.tenant_id), 'talent_assessment_response', coalesce(new.id, old.id), auth.uid(), coalesce(new.subject_employee_id, old.subject_employee_id), audit_action, jsonb_build_object('before', before_data, 'after', after_data), gen_random_uuid());
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function internal_security.audit_talent_assessment_response() from public, anon, authenticated;

create trigger audit_talent_assessment_responses
after insert or update or delete on public.talent_assessment_responses
for each row execute function internal_security.audit_talent_assessment_response();

create trigger set_talent_assessment_cycles_updated_at
before update on public.talent_assessment_cycles
for each row execute function internal_security.set_updated_at();
create trigger set_talent_assessment_items_updated_at
before update on public.talent_assessment_items
for each row execute function internal_security.set_updated_at();
create trigger set_talent_assessment_responses_updated_at
before update on public.talent_assessment_responses
for each row execute function internal_security.set_updated_at();
create trigger set_talent_assessment_answers_updated_at
before update on public.talent_assessment_answers
for each row execute function internal_security.set_updated_at();
create trigger set_talent_assessment_private_notes_updated_at
before update on public.talent_assessment_private_notes
for each row execute function internal_security.set_updated_at();

alter table public.talent_assessment_cycles enable row level security;
alter table public.talent_assessment_items enable row level security;
alter table public.talent_assessment_responses enable row level security;
alter table public.talent_assessment_answers enable row level security;
alter table public.talent_assessment_private_notes enable row level security;

create policy talent_assessment_cycles_select
on public.talent_assessment_cycles for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-assessment:manage'))
  or ((select internal_security.current_user_has_permission(tenant_id, null, 'talent-assessment:read')) and status in ('OPEN', 'CLOSED'))
  or ((select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-assessment:read')) and status in ('OPEN', 'CLOSED'))
);

create policy talent_assessment_cycles_insert
on public.talent_assessment_cycles for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'talent-assessment:manage')));

create policy talent_assessment_cycles_update
on public.talent_assessment_cycles for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'talent-assessment:manage')))
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'talent-assessment:manage')));

create policy talent_assessment_items_select
on public.talent_assessment_items for select to authenticated
using (exists (select 1 from public.talent_assessment_cycles cycle where cycle.tenant_id = public.talent_assessment_items.tenant_id and cycle.id = public.talent_assessment_items.cycle_id));

create policy talent_assessment_items_insert
on public.talent_assessment_items for insert to authenticated
with check (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-assessment:manage'))
  and exists (select 1 from public.talent_assessment_cycles cycle where cycle.tenant_id = public.talent_assessment_items.tenant_id and cycle.id = public.talent_assessment_items.cycle_id and cycle.status = 'DRAFT')
);

create policy talent_assessment_items_update
on public.talent_assessment_items for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'talent-assessment:manage')))
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'talent-assessment:manage')));

create policy talent_assessment_responses_select
on public.talent_assessment_responses for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-assessment:manage'))
  or (
    (select internal_security.current_user_has_permission(tenant_id, null, 'talent-assessment:read'))
    and (
      (select internal_security.can_manage_employee(subject_employee_id, 'talent-assessment:read'))
      or (assessor_employee_id = (select internal_security.current_employee_id()))
    )
  )
  or (
    subject_employee_id = (select internal_security.current_employee_id())
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-assessment:read'))
    and (response_type = 'SELF' or status = 'FINALIZED')
  )
);

create policy talent_assessment_responses_insert
on public.talent_assessment_responses for insert to authenticated
with check (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-assessment:manage'))
  or (
    response_type = 'SELF'
    and subject_employee_id = (select internal_security.current_employee_id())
    and assessor_employee_id = subject_employee_id
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-assessment:write'))
  )
  or (
    response_type = 'MANAGER'
    and assessor_employee_id = (select internal_security.current_employee_id())
    and (select internal_security.can_manage_employee(subject_employee_id, 'talent-assessment:write'))
    and (select internal_security.current_user_has_permission(tenant_id, null, 'talent-assessment:write'))
  )
);

create policy talent_assessment_responses_update
on public.talent_assessment_responses for update to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-assessment:manage'))
  or (
    response_type = 'SELF'
    and subject_employee_id = (select internal_security.current_employee_id())
    and status = 'DRAFT'
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-assessment:write'))
  )
  or (
    response_type = 'MANAGER'
    and assessor_employee_id = (select internal_security.current_employee_id())
    and status = 'DRAFT'
    and (select internal_security.can_manage_employee(subject_employee_id, 'talent-assessment:write'))
    and (select internal_security.current_user_has_permission(tenant_id, null, 'talent-assessment:write'))
  )
)
with check (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-assessment:manage'))
  or (
    response_type = 'SELF'
    and subject_employee_id = (select internal_security.current_employee_id())
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-assessment:write'))
  )
  or (
    response_type = 'MANAGER'
    and assessor_employee_id = (select internal_security.current_employee_id())
    and (select internal_security.can_manage_employee(subject_employee_id, 'talent-assessment:write'))
    and (select internal_security.current_user_has_permission(tenant_id, null, 'talent-assessment:write'))
  )
);

create policy talent_assessment_answers_select
on public.talent_assessment_answers for select to authenticated
using (exists (select 1 from public.talent_assessment_responses response where response.tenant_id = public.talent_assessment_answers.tenant_id and response.id = public.talent_assessment_answers.response_id));

create policy talent_assessment_answers_insert
on public.talent_assessment_answers for insert to authenticated
with check (exists (
  select 1 from public.talent_assessment_responses response
  where response.tenant_id = public.talent_assessment_answers.tenant_id and response.id = public.talent_assessment_answers.response_id
    and (
      (select internal_security.current_user_has_permission(response.tenant_id, null, 'talent-assessment:manage'))
      or (response.response_type = 'SELF' and response.subject_employee_id = (select internal_security.current_employee_id()) and (select internal_security.current_user_has_permission(response.tenant_id, null, 'self:talent-assessment:write')))
      or (response.response_type = 'MANAGER' and response.assessor_employee_id = (select internal_security.current_employee_id()) and (select internal_security.can_manage_employee(response.subject_employee_id, 'talent-assessment:write')) and (select internal_security.current_user_has_permission(response.tenant_id, null, 'talent-assessment:write')))
    )
));

create policy talent_assessment_answers_update
on public.talent_assessment_answers for update to authenticated
using (exists (
  select 1 from public.talent_assessment_responses response
  where response.tenant_id = public.talent_assessment_answers.tenant_id and response.id = public.talent_assessment_answers.response_id and response.status = 'DRAFT'
    and (
      (select internal_security.current_user_has_permission(response.tenant_id, null, 'talent-assessment:manage'))
      or (response.response_type = 'SELF' and response.subject_employee_id = (select internal_security.current_employee_id()) and (select internal_security.current_user_has_permission(response.tenant_id, null, 'self:talent-assessment:write')))
      or (response.response_type = 'MANAGER' and response.assessor_employee_id = (select internal_security.current_employee_id()) and (select internal_security.can_manage_employee(response.subject_employee_id, 'talent-assessment:write')) and (select internal_security.current_user_has_permission(response.tenant_id, null, 'talent-assessment:write')))
    )
))
with check (exists (
  select 1 from public.talent_assessment_responses response
  where response.tenant_id = public.talent_assessment_answers.tenant_id and response.id = public.talent_assessment_answers.response_id
    and (
      (select internal_security.current_user_has_permission(response.tenant_id, null, 'talent-assessment:manage'))
      or (response.response_type = 'SELF' and response.subject_employee_id = (select internal_security.current_employee_id()) and (select internal_security.current_user_has_permission(response.tenant_id, null, 'self:talent-assessment:write')))
      or (response.response_type = 'MANAGER' and response.assessor_employee_id = (select internal_security.current_employee_id()) and (select internal_security.can_manage_employee(response.subject_employee_id, 'talent-assessment:write')) and (select internal_security.current_user_has_permission(response.tenant_id, null, 'talent-assessment:write')))
    )
));

create policy talent_assessment_private_notes_select
on public.talent_assessment_private_notes for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-assessment:manage'))
  or exists (
    select 1 from public.talent_assessment_responses response
    where response.tenant_id = public.talent_assessment_private_notes.tenant_id and response.id = public.talent_assessment_private_notes.response_id
      and response.response_type = 'MANAGER'
      and response.assessor_employee_id = (select internal_security.current_employee_id())
      and (select internal_security.can_manage_employee(response.subject_employee_id, 'talent-assessment:read'))
  )
);

create policy talent_assessment_private_notes_insert
on public.talent_assessment_private_notes for insert to authenticated
with check (
  exists (
    select 1 from public.talent_assessment_responses response
    where response.tenant_id = public.talent_assessment_private_notes.tenant_id and response.id = public.talent_assessment_private_notes.response_id
      and response.response_type = 'MANAGER'
      and response.assessor_employee_id = (select internal_security.current_employee_id())
      and (select internal_security.can_manage_employee(response.subject_employee_id, 'talent-assessment:write'))
      and (select internal_security.current_user_has_permission(tenant_id, null, 'talent-assessment:write'))
  )
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent-assessment:manage'))
);

create policy talent_assessment_private_notes_update
on public.talent_assessment_private_notes for update to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-assessment:manage'))
  or exists (
    select 1 from public.talent_assessment_responses response
    where response.tenant_id = public.talent_assessment_private_notes.tenant_id and response.id = public.talent_assessment_private_notes.response_id
      and response.assessor_employee_id = (select internal_security.current_employee_id())
      and (select internal_security.can_manage_employee(response.subject_employee_id, 'talent-assessment:write'))
  )
)
with check (
  (select internal_security.current_user_has_permission(public.talent_assessment_private_notes.tenant_id, null, 'talent-assessment:manage'))
  or exists (
    select 1 from public.talent_assessment_responses response
    where response.tenant_id = public.talent_assessment_private_notes.tenant_id and response.id = public.talent_assessment_private_notes.response_id
      and response.response_type = 'MANAGER'
      and response.assessor_employee_id = (select internal_security.current_employee_id())
      and (select internal_security.can_manage_employee(response.subject_employee_id, 'talent-assessment:write'))
      and (select internal_security.current_user_has_permission(response.tenant_id, null, 'talent-assessment:write'))
  )
);

revoke all on table public.talent_assessment_cycles from public, anon, authenticated;
revoke all on table public.talent_assessment_items from public, anon, authenticated;
revoke all on table public.talent_assessment_responses from public, anon, authenticated;
revoke all on table public.talent_assessment_answers from public, anon, authenticated;
revoke all on table public.talent_assessment_private_notes from public, anon, authenticated;
grant select, insert, update on table public.talent_assessment_cycles to authenticated;
grant select, insert, update on table public.talent_assessment_items to authenticated;
grant select, insert, update on table public.talent_assessment_responses to authenticated;
grant select, insert, update on table public.talent_assessment_answers to authenticated;
grant select, insert, update on table public.talent_assessment_private_notes to authenticated;

insert into public.permissions (code, name, description, category)
values
  ('talent-assessment:manage', 'Talent-assessment beheren', 'Beheert assessmentcycli en expliciete statuscommando’s.', 'Talent'),
  ('talent-assessment:read', 'Talent-assessments lezen', 'Leest assessmentprojecties binnen de actuele scope.', 'Talent'),
  ('talent-assessment:write', 'Manager-assessment schrijven', 'Schrijft managerantwoorden binnen de actuele scope en een open cyclus.', 'Talent'),
  ('self:talent-assessment:read', 'Eigen Talent-assessment lezen', 'Leest eigen assessmentgegevens volgens releasebeleid.', 'Talent'),
  ('self:talent-assessment:write', 'Eigen Talent-assessment schrijven', 'Schrijft eigen antwoorden binnen een open cyclus.', 'Talent'),
  ('talent-team:read', 'Team Talent lezen', 'Leest de Team Talent- en Skills Matrix-projectie binnen scope.', 'Talent')
on conflict (code) do update set name = excluded.name, description = excluded.description, category = excluded.category;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.tenant_id is null
  and (
    (role.code = 'TENANT_ADMIN' and permission.code in ('talent-assessment:manage', 'talent-assessment:read', 'talent-team:read'))
    or (role.code = 'DIRECT_MANAGER' and permission.code in ('talent-assessment:read', 'talent-assessment:write', 'talent-team:read'))
    or (role.code = 'EMPLOYEE' and permission.code in ('self:talent-assessment:read', 'self:talent-assessment:write'))
  )
on conflict do nothing;

commit;
