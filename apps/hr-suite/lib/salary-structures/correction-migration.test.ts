import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../supabase/migrations/20261019070211_salary_structure_revision_correction_provenance.sql', import.meta.url),
  'utf8',
)

const tenantId = '10000000-0000-4000-8000-000000000001'
const hrGroupId = '10000000-0000-4000-8000-000000000002'
const structureId = '10000000-0000-4000-8000-000000000003'
const userId = '20000000-0000-4000-8000-000000000001'
const priorRevisionId = '30000000-0000-4000-8000-000000000001'
const predecessorRevisionId = '30000000-0000-4000-8000-000000000002'
const runId = '40000000-0000-4000-8000-000000000001'

const sourceMetadata = {
  title: 'Cao Kinderopvang salaristabel',
  version: '2026.09',
  effectiveFrom: '2026-09-01',
  effectiveTo: '2026-12-31',
  url: 'https://example.org/kinderopvang.pdf',
  sha256: 'a'.repeat(64),
  fileName: 'kinderopvang.pdf',
  rowCount: 196,
}

function correctionPayload(correctionOfRevisionId: string) {
  return {
    structureType: 'SCALE_WITH_STEPS',
    effectiveFrom: '2026-09-01',
    salaryBasis: 'MONTHLY_BASE',
    currencyCode: 'EUR',
    description: 'Geverifieerde correctieversie',
    sourceMetadata,
    correctionOfRevisionId,
  }
}

