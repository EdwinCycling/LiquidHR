alter table public.overtime_type_settings
  add column if not exists requires_manager_approval boolean not null default false;

create unique index if not exists work_hour_types_tenant_hr_group_name_unique
  on public.work_hour_types (tenant_id, hr_group_id, lower(btrim(name)));
