insert into public.personal_dashboard_widgets (tenant_id, dashboard_id, widget_type, position, settings)
select dashboard.tenant_id,
       dashboard.id,
       'COMPANY_DOCUMENTS',
       coalesce((select max(existing.position) + 1 from public.personal_dashboard_widgets existing where existing.dashboard_id = dashboard.id), 0),
       '{}'::jsonb
from public.personal_dashboards dashboard
where dashboard.is_default
  and not exists (
    select 1 from public.personal_dashboard_widgets existing
    where existing.dashboard_id = dashboard.id
      and existing.widget_type = 'COMPANY_DOCUMENTS'
  );
