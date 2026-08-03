create table public.product_update_surface_dismissals (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_update_id uuid not null references public.product_updates(id) on delete cascade,
  channel text not null check (channel in ('LOGIN_POPUP', 'TOP_BANNER')),
  seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, user_id, product_update_id, channel)
);

create index product_update_surface_dismissals_user_idx
  on public.product_update_surface_dismissals (tenant_id, user_id, channel, seen_at desc);

create trigger set_product_update_surface_dismissals_updated_at
before update on public.product_update_surface_dismissals
for each row execute function internal_security.set_updated_at();

alter table public.product_update_surface_dismissals enable row level security;

create policy product_update_surface_dismissals_select_self
on public.product_update_surface_dismissals for select to authenticated
using (
  user_id = (select auth.uid())
  and internal_security.has_tenant_access(tenant_id)
);

create policy product_update_surface_dismissals_insert_self
on public.product_update_surface_dismissals for insert to authenticated
with check (
  user_id = (select auth.uid())
  and internal_security.has_tenant_access(tenant_id)
);

create policy product_update_surface_dismissals_update_self
on public.product_update_surface_dismissals for update to authenticated
using (
  user_id = (select auth.uid())
  and internal_security.has_tenant_access(tenant_id)
)
with check (
  user_id = (select auth.uid())
  and internal_security.has_tenant_access(tenant_id)
);

grant select, insert, update on table public.product_update_surface_dismissals to authenticated;
