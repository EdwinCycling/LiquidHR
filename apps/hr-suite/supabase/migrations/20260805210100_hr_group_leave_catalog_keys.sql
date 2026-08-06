begin;

create unique index if not exists leave_settings_tenant_hr_group_key
  on public.leave_settings (tenant_id, hr_group_id);
create unique index if not exists leave_year_controls_tenant_hr_group_year_key
  on public.leave_year_controls (tenant_id, hr_group_id, year);
create unique index if not exists leave_types_tenant_hr_group_name_key
  on public.leave_types (tenant_id, hr_group_id, name);
create unique index if not exists work_hour_types_tenant_hr_group_name_key
  on public.work_hour_types (tenant_id, hr_group_id, name);
create unique index if not exists leave_profiles_tenant_hr_group_name_key
  on public.leave_profiles (tenant_id, hr_group_id, name);
create unique index if not exists leave_year_rollovers_tenant_hr_group_from_year_key
  on public.leave_year_rollovers (tenant_id, hr_group_id, from_year);

commit;
