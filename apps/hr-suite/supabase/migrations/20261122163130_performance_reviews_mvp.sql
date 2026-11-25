begin;

create table public.performance_review_rounds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  hr_group_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 160),
  round_type text not null default 'DEVELOPMENT' check (length(btrim(round_type)) between 1 and 80),
  introduction text not null check (length(btrim(introduction)) > 0),
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  start_date date not null,
  due_date date,
  rating_snapshot jsonb,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SCHEDULED', 'ACTIVE', 'CLOSED', 'CANCELLED')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id)
);

create table public.performance_review_dossiers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  round_id uuid not null,
  hr_group_id uuid not null,
  administration_id uuid not null,
  employee_id uuid not null,
  reviewer_employee_id uuid not null,
  phase text not null default 'WAITING_EMPLOYEE' check (phase in ('WAITING_EMPLOYEE', 'WAITING_MANAGER', 'WAITING_ACKNOWLEDGEMENT', 'COMPLETED_AGREED', 'COMPLETED_DISAGREED')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (round_id, employee_id),
  foreign key (tenant_id, hr_group_id, round_id) references public.performance_review_rounds(tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, administration_id) references public.administrations(tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, employee_id) references public.employees(tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, reviewer_employee_id) references public.employees(tenant_id, hr_group_id, id),
  check (employee_id <> reviewer_employee_id)
);

-- Concepten en interne informatie worden fysiek gescheiden van dossiermetadata.
create table public.performance_review_submissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  dossier_id uuid not null,
  kind text not null check (kind in ('SELF', 'MANAGER')),
  author_user_id uuid not null references auth.users(id),
  body text not null,
  score integer,
  rating_explanation text,
  meeting_date date,
  submitted_at timestamptz,
  version integer not null default 1 check (version > 0),
  unique (tenant_id, dossier_id, kind),
  foreign key (tenant_id, dossier_id) references public.performance_review_dossiers(tenant_id, id)
);

create table public.performance_review_private_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  dossier_id uuid not null,
  author_user_id uuid not null references auth.users(id),
  body text not null check (length(btrim(body)) > 0),
  version integer not null check (version > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, dossier_id, version),
  foreign key (tenant_id, dossier_id) references public.performance_review_dossiers(tenant_id, id)
);

create table public.performance_review_acknowledgements (
  tenant_id uuid not null,
  dossier_id uuid not null,
  actor_user_id uuid not null references auth.users(id),
  decision text not null check (decision in ('AGREE', 'DISAGREE')),
  reason text,
  created_at timestamptz not null default now(),
  primary key (tenant_id, dossier_id),
  foreign key (tenant_id, dossier_id) references public.performance_review_dossiers(tenant_id, id),
  check ((decision = 'AGREE' and reason is null) or (decision = 'DISAGREE' and reason is not null and length(btrim(reason)) > 0))
);

create table public.performance_review_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  dossier_id uuid not null,
  uploaded_by uuid not null references auth.users(id),
  storage_key text not null,
  original_filename text not null check (length(btrim(original_filename)) between 1 and 255),
  content_type text not null check (content_type in ('application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  file_size bigint not null check (file_size between 1 and 26214400),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (tenant_id, storage_key),
  foreign key (tenant_id, dossier_id) references public.performance_review_dossiers(tenant_id, id)
);

create table public.performance_review_appraisal_links (
  tenant_id uuid not null,
  dossier_id uuid not null,
  appraisal_item_id uuid not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (tenant_id, dossier_id, appraisal_item_id),
  foreign key (tenant_id, dossier_id) references public.performance_review_dossiers(tenant_id, id),
  foreign key (tenant_id, appraisal_item_id) references public.continuous_appraisal_items(tenant_id, id)
);

create table public.performance_review_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  round_id uuid,
  dossier_id uuid,
  actor_user_id uuid not null default auth.uid(),
  action text not null check (action in ('ROUND_CREATED', 'ROUND_PUBLISHED', 'ROUND_ACTIVATED', 'ROUND_CANCELLED', 'DOSSIER_CREATED', 'REVIEWER_REASSIGNED', 'SELF_SAVED', 'SELF_SUBMITTED', 'MANAGER_SAVED', 'MANAGER_SUBMITTED', 'ACKNOWLEDGED', 'PRIVATE_NOTE_SAVED', 'ATTACHMENT_ADDED', 'ATTACHMENT_REMOVED', 'APPRAISAL_LINKED', 'ROUND_CLOSED')),
  reason text,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, round_id) references public.performance_review_rounds(tenant_id, id),
  foreign key (tenant_id, dossier_id) references public.performance_review_dossiers(tenant_id, id)
);

create table public.performance_review_command_results (
  tenant_id uuid not null,
  actor_user_id uuid not null,
  operation text not null,
  idempotency_key text not null check (length(btrim(idempotency_key)) between 8 and 160),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{32}$'),
  result_id uuid not null,
  result_version integer,
  created_at timestamptz not null default now(),
  primary key (tenant_id, actor_user_id, operation, idempotency_key)
);

create index performance_review_dossiers_employee_idx on public.performance_review_dossiers (tenant_id, employee_id, created_at desc);
create index performance_review_dossiers_reviewer_idx on public.performance_review_dossiers (tenant_id, reviewer_employee_id, phase);
create index performance_review_rounds_group_idx on public.performance_review_rounds (tenant_id, hr_group_id, status, start_date);
create index performance_review_attachments_dossier_idx on public.performance_review_attachments (tenant_id, dossier_id, created_at);

insert into public.permissions (code, name, category, description)
values
  ('performance-review:manage', 'Gespreksrondes beheren', 'Workforce', 'Maakt, publiceert en sluit gespreksrondes binnen de bevoegde HR-groep.'),
  ('performance-review:read', 'Gesprekken lezen', 'Workforce', 'Leest geautoriseerde gespreksdossiers binnen de HR-context.'),
  ('performance-review:team-read', 'Teamgesprekken lezen', 'Workforce', 'Leest toegewezen teamgesprekken.'),
  ('performance-review:team-submit', 'Managerreactie indienen', 'Workforce', 'Dient managerreacties in voor toegewezen dossiers.'),
  ('performance-review:private-read', 'Interne gespreksinformatie lezen', 'Workforce', 'Leest vertrouwelijke interne gespreksinformatie.'),
  ('performance-review:private-write', 'Interne gespreksinformatie schrijven', 'Workforce', 'Beheert vertrouwelijke interne gespreksinformatie.'),
  ('self:performance-review:read', 'Eigen gesprekken lezen', 'Persoonlijk', 'Leest eigen gespreksdossiers.'),
  ('self:performance-review:submit', 'Eigen gesprek indienen', 'Persoonlijk', 'Dient eigen zelfreflectie en bevestiging in.')
on conflict (code) do update set name = excluded.name, category = excluded.category, description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role cross join public.permissions permission
where role.code = 'HR_ADMIN'
  and permission.code in ('performance-review:manage', 'performance-review:read', 'performance-review:private-read', 'performance-review:private-write')
on conflict do nothing;

-- Een TENANT_ADMIN krijgt deze gevoelige capability alleen wanneer het een
-- tenant-owned override is die al expliciet HR-groepsbeheer heeft. De globale
-- platformrol krijgt geen performance-review-grants.
insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'TENANT_ADMIN'
  and role.tenant_id is not null
  and permission.code in ('performance-review:manage', 'performance-review:read', 'performance-review:private-read', 'performance-review:private-write')
  and exists (
    select 1 from public.role_permissions existing_rp
    join public.permissions existing_permission on existing_permission.id = existing_rp.permission_id
    where existing_rp.management_role_id = role.id and existing_permission.code = 'hr-group:manage'
  )
on conflict do nothing;

