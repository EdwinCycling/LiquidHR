begin;

-- Cover the Actual Work user and type foreign keys without changing RLS or data.
create index if not exists work_hour_types_created_by_idx
  on public.work_hour_types (created_by);
create index if not exists work_hour_types_updated_by_idx
  on public.work_hour_types (updated_by);
create index if not exists employment_work_hour_entries_type_group_idx
  on public.employment_work_hour_entries (tenant_id, hr_group_id, work_hour_type_id);
create index if not exists actual_work_type_limits_created_by_idx
  on public.actual_work_type_limits (created_by);
create index if not exists actual_work_type_limits_updated_by_idx
  on public.actual_work_type_limits (updated_by);
create index if not exists actual_work_periods_closed_by_idx
  on public.actual_work_periods (closed_by);
create index if not exists actual_work_periods_created_by_idx
  on public.actual_work_periods (created_by);
create index if not exists actual_work_revisions_actor_user_idx
  on public.actual_work_revisions (actor_user_id);

commit;

