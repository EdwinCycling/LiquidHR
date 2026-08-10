begin;

create table public.company_activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  administration_id uuid,
  name text not null check (length(btrim(name)) between 1 and 160),
  activity_date date not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint company_activities_hr_group_fkey foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete cascade,
  constraint company_activities_unique_date_name unique (tenant_id, hr_group_id, activity_date, name)
);

create index company_activities_upcoming_idx
  on public.company_activities (tenant_id, hr_group_id, activity_date)
  where is_active;

create trigger company_activities_updated
before update on public.company_activities
for each row execute function internal_security.set_updated_at();

create trigger audit_company_activities
after insert or update or delete on public.company_activities
for each row execute function internal_security.audit_configuration_change('company_activity');

alter table public.company_activities enable row level security;

create policy company_activities_read_group_scoped
on public.company_activities for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'holidays:read'))
  or (select internal_security.current_employee_id(tenant_id, hr_group_id)) is not null
);

create policy company_activities_insert_group_scoped
on public.company_activities for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'holidays:write')));

create policy company_activities_update_group_scoped
on public.company_activities for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'holidays:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'holidays:write')));

create policy company_activities_delete_group_scoped
on public.company_activities for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'holidays:write')));

grant select, insert, update, delete on public.company_activities to authenticated;

drop policy if exists holidays_read_group_scoped on public.holidays;
create policy holidays_read_group_scoped
on public.holidays for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'holidays:read'))
  or (select internal_security.current_employee_id(tenant_id, hr_group_id)) is not null
);

commit;
