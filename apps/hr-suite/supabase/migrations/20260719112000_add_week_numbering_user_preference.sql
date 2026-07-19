create type public.week_numbering_system as enum ('JANUARY_FIRST', 'ISO');

alter table public.user_preferences
  add column week_numbering_system public.week_numbering_system not null default 'JANUARY_FIRST';
