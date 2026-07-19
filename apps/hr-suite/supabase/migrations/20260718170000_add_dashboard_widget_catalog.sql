insert into public.permissions (code, name, category, description)
values
  ('dashboard-widget:read', 'Dashboardwidgets bekijken', 'DASHBOARD', 'Geautoriseerde dashboardwidgets bekijken'),
  ('dashboard-widget:write', 'Dashboardwidgets beheren', 'DASHBOARD', 'Dashboardwidgetcatalogus en roltoegang beheren')
on conflict (code) do update set name = excluded.name, category = excluded.category, description = excluded.description;

create table public.dashboard_widget_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  widget_type text not null,
  is_enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, widget_type)
);

create table public.dashboard_widget_role_access (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  widget_type text not null,
  management_role_id uuid not null references public.management_roles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, widget_type, management_role_id)
);

create index dashboard_widget_configs_tenant_idx on public.dashboard_widget_configs (tenant_id, widget_type);
create index dashboard_widget_role_access_tenant_widget_idx on public.dashboard_widget_role_access (tenant_id, widget_type);

create trigger set_dashboard_widget_configs_updated_at before update on public.dashboard_widget_configs
for each row execute function internal_security.set_updated_at();
create trigger set_dashboard_widget_role_access_updated_at before update on public.dashboard_widget_role_access
for each row execute function internal_security.set_updated_at();
create trigger audit_dashboard_widget_configs after insert or update or delete on public.dashboard_widget_configs
for each row execute function internal_security.audit_hr_change('dashboard_widget_config');
create trigger audit_dashboard_widget_role_access after insert or update or delete on public.dashboard_widget_role_access
for each row execute function internal_security.audit_hr_change('dashboard_widget_role_access');

alter table public.dashboard_widget_configs enable row level security;
alter table public.dashboard_widget_role_access enable row level security;

create policy dashboard_widget_configs_select on public.dashboard_widget_configs
for select to authenticated using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'dashboard-widget:read'))
);
create policy dashboard_widget_configs_write on public.dashboard_widget_configs
for all to authenticated using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'dashboard-widget:write'))
) with check (
  (select internal_security.current_user_has_permission(tenant_id, null, 'dashboard-widget:write'))
);

create policy dashboard_widget_role_access_select on public.dashboard_widget_role_access
for select to authenticated using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'dashboard-widget:read'))
);
create policy dashboard_widget_role_access_write on public.dashboard_widget_role_access
for all to authenticated using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'dashboard-widget:write'))
) with check (
  (select internal_security.current_user_has_permission(tenant_id, null, 'dashboard-widget:write'))
);

grant select, insert, update, delete on public.dashboard_widget_configs to authenticated;
grant select, insert, update, delete on public.dashboard_widget_role_access to authenticated;

with widget_types(widget_type) as (values
  ('WELCOME'), ('MY_REMINDERS'), ('ORGANIZATION_OVERVIEW'), ('EMPLOYEE_OVERVIEW'),
  ('MY_PROFILE'), ('PROFILE_COMPLETENESS'), ('MY_EMERGENCY_CONTACTS'), ('EMPLOYEE_DIRECTORY'), ('UPCOMING_BIRTHDAYS'),
  ('HEADCOUNT_BY_DEPARTMENT'), ('GENDER_DISTRIBUTION'), ('EDUCATION_MIX'), ('NATIONALITY_DISTRIBUTION'),
  ('MY_CONTRACT_DETAILS'), ('CONTRACT_TYPE_MIX'), ('EXPIRING_CONTRACTS'), ('PROBATION_ALERTS'), ('UPCOMING_STARTS'),
  ('CURRENT_MONTH_ENDS'), ('AVERAGE_TENURE'), ('EMPLOYMENT_STATUS_MIX'), ('EMPLOYMENT_CHANGE_TIMELINE'),
  ('MY_RECENT_DOCUMENTS'), ('EXPIRING_DOCUMENTS'), ('DOCUMENTS_BY_CATEGORY'), ('DOCUMENTS_PER_EMPLOYEE'), ('DOCUMENT_REMINDER_STATUS'),
  ('MY_SALARY_HISTORY'), ('AVERAGE_SALARY_BY_DEPARTMENT'), ('SALARY_SCALE_OCCUPANCY'), ('PAYMENT_TYPE_MIX'), ('COST_ALLOCATION_MIX'), ('SALARY_CHANGE_TIMELINE'),
  ('MY_WEEKLY_ROSTER'), ('WEEKDAY_HOURS'), ('FTE_BY_DEPARTMENT'), ('ROSTER_COVERAGE_BY_DEPARTMENT'), ('UPCOMING_HOLIDAYS'), ('ACTIVE_REMINDERS'), ('ORGANIZATION_SUMMARY'), ('WORK_PATTERNS_BY_DEPARTMENT')
)
insert into public.dashboard_widget_configs (tenant_id, widget_type)
select tenant.id, widget.widget_type
from public.tenants tenant cross join widget_types widget
on conflict (tenant_id, widget_type) do nothing;

insert into public.dashboard_widget_role_access (tenant_id, widget_type, management_role_id)
select tenant.id, config.widget_type, role.id
from public.tenants tenant
join public.dashboard_widget_configs config on config.tenant_id = tenant.id
join public.management_roles role on role.tenant_id is null and role.code in ('EMPLOYEE', 'DIRECT_MANAGER', 'TENANT_ADMIN')
on conflict (tenant_id, widget_type, management_role_id) do nothing;

insert into public.dashboard_widget_role_access (tenant_id, widget_type, management_role_id)
select tenant.id, config.widget_type, role.id
from public.tenants tenant
join public.dashboard_widget_configs config on config.tenant_id = tenant.id
join public.management_roles role on role.tenant_id = tenant.id and role.code in ('HR_ADVISOR', 'PAYROLL_SPECIALIST', 'TEAM_LEAD')
on conflict (tenant_id, widget_type, management_role_id) do nothing;
