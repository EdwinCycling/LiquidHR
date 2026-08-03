do $$
declare table_name text;
begin
  foreach table_name in array array[
    'talent_level_models', 'talent_levels', 'talent_seniorities',
    'job_families', 'talent_categories', 'talent_capabilities',
    'talent_capability_level_content', 'job_profiles',
    'job_profile_versions', 'job_profile_capability_requirements'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_talent_write', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select internal_security.current_user_has_permission(tenant_id, null, ''talent:manage'')))', table_name || '_talent_insert', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select internal_security.current_user_has_permission(tenant_id, null, ''talent:manage''))) with check ((select internal_security.current_user_has_permission(tenant_id, null, ''talent:manage'')))', table_name || '_talent_update', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select internal_security.current_user_has_permission(tenant_id, null, ''talent:manage'')))', table_name || '_talent_delete', table_name);
  end loop;
end;
$$;
