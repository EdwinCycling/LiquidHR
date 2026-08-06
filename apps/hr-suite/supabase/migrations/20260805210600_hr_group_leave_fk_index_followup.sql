begin;

drop index if exists public.overtime_type_exceptions_employee_idx;

-- This FK is tenant-scoped, so tenant_id must be the leftmost index column.
create index if not exists overtime_type_exceptions_employee_tenant_idx
  on public.overtime_type_exceptions (tenant_id, employee_id);

commit;
