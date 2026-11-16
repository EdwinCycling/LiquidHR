BEGIN;

CREATE OR REPLACE FUNCTION public.link_local_test_payroll_persona_v1(
  p_persona_key text,
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
  v_actor_id uuid := auth.uid();
  v_actor_email text;
  v_actor_verified boolean;
  v_issuer text;
  v_target_email text;
  v_target_verified boolean;
  v_target_anonymous boolean;
  v_expected_email text;
  v_expected_employee_id uuid;
  v_expected_employment_id uuid;
  v_employee public.employees%ROWTYPE;
  v_changed boolean := false;
BEGIN
  IF p_persona_key = 'payroll-jaap' THEN
    v_expected_email := 'jaap.test@liquidhr.test';
    v_expected_employee_id := 'dd9bde02-76bb-4f7c-8add-db544a148f3f';
    v_expected_employment_id := '29058c73-5cfa-409d-b9d4-80dd30f36962';
  ELSIF p_persona_key = 'payroll-frits' THEN
    v_expected_email := 'frits.test@liquidhr.test';
    v_expected_employee_id := '79091d14-ef66-41fe-a2d5-92df108727e5';
    v_expected_employment_id := 'd19bace9-bb97-4822-a462-eed22821ed05';
  ELSE
    RAISE EXCEPTION 'LOCAL_PERSONA_LINK_FORBIDDEN';
  END IF;

  IF p_employee_id IS DISTINCT FROM v_expected_employee_id
    OR p_employment_id IS DISTINCT FROM v_expected_employment_id
    OR p_auth_user_id IS NULL
    OR v_actor_id IS NULL THEN
    RAISE EXCEPTION 'LOCAL_PERSONA_LINK_FORBIDDEN';
  END IF;

  v_issuer := auth.jwt() ->> 'iss';
  IF v_issuer IS DISTINCT FROM 'https://wnpfloqpjvaacobppbpk.supabase.co/auth/v1' THEN
    RAISE EXCEPTION 'LOCAL_PERSONA_LINK_FORBIDDEN';
  END IF;

  SELECT pg_catalog.lower(actor.email), actor.email_confirmed_at IS NOT NULL
    INTO v_actor_email, v_actor_verified
  FROM auth.users AS actor
  WHERE actor.id = v_actor_id
    AND actor.is_anonymous IS NOT TRUE;

  IF v_actor_email IS DISTINCT FROM 'hradmin.fixture@liquidhr.test'
    OR v_actor_verified IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'LOCAL_PERSONA_LINK_FORBIDDEN';
  END IF;

  SELECT pg_catalog.lower(target.email), target.email_confirmed_at IS NOT NULL, target.is_anonymous
    INTO v_target_email, v_target_verified, v_target_anonymous
  FROM auth.users AS target
  WHERE target.id = p_auth_user_id;

  IF v_target_email IS DISTINCT FROM v_expected_email
    OR v_target_verified IS DISTINCT FROM true
    OR v_target_anonymous IS TRUE THEN
    RAISE EXCEPTION 'LOCAL_PERSONA_AUTH_IDENTITY_INVALID';
  END IF;

  SELECT employee.*
    INTO v_employee
  FROM public.employees AS employee
  WHERE employee.id = v_expected_employee_id
    AND employee.tenant_id = '07249eb9-545c-883b-b26b-d52f83b4f4a1'::uuid
    AND employee.hr_group_id = '6ba6f1df-e376-40f2-abff-ffdf000172e1'::uuid
    AND employee.deleted_at IS NULL
    AND employee.is_active IS TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOCAL_PERSONA_CORE_SCOPE_INVALID';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employments AS employment
    JOIN public.administrations AS administration
      ON administration.id = employment.administration_id
      AND administration.tenant_id = employment.tenant_id
      AND administration.hr_group_id = employment.hr_group_id
    WHERE employment.id = v_expected_employment_id
      AND employment.employee_id = v_expected_employee_id
      AND employment.tenant_id = '07249eb9-545c-883b-b26b-d52f83b4f4a1'::uuid
      AND employment.hr_group_id = '6ba6f1df-e376-40f2-abff-ffdf000172e1'::uuid
      AND employment.administration_id = '8483abc9-f275-c80b-5a23-fedc54ce9f0a'::uuid
      AND employment.record_status = 'CONFIRMED'
      AND employment.deleted_at IS NULL
      AND administration.code = 'OPERATIONS'
      AND administration.name = 'Jupiter BV'
      AND administration.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'LOCAL_PERSONA_CORE_SCOPE_INVALID';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.employees AS linked
    WHERE linked.auth_user_id = p_auth_user_id
      AND linked.id <> v_expected_employee_id
      AND linked.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'LOCAL_PERSONA_IDENTITY_ALREADY_LINKED';
  END IF;

  IF v_employee.auth_user_id IS NOT NULL AND v_employee.auth_user_id <> p_auth_user_id THEN
    RAISE EXCEPTION 'LOCAL_PERSONA_EMPLOYEE_ALREADY_LINKED';
  END IF;

  IF v_employee.auth_user_id IS NULL THEN
    UPDATE public.employees
    SET auth_user_id = p_auth_user_id
    WHERE id = v_expected_employee_id
      AND auth_user_id IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'LOCAL_PERSONA_EMPLOYEE_ALREADY_LINKED';
    END IF;

    v_changed := true;
    INSERT INTO public.audit_logs (
      tenant_id,
      hr_group_id,
      administration_id,
      entity_name,
      entity_id,
      subject_employee_id,
      employment_id,
      actor_user_id,
      action,
      changes
    ) VALUES (
      '07249eb9-545c-883b-b26b-d52f83b4f4a1'::uuid,
      '6ba6f1df-e376-40f2-abff-ffdf000172e1'::uuid,
      '8483abc9-f275-c80b-5a23-fedc54ce9f0a'::uuid,
      'employee_auth_link',
      v_expected_employee_id,
      v_expected_employee_id,
      v_expected_employment_id,
      v_actor_id,
      'UPDATE',
      pg_catalog.jsonb_build_object(
        'event', 'LOCAL_PAYROLL_PERSONA_LINK_CREATED',
        'personaKey', p_persona_key,
        'authUserId', p_auth_user_id,
        'changed', true
      )
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'status', CASE WHEN v_changed THEN 'LINKED' ELSE 'ALREADY_LINKED' END,
    'changed', v_changed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.link_local_test_payroll_persona_v1(text, uuid, uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.link_local_test_payroll_persona_v1(text, uuid, uuid, uuid) TO authenticated;

COMMIT;
