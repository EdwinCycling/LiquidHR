begin;

-- Sla alleen bestaande documentreferenties op. Geen documentinhoud of medische metadata.
create table public.wvp_document_links (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.absence_guidance(case_id) on delete restrict,
  task_id uuid not null references public.absence_tasks(id) on delete restrict,
  document_id uuid not null references public.employee_documents(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by_user_id uuid references auth.users(id) on delete restrict,
  constraint wvp_document_links_removal_check check (
    (removed_at is null and removed_by_user_id is null)
    or (removed_at is not null and removed_by_user_id is not null)
  )
);
create index wvp_document_links_case_task_idx
  on public.wvp_document_links(case_id, task_id, created_at)
  where removed_at is null;
create unique index wvp_document_links_active_unique
  on public.wvp_document_links(case_id, task_id, document_id)
  where removed_at is null;

create function internal_security.wvp_document_milestone_valid(requested_code text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select requested_code = any(array[
    'WVP_WEEK_6', 'WVP_WEEK_8', 'WVP_WEEK_42',
    'WVP_FIRST_YEAR_REVIEW', 'WVP_FINAL_EVALUATION', 'WVP_WIA_APPLICATION'
  ]::text[])
  or requested_code ~ '^WVP_EVALUATION_6W_(0[1-9]|1[0-6])$';
$$;
revoke all on function internal_security.wvp_document_milestone_valid(text) from public, anon, authenticated;

create function internal_security.wvp_document_link_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  case_row public.absence_cases%rowtype;
  guidance_row public.absence_guidance%rowtype;
  task_row public.absence_tasks%rowtype;
  document_row public.employee_documents%rowtype;
begin
  select * into case_row from public.absence_cases c where c.id = new.case_id;
  select * into guidance_row from public.absence_guidance g
    where g.case_id = new.case_id
      and g.tenant_id = case_row.tenant_id
      and g.hr_group_id = case_row.hr_group_id
      and g.administration_id = case_row.administration_id;
  select * into task_row from public.absence_tasks t
    where t.id = new.task_id
      and t.case_id = case_row.id
      and t.tenant_id = case_row.tenant_id
      and t.hr_group_id = case_row.hr_group_id;
  select * into document_row from public.employee_documents d where d.id = new.document_id;

  if case_row.id is null or guidance_row.case_id is null or task_row.id is null
    or not internal_security.wvp_document_milestone_valid(task_row.milestone_code) then
    raise exception 'WVP_MILESTONE_INVALID' using errcode = '22023';
  end if;
  if document_row.id is null
    or document_row.tenant_id is distinct from case_row.tenant_id
    or document_row.administration_id is distinct from case_row.administration_id
    or document_row.employee_id is distinct from case_row.employee_id then
    raise exception 'WVP_DOCUMENT_INVALID' using errcode = '22023';
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() is null or new.created_by_user_id is distinct from auth.uid()
      or new.removed_at is not null or new.removed_by_user_id is not null then
      raise exception 'WVP_FORBIDDEN' using errcode = '42501';
    end if;
    return new;
  end if;

  if old.removed_at is not null or new.removed_at is null or new.removed_by_user_id is distinct from auth.uid()
    or new.id is distinct from old.id
    or new.case_id is distinct from old.case_id
    or new.task_id is distinct from old.task_id
    or new.document_id is distinct from old.document_id
    or new.created_by_user_id is distinct from old.created_by_user_id
    or new.created_at is distinct from old.created_at then
    raise exception 'WVP_LINK_IMMUTABLE' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function internal_security.wvp_document_link_guard() from public, anon, authenticated;
create trigger wvp_document_links_guard
before insert or update on public.wvp_document_links
for each row execute function internal_security.wvp_document_link_guard();

create function internal_security.audit_wvp_document_link_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  case_scope record;
  before_data jsonb := '{}'::jsonb;
  after_data jsonb;
  audit_action text;
begin
  select c.tenant_id, c.administration_id into case_scope
    from public.absence_cases c
    join public.absence_guidance g on g.case_id = c.id
      and g.tenant_id = c.tenant_id
      and g.hr_group_id = c.hr_group_id
      and g.administration_id = c.administration_id
    where c.id = case when tg_op = 'DELETE' then old.case_id else new.case_id end;
  if case_scope.tenant_id is null or case_scope.administration_id is null then
    raise exception 'WVP_AUDIT_CASE_SCOPE_MISSING';
  end if;

  if tg_op = 'UPDATE' then
    before_data := jsonb_build_object(
      'id', old.id, 'caseId', old.case_id, 'taskId', old.task_id,
      'documentId', old.document_id, 'removedAt', old.removed_at
    );
    after_data := jsonb_build_object(
      'id', new.id, 'caseId', new.case_id, 'taskId', new.task_id,
      'documentId', new.document_id, 'removedAt', new.removed_at
    );
    audit_action := 'DELETE';
  elsif tg_op = 'DELETE' then
    before_data := jsonb_build_object(
      'id', old.id, 'caseId', old.case_id, 'taskId', old.task_id,
      'documentId', old.document_id, 'removedAt', old.removed_at
    );
    after_data := '{}'::jsonb;
    audit_action := 'DELETE';
  else
    after_data := jsonb_build_object(
      'id', new.id, 'caseId', new.case_id, 'taskId', new.task_id,
      'documentId', new.document_id, 'createdAt', new.created_at
    );
    audit_action := 'CREATE';
  end if;

  insert into public.audit_logs(
    tenant_id, administration_id, entity_name, entity_id,
    actor_user_id, action, changes
  ) values (
    case_scope.tenant_id, case_scope.administration_id, 'wvp_document_link',
    case when tg_op = 'DELETE' then old.id else new.id end,
    auth.uid(), audit_action, jsonb_build_object('before', before_data, 'after', after_data)
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function internal_security.audit_wvp_document_link_change() from public, anon, authenticated;
create trigger wvp_document_links_audit
after insert or update or delete on public.wvp_document_links
for each row execute function internal_security.audit_wvp_document_link_change();

alter table public.wvp_document_links enable row level security;
create policy wvp_document_links_read on public.wvp_document_links
for select to authenticated
using (
  removed_at is null
  and exists (
    select 1 from public.absence_cases c
    where c.id = wvp_document_links.case_id
      and internal_security.wvp_case_access(c, false)
      and public.can_access_employee_dossier(c.employee_id, 'document:read')
  )
  and internal_security.can_access_document(document_id, 'document:read')
);
revoke all on public.wvp_document_links from public, anon, authenticated;
grant select on public.wvp_document_links to authenticated;

create function internal_security.wvp_document_links(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_case_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare case_row public.absence_cases%rowtype;
begin
  if auth.uid() is null then raise exception 'WVP_FORBIDDEN' using errcode = '42501'; end if;
  select * into case_row from public.absence_cases c where c.id = requested_case_id;
  if case_row.id is null
    or case_row.tenant_id is distinct from requested_tenant_id
    or case_row.hr_group_id is distinct from requested_hr_group_id
    or case_row.administration_id is distinct from requested_administration_id
    or not internal_security.wvp_case_access(case_row, false) then
    raise exception 'WVP_FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.absence_guidance g where g.case_id = case_row.id) then
    raise exception 'WVP_NOT_STARTED';
  end if;
  if not public.can_access_employee_dossier(case_row.employee_id, 'document:read') then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', link.id,
      'taskId', link.task_id,
      'documentId', link.document_id,
      'createdAt', link.created_at
    ) order by link.created_at, link.id)
    from public.wvp_document_links link
    join public.absence_tasks task on task.id = link.task_id and task.case_id = link.case_id
    where link.case_id = case_row.id
      and link.removed_at is null
      and internal_security.wvp_document_milestone_valid(task.milestone_code)
      and internal_security.can_access_document(link.document_id, 'document:read')
  ), '[]'::jsonb);
