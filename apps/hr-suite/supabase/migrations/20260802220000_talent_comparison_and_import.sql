begin;

create table public.talent_import_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  source_filename text not null check (length(source_filename) between 1 and 255),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  row_count integer not null check (row_count >= 0),
  status text not null default 'PREVIEW' check (status in ('PREVIEW', 'COMMITTED', 'ROLLED_BACK')),
  commit_idempotency_key text,
  rollback_idempotency_key text,
  created_by_user_id uuid not null references auth.users(id),
  committed_by_user_id uuid references auth.users(id),
  rolled_back_by_user_id uuid references auth.users(id),
  committed_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint talent_import_batches_tenant_id_unique unique (tenant_id, id),
  constraint talent_import_batches_commit_key_unique unique (tenant_id, id, commit_idempotency_key),
  constraint talent_import_batches_rollback_key_unique unique (tenant_id, id, rollback_idempotency_key)
);

create table public.talent_import_rows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  batch_id uuid not null,
  row_number integer not null check (row_number > 0),
  employee_number text not null,
  capability_code text not null,
  valid_from date,
  valid_until date,
  talent_level_code text,
  language_level text,
  certificate_code text,
  evidence_status text,
  parsed_data jsonb not null default '{}'::jsonb check (jsonb_typeof(parsed_data) = 'object'),
  row_status text not null default 'INVALID' check (row_status in ('VALID', 'INVALID', 'APPLIED', 'ROLLED_BACK')),
  errors jsonb not null default '[]'::jsonb check (jsonb_typeof(errors) = 'array'),
  previous_record jsonb,
  applied_record_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint talent_import_rows_batch_fkey foreign key (tenant_id, batch_id)
    references public.talent_import_batches (tenant_id, id) on delete cascade,
  constraint talent_import_rows_batch_row_unique unique (tenant_id, batch_id, row_number)
);

create index talent_import_batches_tenant_status_idx
  on public.talent_import_batches (tenant_id, status, created_at desc);
create index talent_import_rows_batch_status_idx
  on public.talent_import_rows (tenant_id, batch_id, row_status, row_number);
create index talent_import_rows_applied_record_idx
  on public.talent_import_rows (tenant_id, applied_record_id)
  where applied_record_id is not null;

create or replace function internal_security.guard_talent_import_batch_command()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.tenant_id <> old.tenant_id or new.id <> old.id then
    raise exception 'TALENT_IMPORT_IMMUTABLE';
  end if;
  if new.status <> old.status and current_setting('app.talent_import_command', true) not in ('COMMIT', 'ROLLBACK') then
    raise exception 'TALENT_IMPORT_COMMAND_REQUIRED';
  end if;
  if old.status <> 'PREVIEW' and (
    new.source_filename <> old.source_filename
    or new.source_hash <> old.source_hash
    or new.row_count <> old.row_count
    or new.created_by_user_id <> old.created_by_user_id
  ) then
    raise exception 'TALENT_IMPORT_IMMUTABLE';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function internal_security.guard_talent_import_row_immutability()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.tenant_id <> old.tenant_id
    or new.batch_id <> old.batch_id
    or new.row_number <> old.row_number
    or new.employee_number <> old.employee_number
    or new.capability_code <> old.capability_code
    or new.valid_from is distinct from old.valid_from
    or new.valid_until is distinct from old.valid_until
    or new.talent_level_code is distinct from old.talent_level_code
    or new.language_level is distinct from old.language_level
    or new.certificate_code is distinct from old.certificate_code
    or new.evidence_status is distinct from old.evidence_status
    or new.parsed_data is distinct from old.parsed_data then
    raise exception 'TALENT_IMPORT_ROW_IMMUTABLE';
  end if;
  if new.row_status <> old.row_status and current_setting('app.talent_import_command', true) not in ('COMMIT', 'ROLLBACK') then
    raise exception 'TALENT_IMPORT_COMMAND_REQUIRED';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger guard_talent_import_batch_command
before update on public.talent_import_batches
for each row execute function internal_security.guard_talent_import_batch_command();

