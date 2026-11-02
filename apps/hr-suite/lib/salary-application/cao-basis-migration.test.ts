import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../supabase/migrations/20261019165116_salary_application_cao_basis.sql', import.meta.url),
  'utf8',
)

describe('salary application CAO basis migration', () => {
  it('keeps the two invoker RPCs scoped to function replacements and preserves their grants', async () => {
    const db = new PGlite()
    await db.exec(`
      CREATE ROLE authenticated;
      CREATE TYPE public.salary_basis AS ENUM ('MANUAL', 'MINIMUM_WAGE', 'CUSTOM_SCALE', 'CAO_SCALE', 'SALARY_BAND');
      CREATE TYPE public.salary_application_route AS ENUM ('MANUAL', 'MINIMUM_WAGE', 'SCALE_WITH_STEPS', 'SALARY_BAND');
      CREATE FUNCTION public.apply_salary_application_change(
        requested_employment_id uuid, requested_effective_on date, requested_payload jsonb,
        requested_reason text, requested_warning_codes text[], requested_acknowledgements jsonb
      ) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
      DECLARE route public.salary_application_route;
      BEGIN
        route := (requested_payload ->> 'salaryRoute')::public.salary_application_route;
        IF route IS NULL THEN RAISE EXCEPTION 'SALARY_ROUTE_REQUIRED'; END IF;
        RETURN jsonb_build_object(
          'updateBasis', case route when 'SCALE_WITH_STEPS' then 'CUSTOM_SCALE'::public.salary_basis when 'MINIMUM_WAGE' then 'MINIMUM_WAGE'::public.salary_basis else 'MANUAL'::public.salary_basis end,
          'insertBasis', case route when 'SCALE_WITH_STEPS' then 'CUSTOM_SCALE'::public.salary_basis when 'MINIMUM_WAGE' then 'MINIMUM_WAGE'::public.salary_basis else 'MANUAL'::public.salary_basis end
        );
      END
      $$;
      CREATE FUNCTION public.apply_combined_salary_application_change(
        requested_employment_id uuid, requested_effective_on date, requested_mutations jsonb,
        requested_reason text, requested_warning_codes text[], requested_acknowledgements jsonb
      ) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
      DECLARE requested_payload jsonb := requested_mutations -> 0 -> 'payload'; route public.salary_application_route;
      BEGIN
        route := (requested_payload ->> 'salaryRoute')::public.salary_application_route;
        IF route IS NULL THEN RAISE EXCEPTION 'SALARY_ROUTE_REQUIRED'; END IF;
        INSERT INTO pg_temp.combined_basis_capture(basis)
        VALUES (case route when 'SCALE_WITH_STEPS' then 'CUSTOM_SCALE'::public.salary_basis when 'MINIMUM_WAGE' then 'MINIMUM_WAGE'::public.salary_basis else 'MANUAL'::public.salary_basis end::text);
        RETURN '50000000-0000-4000-8000-000000000001'::uuid;
      END
      $$;
      CREATE TEMP TABLE combined_basis_capture (basis text);
      GRANT EXECUTE ON FUNCTION public.apply_salary_application_change(uuid, date, jsonb, text, text[], jsonb) TO authenticated;
      GRANT EXECUTE ON FUNCTION public.apply_combined_salary_application_change(uuid, date, jsonb, text, text[], jsonb) TO authenticated;
    `)

    const beforeGrants = await db.query<{ salary_acl: string | null; combined_acl: string | null; salary_definer: boolean; combined_definer: boolean }>(`
      SELECT
        (SELECT proacl::text FROM pg_proc WHERE oid = 'public.apply_salary_application_change(uuid,date,jsonb,text,text[],jsonb)'::regprocedure) AS salary_acl,
        (SELECT proacl::text FROM pg_proc WHERE oid = 'public.apply_combined_salary_application_change(uuid,date,jsonb,text,text[],jsonb)'::regprocedure) AS combined_acl,
        (SELECT prosecdef FROM pg_proc WHERE oid = 'public.apply_salary_application_change(uuid,date,jsonb,text,text[],jsonb)'::regprocedure) AS salary_definer,
        (SELECT prosecdef FROM pg_proc WHERE oid = 'public.apply_combined_salary_application_change(uuid,date,jsonb,text,text[],jsonb)'::regprocedure) AS combined_definer
    `)
    expect(beforeGrants.rows[0]?.salary_acl).toContain('authenticated=X')
    expect(beforeGrants.rows[0]?.combined_acl).toContain('authenticated=X')
    expect(beforeGrants.rows[0]?.salary_definer).toBe(false)
    expect(beforeGrants.rows[0]?.combined_definer).toBe(false)

    await db.exec(migration)

    const afterGrants = await db.query<{ salary_acl: string | null; combined_acl: string | null; salary_definer: boolean; combined_definer: boolean }>(`
      SELECT
        (SELECT proacl::text FROM pg_proc WHERE oid = 'public.apply_salary_application_change(uuid,date,jsonb,text,text[],jsonb)'::regprocedure) AS salary_acl,
        (SELECT proacl::text FROM pg_proc WHERE oid = 'public.apply_combined_salary_application_change(uuid,date,jsonb,text,text[],jsonb)'::regprocedure) AS combined_acl,
        (SELECT prosecdef FROM pg_proc WHERE oid = 'public.apply_salary_application_change(uuid,date,jsonb,text,text[],jsonb)'::regprocedure) AS salary_definer,
        (SELECT prosecdef FROM pg_proc WHERE oid = 'public.apply_combined_salary_application_change(uuid,date,jsonb,text,text[],jsonb)'::regprocedure) AS combined_definer
    `)
    expect(afterGrants.rows[0]).toEqual(beforeGrants.rows[0])

    const basis = await db.query<{ update_basis: string; insert_basis: string }>(`
      SELECT result ->> 'updateBasis' AS update_basis, result ->> 'insertBasis' AS insert_basis
      FROM (SELECT public.apply_salary_application_change(
        '10000000-0000-4000-8000-000000000001', DATE '2026-09-01',
        '{"salaryRoute":"SCALE_WITH_STEPS","salaryBasis":"CAO_SCALE","caoScaleName":"6 · Schaal 6","caoStepName":"12 · Salarisnummer 12"}'::jsonb,
        'CAO-basis', ARRAY[]::text[], '{}'::jsonb
      ) AS result) query
    `)
    expect(basis.rows[0]).toEqual({ update_basis: 'CAO_SCALE', insert_basis: 'CAO_SCALE' })
    await expect(db.query(`
      SELECT public.apply_salary_application_change(
        '10000000-0000-4000-8000-000000000001', DATE '2026-09-01',
        '{"salaryRoute":"SCALE_WITH_STEPS","salaryBasis":"CAO_SCALE"}'::jsonb,
        'CAO-basis', ARRAY[]::text[], '{}'::jsonb
      )
    `)).rejects.toThrow('CAO_SCALE_REQUIRED')
    await expect(db.query(`
      SELECT public.apply_salary_application_change(
        '10000000-0000-4000-8000-000000000001', DATE '2026-09-01',
        '{"salaryRoute":"SCALE_WITH_STEPS","salaryBasis":"MINIMUM_WAGE"}'::jsonb,
        'CAO-basis', ARRAY[]::text[], '{}'::jsonb
      )
    `)).rejects.toThrow('SALARY_BASIS_ROUTE_MISMATCH')

    await db.query(`
      SELECT public.apply_combined_salary_application_change(
        '10000000-0000-4000-8000-000000000001', DATE '2026-09-01',
        '[{"timeline":"SALARY","payload":{"salaryRoute":"SCALE_WITH_STEPS","salaryBasis":"CAO_SCALE","caoScaleName":"6 · Schaal 6","caoStepName":"12 · Salarisnummer 12"}}]'::jsonb,
        'CAO-basis', ARRAY[]::text[], '{}'::jsonb
      )
    `)
    const combinedBasis = await db.query<{ basis: string }>(`SELECT basis FROM combined_basis_capture ORDER BY ctid DESC LIMIT 1`)
    expect(combinedBasis.rows[0]?.basis).toBe('CAO_SCALE')
    await db.close()
  })
})