async function createDatabase(options: { futurePublishedRevision?: boolean } = {}) {
  const db = new PGlite()
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE SCHEMA internal_security;
    CREATE TYPE public.salary_revision_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    CREATE FUNCTION internal_security.current_user_has_hr_group_permission(uuid, uuid, text)
      RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
    CREATE FUNCTION internal_security.validate_salary_structure_revision(uuid)
      RETURNS void LANGUAGE plpgsql AS $$
      BEGIN
        IF current_setting('test.fail_salary_validation', true) = 'true' THEN
          RAISE EXCEPTION 'SALARY_STRUCTURE_VALIDATION_FAILED';
        END IF;
      END
      $$;
    CREATE TABLE public.salary_structures (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL,
      hr_group_id uuid NOT NULL,
      is_active boolean NOT NULL DEFAULT true
    );
    CREATE TABLE public.salary_structure_revisions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      hr_group_id uuid NOT NULL,
      salary_structure_id uuid NOT NULL REFERENCES public.salary_structures(id),
      revision_number integer NOT NULL,
      status public.salary_revision_status NOT NULL DEFAULT 'DRAFT',
      effective_from date NOT NULL,
      salary_basis text NOT NULL,
      currency_code text NOT NULL,
      description text,
      draft_payload jsonb,
      lock_version integer NOT NULL DEFAULT 1,
      created_by_user_id uuid,
      updated_by_user_id uuid,
      updated_at timestamptz,
      published_at timestamptz,
      published_by_user_id uuid,
      CONSTRAINT salary_structure_revisions_effective_key
        UNIQUE (tenant_id, hr_group_id, salary_structure_id, effective_from)
    );
    CREATE TABLE public.payroll_runs (
      id uuid PRIMARY KEY,
      salary_structure_revision_id uuid NOT NULL
        REFERENCES public.salary_structure_revisions(id) ON DELETE RESTRICT
    );
    ALTER TABLE public.salary_structures ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.salary_structure_revisions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY salary_structures_test_scope ON public.salary_structures
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY salary_structure_revisions_test_scope ON public.salary_structure_revisions
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
    CREATE FUNCTION internal_security.prevent_published_salary_revision_mutation()
      RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
      BEGIN
        IF old.status = 'PUBLISHED' THEN
          RAISE EXCEPTION 'SALARY_STRUCTURE_REVISION_IMMUTABLE';
        END IF;
        RETURN CASE WHEN tg_op = 'DELETE' THEN old ELSE new END;
      END
      $$;
    CREATE TRIGGER prevent_published_salary_revision_mutation
      BEFORE UPDATE OR DELETE ON public.salary_structure_revisions
      FOR EACH ROW EXECUTE FUNCTION internal_security.prevent_published_salary_revision_mutation();
    CREATE FUNCTION public.save_salary_structure_draft(
      requested_structure_id uuid,
      requested_draft_id uuid,
      requested_expected_lock_version integer,
      requested_payload jsonb
    ) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
    DECLARE
      structure_row public.salary_structures%rowtype;
      revision_row public.salary_structure_revisions%rowtype;
    BEGIN
      SELECT * INTO structure_row FROM public.salary_structures
      WHERE id = requested_structure_id AND is_active FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'SALARY_STRUCTURE_NOT_FOUND'; END IF;
      IF requested_draft_id IS NULL THEN
        INSERT INTO public.salary_structure_revisions (
          tenant_id, hr_group_id, salary_structure_id, revision_number, status,
          effective_from, salary_basis, currency_code, description, draft_payload,
          created_by_user_id, updated_by_user_id
        ) VALUES (
          structure_row.tenant_id, structure_row.hr_group_id, structure_row.id,
          (SELECT coalesce(max(revision_number), 0) + 1 FROM public.salary_structure_revisions WHERE salary_structure_id = structure_row.id),
          'DRAFT', (requested_payload ->> 'effectiveFrom')::date,
          requested_payload ->> 'salaryBasis', requested_payload ->> 'currencyCode',
          requested_payload ->> 'description', requested_payload, auth.uid(), auth.uid()
        ) RETURNING * INTO revision_row;
      ELSE
        SELECT * INTO revision_row FROM public.salary_structure_revisions
        WHERE id = requested_draft_id AND salary_structure_id = structure_row.id AND status = 'DRAFT'
        FOR UPDATE;
        IF NOT FOUND OR revision_row.lock_version <> requested_expected_lock_version THEN
          RAISE EXCEPTION 'SALARY_STRUCTURE_DRAFT_CONFLICT';
        END IF;
        UPDATE public.salary_structure_revisions
        SET effective_from = (requested_payload ->> 'effectiveFrom')::date,
            salary_basis = requested_payload ->> 'salaryBasis',
            currency_code = requested_payload ->> 'currencyCode',
            description = requested_payload ->> 'description',
            draft_payload = requested_payload,
            lock_version = lock_version + 1,
            updated_by_user_id = auth.uid()
        WHERE id = requested_draft_id
        RETURNING * INTO revision_row;
      END IF;
      RETURN jsonb_build_object('id', revision_row.id, 'status', revision_row.status, 'lockVersion', revision_row.lock_version);
    END
    $$;
    GRANT USAGE ON SCHEMA public, auth, internal_security TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_structures, public.salary_structure_revisions, public.payroll_runs TO authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
    GRANT EXECUTE ON FUNCTION internal_security.current_user_has_hr_group_permission(uuid, uuid, text) TO authenticated;
    GRANT EXECUTE ON FUNCTION internal_security.validate_salary_structure_revision(uuid) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.save_salary_structure_draft(uuid, uuid, integer, jsonb) TO authenticated;
  `)
  await db.exec(`
    INSERT INTO public.salary_structures (id, tenant_id, hr_group_id)
    VALUES ('${structureId}', '${tenantId}', '${hrGroupId}');
    INSERT INTO public.salary_structure_revisions (
      id, tenant_id, hr_group_id, salary_structure_id, revision_number, status,
      effective_from, salary_basis, currency_code, description, published_at, published_by_user_id
    ) VALUES
      ('${priorRevisionId}', '${tenantId}', '${hrGroupId}', '${structureId}', 1, 'PUBLISHED', '2026-01-01', 'MONTHLY_BASE', 'EUR', 'Januari versie', now(), '${userId}'),
      ('${predecessorRevisionId}', '${tenantId}', '${hrGroupId}', '${structureId}', 2, 'PUBLISHED', '2026-09-01', 'MONTHLY_BASE', 'EUR', 'Oorspronkelijke septemberversie', now(), '${userId}');
    INSERT INTO public.payroll_runs (id, salary_structure_revision_id)
    VALUES ('${runId}', '${predecessorRevisionId}');
  `)
  if (options.futurePublishedRevision) {
    await db.query(`
      INSERT INTO public.salary_structure_revisions (
        id, tenant_id, hr_group_id, salary_structure_id, revision_number, status,
        effective_from, salary_basis, currency_code, description, published_at, published_by_user_id
      ) VALUES (
        '30000000-0000-4000-8000-000000000003', '${tenantId}', '${hrGroupId}', '${structureId}',
        3, 'PUBLISHED', DATE '2026-10-01', 'MONTHLY_BASE', 'EUR', 'Volgende versie', now(), '${userId}'
      )
    `)
  }
  await db.exec(migration)
  await db.query('SELECT set_config(\'request.jwt.claim.sub\', $1, false)', [userId])
  await db.exec('SET ROLE authenticated')
  return db
}

describe('salary structure correction migration', () => {
  it('atomically publishes a same-date correction and preserves the historical run reference', async () => {
    const db = await createDatabase()
    const payload = correctionPayload(predecessorRevisionId)
    const draftResult = await db.query<{ result: { id: string; lockVersion: number; correctionOfRevisionId: string } }>(
      'SELECT public.save_salary_structure_import_draft($1, NULL, NULL, $2::jsonb) AS result',
      [structureId, JSON.stringify(payload)],
    )
    const draftId = draftResult.rows[0]?.result.id
    expect(draftId).toBeTruthy()
    const publisherRole = await db.query<{ rolcanlogin: boolean; rolbypassrls: boolean }>(`
      SELECT rolcanlogin, rolbypassrls FROM pg_catalog.pg_roles
      WHERE rolname = 'liquidhr_salary_revision_publisher'
    `)
    expect(publisherRole.rows[0]).toEqual({ rolcanlogin: false, rolbypassrls: false })
    const publisherMembership = await db.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_auth_members membership
        JOIN pg_catalog.pg_roles granted_role ON granted_role.oid = membership.roleid
        JOIN pg_catalog.pg_roles member_role ON member_role.oid = membership.member
        WHERE granted_role.rolname = 'liquidhr_salary_revision_publisher'
          AND member_role.rolname = 'postgres'
      ) AS exists
    `)
    expect(publisherMembership.rows[0]?.exists).toBe(false)
    const rpcGrants = await db.query<{
      authenticated_save: boolean
      authenticated_publish: boolean
      service_save: boolean
      service_publish: boolean
    }>(`
      SELECT
        has_function_privilege('authenticated', 'public.save_salary_structure_import_draft(uuid,uuid,integer,jsonb)', 'EXECUTE') AS authenticated_save,
        has_function_privilege('authenticated', 'public.publish_salary_structure_revision(uuid,integer)', 'EXECUTE') AS authenticated_publish,
        has_function_privilege('service_role', 'public.save_salary_structure_import_draft(uuid,uuid,integer,jsonb)', 'EXECUTE') AS service_save,
        has_function_privilege('service_role', 'public.publish_salary_structure_revision(uuid,integer)', 'EXECUTE') AS service_publish
    `)
    expect(rpcGrants.rows[0]).toEqual({
      authenticated_save: true,
      authenticated_publish: true,
      service_save: false,
      service_publish: false,
    })
    await expect(db.query('SELECT * FROM internal_security.salary_revision_publish_context')).rejects.toThrow()

    await db.query("SELECT set_config('liquidhr.salary_revision_archive_id', $1, false)", [predecessorRevisionId])
    await expect(db.query(
      "UPDATE public.salary_structure_revisions SET status = 'ARCHIVED' WHERE id = $1",
      [predecessorRevisionId],
    )).rejects.toThrow('SALARY_STRUCTURE_REVISION_IMMUTABLE')
    await db.query("SELECT set_config('liquidhr.salary_revision_publish_id', $1, false)", [draftId])
    await expect(db.query(`
      UPDATE public.salary_structure_revisions
      SET status = 'PUBLISHED', published_at = now(), published_by_user_id = $2
      WHERE id = $1
    `, [draftId, userId])).rejects.toThrow('SALARY_STRUCTURE_PUBLISH_RPC_REQUIRED')

    const saved = await db.query<{ result: { lockVersion: number } }>(
      'SELECT public.save_salary_structure_import_draft($1, $2, 1, $3::jsonb) AS result',
      [structureId, draftId, JSON.stringify({ ...payload, description: 'Gereviewde correctieversie' })],
    )
    expect(saved.rows[0]?.result.lockVersion).toBe(2)

    await db.query("SELECT set_config('test.fail_salary_validation', 'true', false)")
    await expect(db.query('SELECT public.publish_salary_structure_revision($1, 2)', [draftId])).rejects.toThrow('SALARY_STRUCTURE_VALIDATION_FAILED')
    const afterValidationFailure = await db.query<{ id: string; status: string }>(
      'SELECT id::text, status::text FROM public.salary_structure_revisions WHERE id = $1',
      [predecessorRevisionId],
    )
    expect(afterValidationFailure.rows[0]?.status).toBe('PUBLISHED')

    await db.query("SELECT set_config('test.fail_salary_validation', 'false', false)")
    await db.exec(`
      RESET ROLE;
      CREATE FUNCTION public.reject_salary_publication() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF old.status = 'DRAFT' AND new.status = 'PUBLISHED' THEN
          RAISE EXCEPTION 'TEST_PUBLICATION_REJECTED';
        END IF;
        RETURN new;
      END
      $$;
      CREATE TRIGGER reject_salary_publication BEFORE UPDATE ON public.salary_structure_revisions
      FOR EACH ROW EXECUTE FUNCTION public.reject_salary_publication();
      SET ROLE authenticated;
    `)
    await expect(db.query('SELECT public.publish_salary_structure_revision($1, 2)', [draftId])).rejects.toThrow('TEST_PUBLICATION_REJECTED')
    const afterAtomicFailure = await db.query<{ status: string }>(
      'SELECT status::text FROM public.salary_structure_revisions WHERE id = $1',
      [predecessorRevisionId],
    )
    expect(afterAtomicFailure.rows[0]?.status).toBe('PUBLISHED')
    await db.exec('RESET ROLE; DROP TRIGGER reject_salary_publication ON public.salary_structure_revisions; DROP FUNCTION public.reject_salary_publication(); SET ROLE authenticated;')

    const published = await db.query<{ result: { status: string; correctionOfRevisionId: string } }>(
      'SELECT public.publish_salary_structure_revision($1, 2) AS result',
      [draftId],
    )
    expect(published.rows[0]?.result).toEqual({
      id: draftId,
      status: 'PUBLISHED',
      lockVersion: 3,
      correctionOfRevisionId: predecessorRevisionId,
    })

    const rows = await db.query<{ id: string; status: string; source_metadata: { sha256: string; rowCount: number; effectiveFrom: string }; description: string }>(`
      SELECT id::text, status::text, source_metadata, description
      FROM public.salary_structure_revisions
      WHERE salary_structure_id = $1 AND effective_from = DATE '2026-09-01'
      ORDER BY revision_number
    `, [structureId])
    expect(rows.rows.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: predecessorRevisionId, status: 'ARCHIVED' },
      { id: draftId, status: 'PUBLISHED' },
    ])
    expect(rows.rows[1]).toMatchObject({
      description: 'Gereviewde correctieversie',
      source_metadata: { sha256: sourceMetadata.sha256, rowCount: 196, effectiveFrom: '2026-09-01' },
    })
    const effective = await db.query<{ id: string }>(`
      SELECT id::text FROM public.salary_structure_revisions
      WHERE salary_structure_id = $1 AND status = 'PUBLISHED' AND effective_from <= DATE '2026-09-01'
      ORDER BY effective_from DESC LIMIT 1
    `, [structureId])
    expect(effective.rows[0]?.id).toBe(draftId)
    const earlierEffective = await db.query<{ id: string }>(`
      SELECT id::text FROM public.salary_structure_revisions
      WHERE salary_structure_id = $1 AND status = 'PUBLISHED' AND effective_from <= DATE '2026-08-31'
      ORDER BY effective_from DESC LIMIT 1
    `, [structureId])
    expect(earlierEffective.rows[0]?.id).toBe(priorRevisionId)

    const historical = await db.query<{ id: string; salary_structure_revision_id: string }>(`
      SELECT run.id::text, run.salary_structure_revision_id::text
      FROM public.payroll_runs run WHERE run.id = $1
    `, [runId])
    expect(historical.rows[0]).toEqual({ id: runId, salary_structure_revision_id: predecessorRevisionId })
    await expect(db.query('DELETE FROM public.salary_structure_revisions WHERE id = $1', [predecessorRevisionId])).rejects.toThrow()
    await expect(db.query(
      'UPDATE public.salary_structure_revisions SET description = $2 WHERE id = $1',
      [predecessorRevisionId, 'Ongeoorloofde historische wijziging'],
    )).rejects.toThrow('SALARY_STRUCTURE_REVISION_IMMUTABLE')
    await expect(db.query(
      'UPDATE public.salary_structure_revisions SET source_metadata = $2::jsonb WHERE id = $1',
      [draftId, JSON.stringify({ changed: true })],
    )).rejects.toThrow('SALARY_STRUCTURE_REVISION_IMMUTABLE')
    await db.close()
  })

  it('rejects stale predecessors and duplicate effective publications without partial drafts', async () => {
    const db = await createDatabase()
    await expect(db.query(
      "UPDATE public.salary_structure_revisions SET status = 'ARCHIVED' WHERE id = $1",
      [predecessorRevisionId],
    )).rejects.toThrow('SALARY_STRUCTURE_REVISION_IMMUTABLE')
    await expect(db.query(`
      INSERT INTO public.salary_structure_revisions (
        tenant_id, hr_group_id, salary_structure_id, revision_number, status,
        effective_from, salary_basis, currency_code, published_at, published_by_user_id
      ) VALUES ($1, $2, $3, 4, 'PUBLISHED', DATE '2027-01-01', 'MONTHLY_BASE', 'EUR', now(), $4)
    `, [tenantId, hrGroupId, structureId, userId])).rejects.toThrow('SALARY_STRUCTURE_PUBLISH_RPC_REQUIRED')

    const stale = correctionPayload(priorRevisionId)
    await expect(db.query(
      'SELECT public.save_salary_structure_import_draft($1, NULL, NULL, $2::jsonb)',
      [structureId, JSON.stringify(stale)],
    )).rejects.toThrow('SALARY_STRUCTURE_CORRECTION_STALE')

    const valid = correctionPayload(predecessorRevisionId)
    const draft = await db.query<{ result: { id: string } }>(
      'SELECT public.save_salary_structure_import_draft($1, NULL, NULL, $2::jsonb) AS result',
      [structureId, JSON.stringify(valid)],
    )
    const draftId = draft.rows[0]?.result.id
    expect(draftId).toBeTruthy()
    await expect(db.query(
      'SELECT public.save_salary_structure_import_draft($1, NULL, NULL, $2::jsonb)',
      [structureId, JSON.stringify(valid)],
    )).rejects.toThrow('salary_structure_revisions_draft_effective_key')

    const sameDate = await db.query<{ count: number }>(`
      SELECT count(*)::integer AS count FROM public.salary_structure_revisions
      WHERE salary_structure_id = $1 AND effective_from = DATE '2026-09-01'
    `, [structureId])
    expect(sameDate.rows[0]?.count).toBe(2)
    const currentCount = await db.query<{ count: number }>(`
      SELECT count(*)::integer AS count FROM public.salary_structure_revisions
      WHERE salary_structure_id = $1 AND effective_from = DATE '2026-09-01' AND status = 'PUBLISHED'
    `, [structureId])
    expect(currentCount.rows[0]?.count).toBe(1)
    await expect(db.query(`
      UPDATE public.salary_structure_revisions
      SET status = 'PUBLISHED', published_at = now(), published_by_user_id = $2
      WHERE id = $1
    `, [draftId, userId])).rejects.toThrow('SALARY_STRUCTURE_PUBLISH_RPC_REQUIRED')
    await db.close()
  })

  it('rejects overlapping source periods without changing the predecessor or future publication', async () => {
    const db = await createDatabase({ futurePublishedRevision: true })
    const draftResult = await db.query<{ result: { id: string } }>(
      'SELECT public.save_salary_structure_import_draft($1, NULL, NULL, $2::jsonb) AS result',
      [structureId, JSON.stringify(correctionPayload(predecessorRevisionId))],
    )
    const draftId = draftResult.rows[0]?.result.id
    expect(draftId).toBeTruthy()

    await expect(db.query(
      'SELECT public.publish_salary_structure_revision($1, 1)',
      [draftId],
    )).rejects.toThrow('SALARY_STRUCTURE_VERSION_PERIOD_OVERLAP')

    const rows = await db.query<{ id: string; status: string }>(`
      SELECT id::text, status::text
      FROM public.salary_structure_revisions
      WHERE salary_structure_id = $1 AND id IN ($2, $3, $4)
    `, [
      structureId,
      predecessorRevisionId,
      '30000000-0000-4000-8000-000000000003',
      draftId,
    ])
    expect(rows.rows).toHaveLength(3)
    expect(rows.rows).toEqual(expect.arrayContaining([
      { id: predecessorRevisionId, status: 'PUBLISHED' },
      { id: draftId, status: 'DRAFT' },
      { id: '30000000-0000-4000-8000-000000000003', status: 'PUBLISHED' },
    ]))
    await db.close()
  })
})
