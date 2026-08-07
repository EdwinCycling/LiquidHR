begin;

-- Leave types are editable. Tenant, group and system ownership remain fixed;
-- the HR-admin write policy controls who may change the configuration itself.
create or replace function internal_security.prevent_leave_catalog_identity_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_op <> 'UPDATE' then
    raise exception using errcode = '55000', message = 'LEAVE_CATALOG_IMMUTABLE';
  end if;

  if tg_table_name = 'leave_types' then
    if old.tenant_id is distinct from new.tenant_id
      or old.hr_group_id is distinct from new.hr_group_id
      or old.administration_id is distinct from new.administration_id
      or old.is_system is distinct from new.is_system then
      raise exception using errcode = '55000', message = 'LEAVE_CATALOG_SCOPE_IMMUTABLE';
    end if;
  else
    if old.tenant_id is distinct from new.tenant_id
      or old.hr_group_id is distinct from new.hr_group_id
      or old.administration_id is distinct from new.administration_id
      or old.name is distinct from new.name
      or old.color_code is distinct from new.color_code
      or old.category is distinct from new.category then
      raise exception using errcode = '55000', message = 'LEAVE_CATALOG_IMMUTABLE';
    end if;
  end if;
  return new;
end;
$$;

alter table public.leave_types
  drop constraint if exists leave_types_entitlement_values_valid;

alter table public.leave_types
  drop column if exists scope;

drop type if exists public.leave_type_scope;

alter table public.leave_types
  rename column weekly_hours_cap_factor to annual_hours_fte_cap;

-- All current records are synthetic test data. Convert the former weekly
-- factor sample to the new annual full-time cap used by the editor.
update public.leave_types
set name = replace(name, 'contractfactor', 'deeltijdfactor'),
    entitlement_mode = 'ANNUAL_HOURS_FTE_CAP',
    annual_hours_cap = null,
    annual_hours_fte_cap = 160
where entitlement_mode = 'WEEKLY_HOURS_FACTOR_CAP';

alter table public.leave_types
  add constraint leave_types_entitlement_values_valid check (
    (entitlement_mode = 'ACCRUAL' and annual_hours_cap is null and annual_hours_fte_cap is null)
    or (entitlement_mode = 'UNLIMITED' and annual_hours_cap is null and annual_hours_fte_cap is null)
    or (entitlement_mode = 'ANNUAL_HOURS_CAP' and annual_hours_cap is not null and annual_hours_cap >= 0 and annual_hours_fte_cap is null)
    or (entitlement_mode = 'ANNUAL_HOURS_FTE_CAP' and annual_hours_cap is null and annual_hours_fte_cap is not null and annual_hours_fte_cap >= 0)
    or (entitlement_mode = 'OVERTIME_HOURS' and annual_hours_cap is null and annual_hours_fte_cap is null)
  );

create table public.leave_type_overtime_work_hours (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hr_group_id uuid not null,
  administration_id uuid,
  leave_type_id uuid not null,
  work_hour_type_id uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint leave_type_overtime_work_hours_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete restrict,
  constraint leave_type_overtime_work_hours_leave_type_group_fkey
    foreign key (tenant_id, hr_group_id, leave_type_id)
    references public.leave_types(tenant_id, hr_group_id, id) on delete cascade,
  constraint leave_type_overtime_work_hours_work_type_group_fkey
    foreign key (tenant_id, hr_group_id, work_hour_type_id)
    references public.work_hour_types(tenant_id, hr_group_id, id) on delete restrict,
  primary key (tenant_id, hr_group_id, leave_type_id, work_hour_type_id)
);

create index leave_type_overtime_work_hours_type_idx
  on public.leave_type_overtime_work_hours (tenant_id, hr_group_id, leave_type_id);
create index leave_type_overtime_work_hours_work_type_idx
  on public.leave_type_overtime_work_hours (tenant_id, hr_group_id, work_hour_type_id);

