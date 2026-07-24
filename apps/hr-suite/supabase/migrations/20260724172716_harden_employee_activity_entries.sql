create index employee_activity_entries_administration_idx
  on public.employee_activity_entries (tenant_id, administration_id);

create index employee_activity_entries_created_by_idx
  on public.employee_activity_entries (created_by_user_id);

alter policy employee_activity_entries_insert_scoped
on public.employee_activity_entries
with check (
  created_by_user_id = (select auth.uid())
  and (select internal_security.can_manage_employee(employee_id, 'employee-activity:write'))
);

revoke all on public.employee_activity_entries from anon;
revoke all on public.employee_activity_entries from authenticated;
grant select, insert on public.employee_activity_entries to authenticated;
