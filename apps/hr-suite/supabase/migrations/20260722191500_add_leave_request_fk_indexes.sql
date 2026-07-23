-- Cover the composite foreign keys introduced by the HR-admin booking slice.
-- These indexes also keep FIFO allocation and request audit reads tenant-scoped.
create index leave_requests_employment_fk_idx
  on public.leave_requests (tenant_id, administration_id, employee_id, employment_id);
create index leave_requests_priority_rule_fk_idx
  on public.leave_requests (tenant_id, administration_id, priority_rule_id)
  where priority_rule_id is not null;
create index leave_requests_leave_type_fk_idx
  on public.leave_requests (tenant_id, administration_id, leave_type_id)
  where leave_type_id is not null;
create index leave_requests_actor_idx
  on public.leave_requests (actor_user_id);

create index leave_request_allocations_employment_fk_idx
  on public.leave_request_allocations (tenant_id, administration_id, employee_id, employment_id);
create index leave_request_allocations_type_fk_idx
  on public.leave_request_allocations (tenant_id, administration_id, leave_type_id);
create index leave_request_allocations_bucket_fk_idx
  on public.leave_request_allocations (tenant_id, administration_id, employment_id, leave_type_id, bucket_id)
  where bucket_id is not null;

create index employment_work_hour_entries_employment_fk_idx
  on public.employment_work_hour_entries (tenant_id, administration_id, employee_id, employment_id);
create index employment_work_hour_entries_approved_by_idx
  on public.employment_work_hour_entries (approved_by)
  where approved_by is not null;
create index employment_work_hour_entries_created_by_idx
  on public.employment_work_hour_entries (created_by)
  where created_by is not null;
