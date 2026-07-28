alter table public.work_hour_types
  add column if not exists is_self_service boolean not null default true,
  add column if not exists pin_in_calendar boolean not null default false;

insert into public.overtime_type_settings (tenant_id, administration_id, work_hour_type_id)
select tenant_id, administration_id, id
from public.work_hour_types
on conflict (tenant_id, administration_id, work_hour_type_id) do nothing;
