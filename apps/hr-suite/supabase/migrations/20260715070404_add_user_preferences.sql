create type public.ui_locale as enum ('nl', 'en');
create type public.ui_theme as enum (
  'liquid-navy',
  'noordzee',
  'bos',
  'warm-zand',
  'aubergine',
  'nacht'
);

create table public.user_preferences (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  locale public.ui_locale not null default 'nl',
  theme public.ui_theme not null default 'liquid-navy',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_user_preferences_updated_at
before update on public.user_preferences
for each row execute function internal_security.set_updated_at();

alter table public.user_preferences enable row level security;

create policy user_preferences_select_self
on public.user_preferences
for select
to authenticated
using (auth_user_id = (select auth.uid()));

create policy user_preferences_insert_self
on public.user_preferences
for insert
to authenticated
with check (auth_user_id = (select auth.uid()));

create policy user_preferences_update_self
on public.user_preferences
for update
to authenticated
using (auth_user_id = (select auth.uid()))
with check (auth_user_id = (select auth.uid()));

grant select, insert, update on table public.user_preferences to authenticated;
