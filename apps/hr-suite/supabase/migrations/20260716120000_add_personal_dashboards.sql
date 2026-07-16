create table public.personal_dashboards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint personal_dashboards_tenant_id_id_key unique (tenant_id, id)
);

create unique index personal_dashboards_one_default_per_owner_idx
  on public.personal_dashboards (tenant_id, owner_user_id)
  where is_default;
create index personal_dashboards_owner_recent_idx on public.personal_dashboards (tenant_id, owner_user_id, updated_at desc);

create table public.personal_dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  dashboard_id uuid not null,
  widget_type text not null check (widget_type in ('WELCOME', 'MY_REMINDERS', 'ORGANIZATION_OVERVIEW', 'EMPLOYEE_OVERVIEW')),
  position integer not null check (position between 0 and 50),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint personal_dashboard_widgets_dashboard_same_tenant_fkey
    foreign key (tenant_id, dashboard_id)
    references public.personal_dashboards(tenant_id, id)
    on delete cascade,
  constraint personal_dashboard_widgets_dashboard_position_key unique (dashboard_id, position)
);

create index personal_dashboard_widgets_dashboard_position_idx on public.personal_dashboard_widgets (tenant_id, dashboard_id, position);

create trigger set_personal_dashboards_updated_at before update on public.personal_dashboards
for each row execute function internal_security.set_updated_at();
create trigger set_personal_dashboard_widgets_updated_at before update on public.personal_dashboard_widgets
for each row execute function internal_security.set_updated_at();

alter table public.personal_dashboards enable row level security;
alter table public.personal_dashboard_widgets enable row level security;

create policy personal_dashboards_owner_access on public.personal_dashboards for all to authenticated
using (owner_user_id = (select auth.uid()) and (select internal_security.has_tenant_access(tenant_id)))
with check (owner_user_id = (select auth.uid()) and (select internal_security.has_tenant_access(tenant_id)));

create policy personal_dashboard_widgets_owner_access on public.personal_dashboard_widgets for all to authenticated
using (exists (
  select 1 from public.personal_dashboards dashboard
  where dashboard.id = personal_dashboard_widgets.dashboard_id
    and dashboard.tenant_id = personal_dashboard_widgets.tenant_id
    and dashboard.owner_user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.personal_dashboards dashboard
  where dashboard.id = personal_dashboard_widgets.dashboard_id
    and dashboard.tenant_id = personal_dashboard_widgets.tenant_id
    and dashboard.owner_user_id = (select auth.uid())
));

grant select, insert, update, delete on public.personal_dashboards to authenticated;
grant select, insert, update, delete on public.personal_dashboard_widgets to authenticated;
