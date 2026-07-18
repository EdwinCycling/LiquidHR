drop policy if exists dashboard_widget_configs_select on public.dashboard_widget_configs;
create policy dashboard_widget_configs_select on public.dashboard_widget_configs
for select to authenticated using (
  (select internal_security.has_tenant_access(tenant_id))
);

drop policy if exists dashboard_widget_role_access_select on public.dashboard_widget_role_access;
create policy dashboard_widget_role_access_select on public.dashboard_widget_role_access
for select to authenticated using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'dashboard-widget:read'))
);
