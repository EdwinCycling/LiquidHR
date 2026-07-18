create type public.date_format as enum ('DMY', 'MDY', 'YMD');
create type public.time_format as enum ('24H', '12H');

alter table public.user_preferences
  add column date_format public.date_format not null default 'DMY',
  add column time_format public.time_format not null default '24H';
