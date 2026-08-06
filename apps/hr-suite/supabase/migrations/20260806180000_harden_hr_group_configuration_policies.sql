begin;

-- Keep read and write policies separate so the advisor does not have to
-- evaluate overlapping permissive SELECT policies for authenticated users.
drop policy if exists holiday_calendars_write_group_scoped on public.holiday_calendars;
create policy holiday_calendars_insert_group_scoped
on public.holiday_calendars for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'holidays:write')));
create policy holiday_calendars_update_group_scoped
on public.holiday_calendars for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'holidays:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'holidays:write')));
create policy holiday_calendars_delete_group_scoped
on public.holiday_calendars for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'holidays:write')));

drop policy if exists holidays_write_group_scoped on public.holidays;
create policy holidays_insert_group_scoped
on public.holidays for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'holidays:write')));
create policy holidays_update_group_scoped
on public.holidays for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'holidays:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'holidays:write')));
create policy holidays_delete_group_scoped
on public.holidays for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'holidays:write')));

drop policy if exists custom_field_definitions_write_group_scoped on public.custom_field_definitions;
create policy custom_field_definitions_insert_group_scoped
on public.custom_field_definitions for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-fields:write')));
create policy custom_field_definitions_update_group_scoped
on public.custom_field_definitions for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-fields:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-fields:write')));
create policy custom_field_definitions_delete_group_scoped
on public.custom_field_definitions for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-fields:write')));

drop policy if exists custom_field_select_options_write_group_scoped on public.custom_field_select_options;
create policy custom_field_select_options_insert_group_scoped
on public.custom_field_select_options for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-fields:write')));
create policy custom_field_select_options_update_group_scoped
on public.custom_field_select_options for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-fields:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-fields:write')));
create policy custom_field_select_options_delete_group_scoped
on public.custom_field_select_options for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-fields:write')));

create index if not exists administration_branding_updated_by_idx
  on public.administration_branding (updated_by);
create index if not exists employee_custom_field_values_definition_group_idx
  on public.employee_custom_field_values (tenant_id, hr_group_id, definition_id);
create index if not exists holidays_calendar_group_idx
  on public.holidays (tenant_id, hr_group_id, holiday_calendar_id);

commit;
