-- Employees need only the active capability vocabulary and active levels to
-- create their own draft record. This does not expose personal records or
-- configuration write access.
drop policy if exists talent_capabilities_self_record_read on public.talent_capabilities;
create policy talent_capabilities_self_record_read
on public.talent_capabilities for select to authenticated
using (
  status = 'ACTIVE'
  and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-record:read'))
);

drop policy if exists talent_levels_self_record_read on public.talent_levels;
create policy talent_levels_self_record_read
on public.talent_levels for select to authenticated
using (
  exists (
    select 1
    from public.talent_level_models model
    where model.tenant_id = talent_levels.tenant_id
      and model.id = talent_levels.level_model_id
      and model.status = 'ACTIVE'
  )
  and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-record:read'))
);
