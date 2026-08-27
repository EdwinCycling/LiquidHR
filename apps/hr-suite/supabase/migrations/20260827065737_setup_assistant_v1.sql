begin;

create table public.setup_guide_settings (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hr_group_id uuid not null,
  guide_code text not null check (
    char_length(btrim(guide_code)) between 1 and 80
    and guide_code = upper(btrim(guide_code))
  ),
  is_enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (tenant_id, hr_group_id, guide_code),
  constraint setup_guide_settings_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete cascade
);

create table public.setup_step_completion (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hr_group_id uuid not null,
  guide_code text not null check (
    char_length(btrim(guide_code)) between 1 and 80
    and guide_code = upper(btrim(guide_code))
  ),
  step_key text not null check (char_length(btrim(step_key)) between 1 and 120),
  is_completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (tenant_id, hr_group_id, guide_code, step_key),
  constraint setup_step_completion_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete cascade,
  constraint setup_step_completion_state_check
    check (
      (is_completed and completed_at is not null and completed_by is not null)
      or (not is_completed and completed_at is null and completed_by is null)
    )
);

comment on table public.setup_guide_settings is 'Gedeelde Setup Assistent-instelling per tenant en HR-groep.';
comment on table public.setup_step_completion is 'Gedeelde Setup Assistent-voortgang per tenant, HR-groep en stap.';

create trigger setup_guide_settings_updated
before update on public.setup_guide_settings
for each row execute function internal_security.set_updated_at();

create trigger setup_step_completion_updated
before update on public.setup_step_completion
for each row execute function internal_security.set_updated_at();

create trigger audit_setup_guide_settings
after insert or update or delete on public.setup_guide_settings
for each row execute function internal_security.audit_configuration_change('setup_guide_setting');

create trigger audit_setup_step_completion
after insert or update or delete on public.setup_step_completion
for each row execute function internal_security.audit_configuration_change('setup_step_completion');

alter table public.setup_guide_settings enable row level security;
alter table public.setup_step_completion enable row level security;

revoke all on table public.setup_guide_settings from public, anon, authenticated;
revoke all on table public.setup_step_completion from public, anon, authenticated;
grant select, insert, update, delete on table public.setup_guide_settings to authenticated;
grant select, insert, update, delete on table public.setup_step_completion to authenticated;

create policy setup_guide_settings_select_group_scoped
on public.setup_guide_settings for select to authenticated
using ((select internal_security.has_hr_group_access(tenant_id, hr_group_id)));

create policy setup_guide_settings_insert_group_scoped
on public.setup_guide_settings for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(
  tenant_id, hr_group_id, 'settings:write'
)));

create policy setup_guide_settings_update_group_scoped
on public.setup_guide_settings for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(
  tenant_id, hr_group_id, 'settings:write'
)))
with check ((select internal_security.current_user_has_hr_group_permission(
  tenant_id, hr_group_id, 'settings:write'
)));

create policy setup_guide_settings_delete_group_scoped
on public.setup_guide_settings for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(
  tenant_id, hr_group_id, 'settings:write'
)));

create policy setup_step_completion_select_group_scoped
on public.setup_step_completion for select to authenticated
using ((select internal_security.has_hr_group_access(tenant_id, hr_group_id)));

create policy setup_step_completion_insert_group_scoped
on public.setup_step_completion for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(
  tenant_id, hr_group_id, 'settings:write'
)));

create policy setup_step_completion_update_group_scoped
on public.setup_step_completion for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(
  tenant_id, hr_group_id, 'settings:write'
)))
with check ((select internal_security.current_user_has_hr_group_permission(
  tenant_id, hr_group_id, 'settings:write'
)));

create policy setup_step_completion_delete_group_scoped
on public.setup_step_completion for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(
  tenant_id, hr_group_id, 'settings:write'
)));

commit;
