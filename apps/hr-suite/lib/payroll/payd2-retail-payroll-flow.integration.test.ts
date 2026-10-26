import { createHash } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import type { PayrollCalculationArtifacts, PayrollRunSummary } from './calculation-repository'
import { createEmployeePayrollCalculationService, type EmployeePayrollCalculationDependencies } from './employee-payroll-calculation-service'
import { createFinalizedEmployeePayslipPdfArtifact, renderGenericEmployeePayslipConceptPdfPreview } from './payrun01-service'
import type { Payrun01Repository } from './payrun01-repository'
import {
  getMySalaryPayslipPdfArtifact,
  getMySalaryStatements,
  listEmployeePayrollPayslipPeriods,
  renderEmployeePayrollPayslipPdf,
  type EmployeePayrollDependencies,
} from './payroll-professional-service'
import { servePayrollPayslip } from './payroll-payslip-response'
import { derivePayd2RetailR2NetIndependentOracle } from './payd2-retail-independent-oracle'
import type { PayrollScope } from './scope'
import {
  calculateRetailR2SyntheticOracle,
  createRetailSourceSnapshot,
  resultAmount,
  scope as retailScope,
} from './payd2-retail-source-fixture'
import type { PayrollSourceSnapshot } from '@liquid-hr/payroll-engine'

const scope: PayrollScope = retailScope
const payrollAdministrationId = '96000000-0000-4000-8000-000000000001'
const actorUserId = '96000000-0000-4000-8000-000000000002'
const periodId = '96000000-0000-4000-8000-000000000003'
const now = () => new Date('2026-07-31T15:00:00.000Z')
let store: IsolatedPayrollDatabase

type JsonRow = Record<string, unknown>

function json(value: unknown): string {
  return JSON.stringify(value)
}

function asRow<T>(value: JsonRow): T {
  return value as T
}