create trigger guard_talent_import_row_immutability
before update on public.talent_import_rows
for each row execute function internal_security.guard_talent_import_row_immutability();

create trigger set_talent_import_batches_updated_at
before update on public.talent_import_batches
for each row execute function internal_security.set_updated_at();

create trigger set_talent_import_rows_updated_at
before update on public.talent_import_rows
for each row execute function internal_security.set_updated_at();

create or replace function internal_security.audit_talent_import_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_data jsonb := to_jsonb(new);
  old_data jsonb := to_jsonb(old);
  tenant uuid := coalesce(new.tenant_id, old.tenant_id);
  entity_id uuid := coalesce(new.id, old.id);
begin
  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (
    tenant,
    tg_arg[0],
    entity_id,
    auth.uid(),
    lower(tg_op),
    jsonb_build_object(
      'status', coalesce(row_data ->> 'status', old_data ->> 'status'),
      'rowCount', coalesce(row_data -> 'row_count', old_data -> 'row_count'),
      'batchId', coalesce(row_data ->> 'batch_id', old_data ->> 'batch_id'),
      'rowNumber', coalesce(row_data -> 'row_number', old_data -> 'row_number')
    )
  );
  return coalesce(new, old);
end;
$$;

revoke all on function internal_security.guard_talent_import_batch_command() from public, anon, authenticated;
revoke all on function internal_security.guard_talent_import_row_immutability() from public, anon, authenticated;
revoke all on function internal_security.audit_talent_import_change() from public, anon, authenticated;

create trigger audit_talent_import_batches
after insert or update on public.talent_import_batches
for each row execute function internal_security.audit_talent_import_change('talent_import_batch');

create trigger audit_talent_import_rows
after insert or update on public.talent_import_rows
for each row execute function internal_security.audit_talent_import_change('talent_import_row');

alter table public.talent_import_batches enable row level security;
alter table public.talent_import_rows enable row level security;

create policy talent_import_batches_select
on public.talent_import_batches for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'talent-import:manage')));

create policy talent_import_batches_insert
on public.talent_import_batches for insert to authenticated
with check (
  created_by_user_id = auth.uid()
  and (select internal_security.current_user_has_permission(tenant_id, null, 'talent-import:manage'))
);

create policy talent_import_batches_update
on public.talent_import_batches for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'talent-import:manage')))
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'talent-import:manage')));

create policy talent_import_rows_select
on public.talent_import_rows for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'talent-import:manage')));

create policy talent_import_rows_insert
on public.talent_import_rows for insert to authenticated
with check (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-import:manage'))
  and exists (
    select 1 from public.talent_import_batches batch
    where batch.tenant_id = talent_import_rows.tenant_id
      and batch.id = talent_import_rows.batch_id
      and batch.status = 'PREVIEW'
  )
);

create policy talent_import_rows_update
on public.talent_import_rows for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'talent-import:manage')))
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'talent-import:manage')));

revoke all on table public.talent_import_batches from public, anon, authenticated;
revoke all on table public.talent_import_rows from public, anon, authenticated;
grant select, insert, update on table public.talent_import_batches to authenticated;
grant select, insert, update on table public.talent_import_rows to authenticated;