alter table public.leave_type_overtime_work_hours enable row level security;
revoke all on public.leave_type_overtime_work_hours from anon;
grant select, insert, update, delete on public.leave_type_overtime_work_hours to authenticated;

create policy leave_type_overtime_work_hours_group_read
on public.leave_type_overtime_work_hours
for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:read')));

create policy leave_type_overtime_work_hours_group_insert
on public.leave_type_overtime_work_hours
for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:write')));

create policy leave_type_overtime_work_hours_group_update
on public.leave_type_overtime_work_hours
for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:write')));

create policy leave_type_overtime_work_hours_group_delete
on public.leave_type_overtime_work_hours
for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'leave:write')));

create trigger audit_leave_type_overtime_work_hours
after insert or update or delete on public.leave_type_overtime_work_hours
for each row execute function internal_security.audit_configuration_change('leave_type_overtime_work_hours');

create or replace function public.save_group_leave_type(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_leave_type_id uuid,
  requested_name text,
  requested_color_code text,
  requested_entitlement_mode public.leave_type_entitlement_mode,
  requested_annual_hours_cap numeric,
  requested_annual_hours_fte_cap numeric,
  requested_is_self_service boolean,
  requested_allow_limit_overrun boolean,
  requested_pin_in_calendar boolean,
  requested_requires_manager_approval boolean,
  requested_notify_manager_on_request boolean,
  requested_requires_manager_approval_on_cancellation boolean,
  requested_is_active boolean,
  requested_overtime_work_hour_type_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, auth
as $$
declare
  actor_id uuid := auth.uid();
  saved_leave_type_id uuid;
  existing_is_system boolean;
  selected_work_hour_type_id uuid;
  selected_ids uuid[] := coalesce(requested_overtime_work_hour_type_ids, array[]::uuid[]);
begin
  if actor_id is null or not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'leave:write') then
    raise exception using errcode = '42501', message = 'LEAVE_PERMISSION_REQUIRED';
  end if;
  if length(btrim(coalesce(requested_name, ''))) not between 1 and 160
     or length(btrim(coalesce(requested_color_code, ''))) not between 1 and 32 then
    raise exception using errcode = '23514', message = 'LEAVE_TYPE_INPUT_INVALID';
  end if;
  if requested_entitlement_mode = 'ANNUAL_HOURS_CAP' and (requested_annual_hours_cap is null or requested_annual_hours_cap < 0) then
    raise exception using errcode = '23514', message = 'LEAVE_ANNUAL_CAP_REQUIRED';
  end if;
  if requested_entitlement_mode = 'ANNUAL_HOURS_FTE_CAP' and (requested_annual_hours_fte_cap is null or requested_annual_hours_fte_cap < 0) then
    raise exception using errcode = '23514', message = 'LEAVE_ANNUAL_FTE_CAP_REQUIRED';
  end if;
  if requested_entitlement_mode not in ('ANNUAL_HOURS_CAP', 'ANNUAL_HOURS_FTE_CAP')
     and (requested_annual_hours_cap is not null or requested_annual_hours_fte_cap is not null) then
    raise exception using errcode = '23514', message = 'LEAVE_ANNUAL_CAP_NOT_ALLOWED';
  end if;
  if requested_entitlement_mode = 'OVERTIME_HOURS' and cardinality(selected_ids) = 0 then
    raise exception using errcode = '23514', message = 'LEAVE_OVERTIME_TYPE_REQUIRED';
  end if;
  if requested_entitlement_mode <> 'OVERTIME_HOURS' and cardinality(selected_ids) > 0 then
    raise exception using errcode = '23514', message = 'LEAVE_OVERTIME_TYPES_NOT_ALLOWED';
  end if;
  if exists (
    select 1
    from unnest(selected_ids) selected(id)
    where not exists (
      select 1
      from public.work_hour_types type
      where type.tenant_id = requested_tenant_id
        and type.hr_group_id = requested_hr_group_id
        and type.id = selected.id
        and type.category = 'OVERTIME'
        and type.is_active
    )
  ) then
    raise exception using errcode = '23503', message = 'LEAVE_OVERTIME_TYPE_NOT_FOUND';
  end if;

  if requested_leave_type_id is null then
    insert into public.leave_types (
      tenant_id, hr_group_id, administration_id, name, color_code, is_system, is_active,
      is_self_service, entitlement_mode, annual_hours_cap, annual_hours_fte_cap,
      allow_limit_overrun, pin_in_calendar, requires_manager_approval,
      notify_manager_on_request, requires_manager_approval_on_cancellation,
      created_by, updated_by
    ) values (
      requested_tenant_id, requested_hr_group_id, null, btrim(requested_name), btrim(requested_color_code), false,
      requested_is_active, requested_is_self_service, requested_entitlement_mode,
      case when requested_entitlement_mode = 'ANNUAL_HOURS_CAP' then requested_annual_hours_cap else null end,
      case when requested_entitlement_mode = 'ANNUAL_HOURS_FTE_CAP' then requested_annual_hours_fte_cap else null end,
      requested_allow_limit_overrun, requested_pin_in_calendar, requested_requires_manager_approval,
      requested_notify_manager_on_request, requested_requires_manager_approval_on_cancellation,
      actor_id, actor_id
    ) returning id into saved_leave_type_id;
  else
    select type.id, type.is_system
      into saved_leave_type_id, existing_is_system
    from public.leave_types type
    where type.tenant_id = requested_tenant_id
      and type.hr_group_id = requested_hr_group_id
      and type.id = requested_leave_type_id
    for update;
    if saved_leave_type_id is null then
      raise exception using errcode = '23503', message = 'LEAVE_CATALOG_ITEM_NOT_FOUND';
    end if;
    if existing_is_system then
      raise exception using errcode = '55000', message = 'LEAVE_SYSTEM_TYPE_IMMUTABLE';
    end if;
    update public.leave_types
    set name = btrim(requested_name),
        color_code = btrim(requested_color_code),
        is_active = requested_is_active,
        is_self_service = requested_is_self_service,
        entitlement_mode = requested_entitlement_mode,
        annual_hours_cap = case when requested_entitlement_mode = 'ANNUAL_HOURS_CAP' then requested_annual_hours_cap else null end,
        annual_hours_fte_cap = case when requested_entitlement_mode = 'ANNUAL_HOURS_FTE_CAP' then requested_annual_hours_fte_cap else null end,
        allow_limit_overrun = requested_allow_limit_overrun,
        pin_in_calendar = requested_pin_in_calendar,
        requires_manager_approval = requested_requires_manager_approval,
        notify_manager_on_request = requested_notify_manager_on_request,
        requires_manager_approval_on_cancellation = requested_requires_manager_approval_on_cancellation,
        updated_by = actor_id
    where tenant_id = requested_tenant_id
      and hr_group_id = requested_hr_group_id
      and id = requested_leave_type_id;
  end if;

  delete from public.leave_type_overtime_work_hours
  where tenant_id = requested_tenant_id
    and hr_group_id = requested_hr_group_id
    and leave_type_id = saved_leave_type_id;

  foreach selected_work_hour_type_id in array selected_ids loop
    insert into public.leave_type_overtime_work_hours (
      tenant_id, hr_group_id, administration_id, leave_type_id, work_hour_type_id, created_by
    ) values (
      requested_tenant_id, requested_hr_group_id, null, saved_leave_type_id, selected_work_hour_type_id, actor_id
    );
  end loop;

  return saved_leave_type_id;
end;
$$;

revoke all on function public.save_group_leave_type(uuid, uuid, uuid, text, text, public.leave_type_entitlement_mode, numeric, numeric, boolean, boolean, boolean, boolean, boolean, boolean, boolean, uuid[]) from public, anon;
grant execute on function public.save_group_leave_type(uuid, uuid, uuid, text, text, public.leave_type_entitlement_mode, numeric, numeric, boolean, boolean, boolean, boolean, boolean, boolean, boolean, uuid[]) to authenticated;

commit;
