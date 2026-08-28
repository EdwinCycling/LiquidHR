-- AN-0 retires the legacy personal analytical dashboard and its tenant widget catalogue.
-- Drop children before parents. No CASCADE is intentional: an unexpected dependency
-- must fail the migration instead of silently removing another database object.
drop table if exists public.personal_dashboard_widgets;
drop table if exists public.personal_dashboards;
drop table if exists public.dashboard_widget_role_access;
drop table if exists public.dashboard_widget_configs;

-- dashboard:read remains the access contract for /insights/analysis.
-- dashboard-widget:* permission rows are intentionally left inert for now because
-- deleting permission rows would be a separate authorization cleanup decision.