function uuidFor(name: string): string {
  const digest = createHash('sha256').update(name).digest('hex')
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`
}

/** A process-local PostgreSQL instance; it never connects to Supabase or a shared test project. */
class IsolatedPayrollDatabase {
  readonly db = new PGlite()
  readonly period = {
    id: periodId,
    payroll_administration_id: payrollAdministrationId,
    period_year: 2026,
    period_month: 7,
    starts_on: '2026-07-01',
    ends_on: '2026-07-31',
    status: 'OPEN',
  }

  async initialize(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE payroll_periods (
        id text PRIMARY KEY, payroll_administration_id text NOT NULL,
        period_year integer NOT NULL, period_month integer NOT NULL,
        starts_on text NOT NULL, ends_on text NOT NULL, status text NOT NULL
      );
      CREATE TABLE source_snapshots (
        id text PRIMARY KEY, source_employee_id text NOT NULL, source_employment_id text NOT NULL,
        source_income_relationship_id text, source_hash text NOT NULL,
        source_payload jsonb NOT NULL, source_version_vector jsonb NOT NULL
      );
      CREATE TABLE calculation_input_sets (
        id text PRIMARY KEY, source_snapshot_id text NOT NULL, payroll_period_id text NOT NULL,
        rule_package_composition_id text NOT NULL, engine_version text NOT NULL, input_hash text NOT NULL
      );
      CREATE TABLE calculation_runs (
        id text PRIMARY KEY, calculation_input_set_id text NOT NULL, run_type text NOT NULL,
        status text NOT NULL, started_at text, finished_at text, result_hash text
      );
      CREATE TABLE component_results (
        calculation_run_id text NOT NULL, component_key text NOT NULL, amount text, result_payload jsonb NOT NULL,
        PRIMARY KEY (calculation_run_id, component_key)
      );
      CREATE TABLE payroll_controls (
        calculation_run_id text NOT NULL, control_key text NOT NULL, status text NOT NULL, detail_payload jsonb NOT NULL,
        PRIMARY KEY (calculation_run_id, control_key)
      );
      CREATE TABLE calculation_traces (calculation_run_id text PRIMARY KEY, trace_payload jsonb NOT NULL);
      CREATE TABLE generic_payroll_input_references (
        id text PRIMARY KEY, calculation_input_set_id text UNIQUE NOT NULL,
        source_employee_id text NOT NULL, source_employment_id text NOT NULL,
        source_income_relationship_id text NOT NULL, employment_income_relationship_id text NOT NULL,
        tax_profile_id text NOT NULL, tax_profile_version integer NOT NULL,
        core_source_contract_version text NOT NULL, core_validated_at text NOT NULL,
        source_version_vector jsonb NOT NULL, source_hash text NOT NULL, input_hash text NOT NULL,
        input_reference_json jsonb NOT NULL
      );
      CREATE TABLE lifecycle_events (
        id text PRIMARY KEY, payroll_period_id text NOT NULL, source_employment_id text NOT NULL,
        calculation_run_id text NOT NULL, revision integer NOT NULL, event_sequence integer NOT NULL,
        event_type text NOT NULL CHECK (event_type IN ('CONCEPT', 'REVIEWED', 'FINALIZED')),
        event_payload jsonb NOT NULL, created_at text NOT NULL,
        UNIQUE (calculation_run_id, event_sequence)
      );
      CREATE TABLE payroll_artifacts (
        id text PRIMARY KEY, calculation_run_id text NOT NULL, artifact_type text NOT NULL,
        file_name text NOT NULL, content_type text NOT NULL, artifact_bytes bytea NOT NULL,
        artifact_hash text NOT NULL, provenance_json jsonb NOT NULL, created_at text NOT NULL,
        UNIQUE (calculation_run_id, artifact_type)
      );
      CREATE FUNCTION prevent_test_artifact_mutation() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'PAYROLL_ARTIFACT_IMMUTABLE'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER payroll_artifact_immutable BEFORE UPDATE OR DELETE ON payroll_artifacts
      FOR EACH ROW EXECUTE FUNCTION prevent_test_artifact_mutation();
      CREATE FUNCTION prevent_test_lifecycle_mutation() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'PAYROLL_LIFECYCLE_IMMUTABLE'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER payroll_lifecycle_immutable BEFORE UPDATE OR DELETE ON lifecycle_events
      FOR EACH ROW EXECUTE FUNCTION prevent_test_lifecycle_mutation();
    `)
    await this.db.query(
      'INSERT INTO payroll_periods VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [this.period.id, this.period.payroll_administration_id, this.period.period_year, this.period.period_month,
        this.period.starts_on, this.period.ends_on, this.period.status],
    )
  }

  readonly calculationRepository = {
    getPayrollPeriod: async (_scope: PayrollScope, _administrationId: string, year: number, month: number) => {
      if (year !== this.period.period_year || month !== this.period.period_month) return null
      return this.period
    },
    getOrCreateSourceSnapshot: async (_scope: PayrollScope, _administrationId: string, row: JsonRow) => {
      const existing = await this.db.query<JsonRow>('SELECT * FROM source_snapshots WHERE id = $1', [row.id])
      if (existing.rows[0]) return asRow(existing.rows[0])
      await this.db.query(
        `INSERT INTO source_snapshots
          (id, source_employee_id, source_employment_id, source_income_relationship_id, source_hash, source_payload, source_version_vector)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
        [row.id, row.source_employee_id, row.source_employment_id, row.source_income_relationship_id,
          row.source_hash, json(row.source_payload), json(row.source_version_vector)],
      )
      const saved = await this.db.query<JsonRow>('SELECT * FROM source_snapshots WHERE id = $1', [row.id])
      return asRow(saved.rows[0]!)
    },
    getOrCreateCalculationInputSet: async (_scope: PayrollScope, _administrationId: string, row: JsonRow) => {
      const existing = await this.db.query<JsonRow>('SELECT * FROM calculation_input_sets WHERE id = $1', [row.id])
      if (existing.rows[0]) return asRow(existing.rows[0])
      await this.db.query(
        'INSERT INTO calculation_input_sets VALUES ($1, $2, $3, $4, $5, $6)',
        [row.id, row.source_snapshot_id, row.payroll_period_id, row.rule_package_composition_id, row.engine_version, row.input_hash],
      )
      const saved = await this.db.query<JsonRow>('SELECT * FROM calculation_input_sets WHERE id = $1', [row.id])
      return asRow(saved.rows[0]!)
    },
    getOrCreateCalculationRun: async (_scope: PayrollScope, _administrationId: string, row: JsonRow) => {
      const existing = await this.db.query<JsonRow>('SELECT * FROM calculation_runs WHERE id = $1', [row.id])
      if (existing.rows[0]) return { run: asRow(existing.rows[0]), created: false }
      await this.db.query(
        'INSERT INTO calculation_runs VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [row.id, row.calculation_input_set_id, row.run_type, row.status, row.started_at, row.finished_at, row.result_hash],
      )
      const saved = await this.db.query<JsonRow>('SELECT * FROM calculation_runs WHERE id = $1', [row.id])
      return { run: asRow(saved.rows[0]!), created: true }
    },
    markCalculationRunRunning: async (_scope: PayrollScope, _administrationId: string, runId: string, _actor: string, startedAt: string) => {
      await this.db.query("UPDATE calculation_runs SET status = 'RUNNING', started_at = $2 WHERE id = $1", [runId, startedAt])
      return this.runRow(runId)
    },
    markCalculationRunFailed: async (_scope: PayrollScope, _administrationId: string, runId: string, _actor: string, finishedAt: string) => {
      await this.db.query("UPDATE calculation_runs SET status = 'FAILED', finished_at = $2 WHERE id = $1", [runId, finishedAt])
      return this.runRow(runId)
    },
    insertComponentResults: async (_scope: PayrollScope, _administrationId: string, rows: readonly JsonRow[]) => {
      for (const row of rows) await this.db.query(
        'INSERT INTO component_results VALUES ($1, $2, $3, $4::jsonb)',
        [row.calculation_run_id, row.component_key, row.amount, json(row.result_payload)],
      )
      return rows
    },
    insertPayrollControls: async (_scope: PayrollScope, _administrationId: string, rows: readonly JsonRow[]) => {
      for (const row of rows) await this.db.query(
        'INSERT INTO payroll_controls VALUES ($1, $2, $3, $4::jsonb)',
        [row.calculation_run_id, row.control_key, row.status, json(row.detail_payload)],
      )
      return rows
    },
    insertCalculationTrace: async (_scope: PayrollScope, _administrationId: string, row: JsonRow) => {
      await this.db.query('INSERT INTO calculation_traces VALUES ($1, $2::jsonb)', [row.calculation_run_id, json(row.trace_payload)])
      return row
    },
    markCalculationRunSucceededWithConcept: async (
      _scope: PayrollScope, _administrationId: string, runId: string, payrollPeriodId: string,
      employmentId: string, _actor: string, finishedAt: string, resultHash: string, eventPayload: unknown,
    ) => {
      await this.db.query(
        "UPDATE calculation_runs SET status = 'SUCCEEDED', finished_at = $2, result_hash = $3 WHERE id = $1",
        [runId, finishedAt, resultHash],
      )
      const run = await this.runRow(runId)
      const id = uuidFor(`${runId}:CONCEPT`)
      await this.db.query(
        'INSERT INTO lifecycle_events VALUES ($1, $2, $3, $4, 1, 1, $5, $6::jsonb, $7)',
        [id, payrollPeriodId, employmentId, runId, 'CONCEPT', json(eventPayload), finishedAt],
      )
      return run
    },
    getLatestSyntheticArtifacts: async (
      _scope: PayrollScope, _administrationId: string, compositionId?: string, runId?: string,
    ): Promise<PayrollCalculationArtifacts | null> => {
      if (!runId) return null
      const result = await this.db.query<JsonRow>(
        `SELECT r.*, i.id AS input_id, i.source_snapshot_id, i.payroll_period_id, i.rule_package_composition_id, i.engine_version, i.input_hash,
                s.id AS snapshot_id, s.source_employee_id, s.source_employment_id, s.source_income_relationship_id, s.source_hash, s.source_payload, s.source_version_vector
         FROM calculation_runs r
         JOIN calculation_input_sets i ON i.id = r.calculation_input_set_id
         JOIN source_snapshots s ON s.id = i.source_snapshot_id
         WHERE r.id = $1`,
        [runId],
      )
      const row = result.rows[0]
      if (!row || (compositionId && row.rule_package_composition_id !== compositionId)) return null
      const componentRows = await this.db.query<JsonRow>('SELECT component_key, amount, result_payload FROM component_results WHERE calculation_run_id = $1 ORDER BY component_key', [runId])
      const controlRows = await this.db.query<JsonRow>('SELECT control_key, status, detail_payload FROM payroll_controls WHERE calculation_run_id = $1 ORDER BY control_key', [runId])
      const traceRows = await this.db.query<JsonRow>('SELECT trace_payload FROM calculation_traces WHERE calculation_run_id = $1', [runId])
      const sourceSnapshot = {
        id: row.snapshot_id,
        source_employee_id: row.source_employee_id,
        source_employment_id: row.source_employment_id,
        source_income_relationship_id: row.source_income_relationship_id,
        source_hash: row.source_hash,
        source_payload: row.source_payload,
        source_version_vector: row.source_version_vector,
      }
      const inputSet = {
        id: row.input_id,
        source_snapshot_id: row.source_snapshot_id,
        input_hash: row.input_hash,
        rule_package_composition_id: row.rule_package_composition_id,
        engine_version: row.engine_version,
      }
      const artifacts = {
        run: { id: row.id, status: row.status, run_type: row.run_type, started_at: row.started_at, finished_at: row.finished_at, result_hash: row.result_hash },
        inputSet,
        sourceSnapshot,
        payrollPeriod: { ...this.period, id: row.payroll_period_id },
        componentResults: componentRows.rows,
        trace: traceRows.rows[0] ?? null,
        controls: controlRows.rows,
        goldenCase: null,
      }
      return artifacts as unknown as PayrollCalculationArtifacts
    },
    listPayrollRunSummaries: async (_scope: PayrollScope, _administrationId: string, options?: { employeeId?: string }) => {
      const query = options?.employeeId
        ? await this.db.query<JsonRow>(
          `SELECT r.*, i.id AS input_id, i.input_hash, i.rule_package_composition_id, i.engine_version, i.source_snapshot_id,
                  s.id AS snapshot_id, s.source_employee_id, s.source_employment_id, s.source_hash, s.source_payload, s.source_version_vector
           FROM calculation_runs r JOIN calculation_input_sets i ON i.id = r.calculation_input_set_id
           JOIN source_snapshots s ON s.id = i.source_snapshot_id WHERE s.source_employee_id = $1`,
          [options.employeeId],
        )
        : await this.db.query<JsonRow>(
          `SELECT r.*, i.id AS input_id, i.input_hash, i.rule_package_composition_id, i.engine_version, i.source_snapshot_id,
                  s.id AS snapshot_id, s.source_employee_id, s.source_employment_id, s.source_hash, s.source_payload, s.source_version_vector
           FROM calculation_runs r JOIN calculation_input_sets i ON i.id = r.calculation_input_set_id
           JOIN source_snapshots s ON s.id = i.source_snapshot_id`,
        )
      const summaries: PayrollRunSummary[] = []
      for (const row of query.rows) {
        summaries.push({
          run: { id: row.id, status: row.status, run_type: row.run_type, result_hash: row.result_hash } as never,
          inputSet: { id: row.input_id, input_hash: row.input_hash, rule_package_composition_id: row.rule_package_composition_id, engine_version: row.engine_version, source_snapshot_id: row.source_snapshot_id } as never,
          sourceSnapshot: { id: row.snapshot_id, source_employee_id: row.source_employee_id, source_employment_id: row.source_employment_id, source_hash: row.source_hash, source_payload: row.source_payload, source_version_vector: row.source_version_vector } as never,
          payrollPeriod: this.period as never,
        })
      }
      return summaries
    },
  }

  readonly lifecycleRepository = {
    getOrCreateGenericInputReference: async (_scope: PayrollScope, _administrationId: string, row: JsonRow) => {
      const existing = await this.db.query<JsonRow>('SELECT * FROM generic_payroll_input_references WHERE calculation_input_set_id = $1', [row.calculation_input_set_id])
      if (existing.rows[0]) return asRow(existing.rows[0])
      await this.db.query(
        `INSERT INTO generic_payroll_input_references VALUES
         ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14::jsonb)`,
        [uuidFor(String(row.calculation_input_set_id)), row.calculation_input_set_id, row.source_employee_id, row.source_employment_id,
          row.source_income_relationship_id, row.employment_income_relationship_id, row.tax_profile_id, row.tax_profile_version,
          row.core_source_contract_version, row.core_validated_at, json(row.source_version_vector), row.source_hash, row.input_hash,
          json(row.input_reference_json)],
      )
      const saved = await this.db.query<JsonRow>('SELECT * FROM generic_payroll_input_references WHERE calculation_input_set_id = $1', [row.calculation_input_set_id])
      return asRow(saved.rows[0]!)
    },
    getGenericInputReference: async (_scope: PayrollScope, _administrationId: string, inputSetId: string) => {
      const result = await this.db.query<JsonRow>('SELECT * FROM generic_payroll_input_references WHERE calculation_input_set_id = $1', [inputSetId])
      return result.rows[0] ? asRow(result.rows[0]) : null
    },
    listLifecycleEvents: async (_scope: PayrollScope, _administrationId: string, payrollPeriodId: string, employmentId: string) => {
      const result = await this.db.query<JsonRow>(
        'SELECT * FROM lifecycle_events WHERE payroll_period_id = $1 AND source_employment_id = $2 ORDER BY revision, event_sequence',
        [payrollPeriodId, employmentId],
      )
      return result.rows
    },
    insertLifecycleEvent: async (_scope: PayrollScope, _administrationId: string, row: JsonRow) => {
      const createdAt = now().toISOString()
      const id = uuidFor(`${row.calculation_run_id}:${row.event_type}`)
      await this.db.query(
        'INSERT INTO lifecycle_events VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)',
        [id, row.payroll_period_id, row.source_employment_id, row.calculation_run_id, row.revision,
          row.event_sequence, row.event_type, json(row.event_payload), createdAt],
      )
      const saved = await this.db.query<JsonRow>('SELECT * FROM lifecycle_events WHERE id = $1', [id])
      return asRow(saved.rows[0]!)
    },
    getArtifact: async (_scope: PayrollScope, _administrationId: string, runId: string, artifactType: string) => {
      const result = await this.db.query<JsonRow>(
        'SELECT * FROM payroll_artifacts WHERE calculation_run_id = $1 AND artifact_type = $2', [runId, artifactType],
      )
      return result.rows[0] ? asRow(result.rows[0]) : null
    },
    insertArtifact: async (_scope: PayrollScope, _administrationId: string, metadata: JsonRow, bytes: Uint8Array) => {
      const existing = await this.db.query<JsonRow>(
        'SELECT id FROM payroll_artifacts WHERE calculation_run_id = $1 AND artifact_type = $2',
        [metadata.calculation_run_id, metadata.artifact_type],
      )
      if (existing.rows[0]) throw new Error('PAYRUN01_ARTIFACT_ALREADY_EXISTS')
      const id = uuidFor(`${metadata.calculation_run_id}:${metadata.artifact_type}`)
      const artifactHash = createHash('sha256').update(bytes).digest('hex')
      await this.db.query(
        'INSERT INTO payroll_artifacts VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)',
        [id, metadata.calculation_run_id, metadata.artifact_type, metadata.file_name, metadata.content_type,
          bytes, artifactHash, json(metadata.provenance_json), now().toISOString()],
      )
      const saved = await this.db.query<JsonRow>('SELECT * FROM payroll_artifacts WHERE id = $1', [id])
      return asRow(saved.rows[0]!)
    },
  }

  async runRow(runId: string): Promise<JsonRow> {
    const result = await this.db.query<JsonRow>('SELECT * FROM calculation_runs WHERE id = $1', [runId])
    return result.rows[0]!
  }

  async artifactCount(): Promise<number> {
    const result = await this.db.query<{ count: number }>('SELECT count(*)::int AS count FROM payroll_artifacts')
    return result.rows[0]!.count
  }

  async runCount(): Promise<number> {
    const result = await this.db.query<{ count: number }>('SELECT count(*)::int AS count FROM calculation_runs')
    return result.rows[0]!.count
  }

  async close(): Promise<void> {
    await this.db.close()
  }
}

function serviceDependencies(snapshots: readonly PayrollSourceSnapshot[]): EmployeePayrollCalculationDependencies {
  const byEmployeeId = new Map(snapshots.map((snapshot) => [snapshot.sourceEmployeeId, snapshot]))
  return {
    requireAccess: async () => ({ scope, administration: { id: payrollAdministrationId, status: 'ACTIVE' as const, capabilityEnabled: true }, actorUserId }),
    createCalculationRepository: () => store.calculationRepository as never,
    createLifecycleRepository: () => store.lifecycleRepository as never,
    sourceProvider: {
      getPayrollSourceSnapshot: async (input: { employeeId: string }) => {
        const snapshot = byEmployeeId.get(input.employeeId)
        if (!snapshot) throw new Error('RETAIL_FIXTURE_EMPLOYEE_NOT_FOUND')
        return snapshot
      },
    },
    enabled: () => true,
    allowIsolatedTestScenario: true,
    now,
    createId: uuidFor,
  } as unknown as EmployeePayrollCalculationDependencies
}

function employeeReadDependencies(employeeId: string): EmployeePayrollDependencies {
  const context = {
    userId: actorUserId,
    tenantId: scope.tenantId,
    hrGroupId: scope.hrGroupId,
    administrationId: scope.administrationId,
    employeeId,
  }
  return {
    requireAuthContext: async () => context,
    requirePermission: async (_permission: string, requestedEmployeeId?: string) => ({ ...context, employeeId: requestedEmployeeId ?? employeeId }),
    isEnabled: () => true,
    createPayrollRepository: () => ({
      getPayrollAdministration: async () => ({ id: payrollAdministrationId, status: 'ACTIVE' as const, capabilityEnabled: true }),
    }),
    createCalculationRepository: () => store.calculationRepository as never,
    createPayrunRepository: () => store.lifecycleRepository as never,
    getPayslipPdfArtifactForRun: async ({ runId }: { readonly runId: string }) => {
      const artifact = await store.lifecycleRepository.getArtifact(scope, payrollAdministrationId, runId, 'PAYSLIP_PDF')
      return artifact ? { ...artifact, content_type: 'application/pdf' as const } : null
    },
    renderPayslipPdf: async (input: { readonly employeeId: string; readonly runId: string }) => await createFinalizedEmployeePayslipPdfArtifact({
      scope,
      payrollAdministrationId,
      actorUserId,
      employeeId: input.employeeId,
      runId: input.runId,
      genericPayslipProfile: { employeeName: 'R1 Testmedewerker', employerName: 'Retail TEST' },
    }, {
      payrollRepository: store.calculationRepository as never,
      payrunRepository: store.lifecycleRepository as unknown as Payrun01Repository,
      sourceProvider: { getPayrollSourceSnapshot: async () => { throw new Error('SOURCE_NOT_RELOADED_FOR_FINAL_ARTIFACT_READ') } },
      enabled: () => true,
      now,
    } as never) as never,
    loadPayslipDisplayProfile: async () => ({ employeeName: 'R1 Testmedewerker', employerName: 'Retail TEST' }),
  } as unknown as EmployeePayrollDependencies
}

describe('PAY-DOSSIER-01 isolated Retail payroll flow', () => {
  let r1Snapshot: PayrollSourceSnapshot
  let r2Snapshot: PayrollSourceSnapshot
  let r2CompleteSnapshot: PayrollSourceSnapshot
  let r1RunId: string

  beforeAll(async () => {
    store = new IsolatedPayrollDatabase()
    await store.initialize()
    r1Snapshot = await createRetailSourceSnapshot('R1')
    r2Snapshot = await createRetailSourceSnapshot('R2')
    r2CompleteSnapshot = await createRetailSourceSnapshot('R2', { completeR2PayrollSource: true })
  })

  afterAll(async () => await store.close())

  it('calculates and finalizes R1 in PGlite, then exposes the exact saved PDF to the employee and HR dossier', async () => {
    const calculation = createEmployeePayrollCalculationService(serviceDependencies([r1Snapshot, r2Snapshot]))
    const r1EmployeeId = r1Snapshot.sourceEmployeeId
    const r1EmploymentId = r1Snapshot.sourceEmploymentId
    const input = { employeeId: r1EmployeeId, employmentId: r1EmploymentId, period: { year: 2026, month: 7 } }

    const concept = await calculation.calculateEmployeePayroll(input)
    expect(concept).toMatchObject({ status: 'CALCULATED', businessStatus: 'CONCEPT', grossAmount: '4767.20', wageTaxAmount: '1107.17', netAfterWageTax: '3461.38' })
    expect(concept.payfull02).toMatchObject({
      taxableWage: '4568.55',
      employeePension: '198.65',
      employerPension: '595.96',
      employerPremiums: '801.32',
      holidayReserve: '381.38',
      totalEmployerCost: '6545.86',
    })
    r1RunId = concept.runId!
    await expect(calculation.calculateEmployeePayroll(input)).resolves.toMatchObject({ runId: r1RunId, businessStatus: 'CONCEPT' })
    expect(await store.runCount()).toBe(1)

    const payrunDependencies = {
      payrollRepository: store.calculationRepository as never,
      payrunRepository: store.lifecycleRepository as unknown as Payrun01Repository,
      sourceProvider: { getPayrollSourceSnapshot: async () => r1Snapshot },
      enabled: () => true,
      now,
    }
    const finalizedPdfInput = {
      scope, payrollAdministrationId, actorUserId, employeeId: r1EmployeeId, runId: r1RunId,
      genericPayslipProfile: { employeeName: 'R1 Testmedewerker', employerName: 'Retail TEST' },
    }
    const conceptPdf = await renderGenericEmployeePayslipConceptPdfPreview(finalizedPdfInput, payrunDependencies as never)
    expect(conceptPdf).toMatchObject({
      content_type: 'application/pdf',
      source_hash: r1Snapshot.sourceHash,
      document_hash: createHash('sha256').update(conceptPdf.artifact_bytes).digest('hex'),
    })
    expect(await store.artifactCount()).toBe(0)
    const parsedConceptPdf = await getDocument({ data: new Uint8Array(conceptPdf.artifact_bytes) }).promise
    const conceptPdfText = await parsedConceptPdf.getPage(1).then(async (page) => (await page.getTextContent()).items
      .flatMap((item) => 'str' in item ? [item.str] : []).join(' '))
    expect(conceptPdfText).toContain('CONCEPT — NIET DEFINITIEF · NIET VOOR UITBETALING')
    expect(conceptPdfText).toContain('TEST / NIET VOOR UITBETALING')

    const employeeBeforeFinal = employeeReadDependencies(r1EmployeeId)
    await expect(getMySalaryStatements(employeeBeforeFinal)).resolves.toEqual([])
    await expect(listEmployeePayrollPayslipPeriods(r1EmployeeId, employeeBeforeFinal)).resolves.toEqual([])
    await expect(createFinalizedEmployeePayslipPdfArtifact({
      scope, payrollAdministrationId, actorUserId, employeeId: r1EmployeeId, runId: r1RunId,
      genericPayslipProfile: { employeeName: 'R1 Testmedewerker', employerName: 'Retail TEST' },
    }, {
      payrollRepository: store.calculationRepository as never,
      payrunRepository: store.lifecycleRepository as unknown as Payrun01Repository,
      sourceProvider: { getPayrollSourceSnapshot: async () => r1Snapshot },
      enabled: () => true,
      now,
    })).rejects.toMatchObject({ code: 'PAYROLL_INPUT_INVALID' })
    expect(await store.artifactCount()).toBe(0)

    await expect(calculation.reviewEmployeePayroll({ ...input, runId: r1RunId })).resolves.toMatchObject({ eventType: 'REVIEWED' })
    await expect(calculation.finalizeEmployeePayroll({ ...input, runId: r1RunId })).resolves.toMatchObject({ eventType: 'FINALIZED' })

    const savedArtifact = await createFinalizedEmployeePayslipPdfArtifact(finalizedPdfInput, payrunDependencies as never)
    expect(Buffer.from(savedArtifact.artifact_bytes).subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(savedArtifact.provenance_json).toMatchObject({
      documentClassification: 'TEST / NIET VOOR UITBETALING',
      sourceHash: r1Snapshot.sourceHash,
      inputHash: expect.any(String),
      resultHash: expect.any(String),
      pdfHash: savedArtifact.artifact_hash,
    })
    const parsedPdf = await getDocument({ data: new Uint8Array(savedArtifact.artifact_bytes) }).promise
    const pdfText = await parsedPdf.getPage(1).then(async (page) => (await page.getTextContent()).items
      .flatMap((item) => 'str' in item ? [item.str] : []).join(' '))
    expect(pdfText).toContain('TEST / NIET VOOR UITBETALING')
    expect(await createFinalizedEmployeePayslipPdfArtifact(finalizedPdfInput, payrunDependencies as never)).toMatchObject({
      id: savedArtifact.id,
      artifact_hash: savedArtifact.artifact_hash,
    })
    expect(await store.artifactCount()).toBe(1)

    const employeeDeps = employeeReadDependencies(r1EmployeeId)
    await expect(getMySalaryStatements(employeeDeps)).resolves.toMatchObject([
      { periodYear: 2026, periodMonth: 7, components: expect.arrayContaining([{ key: 'gross_salary', amount: 4767.2 }, { key: 'net_salary', amount: 3461.38 }]) },
    ])
    await expect(listEmployeePayrollPayslipPeriods(r1EmployeeId, employeeDeps)).resolves.toEqual([{ periodYear: 2026, periodMonth: 7 }])
    const employeeArtifact = await getMySalaryPayslipPdfArtifact(2026, 7, employeeDeps)
    expect(employeeArtifact?.artifact_hash).toBe(savedArtifact.artifact_hash)
    expect(employeeArtifact?.artifact_bytes).toEqual(savedArtifact.artifact_bytes)

    const hrAdminPdf = await renderEmployeePayrollPayslipPdf(r1EmployeeId, 2026, 7, employeeDeps)
    expect(hrAdminPdf?.artifact_bytes).toEqual(savedArtifact.artifact_bytes)
    expect(hrAdminPdf?.artifact_hash).toBe(savedArtifact.artifact_hash)
    const employeeResponse = await servePayrollPayslip(
      new Request('http://localhost/api/my-salary/payslips/2026-07'),
      '2026-07', async () => employeeArtifact ? { ...employeeArtifact, content_type: 'application/pdf' as const } : null,
    )
    const hrAdminDownload = await servePayrollPayslip(
      new Request('http://localhost/api/employees/r1/payslips/payroll/2026-07?download=1'),
      '2026-07', async () => hrAdminPdf,
    )
    expect(employeeResponse.headers.get('Content-Disposition')).toContain('inline')
    expect(hrAdminDownload.headers.get('Content-Disposition')).toContain('attachment')
    expect(employeeResponse.headers.get('X-Artifact-SHA256')).toBe(savedArtifact.artifact_hash)
    expect(hrAdminDownload.headers.get('X-Artifact-SHA256')).toBe(savedArtifact.artifact_hash)
    expect(new Uint8Array(await employeeResponse.arrayBuffer())).toEqual(savedArtifact.artifact_bytes)
    expect(new Uint8Array(await hrAdminDownload.arrayBuffer())).toEqual(savedArtifact.artifact_bytes)

    await expect(store.db.query('UPDATE payroll_artifacts SET file_name = $1 WHERE id = $2', ['changed.pdf', savedArtifact.id]))
      .rejects.toThrow('PAYROLL_ARTIFACT_IMMUTABLE')
    await expect(store.db.query('DELETE FROM lifecycle_events WHERE calculation_run_id = $1', [r1RunId]))
      .rejects.toThrow('PAYROLL_LIFECYCLE_IMMUTABLE')
  }, 30000)

  it('reconciles R2 source hours and still fails closed without a validated fiscal source', async () => {
    const calculation = createEmployeePayrollCalculationService(serviceDependencies([r1Snapshot, r2Snapshot]))
    const result = await calculation.calculateEmployeePayroll({
      employeeId: r2Snapshot.sourceEmployeeId,
      employmentId: r2Snapshot.sourceEmploymentId,
      period: { year: 2026, month: 7 },
    })
    expect(result.status).toBe('SOURCE_GAP')
    expect(result.runId).toBeNull()
    expect(result.grossAmount).toBeNull()
    expect(result.netAfterWageTax).toBeNull()
    expect(result.gaps).toEqual(expect.arrayContaining([
      { field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'VALIDATED_FISCAL_PROFILE_REQUIRED' },
    ]))
    expect(result.gaps).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ reasonCode: 'SALARY_DOES_NOT_RECONCILE_TO_PART_TIME_FACTOR' }),
      expect.objectContaining({ reasonCode: 'SCHEDULE_HOURS_DO_NOT_RECONCILE_TO_PART_TIME_FACTOR' }),
    ]))
    expect(await store.artifactCount()).toBe(1)
    expect(await store.runCount()).toBe(1)
  })

  it('keeps R2 blocked in Payroll while the isolated synthetic calculation matches the independent oracle', async () => {
    const calculation = createEmployeePayrollCalculationService(serviceDependencies([r2CompleteSnapshot]))
    const input = {
      employeeId: r2CompleteSnapshot.sourceEmployeeId,
      employmentId: r2CompleteSnapshot.sourceEmploymentId,
      period: { year: 2026, month: 7 },
    }
    const oracle = derivePayd2RetailR2NetIndependentOracle()
    const blocked = await calculation.calculateEmployeePayroll(input)
    expect(blocked.status).toBe('SOURCE_GAP')
    expect(blocked.runId).toBeNull()
    expect(blocked.gaps).toContainEqual({
      field: 'actualWork',
      status: 'SOURCE_GAP',
      reasonCode: 'ACTUAL_WORK_INTERVAL_SOURCE_UNAVAILABLE',
    })
    expect(await store.runCount()).toBe(1)

    const first = calculateRetailR2SyntheticOracle(r2CompleteSnapshot)
    const repeated = calculateRetailR2SyntheticOracle(r2CompleteSnapshot)

    expect([oracle.baseMonthlyGross, oracle.selectedPremiumGross, oracle.gross]).toEqual(['1605.79', '15.44', '1621.23'])
    expect({
      gross: resultAmount(first, 'gross_salary'),
      pensionableWage: resultAmount(first, 'pensionable_wage'),
      employeePension: resultAmount(first, 'employee_pension'),
      employerPension: resultAmount(first, 'employer_pension'),
      taxableWage: resultAmount(first, 'taxable_wage'),
      employeeInsuranceBase: resultAmount(first, 'employee_insurance_base'),
      zvwBase: resultAmount(first, 'zvw_base'),
      wageTax: resultAmount(first, 'wage_tax'),
      net: resultAmount(first, 'net_salary'),
      employerAwf: resultAmount(first, 'employer_awf'),
      employerAof: resultAmount(first, 'employer_aof'),
      employerWko: resultAmount(first, 'employer_wko'),
      employerWhk: resultAmount(first, 'employer_whk'),
      employerZvw: resultAmount(first, 'employer_zvw'),
      holidayReserve: resultAmount(first, 'holiday_allowance_reserve'),
      totalEmployerCost: resultAmount(first, 'total_employer_cost'),
    }).toEqual({
      gross: oracle.gross,
      pensionableWage: oracle.monthlyPensionableBase,
      employeePension: oracle.employeePension,
      employerPension: oracle.employerPension,
      taxableWage: oracle.taxableWage,
      employeeInsuranceBase: oracle.taxableWage,
      zvwBase: oracle.taxableWage,
      wageTax: oracle.wageTax,
      net: oracle.net,
      employerAwf: oracle.employerRates.awf,
      employerAof: oracle.employerRates.aof,
      employerWko: oracle.employerRates.wko,
      employerWhk: oracle.employerRates.whk,
      employerZvw: oracle.employerRates.zvw,
      holidayReserve: oracle.holidayReserve,
      totalEmployerCost: oracle.totalEmployerCost,
    })
    expect(repeated.resultRows).toEqual(first.resultRows)
    expect(await store.runCount()).toBe(1)
    expect(await store.artifactCount()).toBe(1)
  })

  it.each([
    ['tax', { omitR2FiscalProfile: true }, 'taxProfile'],
    ['pension', { omitR2PensionSource: true }, 'pension'],
    ['employer', { omitR2EmployerConfiguration: true }, 'payrollConfiguration'],
    ['opening cumulative', { omitR2OpeningCumulative: true }, 'pension'],
    ['contradictory cumulative', { nonZeroR2OpeningCumulative: true }, 'pension'],
    ['effective date', { invalidR2TaxProfileEffectiveDate: true }, 'taxProfile'],
    ['source version', { invalidR2TaxProfileVersion: true }, 'taxProfile'],
  ] as const)('does not admit a synthetic R2 service calculation with missing or invalid %s inputs', async (_name, options, field) => {
    const snapshot = await createRetailSourceSnapshot('R2', { completeR2PayrollSource: true, ...options })
    const calculation = createEmployeePayrollCalculationService(serviceDependencies([snapshot]))
    const readiness = await calculation.inspectEmployeePayrollSource({
      employeeId: snapshot.sourceEmployeeId,
      employmentId: snapshot.sourceEmploymentId,
      period: { year: 2026, month: 7 },
    })

    expect(readiness.eligibleForCalculation).toBe(false)
    expect(readiness.gaps).toEqual(expect.arrayContaining([expect.objectContaining({ field })]))
    expect(await store.runCount()).toBe(1)
  })

  it('does not admit a second actual-work premium path when the single CAO premium source is unavailable', async () => {
    const snapshot = await createRetailSourceSnapshot('R2', {
      completeR2PayrollSource: true,
      businessScope: null,
    })
    const calculation = createEmployeePayrollCalculationService(serviceDependencies([snapshot]))
    const readiness = await calculation.inspectEmployeePayrollSource({
      employeeId: snapshot.sourceEmployeeId,
      employmentId: snapshot.sourceEmploymentId,
      period: { year: 2026, month: 7 },
    })

    expect(readiness.eligibleForCalculation).toBe(false)
    expect(readiness.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'actualWork', reasonCode: 'PAYROLL_VARIABLE_WAGE_NOT_CONFIGURED' }),
    ]))
    expect(await store.runCount()).toBe(1)
  })

  it('rejects a complete R2 source snapshot from a foreign tenant before calculation', async () => {
    const foreignTenantSnapshot = {
      ...r2CompleteSnapshot,
      sourceTenantId: '16000000-0000-4000-8000-000000000099',
    }
    const calculation = createEmployeePayrollCalculationService(serviceDependencies([foreignTenantSnapshot]))

    await expect(calculation.calculateEmployeePayroll({
      employeeId: r2CompleteSnapshot.sourceEmployeeId,
      employmentId: r2CompleteSnapshot.sourceEmploymentId,
      period: { year: 2026, month: 7 },
    })).rejects.toMatchObject({ code: 'PAYROLL_SOURCE_SCOPE_FORBIDDEN' })

    const foreignEmployeeSnapshot = {
      ...r2CompleteSnapshot,
      sourceEmployeeId: '46000000-0000-4000-8000-000000000099',
    }
    const mismatchedEmployeeCalculation = createEmployeePayrollCalculationService({
      ...serviceDependencies([r2CompleteSnapshot]),
      sourceProvider: { getPayrollSourceSnapshot: async () => foreignEmployeeSnapshot },
    })
    await expect(mismatchedEmployeeCalculation.calculateEmployeePayroll({
      employeeId: r2CompleteSnapshot.sourceEmployeeId,
      employmentId: r2CompleteSnapshot.sourceEmploymentId,
      period: { year: 2026, month: 7 },
    })).rejects.toMatchObject({ code: 'PAYROLL_SOURCE_SCOPE_FORBIDDEN' })
    expect(await store.runCount()).toBe(1)
  })
})
