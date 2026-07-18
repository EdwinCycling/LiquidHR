alter function public.publish_employment_work_pattern(uuid, jsonb) security invoker;

drop policy employment_work_patterns_write on public.employment_work_patterns;
create policy employment_work_patterns_insert on public.employment_work_patterns for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id,administration_id,'work-schedule:write')));
create policy employment_work_patterns_update on public.employment_work_patterns for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id,administration_id,'work-schedule:write')))
with check ((select internal_security.current_user_has_permission(tenant_id,administration_id,'work-schedule:write')));
create policy employment_work_patterns_delete on public.employment_work_patterns for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id,administration_id,'work-schedule:write')));

drop policy employment_work_pattern_days_write on public.employment_work_pattern_days;
create policy employment_work_pattern_days_insert on public.employment_work_pattern_days for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id,administration_id,'work-schedule:write')));
create policy employment_work_pattern_days_update on public.employment_work_pattern_days for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id,administration_id,'work-schedule:write')))
with check ((select internal_security.current_user_has_permission(tenant_id,administration_id,'work-schedule:write')));
create policy employment_work_pattern_days_delete on public.employment_work_pattern_days for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id,administration_id,'work-schedule:write')));

drop policy holiday_calendars_write on public.holiday_calendars;
create policy holiday_calendars_insert on public.holiday_calendars for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id,administration_id,'holidays:write')));
create policy holiday_calendars_update on public.holiday_calendars for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id,administration_id,'holidays:write')))
with check ((select internal_security.current_user_has_permission(tenant_id,administration_id,'holidays:write')));
create policy holiday_calendars_delete on public.holiday_calendars for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id,administration_id,'holidays:write')));

drop policy holidays_write on public.holidays;
create policy holidays_insert on public.holidays for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id,administration_id,'holidays:write')));
create policy holidays_update on public.holidays for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id,administration_id,'holidays:write')))
with check ((select internal_security.current_user_has_permission(tenant_id,administration_id,'holidays:write')));
create policy holidays_delete on public.holidays for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id,administration_id,'holidays:write')));

create index employment_work_pattern_days_scope_idx on public.employment_work_pattern_days(tenant_id,administration_id,work_pattern_id);
create index employment_work_patterns_employment_scope_idx on public.employment_work_patterns(tenant_id,administration_id,employee_id,employment_id);
create index employment_work_patterns_change_set_idx on public.employment_work_patterns(change_set_id) where change_set_id is not null;
create index employment_work_patterns_created_by_idx on public.employment_work_patterns(created_by) where created_by is not null;
create index holiday_calendars_imported_by_idx on public.holiday_calendars(imported_by) where imported_by is not null;
create index holidays_calendar_scope_idx on public.holidays(tenant_id,administration_id,holiday_calendar_id);
create index holidays_created_by_idx on public.holidays(created_by) where created_by is not null;
create index holidays_updated_by_idx on public.holidays(updated_by) where updated_by is not null;
create index tenant_modules_enabled_by_idx on public.tenant_modules(enabled_by) where enabled_by is not null;
create index tenant_modules_disabled_by_idx on public.tenant_modules(disabled_by) where disabled_by is not null;
