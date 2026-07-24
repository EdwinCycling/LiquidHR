create table public.tenant_anniversary_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  years smallint not null check (years between 1 and 80),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, years)
);

create index tenant_anniversary_rules_active_idx on public.tenant_anniversary_rules (tenant_id, years) where is_active;

alter table public.tenant_anniversary_rules enable row level security;

create policy tenant_anniversary_rules_read on public.tenant_anniversary_rules for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'settings:read')));
create policy tenant_anniversary_rules_insert on public.tenant_anniversary_rules for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'settings:read')));
create policy tenant_anniversary_rules_update on public.tenant_anniversary_rules for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'settings:read')))
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'settings:read')));
create policy tenant_anniversary_rules_delete on public.tenant_anniversary_rules for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'settings:read')));

grant select, insert, update, delete on public.tenant_anniversary_rules to authenticated;

create trigger tenant_anniversary_rules_updated before update on public.tenant_anniversary_rules
for each row execute function internal_security.set_updated_at();
create trigger audit_tenant_anniversary_rules after insert or update or delete on public.tenant_anniversary_rules
for each row execute function internal_security.audit_configuration_change('tenant_anniversary_rule');

insert into public.tenant_anniversary_rules (tenant_id, years)
select tenant.id, rule.years
from public.tenants tenant
cross join (values (1::smallint), (5::smallint), (25::smallint)) as rule(years)
on conflict (tenant_id, years) do nothing;