create or replace function public.commit_talent_import_batch(
  requested_tenant_id uuid,
  requested_batch_id uuid,
  requested_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  batch public.talent_import_batches%rowtype;
  import_row public.talent_import_rows%rowtype;
  existing_record public.talent_employee_capability_records%rowtype;
  applied_id uuid;
  previous jsonb;
  action text;
begin
  if not (select internal_security.current_user_has_permission(requested_tenant_id, null, 'talent-import:manage')) then
    raise exception 'FORBIDDEN_TALENT_IMPORT';
  end if;
  if requested_idempotency_key is null or length(trim(requested_idempotency_key)) < 16 then
    raise exception 'TALENT_IMPORT_IDEMPOTENCY_REQUIRED';
  end if;

  select * into batch
  from public.talent_import_batches
  where tenant_id = requested_tenant_id and id = requested_batch_id
  for update;
  if not found then raise exception 'TALENT_IMPORT_NOT_FOUND'; end if;
  if batch.status = 'COMMITTED' and batch.commit_idempotency_key = requested_idempotency_key then
    return jsonb_build_object('batchId', batch.id, 'status', batch.status, 'replayed', true);
  end if;
  if batch.status <> 'PREVIEW' then raise exception 'TALENT_IMPORT_NOT_PREVIEW'; end if;
  if exists (select 1 from public.talent_import_rows where tenant_id = requested_tenant_id and batch_id = requested_batch_id and row_status = 'INVALID') then
    raise exception 'TALENT_IMPORT_HAS_INVALID_ROWS';
  end if;

  perform set_config('app.talent_import_command', 'COMMIT', true);
  for import_row in
    select * from public.talent_import_rows
    where tenant_id = requested_tenant_id and batch_id = requested_batch_id and row_status = 'VALID'
    order by row_number
  loop
    action := import_row.parsed_data ->> 'action';
    previous := null;
    if action = 'UPDATE' then
      select * into existing_record
      from public.talent_employee_capability_records
      where tenant_id = requested_tenant_id
        and id = (import_row.parsed_data ->> 'targetRecordId')::uuid
      for update;
      if not found then raise exception 'TALENT_IMPORT_TARGET_NOT_FOUND'; end if;
      previous := to_jsonb(existing_record);
      update public.talent_employee_capability_records
      set valid_from = (import_row.parsed_data ->> 'validFrom')::date,
          valid_until = nullif(import_row.parsed_data ->> 'validUntil', '')::date,
          talent_level_id = nullif(import_row.parsed_data ->> 'talentLevelId', '')::uuid,
          language_level = nullif(import_row.parsed_data ->> 'languageLevel', ''),
          certificate_code = nullif(import_row.parsed_data ->> 'certificateCode', ''),
          evidence_status = nullif(import_row.parsed_data ->> 'evidenceStatus', ''),
          source_type = 'IMPORTED',
          status = 'DRAFT',
          archived_at = null,
          archived_by_user_id = null,
          updated_by_user_id = auth.uid(),
          version = version + 1
      where tenant_id = requested_tenant_id and id = existing_record.id
      returning id into applied_id;
    else
      insert into public.talent_employee_capability_records (
        tenant_id, employee_id, capability_id, talent_level_id, language_level,
        certificate_code, evidence_status, valid_from, valid_until,
        source_type, status, created_by_user_id, updated_by_user_id
      ) values (
        requested_tenant_id,
        (import_row.parsed_data ->> 'employeeId')::uuid,
        (import_row.parsed_data ->> 'capabilityId')::uuid,
        nullif(import_row.parsed_data ->> 'talentLevelId', '')::uuid,
        nullif(import_row.parsed_data ->> 'languageLevel', ''),
        nullif(import_row.parsed_data ->> 'certificateCode', ''),
        nullif(import_row.parsed_data ->> 'evidenceStatus', ''),
        (import_row.parsed_data ->> 'validFrom')::date,
        nullif(import_row.parsed_data ->> 'validUntil', '')::date,
        'IMPORTED', 'DRAFT', auth.uid(), auth.uid()
      ) returning id into applied_id;
    end if;
    update public.talent_import_rows
    set previous_record = previous, applied_record_id = applied_id, row_status = 'APPLIED'
    where tenant_id = requested_tenant_id and id = import_row.id;
  end loop;

  update public.talent_import_batches
  set status = 'COMMITTED', commit_idempotency_key = requested_idempotency_key,
      committed_by_user_id = auth.uid(), committed_at = now()
  where tenant_id = requested_tenant_id and id = requested_batch_id;
  return jsonb_build_object('batchId', requested_batch_id, 'status', 'COMMITTED', 'replayed', false);
end;
$$;

create or replace function public.rollback_talent_import_batch(
  requested_tenant_id uuid,
  requested_batch_id uuid,
  requested_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  batch public.talent_import_batches%rowtype;
  import_row public.talent_import_rows%rowtype;
  previous jsonb;
begin
  if not (select internal_security.current_user_has_permission(requested_tenant_id, null, 'talent-import:manage')) then
    raise exception 'FORBIDDEN_TALENT_IMPORT';
  end if;
  if requested_idempotency_key is null or length(trim(requested_idempotency_key)) < 16 then
    raise exception 'TALENT_IMPORT_IDEMPOTENCY_REQUIRED';
  end if;
  select * into batch from public.talent_import_batches
  where tenant_id = requested_tenant_id and id = requested_batch_id for update;
  if not found then raise exception 'TALENT_IMPORT_NOT_FOUND'; end if;
  if batch.status = 'ROLLED_BACK' and batch.rollback_idempotency_key = requested_idempotency_key then
    return jsonb_build_object('batchId', batch.id, 'status', batch.status, 'replayed', true);
  end if;
  if batch.status <> 'COMMITTED' then raise exception 'TALENT_IMPORT_NOT_COMMITTED'; end if;

  perform set_config('app.talent_import_command', 'ROLLBACK', true);
  for import_row in
    select * from public.talent_import_rows
    where tenant_id = requested_tenant_id and batch_id = requested_batch_id and row_status = 'APPLIED'
    order by row_number desc
  loop
    previous := import_row.previous_record;
    if previous is null then
      update public.talent_employee_capability_records
      set status = 'ARCHIVED', archived_at = now(), archived_by_user_id = auth.uid(),
          updated_by_user_id = auth.uid(), version = version + 1
      where tenant_id = requested_tenant_id and id = import_row.applied_record_id;
    else
      update public.talent_employee_capability_records
      set valid_from = (previous ->> 'valid_from')::date,
          valid_until = nullif(previous ->> 'valid_until', '')::date,
          talent_level_id = nullif(previous ->> 'talent_level_id', '')::uuid,
          language_level = nullif(previous ->> 'language_level', ''),
          certificate_code = nullif(previous ->> 'certificate_code', ''),
          evidence_status = nullif(previous ->> 'evidence_status', ''),
          source_type = previous ->> 'source_type',
          status = previous ->> 'status',
          archived_at = nullif(previous ->> 'archived_at', '')::timestamptz,
          archived_by_user_id = nullif(previous ->> 'archived_by_user_id', '')::uuid,
          updated_by_user_id = auth.uid(),
          version = version + 1
      where tenant_id = requested_tenant_id and id = import_row.applied_record_id;
    end if;
    update public.talent_import_rows set row_status = 'ROLLED_BACK'
    where tenant_id = requested_tenant_id and id = import_row.id;
  end loop;
  update public.talent_import_batches
  set status = 'ROLLED_BACK', rollback_idempotency_key = requested_idempotency_key,
      rolled_back_by_user_id = auth.uid(), rolled_back_at = now()
  where tenant_id = requested_tenant_id and id = requested_batch_id;
  return jsonb_build_object('batchId', requested_batch_id, 'status', 'ROLLED_BACK', 'replayed', false);
end;
$$;

revoke all on function public.commit_talent_import_batch(uuid, uuid, text) from public, anon;
revoke all on function public.rollback_talent_import_batch(uuid, uuid, text) from public, anon;
grant execute on function public.commit_talent_import_batch(uuid, uuid, text) to authenticated;
grant execute on function public.rollback_talent_import_batch(uuid, uuid, text) to authenticated;

insert into public.permissions (code, name, description, category)
values
  ('talent-comparison:read', 'Talentvergelijking lezen', 'Vergelijkt actieve functieprofielen met vrijgegeven persoonlijke Talentdata binnen scope.', 'Talent'),
  ('talent-import:manage', 'Talentimport beheren', 'Maakt previews, commits en batchspecifieke rollbacks voor Talentimport.', 'Talent')
on conflict (code) do update set name = excluded.name, description = excluded.description, category = excluded.category;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.tenant_id is null
  and (
    (role.code = 'TENANT_ADMIN' and permission.code in ('talent-comparison:read', 'talent-import:manage'))
    or (role.code = 'DIRECT_MANAGER' and permission.code = 'talent-comparison:read')
  )
on conflict do nothing;

commit;
