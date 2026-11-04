-- Reconciles the Core/DEV policy refinement recorded at 20261008062834.
-- Read-only catalog inspection confirmed all four tables use HR-group access
-- plus contract permissions, with UPDATE checks on both old and new rows.
-- This file is repository history only; it is not to be re-applied to Core/DEV.

DO $$
DECLARE
  table_name text;
  policy_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'pension_arrangements',
    'pension_arrangement_tiers',
    'labor_condition_pension_arrangements',
    'employment_pension_arrangement_assignments'
  ] LOOP
    FOREACH policy_name IN ARRAY ARRAY[
      table_name || '_read',
      table_name || '_insert',
      table_name || '_update',
      table_name || '_delete'
    ] LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);
    END LOOP;
  END LOOP;
END;
$$;

CREATE POLICY pension_arrangements_read ON public.pension_arrangements
  FOR SELECT USING (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:read'::text)
  );
CREATE POLICY pension_arrangements_insert ON public.pension_arrangements
  FOR INSERT WITH CHECK (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write'::text)
  );
CREATE POLICY pension_arrangements_update ON public.pension_arrangements
  FOR UPDATE USING (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write'::text)
  ) WITH CHECK (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write'::text)
  );
CREATE POLICY pension_arrangements_delete ON public.pension_arrangements
  FOR DELETE USING (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write'::text)
  );

CREATE POLICY pension_arrangement_tiers_read ON public.pension_arrangement_tiers
  FOR SELECT USING (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:read'::text)
  );
CREATE POLICY pension_arrangement_tiers_insert ON public.pension_arrangement_tiers
  FOR INSERT WITH CHECK (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write'::text)
  );
CREATE POLICY pension_arrangement_tiers_update ON public.pension_arrangement_tiers
  FOR UPDATE USING (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write'::text)
  ) WITH CHECK (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write'::text)
  );
CREATE POLICY pension_arrangement_tiers_delete ON public.pension_arrangement_tiers
  FOR DELETE USING (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write'::text)
  );

CREATE POLICY labor_condition_pension_arrangements_read ON public.labor_condition_pension_arrangements
  FOR SELECT USING (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:read'::text)
  );
CREATE POLICY labor_condition_pension_arrangements_insert ON public.labor_condition_pension_arrangements
  FOR INSERT WITH CHECK (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write'::text)
  );
CREATE POLICY labor_condition_pension_arrangements_update ON public.labor_condition_pension_arrangements
  FOR UPDATE USING (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write'::text)
  ) WITH CHECK (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write'::text)
  );
CREATE POLICY labor_condition_pension_arrangements_delete ON public.labor_condition_pension_arrangements
  FOR DELETE USING (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write'::text)
  );

CREATE POLICY employment_pension_arrangement_assignments_read ON public.employment_pension_arrangement_assignments
  FOR SELECT USING (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:read'::text)
  );
CREATE POLICY employment_pension_arrangement_assignments_insert ON public.employment_pension_arrangement_assignments
  FOR INSERT WITH CHECK (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write'::text)
  );
CREATE POLICY employment_pension_arrangement_assignments_update ON public.employment_pension_arrangement_assignments
  FOR UPDATE USING (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write'::text)
  ) WITH CHECK (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write'::text)
  );
CREATE POLICY employment_pension_arrangement_assignments_delete ON public.employment_pension_arrangement_assignments
  FOR DELETE USING (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:write'::text)
  );
