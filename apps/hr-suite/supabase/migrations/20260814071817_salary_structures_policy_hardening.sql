-- Houd writepolicies buiten SELECT zodat read- en writechecks niet dubbel
-- als permissieve SELECT-policies worden uitgevoerd.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'salary_structures',
    'salary_structure_revisions',
    'salary_scales',
    'salary_scale_revision_values',
    'salary_scale_steps',
    'salary_bands',
    'salary_band_values'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_write', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (
        (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''salary-structure:write''))
        and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''salary:write''))
      )',
      table_name || '_insert', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (
        (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''salary-structure:write''))
        and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''salary:write''))
      ) with check (
        (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''salary-structure:write''))
        and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''salary:write''))
      )',
      table_name || '_update', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (
        (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''salary-structure:write''))
        and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''salary:write''))
      )',
      table_name || '_delete', table_name
    );
  end loop;

  foreach table_name in array array[
    'labor_condition_salary_structures',
    'salary_structure_migration_conflicts'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_write', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (
        (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''salary-structure:write''))
      )',
      table_name || '_insert', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (
        (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''salary-structure:write''))
      ) with check (
        (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''salary-structure:write''))
      )',
      table_name || '_update', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (
        (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, ''salary-structure:write''))
      )',
      table_name || '_delete', table_name
    );
  end loop;
end;
$$;