create or replace function internal_security.performance_review_can_manage(requested_tenant uuid, requested_hr_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(internal_security.current_user_has_hr_group_permission(requested_tenant, requested_hr_group, 'performance-review:manage'), false)
$$;

create or replace function internal_security.performance_review_can_read_dossier(requested_tenant uuid, requested_hr_group uuid, requested_employee uuid, requested_reviewer uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    internal_security.performance_review_can_manage(requested_tenant, requested_hr_group)
    or internal_security.current_employee_id(requested_tenant, requested_hr_group) = requested_employee
    or (internal_security.current_employee_id(requested_tenant, requested_hr_group) = requested_reviewer
      and coalesce(internal_security.can_manage_employee(requested_employee, 'performance-review:team-read'), false)), false)
$$;

create or replace function internal_security.performance_review_can_private(requested_tenant uuid, requested_hr_group uuid, requested_employee uuid, requested_reviewer uuid, requested_write boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(internal_security.performance_review_can_manage(requested_tenant, requested_hr_group)
    or (internal_security.current_employee_id(requested_tenant, requested_hr_group) = requested_reviewer
      and coalesce(internal_security.can_manage_employee(requested_employee, case when requested_write then 'performance-review:private-write' else 'performance-review:private-read' end), false)), false)
$$;

create or replace function internal_security.performance_review_valid_rating_snapshot(snapshot jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare option_count integer;
begin
  if snapshot is null then return true; end if;
  if coalesce(jsonb_typeof(snapshot), '') <> 'object' or coalesce(jsonb_typeof(snapshot->'options'), '') <> 'array' then return false; end if;
  select jsonb_array_length(snapshot->'options') into option_count;
  if option_count not in (4, 5, 10) then return false; end if;
  if exists (select 1 from jsonb_array_elements(snapshot->'options') item where jsonb_typeof(item) <> 'object' or (item->>'score') !~ '^[0-9]+$' or length(btrim(coalesce(item->>'label', ''))) = 0 or length(btrim(coalesce(item->>'description', ''))) = 0) then return false; end if;
  if exists (select 1 from jsonb_array_elements(snapshot->'options') item where (item->>'score')::integer not between 1 and option_count) then return false; end if;
  if (select count(distinct (item->>'score')::integer) from jsonb_array_elements(snapshot->'options') item) <> option_count then return false; end if;
  if (select count(distinct item->>'label') from jsonb_array_elements(snapshot->'options') item) <> option_count then return false; end if;
  return true;
end;
$$;

create or replace function internal_security.performance_review_previous_result(requested_tenant uuid, requested_operation text, requested_key text, requested_hash text)
returns uuid language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare found_id uuid; found_hash text;
begin
  select result_id, request_hash into found_id, found_hash
  from public.performance_review_command_results
  where tenant_id = requested_tenant and actor_user_id = auth.uid() and operation = requested_operation and idempotency_key = requested_key;
  if found_id is null then return null; end if;
  if found_hash <> requested_hash then raise exception 'PERFORMANCE_IDEMPOTENCY_KEY_REUSED'; end if;
  return found_id;
end;
$$;

-- Serialize retries for the same actor/operation/key before checking or creating
-- the command result. The command table remains the durable idempotency record;
-- this transaction lock closes the concurrent first-request race.
create or replace function internal_security.performance_review_lock_idempotency(requested_operation text, requested_key text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(requested_operation || ':' || requested_key)::bigint);
end;
$$;

revoke all on function internal_security.performance_review_can_manage(uuid, uuid) from public, anon, authenticated;
revoke all on function internal_security.performance_review_can_read_dossier(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function internal_security.performance_review_can_private(uuid, uuid, uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function internal_security.performance_review_valid_rating_snapshot(jsonb) from public, anon, authenticated;
revoke all on function internal_security.performance_review_previous_result(uuid, text, text, text) from public, anon, authenticated;
revoke all on function internal_security.performance_review_lock_idempotency(text, text) from public, anon, authenticated;
grant execute on function internal_security.performance_review_can_manage(uuid, uuid) to authenticated;
grant execute on function internal_security.performance_review_can_read_dossier(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function internal_security.performance_review_can_private(uuid, uuid, uuid, uuid, boolean) to authenticated;
grant execute on function internal_security.performance_review_valid_rating_snapshot(jsonb) to authenticated;
grant execute on function internal_security.performance_review_previous_result(uuid, text, text, text) to authenticated;
grant execute on function internal_security.performance_review_lock_idempotency(text, text) to authenticated;

create or replace function public.create_performance_review_round(
  requested_hr_group uuid,
  requested_title text,
  requested_introduction text,
  requested_period_start date,
  requested_period_end date,
  requested_start_date date,
  requested_due_date date,
  requested_rating_snapshot jsonb,
  requested_idempotency_key text default null,
  requested_round_type text default 'DEVELOPMENT'
) returns public.performance_review_rounds
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare result_row public.performance_review_rounds; tenant_value uuid; previous_id uuid; request_hash text;
begin
  if auth.uid() is null then raise exception 'PERFORMANCE_AUTH_REQUIRED'; end if;
  select tenant_id into tenant_value from public.hr_groups where id = requested_hr_group and is_active;
  request_hash := md5(concat_ws('|', requested_hr_group::text, requested_title, requested_introduction, requested_period_start::text, requested_period_end::text, requested_start_date::text, requested_due_date::text, requested_rating_snapshot::text, requested_round_type));
  if requested_idempotency_key is not null then
    perform internal_security.performance_review_lock_idempotency('ROUND_CREATED', requested_idempotency_key);
    previous_id := internal_security.performance_review_previous_result(tenant_value, 'ROUND_CREATED', requested_idempotency_key, request_hash);
    if previous_id is not null then select * into result_row from public.performance_review_rounds where id = previous_id; return result_row; end if;
  end if;
  if not internal_security.performance_review_can_manage(tenant_value, requested_hr_group) then raise exception 'PERFORMANCE_FORBIDDEN'; end if;
  if requested_period_end < requested_period_start then raise exception 'PERFORMANCE_PERIOD_INVALID'; end if;
  if not internal_security.performance_review_valid_rating_snapshot(requested_rating_snapshot) then raise exception 'PERFORMANCE_RATING_INVALID'; end if;
  if length(btrim(coalesce(requested_round_type, ''))) not between 1 and 80 then raise exception 'PERFORMANCE_ROUND_TYPE_INVALID'; end if;
  insert into public.performance_review_rounds (tenant_id, hr_group_id, title, round_type, introduction, period_start, period_end, start_date, due_date, rating_snapshot, status, created_by)
  select tenant_id, requested_hr_group, btrim(requested_title), btrim(requested_round_type), btrim(requested_introduction), requested_period_start, requested_period_end, requested_start_date, requested_due_date, requested_rating_snapshot,
    case when requested_start_date > current_date then 'SCHEDULED' else 'DRAFT' end, auth.uid()
  from public.hr_groups where id = requested_hr_group and is_active returning * into result_row;
  if result_row.id is null then raise exception 'PERFORMANCE_HR_GROUP_NOT_FOUND'; end if;
  if requested_idempotency_key is not null then insert into public.performance_review_command_results (tenant_id, actor_user_id, operation, idempotency_key, request_hash, result_id, result_version) values (result_row.tenant_id, auth.uid(), 'ROUND_CREATED', requested_idempotency_key, request_hash, result_row.id, result_row.version) on conflict do nothing; end if;
  insert into public.performance_review_audit_events (tenant_id, round_id, action) values (result_row.tenant_id, result_row.id, 'ROUND_CREATED');
  return result_row;
end;
$$;

create or replace function public.publish_performance_review_round(requested_round uuid, expected_version integer, requested_idempotency_key text default null)
returns public.performance_review_rounds
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare result_row public.performance_review_rounds; previous_id uuid; tenant_value uuid; request_hash text;
begin
  select tenant_id into tenant_value from public.performance_review_rounds where id = requested_round;
  request_hash := md5(concat_ws('|', requested_round::text, expected_version::text));
  if requested_idempotency_key is not null then perform internal_security.performance_review_lock_idempotency('ROUND_PUBLISHED', requested_idempotency_key); previous_id := internal_security.performance_review_previous_result(tenant_value, 'ROUND_PUBLISHED', requested_idempotency_key, request_hash); if previous_id is not null then select * into result_row from public.performance_review_rounds where id = previous_id; return result_row; end if; end if;
  update public.performance_review_rounds r set status = case when r.start_date > current_date then 'SCHEDULED' else 'ACTIVE' end, version = r.version + 1
  where r.id = requested_round and r.version = expected_version
    and internal_security.performance_review_can_manage(r.tenant_id, r.hr_group_id)
  returning r.* into result_row;
  if result_row.id is null then raise exception 'PERFORMANCE_VERSION_OR_FORBIDDEN'; end if;
  if requested_idempotency_key is not null then insert into public.performance_review_command_results (tenant_id, actor_user_id, operation, idempotency_key, request_hash, result_id, result_version) values (result_row.tenant_id, auth.uid(), 'ROUND_PUBLISHED', requested_idempotency_key, request_hash, result_row.id, result_row.version) on conflict do nothing; end if;
  insert into public.performance_review_audit_events (tenant_id, round_id, action) values (result_row.tenant_id, result_row.id, 'ROUND_PUBLISHED');
  return result_row;
end;
$$;

create or replace function public.add_performance_review_dossier(
  requested_round uuid, requested_employee uuid, requested_reviewer uuid, requested_administration uuid, requested_idempotency_key text default null
) returns public.performance_review_dossiers
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare result_row public.performance_review_dossiers; round_row public.performance_review_rounds; employee_group uuid; employee_tenant uuid; previous_id uuid; request_hash text;
begin
  select * into round_row from public.performance_review_rounds where id = requested_round for update;
  request_hash := md5(concat_ws('|', requested_round::text, requested_employee::text, requested_reviewer::text, requested_administration::text));
  if requested_idempotency_key is not null then perform internal_security.performance_review_lock_idempotency('DOSSIER_CREATED', requested_idempotency_key); previous_id := internal_security.performance_review_previous_result(round_row.tenant_id, 'DOSSIER_CREATED', requested_idempotency_key, request_hash); if previous_id is not null then select * into result_row from public.performance_review_dossiers where id = previous_id; return result_row; end if; end if;
  -- HR prepares the participant list while a same-day round is still a draft.
  -- A future round remains scheduled and its PMUX task starts only on activation.
  if round_row.id is null or round_row.status not in ('DRAFT', 'SCHEDULED', 'ACTIVE') then raise exception 'PERFORMANCE_ROUND_NOT_ACTIVE'; end if;
  if not internal_security.performance_review_can_manage(round_row.tenant_id, round_row.hr_group_id) then raise exception 'PERFORMANCE_FORBIDDEN'; end if;
  select tenant_id, hr_group_id into employee_tenant, employee_group from public.employees where id = requested_employee and is_active and not is_archived and deleted_at is null;
  if employee_tenant is distinct from round_row.tenant_id or employee_group is distinct from round_row.hr_group_id then raise exception 'PERFORMANCE_SCOPE_INVALID'; end if;
  if not exists (select 1 from public.employees where id = requested_reviewer and tenant_id = round_row.tenant_id and hr_group_id = round_row.hr_group_id and is_active and not is_archived and deleted_at is null and auth_user_id is not null) then raise exception 'PERFORMANCE_REVIEWER_INVALID'; end if;
  if not exists (select 1 from public.administrations where id = requested_administration and tenant_id = round_row.tenant_id and hr_group_id = round_row.hr_group_id and is_active) then raise exception 'PERFORMANCE_ADMINISTRATION_INVALID'; end if;
  if not exists (select 1 from public.employee_organizations org where org.tenant_id = round_row.tenant_id and org.hr_group_id = round_row.hr_group_id and org.employee_id = requested_employee and org.direct_manager_id = requested_reviewer and org.effective_from <= current_date and (org.effective_to is null or org.effective_to >= current_date)) then raise exception 'PERFORMANCE_REVIEWER_NOT_CURRENT_MANAGER'; end if;
  insert into public.performance_review_dossiers (tenant_id, round_id, hr_group_id, administration_id, employee_id, reviewer_employee_id)
  values (round_row.tenant_id, round_row.id, round_row.hr_group_id, requested_administration, requested_employee, requested_reviewer)
  on conflict (round_id, employee_id) do update set reviewer_employee_id = public.performance_review_dossiers.reviewer_employee_id
  returning * into result_row;
  if requested_idempotency_key is not null then insert into public.performance_review_command_results (tenant_id, actor_user_id, operation, idempotency_key, request_hash, result_id, result_version) values (result_row.tenant_id, auth.uid(), 'DOSSIER_CREATED', requested_idempotency_key, request_hash, result_row.id, result_row.version) on conflict do nothing; end if;
  insert into public.performance_review_audit_events (tenant_id, round_id, dossier_id, action) values (result_row.tenant_id, result_row.round_id, result_row.id, 'DOSSIER_CREATED');
  return result_row;
end;
$$;

create or replace function public.save_performance_review_self(
  requested_dossier uuid, requested_body text, expected_version integer, submit_now boolean default false
) returns public.performance_review_dossiers
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare d public.performance_review_dossiers; s public.performance_review_submissions; actor uuid; r public.performance_review_rounds;
begin
  select * into d from public.performance_review_dossiers where id = requested_dossier;
  select * into r from public.performance_review_rounds where id = d.round_id for update;
  select * into d from public.performance_review_dossiers where id = requested_dossier for update;
  actor := internal_security.current_employee_id(d.tenant_id, d.hr_group_id);
  if d.id is null or actor is distinct from d.employee_id then raise exception 'PERFORMANCE_FORBIDDEN'; end if;
  if r.status <> 'ACTIVE' then raise exception 'PERFORMANCE_ROUND_NOT_ACTIVE'; end if;
  if d.phase <> 'WAITING_EMPLOYEE' or d.version <> expected_version then raise exception 'PERFORMANCE_VERSION_OR_PHASE_CONFLICT'; end if;
  if length(btrim(requested_body)) = 0 then raise exception 'PERFORMANCE_SELF_REQUIRED'; end if;
  insert into public.performance_review_submissions (tenant_id, dossier_id, kind, author_user_id, body, submitted_at)
  values (d.tenant_id, d.id, 'SELF', auth.uid(), btrim(requested_body), case when submit_now then now() end)
  on conflict (tenant_id, dossier_id, kind) do update set body = excluded.body, submitted_at = excluded.submitted_at, version = public.performance_review_submissions.version + 1
    where public.performance_review_submissions.submitted_at is null
  returning * into s;
  if submit_now then
    update public.performance_review_dossiers set phase = 'WAITING_MANAGER', version = version + 1 where id = d.id and version = expected_version returning * into d;
    if d.id is null then raise exception 'PERFORMANCE_VERSION_CONFLICT'; end if;
  else
    update public.performance_review_dossiers set version = version + 1 where id = d.id and version = expected_version returning * into d;
  end if;
  insert into public.performance_review_audit_events (tenant_id, dossier_id, action) values (d.tenant_id, d.id, case when submit_now then 'SELF_SUBMITTED' else 'SELF_SAVED' end);
  return d;
end;
$$;

create or replace function public.save_performance_review_manager(
  requested_dossier uuid, requested_body text, requested_meeting_date date, requested_score integer, requested_rating_explanation text,
  expected_version integer, submit_now boolean default false
) returns public.performance_review_dossiers
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare d public.performance_review_dossiers; r public.performance_review_rounds; actor uuid; s public.performance_review_submissions;
begin
  select * into d from public.performance_review_dossiers where id = requested_dossier;
  if d.id is null then raise exception 'PERFORMANCE_NOT_FOUND'; end if;
  select * into r from public.performance_review_rounds where id = d.round_id for update;
  select * into d from public.performance_review_dossiers where id = requested_dossier for update;
  actor := internal_security.current_employee_id(d.tenant_id, d.hr_group_id);
  if actor is distinct from d.reviewer_employee_id or not internal_security.can_manage_employee(d.employee_id, 'performance-review:team-submit') then raise exception 'PERFORMANCE_FORBIDDEN'; end if;
  if d.phase <> 'WAITING_MANAGER' or d.version <> expected_version then raise exception 'PERFORMANCE_VERSION_OR_PHASE_CONFLICT'; end if;
  if r.status <> 'ACTIVE' then raise exception 'PERFORMANCE_ROUND_NOT_ACTIVE'; end if;
  if length(btrim(requested_body)) = 0 then raise exception 'PERFORMANCE_MANAGER_REQUIRED'; end if;
  if r.rating_snapshot is null and (requested_score is not null or requested_rating_explanation is not null) then raise exception 'PERFORMANCE_RATING_NOT_ALLOWED'; end if;
  if r.rating_snapshot is not null and (requested_score is null or not exists (select 1 from jsonb_array_elements(r.rating_snapshot->'options') item where (item->>'score')::integer = requested_score) or length(btrim(coalesce(requested_rating_explanation, ''))) = 0) then raise exception 'PERFORMANCE_RATING_REQUIRED'; end if;
  insert into public.performance_review_submissions (tenant_id, dossier_id, kind, author_user_id, body, score, rating_explanation, meeting_date, submitted_at)
  values (d.tenant_id, d.id, 'MANAGER', auth.uid(), btrim(requested_body), requested_score, nullif(btrim(requested_rating_explanation), ''), requested_meeting_date, case when submit_now then now() end)
  on conflict (tenant_id, dossier_id, kind) do update set body = excluded.body, score = excluded.score, rating_explanation = excluded.rating_explanation, meeting_date = excluded.meeting_date, submitted_at = excluded.submitted_at, version = public.performance_review_submissions.version + 1
    where public.performance_review_submissions.submitted_at is null
  returning * into s;
  if submit_now then
    update public.performance_review_dossiers set phase = 'WAITING_ACKNOWLEDGEMENT', version = version + 1 where id = d.id and version = expected_version returning * into d;
    if d.id is null then raise exception 'PERFORMANCE_VERSION_CONFLICT'; end if;
  else
    update public.performance_review_dossiers set version = version + 1 where id = d.id and version = expected_version returning * into d;
  end if;
  insert into public.performance_review_audit_events (tenant_id, dossier_id, action) values (d.tenant_id, d.id, case when submit_now then 'MANAGER_SUBMITTED' else 'MANAGER_SAVED' end);
  return d;
end;
$$;

create or replace function public.acknowledge_performance_review(
  requested_dossier uuid, requested_decision text, requested_reason text, expected_version integer
) returns public.performance_review_dossiers
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare d public.performance_review_dossiers; r public.performance_review_rounds; actor uuid;
begin
  select * into d from public.performance_review_dossiers where id = requested_dossier;
  -- Lock the parent round before the dossier so close/cancel cannot race this acknowledgement.
  select * into r from public.performance_review_rounds where id = d.round_id for update;
  select * into d from public.performance_review_dossiers where id = requested_dossier for update;
  actor := internal_security.current_employee_id(d.tenant_id, d.hr_group_id);
  if d.id is null or actor is distinct from d.employee_id or d.phase <> 'WAITING_ACKNOWLEDGEMENT' or d.version <> expected_version then raise exception 'PERFORMANCE_FORBIDDEN_OR_CONFLICT'; end if;
  if requested_decision not in ('AGREE', 'DISAGREE') or (requested_decision = 'DISAGREE' and length(btrim(coalesce(requested_reason, ''))) = 0) or (requested_decision = 'AGREE' and requested_reason is not null) then raise exception 'PERFORMANCE_ACK_INVALID'; end if;
  insert into public.performance_review_acknowledgements (tenant_id, dossier_id, actor_user_id, decision, reason) values (d.tenant_id, d.id, auth.uid(), requested_decision, nullif(btrim(requested_reason), ''));
  update public.performance_review_dossiers set phase = case when requested_decision = 'AGREE' then 'COMPLETED_AGREED' else 'COMPLETED_DISAGREED' end, version = version + 1 where id = d.id and version = expected_version returning * into d;
  if d.id is null then raise exception 'PERFORMANCE_VERSION_CONFLICT'; end if;
  insert into public.performance_review_audit_events (tenant_id, dossier_id, action) values (d.tenant_id, d.id, 'ACKNOWLEDGED');
  return d;
end;
$$;

create or replace function public.save_performance_review_private_note(
  requested_dossier uuid, requested_body text
) returns public.performance_review_private_notes
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare d public.performance_review_dossiers; r public.performance_review_rounds; result_row public.performance_review_private_notes; next_version integer;
begin
  select * into d from public.performance_review_dossiers where id = requested_dossier;
  select * into r from public.performance_review_rounds where id = d.round_id for update;
  select * into d from public.performance_review_dossiers where id = requested_dossier for update;
  if d.id is null or not internal_security.performance_review_can_private(d.tenant_id, d.hr_group_id, d.employee_id, d.reviewer_employee_id, true) then raise exception 'PERFORMANCE_PRIVATE_FORBIDDEN'; end if;
  if exists (select 1 from public.performance_review_rounds where id = d.round_id and status in ('CLOSED', 'CANCELLED')) then raise exception 'PERFORMANCE_ROUND_CLOSED'; end if;
  if length(btrim(requested_body)) = 0 then raise exception 'PERFORMANCE_PRIVATE_REQUIRED'; end if;
  select coalesce(max(version), 0) + 1 into next_version from public.performance_review_private_notes where tenant_id = d.tenant_id and dossier_id = d.id;
  insert into public.performance_review_private_notes (tenant_id, dossier_id, author_user_id, body, version) values (d.tenant_id, d.id, auth.uid(), btrim(requested_body), next_version) returning * into result_row;
  insert into public.performance_review_audit_events (tenant_id, dossier_id, action) values (d.tenant_id, d.id, 'PRIVATE_NOTE_SAVED');
  return result_row;
end;
$$;

create or replace function public.add_performance_review_attachment(
  requested_dossier uuid, requested_storage_key text, requested_filename text, requested_content_type text, requested_size bigint, requested_checksum text, requested_idempotency_key text default null
) returns public.performance_review_attachments
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare d public.performance_review_dossiers; r public.performance_review_rounds; result_row public.performance_review_attachments; actor uuid; previous_id uuid; request_hash text;
begin
  select * into d from public.performance_review_dossiers where id = requested_dossier;
  select * into r from public.performance_review_rounds where id = d.round_id for update;
  select * into d from public.performance_review_dossiers where id = requested_dossier for update;
  actor := internal_security.current_employee_id(d.tenant_id, d.hr_group_id);
  if d.id is null or actor is distinct from d.reviewer_employee_id or d.phase <> 'WAITING_MANAGER' or not internal_security.can_manage_employee(d.employee_id, 'performance-review:team-submit') then raise exception 'PERFORMANCE_ATTACHMENT_FORBIDDEN'; end if;
  if not exists (select 1 from public.performance_review_rounds where id = d.round_id and status = 'ACTIVE') then raise exception 'PERFORMANCE_ROUND_NOT_ACTIVE'; end if;
  if requested_content_type not in ('application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') or requested_size > 26214400 or requested_checksum !~ '^[0-9a-f]{64}$' then raise exception 'PERFORMANCE_ATTACHMENT_INVALID'; end if;
  if requested_idempotency_key is null or length(btrim(requested_idempotency_key)) not between 8 and 160 then raise exception 'PERFORMANCE_IDEMPOTENCY_KEY_REQUIRED'; end if;
  request_hash := md5(concat_ws('|', d.id::text, btrim(requested_filename), requested_content_type, requested_size::text, requested_checksum));
  perform internal_security.performance_review_lock_idempotency('ATTACHMENT_CREATED', requested_idempotency_key);
  previous_id := internal_security.performance_review_previous_result(d.tenant_id, 'ATTACHMENT_CREATED', requested_idempotency_key, request_hash);
  if previous_id is not null then
    select * into result_row from public.performance_review_attachments where tenant_id = d.tenant_id and id = previous_id and dossier_id = d.id;
    if result_row.id is null then raise exception 'PERFORMANCE_ATTACHMENT_NOT_FOUND'; end if;
    return result_row;
  end if;
  insert into public.performance_review_attachments (tenant_id, dossier_id, uploaded_by, storage_key, original_filename, content_type, file_size, checksum_sha256)
  values (d.tenant_id, d.id, auth.uid(), requested_storage_key, btrim(requested_filename), requested_content_type, requested_size, requested_checksum) returning * into result_row;
  insert into public.performance_review_command_results (tenant_id, actor_user_id, operation, idempotency_key, request_hash, result_id, result_version)
  values (d.tenant_id, auth.uid(), 'ATTACHMENT_CREATED', requested_idempotency_key, request_hash, result_row.id, null);
  insert into public.performance_review_audit_events (tenant_id, dossier_id, action) values (d.tenant_id, d.id, 'ATTACHMENT_ADDED');
  return result_row;
end;
$$;

create or replace function public.link_performance_review_appraisal(
  requested_dossier uuid, requested_item uuid
) returns public.performance_review_appraisal_links
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare d public.performance_review_dossiers; r public.performance_review_rounds; result_row public.performance_review_appraisal_links;
begin
  select * into d from public.performance_review_dossiers where id = requested_dossier;
  if d.id is null then raise exception 'PERFORMANCE_NOT_FOUND'; end if;
  -- All dossier mutations take the round lock first. This gives close/cancel and
  -- dossier writes one deterministic lock order and prevents a close/upload race.
  select * into r from public.performance_review_rounds where id = d.round_id for update;
  select * into d from public.performance_review_dossiers where id = requested_dossier for update;
  if d.id is null or not internal_security.performance_review_can_read_dossier(d.tenant_id, d.hr_group_id, d.employee_id, d.reviewer_employee_id) then raise exception 'PERFORMANCE_FORBIDDEN'; end if;
  if r.id is null or r.status in ('CLOSED', 'CANCELLED') then raise exception 'PERFORMANCE_ROUND_CLOSED'; end if;
  if internal_security.current_employee_id(d.tenant_id, d.hr_group_id) <> d.employee_id
    and not internal_security.performance_review_can_manage(d.tenant_id, d.hr_group_id)
    and not coalesce(internal_security.can_manage_employee(d.employee_id, 'continuous-appraisal:read'), false) then raise exception 'PERFORMANCE_APPRAISAL_FORBIDDEN'; end if;
  if not exists (select 1 from public.continuous_appraisal_items item where item.id = requested_item and item.tenant_id = d.tenant_id and item.employee_id = d.employee_id) then raise exception 'PERFORMANCE_APPRAISAL_INVALID'; end if;
  insert into public.performance_review_appraisal_links (tenant_id, dossier_id, appraisal_item_id, created_by) values (d.tenant_id, d.id, requested_item, auth.uid()) on conflict do nothing returning * into result_row;
  if result_row.dossier_id is null then select * into result_row from public.performance_review_appraisal_links where tenant_id = d.tenant_id and dossier_id = d.id and appraisal_item_id = requested_item; end if;
  insert into public.performance_review_audit_events (tenant_id, dossier_id, action) values (d.tenant_id, d.id, 'APPRAISAL_LINKED');
  return result_row;
end;
$$;

create or replace function public.close_performance_review_round(requested_round uuid, requested_reason text, expected_version integer, requested_idempotency_key text default null)
returns public.performance_review_rounds
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare result_row public.performance_review_rounds; previous_id uuid; tenant_value uuid; request_hash text;
begin
  if length(btrim(requested_reason)) = 0 then raise exception 'PERFORMANCE_CLOSE_REASON_REQUIRED'; end if;
  select tenant_id into tenant_value from public.performance_review_rounds where id = requested_round;
  request_hash := md5(concat_ws('|', requested_round::text, requested_reason, expected_version::text));
  if requested_idempotency_key is not null then perform internal_security.performance_review_lock_idempotency('ROUND_CLOSED', requested_idempotency_key); previous_id := internal_security.performance_review_previous_result(tenant_value, 'ROUND_CLOSED', requested_idempotency_key, request_hash); if previous_id is not null then select * into result_row from public.performance_review_rounds where id = previous_id; return result_row; end if; end if;
  update public.performance_review_rounds r set status = 'CLOSED', version = r.version + 1
  where r.id = requested_round and r.version = expected_version and r.status in ('DRAFT', 'SCHEDULED', 'ACTIVE')
    and internal_security.performance_review_can_manage(r.tenant_id, r.hr_group_id)
  returning r.* into result_row;
  if result_row.id is null then raise exception 'PERFORMANCE_CLOSE_FORBIDDEN_OR_CONFLICT'; end if;
  if requested_idempotency_key is not null then insert into public.performance_review_command_results (tenant_id, actor_user_id, operation, idempotency_key, request_hash, result_id, result_version) values (result_row.tenant_id, auth.uid(), 'ROUND_CLOSED', requested_idempotency_key, request_hash, result_row.id, result_row.version) on conflict do nothing; end if;
  insert into public.performance_review_audit_events (tenant_id, round_id, action, reason) values (result_row.tenant_id, result_row.id, 'ROUND_CLOSED', btrim(requested_reason));
  return result_row;
end;
$$;

create or replace function public.activate_performance_review_round(requested_round uuid)
returns public.performance_review_rounds
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare result_row public.performance_review_rounds;
begin
  select * into result_row from public.performance_review_rounds where id = requested_round for update;
  if result_row.id is null or not internal_security.performance_review_can_manage(result_row.tenant_id, result_row.hr_group_id) then raise exception 'PERFORMANCE_FORBIDDEN'; end if;
  if result_row.status = 'ACTIVE' then return result_row; end if;
  if result_row.status <> 'SCHEDULED' or result_row.start_date > current_date then raise exception 'PERFORMANCE_NOT_DUE'; end if;
  update public.performance_review_rounds set status = 'ACTIVE', version = version + 1 where id = requested_round and status = 'SCHEDULED' returning * into result_row;
  insert into public.performance_review_audit_events (tenant_id, round_id, action) values (result_row.tenant_id, result_row.id, 'ROUND_ACTIVATED');
  return result_row;
end;
$$;

create or replace function public.cancel_performance_review_round(requested_round uuid, requested_reason text, expected_version integer)
returns public.performance_review_rounds
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare result_row public.performance_review_rounds;
begin
  if length(btrim(requested_reason)) = 0 then raise exception 'PERFORMANCE_CANCEL_REASON_REQUIRED'; end if;
  update public.performance_review_rounds r set status = 'CANCELLED', version = r.version + 1
  where r.id = requested_round and r.version = expected_version and r.status in ('DRAFT', 'SCHEDULED', 'ACTIVE')
    and internal_security.performance_review_can_manage(r.tenant_id, r.hr_group_id)
  returning r.* into result_row;
  if result_row.id is null then raise exception 'PERFORMANCE_CANCEL_FORBIDDEN_OR_CONFLICT'; end if;
  insert into public.performance_review_audit_events (tenant_id, round_id, action, reason) values (result_row.tenant_id, result_row.id, 'ROUND_CANCELLED', btrim(requested_reason));
  return result_row;
end;
$$;

create policy performance_review_rounds_select on public.performance_review_rounds for select to authenticated using (
  internal_security.performance_review_can_manage(tenant_id, hr_group_id)
  or exists (select 1 from public.performance_review_dossiers d where d.tenant_id = performance_review_rounds.tenant_id and d.round_id = performance_review_rounds.id and internal_security.performance_review_can_read_dossier(d.tenant_id, d.hr_group_id, d.employee_id, d.reviewer_employee_id))
);

create policy performance_review_dossiers_select on public.performance_review_dossiers for select to authenticated using (
  internal_security.performance_review_can_read_dossier(tenant_id, hr_group_id, employee_id, reviewer_employee_id)
);

create policy performance_review_submissions_select on public.performance_review_submissions for select to authenticated using (
  exists (select 1 from public.performance_review_dossiers d where d.tenant_id = performance_review_submissions.tenant_id and d.id = performance_review_submissions.dossier_id and (
    (performance_review_submissions.author_user_id = auth.uid() and performance_review_submissions.submitted_at is null)
    or (performance_review_submissions.submitted_at is not null and internal_security.performance_review_can_read_dossier(d.tenant_id, d.hr_group_id, d.employee_id, d.reviewer_employee_id))
  ))
);

create policy performance_review_acknowledgements_select on public.performance_review_acknowledgements for select to authenticated using (
  exists (select 1 from public.performance_review_dossiers d where d.tenant_id = performance_review_acknowledgements.tenant_id and d.id = performance_review_acknowledgements.dossier_id and internal_security.performance_review_can_read_dossier(d.tenant_id, d.hr_group_id, d.employee_id, d.reviewer_employee_id))
);

create policy performance_review_private_notes_select on public.performance_review_private_notes for select to authenticated using (
  exists (select 1 from public.performance_review_dossiers d where d.tenant_id = performance_review_private_notes.tenant_id and d.id = performance_review_private_notes.dossier_id and internal_security.performance_review_can_private(d.tenant_id, d.hr_group_id, d.employee_id, d.reviewer_employee_id))
);

create policy performance_review_attachments_select on public.performance_review_attachments for select to authenticated using (
  exists (select 1 from public.performance_review_dossiers d join public.performance_review_submissions s on s.tenant_id = d.tenant_id and s.dossier_id = d.id and s.kind = 'MANAGER' where d.tenant_id = performance_review_attachments.tenant_id and d.id = performance_review_attachments.dossier_id and s.submitted_at is not null and internal_security.performance_review_can_read_dossier(d.tenant_id, d.hr_group_id, d.employee_id, d.reviewer_employee_id))
);

create policy performance_review_appraisal_links_select on public.performance_review_appraisal_links for select to authenticated using (
  exists (select 1 from public.performance_review_dossiers d where d.tenant_id = performance_review_appraisal_links.tenant_id and d.id = performance_review_appraisal_links.dossier_id and internal_security.performance_review_can_read_dossier(d.tenant_id, d.hr_group_id, d.employee_id, d.reviewer_employee_id))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('performance-review-attachments', 'performance-review-attachments', false, 26214400,
  array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[])
on conflict (id) do update set public = false, file_size_limit = 26214400;

create policy performance_review_storage_select on storage.objects for select to authenticated using (
  bucket_id = 'performance-review-attachments' and exists (
    select 1 from public.performance_review_attachments a join public.performance_review_dossiers d on d.tenant_id = a.tenant_id and d.id = a.dossier_id
    join public.performance_review_submissions s on s.tenant_id = d.tenant_id and s.dossier_id = d.id and s.kind = 'MANAGER' and s.submitted_at is not null
    where a.storage_key = storage.objects.name and internal_security.performance_review_can_read_dossier(d.tenant_id, d.hr_group_id, d.employee_id, d.reviewer_employee_id)
  )
);

create policy performance_review_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'performance-review-attachments' and exists (
    select 1 from public.performance_review_attachments a join public.performance_review_dossiers d on d.tenant_id = a.tenant_id and d.id = a.dossier_id
    where a.storage_key = storage.objects.name and a.uploaded_by = auth.uid() and d.phase = 'WAITING_MANAGER'
  )
);

create or replace function public.search_performance_review_candidates(
  requested_hr_group uuid,
  requested_search text default '',
  requested_administration uuid default null,
  requested_department uuid default null,
  requested_job uuid default null,
  requested_location uuid default null,
  requested_manager uuid default null,
  requested_employment_status text default 'ACTIVE',
  requested_offset integer default 0,
  requested_limit integer default 25,
  requested_employee uuid default null
) returns table (
  employee_id uuid, first_name text, birth_name text, employee_number text, hr_group_id uuid,
  direct_manager_id uuid, direct_manager_name text, administration_id uuid, administration_name text,
  department_id uuid, department_name text, job_id uuid, job_title text, location_id uuid,
  location_name text, employment_status text, assignment_status text, eligibility_message text, total_count bigint
)
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare tenant_value uuid; search_value text := nullif(btrim(coalesce(requested_search, '')), '');
begin
  if auth.uid() is null then raise exception 'PERFORMANCE_AUTH_REQUIRED'; end if;
  if requested_offset < 0 or requested_limit not between 1 and 100 then raise exception 'PERFORMANCE_PAGE_INVALID'; end if;
  if upper(coalesce(requested_employment_status, 'ACTIVE')) not in ('ACTIVE', 'ENDED', 'ALL') then raise exception 'PERFORMANCE_EMPLOYMENT_STATUS_INVALID'; end if;
  select group_row.tenant_id into tenant_value from public.hr_groups group_row where group_row.id = requested_hr_group and group_row.is_active;
  if tenant_value is null or not internal_security.performance_review_can_manage(tenant_value, requested_hr_group) then raise exception 'PERFORMANCE_FORBIDDEN'; end if;
  if requested_employee is not null then
    if not exists (select 1 from public.employees employee where employee.id = requested_employee and employee.tenant_id = tenant_value and employee.hr_group_id = requested_hr_group and employee.is_active and not employee.is_archived and employee.deleted_at is null) then
      raise exception 'PERFORMANCE_EMPLOYEE_NOT_FOUND';
    end if;
    return query
    with subject_organizations as (
      select organization.* from public.employee_organizations organization
       where organization.tenant_id = tenant_value and organization.hr_group_id = requested_hr_group
         and organization.employee_id = requested_employee and organization.effective_from <= current_date
         and (organization.effective_to is null or organization.effective_to >= current_date)
         and (requested_administration is null or organization.administration_id = requested_administration)
    ), candidate_ids as (
      select distinct candidate.employee_id as id, subject_organization.direct_manager_id,
        subject_organization.administration_id, subject_organization.department_id,
        subject_organization.job_id, subject_organization.job_title, subject_organization.location_id,
        subject_organization.hr_group_id, subject_organization.tenant_id
      from subject_organizations subject_organization
      cross join lateral (values (subject_organization.direct_manager_id), (subject_organization.direct_manager_deputy_id)) candidate(employee_id)
      where candidate.employee_id is not null
        and (requested_manager is null or candidate.employee_id = requested_manager)
    ), reviewer_rows as (
      select reviewer.id, reviewer.first_name, reviewer.birth_name, reviewer.employee_number, reviewer.hr_group_id,
        candidate.direct_manager_id, subject_manager.first_name as manager_first_name, subject_manager.birth_name as manager_birth_name,
        candidate.administration_id, administration.name as administration_name, candidate.department_id, department.name as department_name,
        candidate.job_id, coalesce(candidate.job_title, job_revision.name) as resolved_job_title,
        candidate.location_id, location.name as location_name
      from candidate_ids candidate
      join public.employees reviewer on reviewer.id = candidate.id and reviewer.tenant_id = tenant_value
        and reviewer.hr_group_id = requested_hr_group and reviewer.is_active and not reviewer.is_archived and reviewer.deleted_at is null and reviewer.auth_user_id is not null
      join lateral (
        select employment_row.id
        from public.employments employment_row
        where employment_row.tenant_id = tenant_value and employment_row.hr_group_id = requested_hr_group
          and employment_row.employee_id = reviewer.id and employment_row.is_primary
          and employment_row.deleted_at is null and employment_row.record_status = 'CONFIRMED'
          and employment_row.starts_on <= current_date
          and (employment_row.ends_on is null or employment_row.ends_on >= current_date)
        order by employment_row.starts_on desc, employment_row.id
        limit 1
      ) reviewer_employment on true
      join lateral (
        select reviewer_organization.id
        from public.employee_organizations reviewer_organization
        where reviewer_organization.tenant_id = tenant_value and reviewer_organization.hr_group_id = requested_hr_group
          and reviewer_organization.employee_id = reviewer.id and reviewer_organization.effective_from <= current_date
          and (reviewer_organization.effective_to is null or reviewer_organization.effective_to >= current_date)
        order by reviewer_organization.effective_from desc, reviewer_organization.id
        limit 1
      ) reviewer_placement on true
      join public.employees subject_manager on subject_manager.tenant_id = tenant_value and subject_manager.hr_group_id = requested_hr_group
        and subject_manager.id = candidate.direct_manager_id and subject_manager.deleted_at is null and subject_manager.is_active and not subject_manager.is_archived
      left join public.administrations administration on administration.tenant_id = tenant_value and administration.id = candidate.administration_id and administration.is_active
      left join public.departments department on department.tenant_id = tenant_value and department.id = candidate.department_id and department.is_active
      left join public.jobs job on job.tenant_id = tenant_value and job.hr_group_id = requested_hr_group and job.id = candidate.job_id and job.is_active
      left join lateral (select revision.name from public.job_revisions revision where revision.tenant_id = tenant_value and revision.job_id = candidate.job_id and revision.valid_from <= current_date and (revision.valid_until is null or revision.valid_until > current_date) order by revision.valid_from desc limit 1) job_revision on true
      left join public.administration_locations location on location.tenant_id = tenant_value and location.hr_group_id = requested_hr_group and location.id = candidate.location_id and location.is_active
      where (requested_department is null or candidate.department_id = requested_department)
        and (requested_job is null or candidate.job_id = requested_job)
        and (requested_location is null or candidate.location_id = requested_location)
        and (search_value is null or concat_ws(' ', reviewer.first_name, reviewer.birth_name, reviewer.employee_number) ilike '%' || search_value || '%')
    )
    select reviewer_rows.id, reviewer_rows.first_name, reviewer_rows.birth_name, reviewer_rows.employee_number, reviewer_rows.hr_group_id,
      reviewer_rows.direct_manager_id, nullif(btrim(concat_ws(' ', reviewer_rows.manager_first_name, reviewer_rows.manager_birth_name)), ''),
      reviewer_rows.administration_id, reviewer_rows.administration_name, reviewer_rows.department_id, reviewer_rows.department_name,
      reviewer_rows.job_id, reviewer_rows.resolved_job_title, reviewer_rows.location_id, reviewer_rows.location_name,
      'ACTIVE'::text, 'READY'::text, null::text, count(*) over ()
    from reviewer_rows order by reviewer_rows.birth_name, reviewer_rows.first_name, reviewer_rows.employee_number, reviewer_rows.id
    offset requested_offset limit requested_limit;
    return;
  end if;
  return query
  with placement as (
    select employee.id as subject_id, employee.tenant_id, employee.hr_group_id, employee.first_name, employee.birth_name,
      employee.employee_number, organization.direct_manager_id, manager.first_name as manager_first_name,
      manager.birth_name as manager_birth_name, manager.auth_user_id as manager_auth_user_id,
      (manager.id is not null and manager.auth_user_id is not null
        and exists (
          select 1 from public.employments manager_employment
          where manager_employment.tenant_id = employee.tenant_id and manager_employment.hr_group_id = employee.hr_group_id
            and manager_employment.employee_id = manager.id and manager_employment.is_primary
            and manager_employment.deleted_at is null and manager_employment.record_status = 'CONFIRMED'
            and manager_employment.starts_on <= current_date
            and (manager_employment.ends_on is null or manager_employment.ends_on >= current_date)
        )
        and exists (
          select 1 from public.employee_organizations manager_organization
          where manager_organization.tenant_id = employee.tenant_id and manager_organization.hr_group_id = employee.hr_group_id
            and manager_organization.employee_id = manager.id and manager_organization.effective_from <= current_date
            and (manager_organization.effective_to is null or manager_organization.effective_to >= current_date)
        )) as manager_is_eligible,
      organization.administration_id, administration.name as administration_name,
      organization.department_id, department.name as department_name, organization.job_id,
      coalesce(organization.job_title, job_revision.name) as resolved_job_title,
      organization.location_id, location.name as location_name, employment.employment_status
    from public.employees employee
    join lateral (
      select organization_row.*
      from public.employee_organizations organization_row
      where organization_row.tenant_id = employee.tenant_id and organization_row.hr_group_id = employee.hr_group_id
        and organization_row.employee_id = employee.id and organization_row.effective_from <= current_date
        and (organization_row.effective_to is null or organization_row.effective_to >= current_date)
        and (requested_administration is null or organization_row.administration_id = requested_administration)
        and (requested_department is null or organization_row.department_id = requested_department)
        and (requested_job is null or organization_row.job_id = requested_job)
        and (requested_location is null or organization_row.location_id = requested_location)
        and (requested_manager is null or organization_row.direct_manager_id = requested_manager)
      order by organization_row.effective_from desc, organization_row.id
      limit 1
    ) organization on true
    left join lateral (
      select case
        when employment_row.record_status <> 'CONFIRMED' then employment_row.record_status::text
        when employment_row.starts_on > current_date then 'FUTURE'
        when employment_row.ends_on is not null and employment_row.ends_on < current_date then 'ENDED'
        else 'ACTIVE'
      end as employment_status
      from public.employments employment_row
      where employment_row.tenant_id = employee.tenant_id and employment_row.hr_group_id = employee.hr_group_id
        and employment_row.employee_id = employee.id and employment_row.is_primary and employment_row.deleted_at is null
        and (organization.employment_id is null or employment_row.id = organization.employment_id)
      order by employment_row.is_primary desc, employment_row.starts_on desc, employment_row.id
      limit 1
    ) employment on true
    left join public.employees manager on manager.tenant_id = employee.tenant_id and manager.hr_group_id = employee.hr_group_id
      and manager.id = organization.direct_manager_id and manager.deleted_at is null and manager.is_active and not manager.is_archived
    left join public.administrations administration on administration.tenant_id = employee.tenant_id and administration.id = organization.administration_id and administration.is_active
    left join public.departments department on department.tenant_id = employee.tenant_id and department.id = organization.department_id and department.is_active
    left join public.jobs job on job.tenant_id = employee.tenant_id and job.hr_group_id = employee.hr_group_id and job.id = organization.job_id and job.is_active
    left join lateral (
      select revision.name from public.job_revisions revision
      where revision.tenant_id = employee.tenant_id and revision.job_id = organization.job_id
        and revision.valid_from <= current_date and (revision.valid_until is null or revision.valid_until > current_date)
      order by revision.valid_from desc limit 1
    ) job_revision on true
    left join public.administration_locations location on location.tenant_id = employee.tenant_id
      and location.hr_group_id = employee.hr_group_id and location.id = organization.location_id and location.is_active
    where employee.tenant_id = tenant_value and employee.hr_group_id = requested_hr_group
      and not employee.is_archived and employee.deleted_at is null
      and (upper(coalesce(requested_employment_status, 'ACTIVE')) in ('ENDED', 'ALL') or employee.is_active)
  ), filtered as (
    select placement.* from placement
    where (upper(coalesce(requested_employment_status, 'ACTIVE')) = 'ALL'
      or placement.employment_status = upper(coalesce(requested_employment_status, 'ACTIVE')))
      and (search_value is null or concat_ws(' ', placement.first_name, placement.birth_name, placement.employee_number, placement.administration_name, placement.department_name, placement.resolved_job_title, placement.manager_first_name, placement.manager_birth_name) ilike '%' || search_value || '%')
  )
  select filtered.subject_id, filtered.first_name, filtered.birth_name, filtered.employee_number, filtered.hr_group_id,
    filtered.direct_manager_id,
    nullif(btrim(concat_ws(' ', filtered.manager_first_name, filtered.manager_birth_name)), ''),
    filtered.administration_id, filtered.administration_name, filtered.department_id, filtered.department_name,
    filtered.job_id, filtered.resolved_job_title, filtered.location_id, filtered.location_name, filtered.employment_status,
    case when filtered.administration_id is null then 'ADMINISTRATION_REQUIRED' when filtered.manager_is_eligible then 'READY' else 'REVIEWER_REQUIRED' end,
    case when filtered.administration_id is null then 'CURRENT_ADMINISTRATION_REQUIRED' when filtered.manager_is_eligible then null else 'CURRENT_REVIEWER_REQUIRED' end,
    count(*) over ()
  from filtered
  order by filtered.birth_name, filtered.first_name, filtered.employee_number, filtered.subject_id
  offset requested_offset limit requested_limit;
end;
$$;

grant execute on function public.create_performance_review_round(uuid, text, text, date, date, date, date, jsonb, text, text) to authenticated;
grant execute on function public.search_performance_review_candidates(uuid, text, uuid, uuid, uuid, uuid, uuid, text, integer, integer, uuid) to authenticated;
grant execute on function public.publish_performance_review_round(uuid, integer, text) to authenticated;
grant execute on function public.add_performance_review_dossier(uuid, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.save_performance_review_self(uuid, text, integer, boolean) to authenticated;
grant execute on function public.save_performance_review_manager(uuid, text, date, integer, text, integer, boolean) to authenticated;
grant execute on function public.acknowledge_performance_review(uuid, text, text, integer) to authenticated;
grant execute on function public.save_performance_review_private_note(uuid, text) to authenticated;
grant execute on function public.add_performance_review_attachment(uuid, text, text, text, bigint, text, text) to authenticated;
grant execute on function public.link_performance_review_appraisal(uuid, uuid) to authenticated;
grant execute on function public.close_performance_review_round(uuid, text, integer, text) to authenticated;
grant execute on function public.activate_performance_review_round(uuid) to authenticated;
grant execute on function public.cancel_performance_review_round(uuid, text, integer) to authenticated;

grant select on public.performance_review_rounds, public.performance_review_dossiers,
  public.performance_review_submissions, public.performance_review_private_notes,
  public.performance_review_acknowledgements, public.performance_review_attachments,
  public.performance_review_appraisal_links to authenticated;

revoke all on function public.create_performance_review_round(uuid, text, text, date, date, date, date, jsonb, text, text) from public, anon;
revoke all on function public.search_performance_review_candidates(uuid, text, uuid, uuid, uuid, uuid, uuid, text, integer, integer, uuid) from public, anon;
revoke all on function public.publish_performance_review_round(uuid, integer, text) from public, anon;
revoke all on function public.add_performance_review_dossier(uuid, uuid, uuid, uuid, text) from public, anon;
revoke all on function public.save_performance_review_self(uuid, text, integer, boolean) from public, anon;
revoke all on function public.save_performance_review_manager(uuid, text, date, integer, text, integer, boolean) from public, anon;
revoke all on function public.acknowledge_performance_review(uuid, text, text, integer) from public, anon;
revoke all on function public.save_performance_review_private_note(uuid, text) from public, anon;
revoke all on function public.add_performance_review_attachment(uuid, text, text, text, bigint, text, text) from public, anon;
revoke all on function public.link_performance_review_appraisal(uuid, uuid) from public, anon;
revoke all on function public.close_performance_review_round(uuid, text, integer, text) from public, anon;
revoke all on function public.activate_performance_review_round(uuid) from public, anon;
revoke all on function public.cancel_performance_review_round(uuid, text, integer) from public, anon;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role cross join public.permissions permission
where role.code = 'DIRECT_MANAGER'
  and permission.code in ('performance-review:team-read', 'performance-review:team-submit', 'performance-review:private-read', 'performance-review:private-write')
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role cross join public.permissions permission
where role.code = 'EMPLOYEE'
  and permission.code in ('self:performance-review:read', 'self:performance-review:submit')
on conflict do nothing;

create function public.performance_review_guard_submission()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.submitted_at is not null then
    raise exception 'PERFORMANCE_SUBMISSION_IMMUTABLE';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.tenant_id is distinct from old.tenant_id or new.dossier_id is distinct from old.dossier_id
    or new.kind is distinct from old.kind or new.author_user_id is distinct from old.author_user_id then
    raise exception 'PERFORMANCE_SUBMISSION_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$$;

create function public.performance_review_guard_round()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.tenant_id is distinct from old.tenant_id or new.hr_group_id is distinct from old.hr_group_id
    or new.created_by is distinct from old.created_by then
    raise exception 'PERFORMANCE_ROUND_IDENTITY_IMMUTABLE';
  end if;
  if old.status <> 'DRAFT' and (
    new.title is distinct from old.title or new.introduction is distinct from old.introduction
    or new.period_start is distinct from old.period_start or new.period_end is distinct from old.period_end
    or new.start_date is distinct from old.start_date or new.due_date is distinct from old.due_date
    or new.round_type is distinct from old.round_type or new.rating_snapshot is distinct from old.rating_snapshot
  ) then
    raise exception 'PERFORMANCE_ROUND_CONFIG_IMMUTABLE';
  end if;
  if old.status in ('CLOSED', 'CANCELLED') and new is distinct from old then
    raise exception 'PERFORMANCE_ROUND_CLOSED';
  end if;
  return new;
end;
$$;

create trigger performance_review_guard_round
before update on public.performance_review_rounds
for each row execute function public.performance_review_guard_round();

create function public.performance_review_guard_dossier()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.tenant_id is distinct from old.tenant_id or new.hr_group_id is distinct from old.hr_group_id
    or new.round_id is distinct from old.round_id or new.employee_id is distinct from old.employee_id
    or new.administration_id is distinct from old.administration_id then
    raise exception 'PERFORMANCE_DOSSIER_IDENTITY_IMMUTABLE';
  end if;
  if exists (select 1 from public.performance_review_rounds r where r.id = old.round_id and r.status in ('CLOSED', 'CANCELLED')) then
    raise exception 'PERFORMANCE_ROUND_CLOSED';
  end if;
  if new.phase is distinct from old.phase and not (
    (old.phase = 'WAITING_EMPLOYEE' and new.phase = 'WAITING_MANAGER') or
    (old.phase = 'WAITING_MANAGER' and new.phase = 'WAITING_ACKNOWLEDGEMENT') or
    (old.phase = 'WAITING_ACKNOWLEDGEMENT' and new.phase in ('COMPLETED_AGREED', 'COMPLETED_DISAGREED'))
  ) then
    raise exception 'PERFORMANCE_TRANSITION_FORBIDDEN';
  end if;
  return new;
end;
$$;

create trigger performance_review_guard_dossier
before update on public.performance_review_dossiers
for each row execute function public.performance_review_guard_dossier();

revoke all on function public.performance_review_guard_dossier() from public, anon, authenticated;

create trigger performance_review_guard_submission
before update or delete on public.performance_review_submissions
for each row execute function public.performance_review_guard_submission();

create function public.performance_review_guard_history()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'PERFORMANCE_HISTORY_IMMUTABLE';
end;
$$;

create trigger performance_review_guard_acknowledgements
before update or delete on public.performance_review_acknowledgements
for each row execute function public.performance_review_guard_history();

create trigger performance_review_guard_private_note_versions
before update or delete on public.performance_review_private_notes
for each row execute function public.performance_review_guard_history();

revoke all on function public.performance_review_guard_submission() from public, anon, authenticated;
revoke all on function public.performance_review_guard_round() from public, anon, authenticated;
revoke all on function public.performance_review_guard_history() from public, anon, authenticated;

alter table public.performance_review_rounds enable row level security;
alter table public.performance_review_dossiers enable row level security;
alter table public.performance_review_submissions enable row level security;
alter table public.performance_review_private_notes enable row level security;
alter table public.performance_review_acknowledgements enable row level security;
alter table public.performance_review_attachments enable row level security;
alter table public.performance_review_appraisal_links enable row level security;
alter table public.performance_review_audit_events enable row level security;
alter table public.performance_review_command_results enable row level security;

revoke all on public.performance_review_rounds, public.performance_review_dossiers,
  public.performance_review_submissions, public.performance_review_private_notes,
  public.performance_review_acknowledgements, public.performance_review_attachments,
  public.performance_review_appraisal_links from public, anon, authenticated;
revoke all on public.performance_review_command_results from public, anon, authenticated;

grant select on public.performance_review_rounds, public.performance_review_dossiers,
  public.performance_review_submissions, public.performance_review_private_notes,
  public.performance_review_acknowledgements, public.performance_review_attachments,
  public.performance_review_appraisal_links to authenticated;

commit;
