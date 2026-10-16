-- PAYFULL-02 TEST-only local handoff for the Mars DEMO-002 employee.
-- This function adds one exact Employee access row and an audit trail only.
CREATE OR REPLACE FUNCTION public.link_local_test_payroll_demo_002_v1(
  p_employee_id uuid,
  p_employment_id uuid,
  p_auth_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id constant uuid := '07249eb9-545c-883b-b26b-d52f83b4f4a1';
  v_hr_group_id constant uuid := '6ba6f1df-e376-40f2-abff-ffdf000172e1';
  v_administration_id constant uuid := '2057f6ec-cd3e-3c28-9126-c41235d4ffae';
  v_employee_id constant uuid := '1620bd56-4f74-db62-9f9e-a5ce1d286bc5';
  v_employment_id constant uuid := '6236ee34-182d-1676-6635-ad8eed4c21f3';
  v_actor_id uuid := auth.uid();
  v_actor_email text;
  v_actor_verified boolean;
  v_actor_anonymous boolean;
  v_issuer text;
  v_target_email text;
  v_target_verified boolean;
  v_target_anonymous boolean;
  v_employee public.employees%ROWTYPE;
  v_employee_role_id uuid;
  v_access_count integer;
  v_group_access_count integer;
  v_access_id uuid;
BEGIN
  IF p_employee_id IS DISTINCT FROM v_employee_id
    OR p_employment_id IS DISTINCT FROM v_employment_id
    OR p_auth_user_id IS NULL
    OR v_actor_id IS NULL THEN
    RAISE EXCEPTION 'LOCAL_PAYFULL02_PERSONA_LINK_FORBIDDEN';
  END IF;

  v_issuer := auth.jwt() ->> 'iss';
  IF v_issuer IS DISTINCT FROM 'https://wnpfloqpjvaacobppbpk.supabase.co/auth/v1' THEN
    RAISE EXCEPTION 'LOCAL_PAYFULL02_PERSONA_LINK_FORBIDDEN';
  END IF;

  SELECT pg_catalog.lower(actor.email), actor.email_confirmed_at IS NOT NULL, actor.is_anonymous
    INTO v_actor_email, v_actor_verified, v_actor_anonymous
  FROM auth.users AS actor
  WHERE actor.id = v_actor_id;

  IF v_actor_email IS DISTINCT FROM 'hradmin.fixture@liquidhr.test'
    OR v_actor_verified IS DISTINCT FROM true
    OR v_actor_anonymous IS TRUE THEN
    RAISE EXCEPTION 'LOCAL_PAYFULL02_PERSONA_LINK_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_access AS access
    JOIN public.management_roles AS role ON role.id = access.management_role_id
    WHERE access.user_id = v_actor_id
      AND access.tenant_id = v_tenant_id
      AND access.is_active IS TRUE
      AND role.code IN ('HR_ADMIN', 'TENANT_ADMIN')
      AND role.is_active IS TRUE
      AND role.deleted_at IS NULL
      AND (role.tenant_id IS NULL OR role.tenant_id = v_tenant_id)
      AND (
        (access.scope_type = 'TENANT' AND access.hr_group_id IS NULL AND access.administration_id IS NULL)
        OR (access.scope_type = 'ADMINISTRATION'
          AND access.hr_group_id = v_hr_group_id
          AND access.administration_id = v_administration_id)
      )
  ) OR NOT internal_security.current_user_has_permission(v_tenant_id, v_administration_id, 'salary:write') THEN
    RAISE EXCEPTION 'LOCAL_PAYFULL02_PERSONA_LINK_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenants AS tenant
    WHERE tenant.id = v_tenant_id AND tenant.slug = 'liquid-hr-demo-holding' AND tenant.is_active IS TRUE
  ) OR NOT EXISTS (
    SELECT 1 FROM public.hr_groups AS hr_group
    WHERE hr_group.id = v_hr_group_id
      AND hr_group.tenant_id = v_tenant_id
      AND hr_group.name = 'Planeten'
      AND hr_group.is_active IS TRUE
  ) OR NOT EXISTS (
    SELECT 1 FROM public.administrations AS administration
    WHERE administration.id = v_administration_id
      AND administration.tenant_id = v_tenant_id
      AND administration.hr_group_id = v_hr_group_id
      AND administration.code = 'HOLDING'
      AND administration.name = 'Mars BV'
      AND administration.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'LOCAL_PAYFULL02_PERSONA_CORE_SCOPE_INVALID';
  END IF;

  SELECT pg_catalog.lower(target.email), target.email_confirmed_at IS NOT NULL, target.is_anonymous
    INTO v_target_email, v_target_verified, v_target_anonymous
  FROM auth.users AS target
  WHERE target.id = p_auth_user_id;

  IF v_target_email IS DISTINCT FROM 'demo-002.payroll@liquidhr.test'
    OR v_target_verified IS DISTINCT FROM true
    OR v_target_anonymous IS TRUE THEN
    RAISE EXCEPTION 'LOCAL_PAYFULL02_PERSONA_AUTH_IDENTITY_INVALID';
  END IF;

  SELECT employee.* INTO v_employee
  FROM public.employees AS employee
  WHERE employee.id = v_employee_id
    AND employee.tenant_id = v_tenant_id
    AND employee.hr_group_id = v_hr_group_id
    AND employee.deleted_at IS NULL
    AND employee.is_active IS TRUE
    AND employee.is_archived IS FALSE
  FOR UPDATE;

  IF NOT FOUND OR NOT EXISTS (
    SELECT 1
    FROM public.employments AS employment
    WHERE employment.id = v_employment_id
      AND employment.employee_id = v_employee_id
      AND employment.tenant_id = v_tenant_id
      AND employment.hr_group_id = v_hr_group_id
      AND employment.administration_id = v_administration_id
      AND employment.record_status = 'CONFIRMED'
      AND employment.starts_on <= CURRENT_DATE
      AND (employment.ends_on IS NULL OR employment.ends_on >= CURRENT_DATE)
      AND employment.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'LOCAL_PAYFULL02_PERSONA_CORE_SCOPE_INVALID';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.employees AS linked
    WHERE linked.auth_user_id = p_auth_user_id
      AND linked.id <> v_employee_id
      AND linked.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'LOCAL_PAYFULL02_PERSONA_IDENTITY_ALREADY_LINKED';
  END IF;

  IF v_employee.auth_user_id IS NOT NULL AND v_employee.auth_user_id <> p_auth_user_id THEN
    RAISE EXCEPTION 'LOCAL_PAYFULL02_PERSONA_EMPLOYEE_ALREADY_LINKED';
  END IF;

  SELECT role.id INTO STRICT v_employee_role_id
  FROM public.management_roles AS role
  WHERE role.code = 'EMPLOYEE'
    AND role.tenant_id IS NULL
    AND role.is_active IS TRUE
    AND role.deleted_at IS NULL;

  SELECT pg_catalog.count(*)::integer INTO v_access_count
  FROM public.user_access AS access
  WHERE access.user_id = p_auth_user_id;

  IF v_access_count > 1 OR EXISTS (
    SELECT 1 FROM public.user_access AS access
    WHERE access.user_id = p_auth_user_id
      AND (
        access.tenant_id <> v_tenant_id
        OR access.hr_group_id IS DISTINCT FROM v_hr_group_id
        OR access.administration_id IS DISTINCT FROM v_administration_id
        OR access.scope_type <> 'ADMINISTRATION'
        OR access.management_role_id <> v_employee_role_id
        OR access.is_active IS NOT TRUE
      )
  ) THEN
    RAISE EXCEPTION 'LOCAL_PAYFULL02_PERSONA_ACCESS_CONFLICT';
  END IF;

  SELECT pg_catalog.count(*)::integer INTO v_group_access_count
  FROM public.user_hr_group_access AS access
  WHERE access.user_id = p_auth_user_id;

  IF v_employee.auth_user_id = p_auth_user_id THEN
    IF v_access_count <> 1 OR v_group_access_count <> 1 OR NOT EXISTS (
      SELECT 1 FROM public.user_hr_group_access AS access
      WHERE access.user_id = p_auth_user_id
        AND access.tenant_id = v_tenant_id
        AND access.hr_group_id = v_hr_group_id
        AND access.management_role_id = v_employee_role_id
        AND access.is_active IS TRUE
    ) OR (SELECT pg_catalog.count(*) FROM public.audit_logs AS audit
      WHERE audit.entity_name = 'employee_auth_link'
        AND audit.entity_id = v_employee_id
        AND audit.subject_employee_id = v_employee_id
        AND audit.employment_id = v_employment_id
        AND audit.tenant_id = v_tenant_id
        AND audit.administration_id = v_administration_id
        AND audit.actor_user_id = v_actor_id
        AND audit.action = 'UPDATE'
        AND audit.changes @> pg_catalog.jsonb_build_object(
          'event', 'LOCAL_PAYROLL_PERSONA_LINK_CREATED',
          'personaKey', 'payroll-demo-002',
          'authUserId', p_auth_user_id,
          'changed', true,
          'provenance', 'TEST_SETUP_PAYFULL_02'
        )) <> 1 OR (SELECT pg_catalog.count(*) FROM public.audit_logs AS audit
      JOIN public.user_access AS access ON access.id = audit.entity_id
      WHERE audit.entity_name = 'user_access'
        AND access.user_id = p_auth_user_id
        AND audit.subject_employee_id = v_employee_id
        AND audit.tenant_id = v_tenant_id
        AND audit.administration_id = v_administration_id
        AND audit.actor_user_id = v_actor_id
        AND audit.action = 'CREATE'
        AND audit.changes @> pg_catalog.jsonb_build_object(
          'provenance', 'TEST_SETUP_PAYFULL_02',
          'migration', '20261016064505',
          'authorization_source', 'EXPLICIT_USER_APPROVAL',
          'role', 'EMPLOYEE',
          'scope_type', 'ADMINISTRATION',
          'administration_id', v_administration_id
        )) <> 1 THEN
      RAISE EXCEPTION 'LOCAL_PAYFULL02_PERSONA_EXISTING_PROVENANCE_CONFLICT';
    END IF;

    RETURN pg_catalog.jsonb_build_object('status', 'ALREADY_LINKED', 'changed', false);
  END IF;

  IF v_access_count <> 0 OR v_group_access_count <> 0 THEN
    RAISE EXCEPTION 'LOCAL_PAYFULL02_PERSONA_ACCESS_CONFLICT';
  END IF;

  UPDATE public.employees
  SET auth_user_id = p_auth_user_id
  WHERE id = v_employee_id
    AND auth_user_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOCAL_PAYFULL02_PERSONA_EMPLOYEE_ALREADY_LINKED';
  END IF;

  INSERT INTO public.user_access (
    user_id,
    tenant_id,
    hr_group_id,
    management_role_id,
    scope_type,
    administration_id,
    is_active
  ) VALUES (
    p_auth_user_id,
    v_tenant_id,
    v_hr_group_id,
    v_employee_role_id,
    'ADMINISTRATION',
    v_administration_id,
    true
  ) RETURNING id INTO v_access_id;

  IF (SELECT pg_catalog.count(*) FROM public.user_hr_group_access AS access
      WHERE access.user_id = p_auth_user_id
        AND access.tenant_id = v_tenant_id
        AND access.hr_group_id = v_hr_group_id
        AND access.management_role_id = v_employee_role_id
        AND access.is_active IS TRUE) <> 1
    OR (SELECT pg_catalog.count(*) FROM public.user_hr_group_access AS access
      WHERE access.user_id = p_auth_user_id) <> 1 THEN
    RAISE EXCEPTION 'LOCAL_PAYFULL02_PERSONA_GROUP_SYNC_FAILED';
  END IF;

  INSERT INTO public.audit_logs (
    tenant_id,
    administration_id,
    entity_name,
    entity_id,
    subject_employee_id,
    employment_id,
    actor_user_id,
    action,
    changes
  ) VALUES (
    v_tenant_id,
    v_administration_id,
    'employee_auth_link',
    v_employee_id,
    v_employee_id,
    v_employment_id,
    v_actor_id,
    'UPDATE',
    pg_catalog.jsonb_build_object(
      'event', 'LOCAL_PAYROLL_PERSONA_LINK_CREATED',
      'personaKey', 'payroll-demo-002',
      'authUserId', p_auth_user_id,
      'changed', true,
      'provenance', 'TEST_SETUP_PAYFULL_02'
    )
  );

  INSERT INTO public.audit_logs (
    tenant_id,
    administration_id,
    entity_name,
    entity_id,
    subject_employee_id,
    actor_user_id,
    action,
    changes
  ) VALUES (
    v_tenant_id,
    v_administration_id,
    'user_access',
    v_access_id,
    v_employee_id,
    v_actor_id,
    'CREATE',
    pg_catalog.jsonb_build_object(
      'provenance', 'TEST_SETUP_PAYFULL_02',
      'migration', '20261016064505',
      'authorization_source', 'EXPLICIT_USER_APPROVAL',
      'role', 'EMPLOYEE',
      'scope_type', 'ADMINISTRATION',
      'administration_id', v_administration_id
    )
  );

  RETURN pg_catalog.jsonb_build_object('status', 'LINKED', 'changed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.link_local_test_payroll_demo_002_v1(uuid, uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.link_local_test_payroll_demo_002_v1(uuid, uuid, uuid) TO authenticated;
