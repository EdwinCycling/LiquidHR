insert into public.dashboard_widget_configs (tenant_id, widget_type, is_enabled)
select tenant.id, 'COMPANY_DOCUMENTS', true
from public.tenants tenant
on conflict (tenant_id, widget_type) do nothing;
