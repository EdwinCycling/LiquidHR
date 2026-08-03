begin;

create index if not exists talent_employee_capability_records_qualification_responsible_user_idx
  on public.talent_employee_capability_records (qualification_responsible_user_id)
  where qualification_responsible_user_id is not null;

create index if not exists talent_employee_capability_records_tenant_talent_level_idx
  on public.talent_employee_capability_records (tenant_id, talent_level_id)
  where talent_level_id is not null;

create index if not exists talent_employee_capability_records_archived_by_user_idx
  on public.talent_employee_capability_records (archived_by_user_id)
  where archived_by_user_id is not null;

create index if not exists talent_employee_capability_records_created_by_user_idx
  on public.talent_employee_capability_records (created_by_user_id)
  where created_by_user_id is not null;

create index if not exists talent_employee_capability_records_evidence_document_idx
  on public.talent_employee_capability_records (evidence_document_id)
  where evidence_document_id is not null;

create index if not exists talent_employee_capability_records_updated_by_user_idx
  on public.talent_employee_capability_records (updated_by_user_id)
  where updated_by_user_id is not null;

commit;
