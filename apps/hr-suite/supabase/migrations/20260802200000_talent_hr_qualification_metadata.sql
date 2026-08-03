begin;

-- M2.2: HR-managed qualification metadata on the existing capability record.
-- Evidence remains a document reference only; no document content is stored here.
alter table public.talent_employee_capability_records
  add column certificate_issuing_body text,
  add column certificate_code text,
  add column certificate_validity_months integer,
  add column certificate_is_permanent boolean not null default false,
  add column certificate_renewal_required boolean not null default false,
  add column evidence_status text,
  add column qualification_responsible_user_id uuid references auth.users(id) on delete set null;

alter table public.talent_employee_capability_records
  add constraint talent_employee_capability_records_issuer_length_check
    check (certificate_issuing_body is null or char_length(btrim(certificate_issuing_body)) between 1 and 200),
  add constraint talent_employee_capability_records_code_length_check
    check (certificate_code is null or char_length(btrim(certificate_code)) between 1 and 120),
  add constraint talent_employee_capability_records_validity_months_check
    check (certificate_validity_months is null or certificate_validity_months between 1 and 1200),
  add constraint talent_employee_capability_records_evidence_status_check
    check (evidence_status is null or evidence_status in ('NOT_PROVIDED', 'PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'));

create index talent_employee_capability_records_responsible_user_idx
  on public.talent_employee_capability_records (tenant_id, qualification_responsible_user_id)
  where qualification_responsible_user_id is not null;

create unique index talent_employee_capability_records_active_certificate_code_key
  on public.talent_employee_capability_records (tenant_id, employee_id, capability_id, lower(btrim(certificate_code)))
  where certificate_code is not null and status <> 'ARCHIVED';

update public.talent_employee_capability_records record
set evidence_status = 'NOT_PROVIDED'
where record.evidence_status is null
  and exists (
    select 1
    from public.talent_capabilities capability
    where capability.tenant_id = record.tenant_id
      and capability.id = record.capability_id
      and capability.capability_type = 'CERTIFICATE'
  );

create or replace function internal_security.validate_talent_employee_capability_record()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  capability_type text;
  actor_can_manage boolean;
begin
  select capability.capability_type
    into capability_type
  from public.talent_capabilities capability
  where capability.tenant_id = new.tenant_id
    and capability.id = new.capability_id;

  if capability_type is null then
    raise exception 'TALENT_CAPABILITY_NOT_FOUND';
  end if;

  actor_can_manage := coalesce((select internal_security.current_user_has_permission(new.tenant_id, null, 'talent:manage')), false);

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
    if new.talent_level_id is null or new.language_level is not null or new.language_is_native or new.certificate_status is not null
      or new.certificate_issuing_body is not null or new.certificate_code is not null
      or new.certificate_validity_months is not null or new.certificate_is_permanent
      or new.certificate_renewal_required or new.evidence_status is not null
      or new.qualification_responsible_user_id is not null then
      raise exception 'TALENT_VALUE_TYPE_INVALID';
    end if;
  elsif capability_type = 'LANGUAGE' then
    if new.talent_level_id is not null or new.certificate_status is not null or (new.language_level is null and not new.language_is_native)
      or new.certificate_issuing_body is not null or new.certificate_code is not null
      or new.certificate_validity_months is not null or new.certificate_is_permanent
      or new.certificate_renewal_required or new.evidence_status is not null
      or new.qualification_responsible_user_id is not null then
      raise exception 'TALENT_VALUE_TYPE_INVALID';
    end if;
  elsif capability_type = 'CERTIFICATE' then
    if new.talent_level_id is not null or new.language_level is not null or new.language_is_native or new.certificate_status is null then
      raise exception 'TALENT_VALUE_TYPE_INVALID';
    end if;

    new.certificate_issuing_body := nullif(btrim(new.certificate_issuing_body), '');
    new.certificate_code := nullif(btrim(new.certificate_code), '');

    if new.certificate_status = 'PERMANENT' then
      new.certificate_is_permanent := true;
      new.valid_until := null;
      new.certificate_validity_months := null;
    elsif new.certificate_is_permanent then
      raise exception 'TALENT_PERMANENT_CERTIFICATE_INVALID';
    end if;

    if new.evidence_status is null then
      new.evidence_status := 'NOT_PROVIDED';
    end if;
    if new.evidence_document_id is null and new.evidence_status = 'VERIFIED' then
      raise exception 'TALENT_EVIDENCE_REFERENCE_REQUIRED';
    end if;
    if new.evidence_document_id is not null and new.evidence_status = 'NOT_PROVIDED' then
      new.evidence_status := 'PENDING';
    end if;

    if new.qualification_responsible_user_id is null and actor_can_manage and auth.uid() is not null then
      new.qualification_responsible_user_id := auth.uid();
    end if;
    if new.qualification_responsible_user_id is not null and (
      not actor_can_manage
      or not exists (
        select 1
        from public.user_access access
        where access.user_id = new.qualification_responsible_user_id
          and access.tenant_id = new.tenant_id
          and access.is_active
      )
    ) then
      raise exception 'TALENT_QUALIFICATION_RESPONSIBLE_SCOPE_INVALID';
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

commit;
