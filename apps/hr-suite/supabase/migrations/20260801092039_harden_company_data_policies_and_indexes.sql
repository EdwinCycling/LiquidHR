drop policy if exists administration_company_data_write on public.administration_company_data;
drop policy if exists administration_locations_write on public.administration_locations;

create policy administration_company_data_insert
on public.administration_company_data
for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'company-data:write')));

create policy administration_company_data_update
on public.administration_company_data
for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'company-data:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'company-data:write')));

create policy administration_company_data_delete
on public.administration_company_data
for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'company-data:write')));

create policy administration_locations_insert
on public.administration_locations
for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'company-data:write')));

create policy administration_locations_update
on public.administration_locations
for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'company-data:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'company-data:write')));

create policy administration_locations_delete
on public.administration_locations
for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'company-data:write')));

create index if not exists administration_company_data_created_by_idx
  on public.administration_company_data (created_by_user_id);
create index if not exists administration_company_data_updated_by_idx
  on public.administration_company_data (updated_by_user_id);
create index if not exists administration_locations_created_by_idx
  on public.administration_locations (created_by_user_id);
create index if not exists administration_locations_updated_by_idx
  on public.administration_locations (updated_by_user_id);
