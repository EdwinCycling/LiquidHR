create unique index if not exists leave_types_tenant_hr_group_name_unique
on public.leave_types (tenant_id, hr_group_id, lower(btrim(name)));
