begin;

-- M2.1: tenant-owned personal capability records.
-- Safe defaults from FDR-0003: employees can only save their own draft records;
-- HR controls release/archive; evidence is a reference only, never content.
create table public.talent_employee_capability_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null,
  capability_id uuid not null,
  talent_level_id uuid,
  language_level text,
  language_is_native boolean not null default false,
  certificate_status text,
  source_type text not null default 'HR_ENTERED'
    check (source_type in ('SELF_ENTERED', 'HR_ENTERED', 'MANAGER_ENTERED', 'IMPORTED')),
  valid_from date not null default current_date,
  valid_until date,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'RELEASED', 'EXPIRED', 'ARCHIVED')),
  evidence_document_id uuid references public.employee_documents(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  archived_by_user_id uuid references auth.users(id) on delete set null,
  version integer not null default 1 check (version > 0),
  unique (tenant_id, id),
  check (valid_until is null or valid_until > valid_from),
  check (language_level is null or language_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  check (certificate_status is null or certificate_status in ('VALID', 'EXPIRED', 'PERMANENT', 'REVOKED')),
  foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id) on delete cascade,
  foreign key (tenant_id, capability_id)
    references public.talent_capabilities(tenant_id, id) on delete restrict,
  foreign key (tenant_id, talent_level_id)
    references public.talent_levels(tenant_id, id) on delete restrict
);

create index talent_employee_capability_records_employee_idx
  on public.talent_employee_capability_records (tenant_id, employee_id, status, valid_from desc);
create index talent_employee_capability_records_capability_idx
  on public.talent_employee_capability_records (tenant_id, capability_id, status);
create index talent_employee_capability_records_source_idx
  on public.talent_employee_capability_records (tenant_id, source_type, status);
create index talent_employee_capability_records_evidence_idx
  on public.talent_employee_capability_records (tenant_id, evidence_document_id)
  where evidence_document_id is not null;

create or replace function internal_security.validate_talent_employee_capability_record()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  capability_type text;
begin
  select capability.capability_type
    into capability_type
  from public.talent_capabilities capability
  where capability.tenant_id = new.tenant_id
    and capability.id = new.capability_id;

  if capability_type is null then
    raise exception 'TALENT_CAPABILITY_NOT_FOUND';
  end if;

  if new.evidence_document_id is not null and not exists (
    select 1
    from public.employee_documents document
    where document.id = new.evidence_document_id
      and document.tenant_id = new.tenant_id
      and document.employee_id = new.employee_id
      and document.deleted_at is null
  ) then
    raise exception 'TALENT_EVIDENCE_SCOPE_INVALID';
  end if;

  if capability_type in ('COMPETENCY', 'SKILL', 'KNOWLEDGE') then
    if new.talent_level_id is null or new.language_level is not null or new.language_is_native or new.certificate_status is not null then
      raise exception 'TALENT_VALUE_TYPE_INVALID';
    end if;
  elsif capability_type = 'LANGUAGE' then
    if new.talent_level_id is not null or new.certificate_status is not null or (new.language_level is null and not new.language_is_native) then
      raise exception 'TALENT_VALUE_TYPE_INVALID';
    end if;
  elsif capability_type = 'CERTIFICATE' then
    if new.talent_level_id is not null or new.language_level is not null or new.language_is_native or new.certificate_status is null then
      raise exception 'TALENT_VALUE_TYPE_INVALID';
    end if;
  end if;

  if new.status = 'ARCHIVED' and new.archived_at is null then
    new.archived_at := timezone('utc', now());
  elsif new.status <> 'ARCHIVED' then
    new.archived_at := null;
    new.archived_by_user_id := null;
  end if;

  if new.status <> 'ARCHIVED' and new.valid_until is not null and new.valid_until <= current_date then
    new.status := 'EXPIRED';
  end if;

  return new;
end;
$$;

revoke all on function internal_security.validate_talent_employee_capability_record() from public, anon, authenticated;

