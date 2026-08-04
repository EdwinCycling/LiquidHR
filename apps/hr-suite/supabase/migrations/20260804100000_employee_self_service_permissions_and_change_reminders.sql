-- Employee self-service is explicit. It never grants BSN write access.
insert into public.permissions (code, name, category, description)
values
  ('self:employee:write', 'Eigen persoonsgegevens wijzigen', 'Persoonlijk', 'Wijzigt eigen persoonsgegevens, met uitzondering van het BSN.'),
  ('self:employee-bsn:read', 'Eigen BSN bekijken', 'Persoonlijk', 'Bekijkt het eigen BSN via de bestaande gelogde reveal.'),
  ('self:reminder:read', 'Eigen reminders bekijken', 'Persoonlijk', 'Bekijkt reminders die aan de eigen medewerker zijn gekoppeld.'),
  ('self:organization-chart:read', 'Organogram bekijken', 'Persoonlijk', 'Bekijkt het organogram binnen de eigen medewerkerscope.')
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission on permission.code in (
  'self:employee:write',
  'self:employee-bsn:read',
  'self:reminder:read',
  'self:organization-chart:read'
)
where role.code = 'EMPLOYEE'
  and role.tenant_id is null
on conflict do nothing;

drop policy if exists employees_write_scoped on public.employees;
create policy employees_self_update_scoped
on public.employees for update to authenticated
using (
  (
    id = (select internal_security.current_employee_id())
    and (select internal_security.current_employee_has_permission('self:employee:write'))
  )
  or internal_security.can_manage_employee(id, 'employee:write')
)
with check (
  internal_security.has_tenant_access(tenant_id)
  and (
    (
      id = (select internal_security.current_employee_id())
      and (select internal_security.current_employee_has_permission('self:employee:write'))
    )
    or internal_security.can_manage_employee(id, 'employee:write')
  )
);

drop policy if exists departments_select_scoped on public.departments;
create policy departments_select_scoped
on public.departments for select to authenticated
using (
  internal_security.has_tenant_access(tenant_id)
  and (
    internal_security.can_manage_employee(internal_security.current_employee_id(), 'department:read')
    or (select internal_security.current_employee_has_permission('self:organization-chart:read'))
  )
);

drop policy if exists custom_field_definitions_read_scoped on public.custom_field_definitions;
create policy custom_field_definitions_read_scoped
on public.custom_field_definitions for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, administration_id, 'custom-field-values:read'))
  or (select internal_security.current_user_has_permission(tenant_id, administration_id, 'custom-fields:write'))
  or (
    (select internal_security.current_employee_has_permission('self:custom-field-values:read'))
    and exists (
      select 1 from public.employee_administration_assignments assignment
      where assignment.tenant_id = custom_field_definitions.tenant_id
        and assignment.administration_id = custom_field_definitions.administration_id
        and assignment.employee_id = (select internal_security.current_employee_id())
    )
  )
);

drop policy if exists custom_field_select_options_read_scoped on public.custom_field_select_options;
create policy custom_field_select_options_read_scoped
on public.custom_field_select_options for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, administration_id, 'custom-field-values:read'))
  or (select internal_security.current_user_has_permission(tenant_id, administration_id, 'custom-fields:write'))
  or (
    (select internal_security.current_employee_has_permission('self:custom-field-values:read'))
    and exists (
      select 1 from public.employee_administration_assignments assignment
      where assignment.tenant_id = custom_field_select_options.tenant_id
        and assignment.administration_id = custom_field_select_options.administration_id
        and assignment.employee_id = (select internal_security.current_employee_id())
    )
  )
);

create or replace function public.create_employee_address_change_reminders(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_employee_id uuid,
  requested_action text,
  requested_before jsonb,
  requested_after jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, internal_security, auth, pg_temp
as $$
declare
  created_by uuid := (select auth.uid());
  target_employee_id uuid;
  created_reminder_id uuid;
  description text;
  recipient_count integer := 0;
begin
  if created_by is null then
    raise exception 'ADDRESS_REMINDER_AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if not internal_security.employee_subresource_can_write(
    requested_tenant_id, requested_employee_id, 'self:address:write'
  ) then
    raise exception 'ADDRESS_FORBIDDEN' using errcode = '42501';
  end if;
  if not internal_security.tenant_module_enabled(requested_tenant_id, 'REMINDERS') then
    raise exception 'ADDRESS_REMINDER_MODULE_DISABLED' using errcode = 'P0001';
  end if;

  description := format(
    'Medewerker: %s (%s)%sActie: %s%sOude gegevens: %s%sNieuwe gegevens: %s',
    coalesce((select employee.first_name || ' ' || employee.birth_name from public.employees employee where employee.id = requested_employee_id), 'Onbekende medewerker'),
    coalesce((select employee.employee_number from public.employees employee where employee.id = requested_employee_id), ''),
    chr(10), requested_action, chr(10), coalesce(requested_before, '{}'::jsonb)::text, chr(10), coalesce(requested_after, '{}'::jsonb)::text
  );

  for target_employee_id in
    select employee.id
    from public.user_access access
    join public.management_roles role on role.id = access.management_role_id
    join public.employees employee on employee.auth_user_id = access.user_id
      and employee.tenant_id = requested_tenant_id and employee.deleted_at is null
    where access.tenant_id = requested_tenant_id
      and access.is_active
      and role.code in ('TENANT_ADMIN', 'HR_ADMIN')
      and (access.administration_id is null or access.administration_id = requested_administration_id)
    union
    select manager.id
    from public.employee_organizations placement
    join public.employees manager on manager.id = placement.direct_manager_id
      and manager.tenant_id = requested_tenant_id and manager.deleted_at is null
    where placement.tenant_id = requested_tenant_id
      and placement.employee_id = requested_employee_id
      and placement.effective_from <= current_date
      and (placement.effective_to is null or placement.effective_to >= current_date)
      and (requested_administration_id is null or placement.administration_id = requested_administration_id)
  loop
    insert into public.reminders (
      tenant_id, administration_id, created_by_user_id, reminder_type, target_type,
      title, description, remind_at, status, published_at
    ) values (
      requested_tenant_id, requested_administration_id, created_by, 'HR', 'EMPLOYEES',
      'Adres wijziging', description, timezone('utc', now()), 'PUBLISHED', timezone('utc', now())
    ) returning id into created_reminder_id;

    insert into public.reminder_targets (tenant_id, administration_id, reminder_id, employee_id)
    values (requested_tenant_id, requested_administration_id, created_reminder_id, target_employee_id);

    insert into public.reminder_recipients (tenant_id, reminder_id, user_id, employee_id, effective_remind_at)
    select requested_tenant_id, created_reminder_id, employee.auth_user_id, employee.id,
      (select reminder.remind_at from public.reminders reminder where reminder.id = created_reminder_id)
    from public.employees employee
    where employee.id = target_employee_id and employee.auth_user_id is not null
    on conflict (reminder_id, user_id) do nothing;
    recipient_count := recipient_count + 1;
  end loop;
  return recipient_count;
end;
$$;

revoke all on function public.create_employee_address_change_reminders(uuid, uuid, uuid, text, jsonb, jsonb) from public, anon;
grant execute on function public.create_employee_address_change_reminders(uuid, uuid, uuid, text, jsonb, jsonb) to authenticated;
