begin;

update public.tenant_modules
set is_enabled = true,
    enabled_at = coalesce(enabled_at, timezone('utc', now())),
    disabled_at = null,
    disabled_by = null
where module_code = 'DOCUMENTS';

alter table public.tenant_modules
  drop constraint if exists tenant_modules_documents_always_enabled;

alter table public.tenant_modules
  add constraint tenant_modules_documents_always_enabled
  check (module_code <> 'DOCUMENTS' or is_enabled);

insert into public.tenant_modules as existing (tenant_id, module_code, is_enabled, enabled_at)
select tenant.id, 'DOCUMENTS', true, timezone('utc', now())
from public.tenants tenant
on conflict (tenant_id, module_code) do update
set is_enabled = true,
    enabled_at = coalesce(existing.enabled_at, excluded.enabled_at),
    disabled_at = null,
    disabled_by = null;

create or replace function internal_security.tenant_module_enabled(requested_tenant_id uuid, requested_module_code text)
returns boolean language sql stable security definer set search_path=''
as $$
  select (select auth.uid()) is not null
    and internal_security.has_tenant_access(requested_tenant_id)
    and (
      requested_module_code = 'DOCUMENTS'
      or exists(
        select 1
        from public.tenant_modules module
        where module.tenant_id = requested_tenant_id
          and module.module_code = requested_module_code
          and module.is_enabled
      )
    );
$$;

revoke all on function internal_security.tenant_module_enabled(uuid, text) from public, anon, authenticated;
grant execute on function internal_security.tenant_module_enabled(uuid, text) to authenticated;

commit;
