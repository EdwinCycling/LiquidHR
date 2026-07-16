create type public.identity_match_decision as enum (
  'EXISTING_EMPLOYEE',
  'DIFFERENT_PERSON',
  'UNRESOLVED'
);

insert into public.permissions (code, name, category, description)
values (
  'employee:match',
  'Medewerkers ontdubbelen',
  'Persoonlijk',
  'Zoekt en beoordeelt mogelijke dubbele persoonskaarten binnen één tenant.'
)
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission on permission.code = 'employee:match'
where role.code = 'TENANT_ADMIN'
  and role.tenant_id is null
on conflict do nothing;

alter table public.employees
  add column bsn_fingerprint text,
  add constraint employees_bsn_fingerprint_format
    check (bsn_fingerprint is null or bsn_fingerprint ~ '^[0-9a-f]{64}$');

create unique index employees_tenant_bsn_fingerprint_key
  on public.employees (tenant_id, bsn_fingerprint)
  where bsn_fingerprint is not null and deleted_at is null;

create table public.identity_match_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  match_request_id uuid not null,
  candidate_employee_id uuid,
  selected_employee_id uuid,
  decision public.identity_match_decision not null,
  rule_summary jsonb not null default '{}'::jsonb,
  justification text,
  decided_by_user_id uuid not null references auth.users(id) on delete restrict,
  decided_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  constraint identity_match_decisions_rule_summary_object
    check (jsonb_typeof(rule_summary) = 'object'),
  constraint identity_match_decisions_justification_required
    check (decision <> 'DIFFERENT_PERSON' or length(btrim(coalesce(justification, ''))) >= 10),
  constraint identity_match_decisions_selection_valid
    check (
      (decision = 'EXISTING_EMPLOYEE' and selected_employee_id is not null)
      or (decision <> 'EXISTING_EMPLOYEE' and selected_employee_id is null)
    ),
  constraint identity_match_decisions_candidate_same_tenant_fkey
    foreign key (tenant_id, candidate_employee_id)
    references public.employees(tenant_id, id)
    on delete restrict,
  constraint identity_match_decisions_selected_same_tenant_fkey
    foreign key (tenant_id, selected_employee_id)
    references public.employees(tenant_id, id)
    on delete restrict
);

create index identity_match_decisions_tenant_request_idx
  on public.identity_match_decisions (tenant_id, match_request_id);
create index identity_match_decisions_tenant_candidate_idx
  on public.identity_match_decisions (tenant_id, candidate_employee_id)
  where candidate_employee_id is not null;
create index identity_match_decisions_tenant_selected_idx
  on public.identity_match_decisions (tenant_id, selected_employee_id)
  where selected_employee_id is not null;
create index identity_match_decisions_decided_by_user_id_idx
  on public.identity_match_decisions (decided_by_user_id);

create or replace function internal_security.validate_identity_match_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and new.decided_by_user_id <> (select auth.uid()) then
    raise exception 'IDENTITY_MATCH_ACTOR_INVALID';
  end if;

  return new;
end;
$$;

revoke all on function internal_security.validate_identity_match_decision()
from public, anon, authenticated;

create trigger validate_identity_match_decision_before_insert
before insert on public.identity_match_decisions
for each row execute function internal_security.validate_identity_match_decision();

alter table public.identity_match_decisions enable row level security;

create policy identity_match_decisions_select_scoped
on public.identity_match_decisions
for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'employee:match')));

create policy identity_match_decisions_insert_scoped
on public.identity_match_decisions
for insert to authenticated
with check (
  decided_by_user_id = (select auth.uid())
  and (select internal_security.current_user_has_permission(tenant_id, null, 'employee:match'))
);

grant select, insert on table public.identity_match_decisions to authenticated;
