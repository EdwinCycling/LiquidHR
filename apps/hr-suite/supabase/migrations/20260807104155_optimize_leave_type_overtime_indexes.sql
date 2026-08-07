drop index if exists public.leave_type_overtime_work_hours_type_idx;

create index if not exists leave_type_overtime_work_hours_created_by_idx
  on public.leave_type_overtime_work_hours (created_by);
