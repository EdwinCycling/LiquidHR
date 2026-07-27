create table public.absence_task_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null references public.administrations(id) on delete cascade,
  code text not null check (code = upper(code) and code ~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'),
  title text not null check (char_length(trim(title)) between 1 and 160),
  description text check (description is null or char_length(description) <= 1000),
  due_after_effective_days smallint not null check (due_after_effective_days between 1 and 3650),
  evidence_required boolean not null default false,
  evidence_category text check (evidence_category is null or char_length(trim(evidence_category)) between 1 and 120),
  source text not null default 'CUSTOM' check (source in ('CUSTOM', 'SYSTEM')),
  source_version text,
  valid_from date,
  valid_until date,
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint absence_task_templates_scope_unique unique (tenant_id, administration_id, code),
  constraint absence_task_templates_evidence_required_check check (not evidence_required or evidence_category is not null),
  constraint absence_task_templates_source_guard check ((source = 'SYSTEM') = is_system),
  constraint absence_task_templates_validity_check check (valid_until is null or valid_from is null or valid_until > valid_from)
);

create index absence_task_templates_administration_active_idx
  on public.absence_task_templates (tenant_id, administration_id, is_active, due_after_effective_days);

alter table public.absence_task_templates enable row level security;

create policy absence_task_templates_select on public.absence_task_templates
  for select to authenticated
  using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'absence-settings:read')));

create policy absence_task_templates_insert on public.absence_task_templates
  for insert to authenticated
  with check (
    source = 'CUSTOM'
    and is_system = false
    and (select internal_security.current_user_has_permission(tenant_id, administration_id, 'absence-settings:write'))
  );

create policy absence_task_templates_update on public.absence_task_templates
  for update to authenticated
  using (
    source = 'CUSTOM'
    and is_system = false
    and (select internal_security.current_user_has_permission(tenant_id, administration_id, 'absence-settings:write'))
  )
  with check (
    source = 'CUSTOM'
    and is_system = false
    and (select internal_security.current_user_has_permission(tenant_id, administration_id, 'absence-settings:write'))
  );

grant select, insert, update on table public.absence_task_templates to authenticated;
revoke all on table public.absence_task_templates from anon;

create trigger absence_task_templates_updated_at
  before update on public.absence_task_templates
  for each row execute function internal_security.set_updated_at();

create trigger absence_task_templates_audit
  after insert or update on public.absence_task_templates
  for each row execute function internal_security.audit_hr_change('absence_task_template');