end;
$$;
revoke all on function internal_security.wvp_document_links(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function internal_security.wvp_document_links(uuid, uuid, uuid, uuid) to authenticated;
create function public.wvp_document_links(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_case_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select internal_security.wvp_document_links(
    requested_tenant_id, requested_hr_group_id, requested_administration_id, requested_case_id
  );
$$;
revoke all on function public.wvp_document_links(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.wvp_document_links(uuid, uuid, uuid, uuid) to authenticated;

create function internal_security.wvp_document_link_add(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_case_id uuid,
  requested_task_id uuid,
  requested_document_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  case_row public.absence_cases%rowtype;
  guidance_row public.absence_guidance%rowtype;
  task_row public.absence_tasks%rowtype;
  document_row public.employee_documents%rowtype;
  link_id uuid;
begin
  if auth.uid() is null then raise exception 'WVP_FORBIDDEN' using errcode = '42501'; end if;
  select * into case_row from public.absence_cases c where c.id = requested_case_id for update;
  if case_row.id is null
    or case_row.tenant_id is distinct from requested_tenant_id
    or case_row.hr_group_id is distinct from requested_hr_group_id
    or case_row.administration_id is distinct from requested_administration_id
    or not internal_security.wvp_case_access(case_row, true) then
    raise exception 'WVP_FORBIDDEN' using errcode = '42501';
  end if;
  select * into guidance_row from public.absence_guidance g where g.case_id = case_row.id for update;
  if guidance_row.case_id is null then raise exception 'WVP_NOT_STARTED'; end if;
  if guidance_row.closed_at is not null then raise exception 'WVP_CLOSED'; end if;

  select * into task_row from public.absence_tasks t
    where t.id = requested_task_id and t.case_id = case_row.id
      and t.tenant_id = case_row.tenant_id and t.hr_group_id = case_row.hr_group_id;
  if task_row.id is null or not internal_security.wvp_document_milestone_valid(task_row.milestone_code) then
    raise exception 'WVP_MILESTONE_INVALID' using errcode = '22023';
  end if;

  select * into document_row from public.employee_documents d
    where d.id = requested_document_id
      and d.tenant_id = case_row.tenant_id
      and d.administration_id = case_row.administration_id
      and d.employee_id = case_row.employee_id
      and d.deleted_at is null;
  if document_row.id is null
    or not public.can_access_employee_dossier(case_row.employee_id, 'document:read')
    or not internal_security.can_access_document(document_row.id, 'document:read') then
    raise exception 'WVP_FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.wvp_document_links(case_id, task_id, document_id, created_by_user_id)
  values (case_row.id, task_row.id, document_row.id, auth.uid())
  on conflict (case_id, task_id, document_id) where removed_at is null do nothing
  returning id into link_id;
  if link_id is null then
    select link.id into link_id from public.wvp_document_links link
      where link.case_id = case_row.id and link.task_id = task_row.id
        and link.document_id = document_row.id and link.removed_at is null;
  end if;
  if link_id is null then raise exception 'WVP_LINK_FAILED'; end if;
  return link_id;
end;
$$;
revoke all on function internal_security.wvp_document_link_add(uuid, uuid, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function internal_security.wvp_document_link_add(uuid, uuid, uuid, uuid, uuid, uuid) to authenticated;
create function public.wvp_document_link_add(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_case_id uuid,
  requested_task_id uuid,
  requested_document_id uuid
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select internal_security.wvp_document_link_add(
    requested_tenant_id, requested_hr_group_id, requested_administration_id,
    requested_case_id, requested_task_id, requested_document_id
  );
$$;
revoke all on function public.wvp_document_link_add(uuid, uuid, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.wvp_document_link_add(uuid, uuid, uuid, uuid, uuid, uuid) to authenticated;

create function internal_security.wvp_document_link_remove(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_case_id uuid,
  requested_link_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  case_row public.absence_cases%rowtype;
  guidance_row public.absence_guidance%rowtype;
  link_row public.wvp_document_links%rowtype;
  document_row public.employee_documents%rowtype;
begin
  if auth.uid() is null then raise exception 'WVP_FORBIDDEN' using errcode = '42501'; end if;
  select * into case_row from public.absence_cases c where c.id = requested_case_id for update;
  if case_row.id is null
    or case_row.tenant_id is distinct from requested_tenant_id
    or case_row.hr_group_id is distinct from requested_hr_group_id
    or case_row.administration_id is distinct from requested_administration_id
    or not internal_security.wvp_case_access(case_row, true) then
    raise exception 'WVP_FORBIDDEN' using errcode = '42501';
  end if;
  select * into guidance_row from public.absence_guidance g where g.case_id = case_row.id for update;
  if guidance_row.case_id is null then raise exception 'WVP_NOT_STARTED'; end if;
  if guidance_row.closed_at is not null then raise exception 'WVP_CLOSED'; end if;
  select * into link_row from public.wvp_document_links link
    where link.id = requested_link_id and link.case_id = case_row.id for update;
  if link_row.id is null then raise exception 'WVP_LINK_NOT_FOUND'; end if;
  if link_row.removed_at is not null then return false; end if;

  select * into document_row from public.employee_documents d
    where d.id = link_row.document_id
      and d.tenant_id = case_row.tenant_id
      and d.administration_id = case_row.administration_id
      and d.employee_id = case_row.employee_id;
  if document_row.id is null
    or not public.can_access_employee_dossier(case_row.employee_id, 'document:read')
    or not internal_security.can_access_document(document_row.id, 'document:read') then
    raise exception 'WVP_FORBIDDEN' using errcode = '42501';
  end if;

  update public.wvp_document_links
    set removed_at = now(), removed_by_user_id = auth.uid()
    where id = link_row.id;
  return true;
end;
$$;
revoke all on function internal_security.wvp_document_link_remove(uuid, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function internal_security.wvp_document_link_remove(uuid, uuid, uuid, uuid, uuid) to authenticated;
create function public.wvp_document_link_remove(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_case_id uuid,
  requested_link_id uuid
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select internal_security.wvp_document_link_remove(
    requested_tenant_id, requested_hr_group_id, requested_administration_id,
    requested_case_id, requested_link_id
  );
$$;
revoke all on function public.wvp_document_link_remove(uuid, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.wvp_document_link_remove(uuid, uuid, uuid, uuid, uuid) to authenticated;

commit;