create trigger validate_talent_employee_capability_record
before insert or update on public.talent_employee_capability_records
for each row execute function internal_security.validate_talent_employee_capability_record();

create trigger set_talent_employee_capability_records_updated_at
before update on public.talent_employee_capability_records
for each row execute function internal_security.set_updated_at();

create or replace function internal_security.audit_talent_employee_capability_record()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  after_data jsonb;
  before_data jsonb;
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
    'talent_employee_capability_record',
    coalesce(new.id, old.id),
    auth.uid(),
    audit_action,
    jsonb_build_object(
      'before', before_data,
      'after', after_data,
      'source_channel', 'WEB'
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function internal_security.audit_talent_employee_capability_record() from public, anon, authenticated;

create trigger audit_talent_employee_capability_records
after insert or update or delete on public.talent_employee_capability_records
for each row execute function internal_security.audit_talent_employee_capability_record();

alter table public.talent_employee_capability_records enable row level security;

create policy talent_employee_capability_records_select
on public.talent_employee_capability_records for select to authenticated
using (
  (
    (select internal_security.current_user_has_permission(tenant_id, null, 'talent-record:read'))
    and (
      (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage'))
      or (select internal_security.can_manage_employee(employee_id, 'talent-record:read'))
    )
  )
  or (
    employee_id = (select internal_security.current_employee_id())
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-record:read'))
    and status in ('DRAFT', 'RELEASED', 'EXPIRED')
  )
);

create policy talent_employee_capability_records_insert
on public.talent_employee_capability_records for insert to authenticated
with check (
  (
    (select internal_security.current_user_has_permission(tenant_id, null, 'talent-record:write'))
    and (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage'))
  )
  or (
    employee_id = (select internal_security.current_employee_id())
    and source_type = 'SELF_ENTERED'
    and status = 'DRAFT'
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-record:write'))
  )
);

create policy talent_employee_capability_records_update
on public.talent_employee_capability_records for update to authenticated
using (
  (
    (select internal_security.current_user_has_permission(tenant_id, null, 'talent-record:write'))
    and (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage'))
  )
  or (
    employee_id = (select internal_security.current_employee_id())
    and source_type = 'SELF_ENTERED'
    and status = 'DRAFT'
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-record:write'))
  )
)
with check (
  (
    (select internal_security.current_user_has_permission(tenant_id, null, 'talent-record:write'))
    and (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage'))
  )
  or (
    employee_id = (select internal_security.current_employee_id())
    and source_type = 'SELF_ENTERED'
    and status = 'DRAFT'
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-record:write'))
  )
);

revoke all on table public.talent_employee_capability_records from public;
revoke all on table public.talent_employee_capability_records from anon;
revoke all on table public.talent_employee_capability_records from authenticated;
grant select, insert, update on table public.talent_employee_capability_records to authenticated;

insert into public.permissions (code, name, description, category)
values
  ('talent-record:read', 'Persoonlijke Talentrecords lezen', 'Leest persoonlijke capabilityregistraties binnen de toegestane scope.', 'Talent'),
  ('talent-record:write', 'Persoonlijke Talentrecords beheren', 'Beheert persoonlijke capabilityregistraties als HR Admin.', 'Talent'),
  ('self:talent-record:read', 'Eigen Talentrecords lezen', 'Leest de eigen persoonlijke capabilityregistraties.', 'Talent'),
  ('self:talent-record:write', 'Eigen Talentrecords als concept opslaan', 'Slaat uitsluitend eigen persoonlijke capabilityconcepten op.', 'Talent')
on conflict (code) do update set name = excluded.name, description = excluded.description, category = excluded.category;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.tenant_id is null
  and (
    (role.code = 'TENANT_ADMIN' and permission.code in ('talent-record:read', 'talent-record:write'))
    or (role.code = 'DIRECT_MANAGER' and permission.code = 'talent-record:read')
    or (role.code = 'EMPLOYEE' and permission.code in ('self:talent-record:read', 'self:talent-record:write'))
  )
on conflict do nothing;

commit;
