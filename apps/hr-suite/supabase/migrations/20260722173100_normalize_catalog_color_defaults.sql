update public.leave_types
set color_code = 'var(--chart-1)'
where color_code = 'default';

alter table public.leave_types
  alter column color_code set default 'var(--chart-1)';

update public.work_hour_types
set color_code = 'var(--chart-1)'
where color_code = 'blue';

alter table public.work_hour_types
  alter column color_code set default 'var(--chart-1)';
