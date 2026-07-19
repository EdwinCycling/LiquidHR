drop policy if exists dashboard_widget_configs_write on public.dashboard_widget_configs;
create policy dashboard_widget_configs_insert on public.dashboard_widget_configs for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'dashboard-widget:write')));
create policy dashboard_widget_configs_update on public.dashboard_widget_configs for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'dashboard-widget:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'dashboard-widget:write')));
create policy dashboard_widget_configs_delete on public.dashboard_widget_configs for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'dashboard-widget:write')));

drop policy if exists dashboard_widget_role_access_write on public.dashboard_widget_role_access;
create policy dashboard_widget_role_access_insert on public.dashboard_widget_role_access for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'dashboard-widget:write')));
create policy dashboard_widget_role_access_update on public.dashboard_widget_role_access for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'dashboard-widget:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'dashboard-widget:write')));
create policy dashboard_widget_role_access_delete on public.dashboard_widget_role_access for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'dashboard-widget:write')));

create index dashboard_widget_configs_updated_by_idx on public.dashboard_widget_configs (updated_by);
create index dashboard_widget_role_access_management_role_idx on public.dashboard_widget_role_access (management_role_id);
