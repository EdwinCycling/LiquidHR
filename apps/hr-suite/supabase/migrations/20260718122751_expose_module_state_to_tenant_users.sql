drop policy tenant_modules_read on public.tenant_modules;
create policy tenant_modules_read on public.tenant_modules for select to authenticated
using ((select internal_security.has_tenant_access(tenant_id)));
