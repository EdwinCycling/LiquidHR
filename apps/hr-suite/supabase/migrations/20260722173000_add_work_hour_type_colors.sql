alter table public.work_hour_types
  add column if not exists color_code text not null default 'blue';

alter table public.work_hour_types
  drop constraint if exists work_hour_types_color_code_valid;

alter table public.work_hour_types
  add constraint work_hour_types_color_code_valid
  check (length(btrim(color_code)) between 1 and 32);
