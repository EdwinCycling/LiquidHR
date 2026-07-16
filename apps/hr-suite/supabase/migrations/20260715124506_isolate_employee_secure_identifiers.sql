create table public.employee_secure_identifiers (
  id uuid not null default gen_random_uuid() unique,
  employee_id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  bsn_ciphertext text,
  bsn_fingerprint text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employee_secure_identifiers_employee_scope_fkey
    foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id) on delete cascade,
  constraint employee_secure_identifiers_bsn_pair_check check (
    (bsn_ciphertext is null) = (bsn_fingerprint is null)
  )
);

create unique index employee_secure_identifiers_bsn_fingerprint_key
  on public.employee_secure_identifiers (tenant_id, bsn_fingerprint)
  where bsn_fingerprint is not null;

insert into public.employee_secure_identifiers (
  employee_id, tenant_id, bsn_ciphertext, bsn_fingerprint
)
select id, tenant_id, bsn_ciphertext, bsn_fingerprint
from public.employees
where bsn_ciphertext is not null or bsn_fingerprint is not null;

create function internal_security.employee_secure_identifier_can_read(
  requested_tenant_id uuid,
  requested_employee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (
      requested_employee_id = internal_security.current_employee_id()
      and internal_security.current_employee_has_permission('self:employee-bsn:read')
    )
    or internal_security.current_user_has_permission(
      requested_tenant_id, null, 'employee-bsn:read'
    )
    or internal_security.can_manage_employee(requested_employee_id, 'employee-bsn:read');
$$;

create function internal_security.employee_secure_identifier_can_write(
  requested_tenant_id uuid,
  requested_employee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    internal_security.current_user_has_permission(
      requested_tenant_id, null, 'employee-bsn:write'
    )
    or internal_security.can_manage_employee(requested_employee_id, 'employee-bsn:write');
$$;

revoke all on function internal_security.employee_secure_identifier_can_read(uuid, uuid)
from public, anon, authenticated;
revoke all on function internal_security.employee_secure_identifier_can_write(uuid, uuid)
from public, anon, authenticated;

alter table public.employee_secure_identifiers enable row level security;
create policy employee_secure_identifiers_select_scoped
on public.employee_secure_identifiers for select to authenticated
using ((select internal_security.employee_secure_identifier_can_read(tenant_id, employee_id)));
create policy employee_secure_identifiers_insert_scoped
on public.employee_secure_identifiers for insert to authenticated
with check ((select internal_security.employee_secure_identifier_can_write(tenant_id, employee_id)));
create policy employee_secure_identifiers_update_scoped
on public.employee_secure_identifiers for update to authenticated
using ((select internal_security.employee_secure_identifier_can_write(tenant_id, employee_id)))
with check ((select internal_security.employee_secure_identifier_can_write(tenant_id, employee_id)));

create trigger set_employee_secure_identifiers_updated_at
before update on public.employee_secure_identifiers
for each row execute function internal_security.set_updated_at();
create trigger audit_employee_secure_identifiers
after insert or update or delete on public.employee_secure_identifiers
for each row execute function internal_security.audit_hr_change('employee_secure_identifier');

grant select, insert, update on public.employee_secure_identifiers to authenticated;
revoke delete on public.employee_secure_identifiers from authenticated;

alter table public.employees
  drop column bsn_ciphertext,
  drop column bsn_fingerprint;
