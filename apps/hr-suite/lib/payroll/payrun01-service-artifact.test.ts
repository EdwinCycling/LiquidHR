import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payrun01ServiceDependencies } from './payrun01-service'
import type { Payrun01ArtifactMetadata } from './payrun01-repository'
import type { PayrollScope } from './scope'
import type { PayrollControlStatus, PayrollJson } from './database'

const { renderPdf } = vi.hoisted(() => ({ renderPdf: vi.fn() }))
vi.mock('./payrun01-payslip-pdf', () => ({ renderPayrun01PayslipPdf: renderPdf }))

import {
  createPayrun01PayslipPdfArtifact,
  createPayrun01TechnicalJsonArtifact,
  finalizePayrun01Payroll,
  getPayrun01Lifecycle,
  reviewPayrun01Payroll,
} from './payrun01-service'

const runId = '10000000-0000-4000-8000-000000000001'
const employeeId = '64ad3a23-f59a-4ed0-af41-26dda20ff067'
const kinderopvangEmployeeId = '79091d14-ef66-41fe-a2d5-92df108727e5'
const legacyCompanyEmployeeId = 'dd9bde02-76bb-4f7c-8add-db544a148f3f'
const employmentId = 'b7391845-77d4-407c-bfe6-555a8a3d463b'
const configId = '70000000-0000-4000-8000-000000000001'
const assignmentVersionId = '70000000-0000-4000-8000-000000000002'
const sourceHash = 'a'.repeat(64)
const inputHash = 'b'.repeat(64)
const configHash = 'c'.repeat(64)
const assignmentHash = 'f'.repeat(64)
const resultHash = 'd'.repeat(64)
const pdfBytes = Buffer.from('%PDF-1.7\nPAYRUN01 TEST')
const profile = {
  status: 'SYNTHETIC_TEST_PROFILE',
  employerName: 'LiquidHR Demo Company TEST',
  employeeName: 'Lisa TEST',
  writtenContract: true,
  contractType: 'DEFINITE',
  isOnCall: false,
  contractHoursPerWeek: 40,
  fulltimeHoursPerWeek: 40,
  minimumHourlyWage: '14.99',
  minimumHourlyWageEffectiveFrom: '2026-07-01',
  minimumHourlyWageAgeCategory: 'AGE_21_PLUS',
  source: 'PAYRUN01 synthetic profile test fixture.',
}

type LifecycleEventFixture = {
  calculation_run_id: string
  event_type: string
  event_sequence: number
  id?: string
  revision?: number
}

function fixture(events: LifecycleEventFixture[] = [
  { calculation_run_id: runId, event_type: 'CONCEPT', event_sequence: 1 },
  { calculation_run_id: runId, event_type: 'REVIEWED', event_sequence: 2 },
  { calculation_run_id: runId, event_type: 'FINALIZED', event_sequence: 3, id: 'final-event' },
], sourceEmployeeId = employeeId) {
  const artifacts = {
    run: { id: runId, status: 'SUCCEEDED', run_type: 'INDIVIDUAL_PAYROLL', result_hash: resultHash },
    inputSet: { id: '80000000-0000-4000-8000-000000000001', input_hash: inputHash, rule_package_composition_id: 'PAYRUN01-DEMO-COMPANY-2026.1', engine_version: 'payroll-engine-2026.1' },
    sourceSnapshot: { id: '90000000-0000-4000-8000-000000000001', source_employee_id: sourceEmployeeId, source_employment_id: employmentId, source_hash: sourceHash, source_payload: { employment: { contractType: 'INDEFINITE' } } as Record<string, unknown> },
    payrollPeriod: { id: 'a0000000-0000-4000-8000-000000000001', period_year: 2026, period_month: 10, starts_on: '2026-10-01', ends_on: '2026-10-31' },
    componentResults: [
      { component_key: 'gross_salary', result_payload: { amount: '5500.00' } },
      { component_key: 'employee_pension', result_payload: { amount: '0.00' } },
      { component_key: 'wage_tax', result_payload: { amount: '1577.17' } },
      { component_key: 'net_salary', result_payload: { amount: '3922.83' } },
      { component_key: 'employer_pension', result_payload: { amount: '0.00' } },
      { component_key: 'employer_insurance', result_payload: { amount: '1233.10' } },
      { component_key: 'holiday_allowance_reserve', result_payload: { amount: '440.00' } },
      { component_key: 'year_end_reserve', result_payload: { amount: '0.00' } },
      { component_key: 'total_employer_cost', result_payload: { amount: '7173.10' } },
    ],
    controls: [{ control_key: 'PAYRUN01-CTRL-009-PENSION-RULE-READY', status: 'PASS', detail_payload: { status: 'PASS' } }] as Array<{
      control_key: string
      status: PayrollControlStatus
      detail_payload: PayrollJson
    }>,
  }
  const inputReference = {
    source_employment_id: employmentId,
    assignment_version_id: assignmentVersionId,
    config_version_id: configId,
    input_provenance_json: {
      scenario: sourceEmployeeId === kinderopvangEmployeeId
        ? 'KINDEROPVANG_TEST'
        : sourceEmployeeId === legacyCompanyEmployeeId ? 'LEGACY_COMPANY_TEST' : 'DEMO_COMPANY_TEST',
      sourceHash,
      inputHash,
      supersession: null as Record<string, unknown> | null,
      versions: {
        sourceSnapshotHash: 'e'.repeat(64),
        assignmentHash,
        configHash,
        assignmentVersionNumber: sourceEmployeeId === kinderopvangEmployeeId ? 5 : 3,
        configVersionNumber: sourceEmployeeId === kinderopvangEmployeeId ? 42 : 3,
      },
    },
  }
  const assignmentVersion = { id: assignmentVersionId, assignment_hash: assignmentHash, assignment_json: { payslipProfile: profile } }
  const configVersion: { id: string; config_hash: string; config_json: Record<string, unknown> } = {
    id: configId,
    config_hash: configHash,
    config_json: { pension: { mode: 'DISABLED' } },
  }
  const payrunRepository = {
    getInputReference: vi.fn(async () => inputReference),
    listLifecycleEvents: vi.fn(async () => events),
    insertLifecycleEvent: vi.fn(async (_scope: PayrollScope, _administrationId: string, row: Record<string, unknown>) => row),
    getAssignmentVersion: vi.fn(async () => assignmentVersion),
    getCalculationConfigVersion: vi.fn(async () => configVersion),
    getArtifact: vi.fn(async () => null),
    insertArtifact: vi.fn(async (_scope: PayrollScope, _administrationId: string, metadata: Payrun01ArtifactMetadata, bytes: Uint8Array) => ({
      ...metadata,
      id: 'b0000000-0000-4000-8000-000000000001',
      artifact_hash: resultHash,
      artifact_bytes: bytes,
      created_at: '2026-10-06T00:00:00.000Z',
    })),
  }
  const dependencies = {
    payrollRepository: { getLatestSyntheticArtifacts: vi.fn(async () => artifacts) },
    payrunRepository,
    sourceProvider: { getPayrollSourceSnapshot: vi.fn(async () => ({ sourceEmployeeId, sourceEmploymentId: employmentId, sourceHash: 'e'.repeat(64) })) },
    enabled: () => true,
  } as unknown as Payrun01ServiceDependencies
  return { artifacts, configVersion, inputReference, payrunRepository, dependencies }
}

describe('PAYRUN01 lifecycle source identity', () => {
  it('validates the persisted projected snapshot hash separately from the upstream source hash', async () => {
    const { dependencies } = fixture([{ calculation_run_id: runId, event_type: 'CONCEPT', event_sequence: 1 }])

    await expect(getPayrun01Lifecycle({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId,
      kind: 'DEMO_COMPANY_TEST',
      runId,
    }, dependencies)).resolves.toMatchObject({
      runId,
      latestEvent: { event_type: 'CONCEPT', calculation_run_id: runId },
    })
  })

  it('revalidates current inputs against the upstream source hash and preserves it in the review event', async () => {
    const { dependencies, payrunRepository } = fixture([{ calculation_run_id: runId, event_type: 'CONCEPT', event_sequence: 1, revision: 2 }])

    await reviewPayrun01Payroll({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId,
      kind: 'DEMO_COMPANY_TEST',
      runId,
    }, dependencies)

    expect(payrunRepository.insertLifecycleEvent).toHaveBeenCalledWith(
      expect.any(Object),
      '50000000-0000-4000-8000-000000000001',
      expect.objectContaining({ event_type: 'REVIEWED', revision: 2, event_sequence: 2, event_payload: expect.objectContaining({ sourceSnapshotHash: 'e'.repeat(64) }) }),
    )
  })

  it('keeps TEST-only pension calculations out of FINALIZED until fiscal treatment is verified', async () => {
    const { artifacts, dependencies, payrunRepository } = fixture([
      { calculation_run_id: runId, event_type: 'CONCEPT', event_sequence: 1 },
      { calculation_run_id: runId, event_type: 'REVIEWED', event_sequence: 2 },
    ], legacyCompanyEmployeeId)
    artifacts.controls = [{
      control_key: 'PAYRUN01-CTRL-009-PENSION-RULE-READY',
      status: 'WARN',
      detail_payload: { status: 'WARNING', actual: false, reasonCode: 'PENSION_LEGAL_FISCAL_TREATMENT_UNVERIFIED' },
    }]

    await expect(finalizePayrun01Payroll({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId: legacyCompanyEmployeeId,
      kind: 'LEGACY_COMPANY_TEST',
      runId,
    }, dependencies)).rejects.toMatchObject({
      code: 'PAYROLL_CALCULATION_BLOCKED',
      runId,
      reasonCode: 'PENSION_LEGAL_FISCAL_TREATMENT_UNVERIFIED',
    })

    expect(payrunRepository.insertLifecycleEvent).not.toHaveBeenCalled()
  })
})

describe('PAYRUN01 persisted payslip PDF artifact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    renderPdf.mockResolvedValue(pdfBytes)
  })

  it('renders from the finalized stored amounts and pins the artifact to the persisted versions', async () => {
    const { payrunRepository, dependencies } = fixture()
    const artifact = await createPayrun01PayslipPdfArtifact({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId,
      kind: 'DEMO_COMPANY_TEST',
      runId,
    }, dependencies)

    expect(renderPdf).toHaveBeenCalledWith(expect.objectContaining({
      run: { id: runId, resultHash },
      profile: expect.objectContaining({ contractType: 'INDEFINITE' }),
      versions: expect.objectContaining({ sourceHash, inputHash, configurationHash: configHash }),
      components: expect.arrayContaining([
        { key: 'gross_salary', amount: '5500.00' },
        { key: 'wage_tax', amount: '1577.17' },
        { key: 'net_salary', amount: '3922.83' },
      ]),
    }))
    expect(payrunRepository.insertArtifact).toHaveBeenCalledWith(
      expect.any(Object),
      '50000000-0000-4000-8000-000000000001',
      expect.objectContaining({ artifact_type: 'PAYSLIP_PDF', content_type: 'application/pdf' }),
      pdfBytes,
    )
    expect(artifact.artifact_type).toBe('PAYSLIP_PDF')
  })

  it('passes the excluded-pension boundary into the PDF presentation', async () => {
    const { artifacts, configVersion, dependencies, payrunRepository } = fixture(undefined, kinderopvangEmployeeId)
    const reasonCode = 'PFZW_2026_MONTHLY_ALLOCATION_AND_NEW_JOINER_BASIS_UNVERIFIED'
    artifacts.sourceSnapshot.source_payload = {
      employment: { contractType: 'INDEFINITE' },
      payrollOwned: { pension: { status: 'EXCLUDED_SOURCE_GAP', reasonCode } },
    }
    configVersion.config_json = { pension: { mode: 'EXCLUDED_SOURCE_GAP', reasonCode } }

    await createPayrun01PayslipPdfArtifact({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId: kinderopvangEmployeeId,
      kind: 'KINDEROPVANG_TEST',
      runId,
    }, dependencies)

    expect(payrunRepository.getAssignmentVersion).toHaveBeenCalledWith(
      expect.any(Object),
      '50000000-0000-4000-8000-000000000001',
      expect.any(String),
      5,
    )
    expect(payrunRepository.getCalculationConfigVersion).toHaveBeenCalledWith(
      expect.any(Object),
      '50000000-0000-4000-8000-000000000001',
      employmentId,
      42,
    )

    expect(renderPdf).toHaveBeenCalledWith(expect.objectContaining({
      profile: expect.objectContaining({ pensionTreatment: 'EXCLUDED_SOURCE_GAP' }),
    }))
  })

  it('marks unresolved pension component amounts as excluded in the technical JSON artifact', async () => {
    const { artifacts, dependencies } = fixture(undefined, kinderopvangEmployeeId)
    const reasonCode = 'PFZW_2026_MONTHLY_ALLOCATION_AND_NEW_JOINER_BASIS_UNVERIFIED'
    artifacts.sourceSnapshot.source_payload = {
      payrollOwned: { pension: { status: 'EXCLUDED_SOURCE_GAP', reasonCode } },
    }
    const artifact = await createPayrun01TechnicalJsonArtifact({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId: kinderopvangEmployeeId,
      kind: 'KINDEROPVANG_TEST',
      runId,
    }, dependencies)
    const payload = JSON.parse(Buffer.from(artifact.artifact_bytes).toString('utf8')) as {
      result: {
        pensionBoundary: { status: string; amountIncluded: boolean; reasonCode: string | null }
        components: Array<{ key: string; payload: { amount: string | null; status?: string; reasonCode?: string | null } }>
      }
    }

    expect(payload.result.pensionBoundary).toEqual({
      status: 'EXCLUDED_SOURCE_GAP',
      amountIncluded: false,
      reasonCode,
    })
    for (const key of ['employee_pension', 'employer_pension']) {
      expect(payload.result.components.find((component) => component.key === key)?.payload).toMatchObject({
        amount: null,
        status: 'EXCLUDED_SOURCE_GAP',
        reasonCode,
      })
    }
  })

  it('carries explicit correction lineage into persisted JSON and PDF artifact provenance', async () => {
    const { inputReference, payrunRepository, dependencies } = fixture(undefined, kinderopvangEmployeeId)
    const supersession = {
      kind: 'CORRECTION_SUCCESSOR',
      successorConfigVersionId: configId,
      successorConfigVersion: 42,
      supersedesConfigVersionId: '70000000-0000-4000-8000-000000000003',
      supersedesConfigVersion: 41,
      reasonCode: 'CORRECTED_PAYROLL_INPUT',
      supersedesRunId: '70000000-0000-4000-8000-000000000004',
      supersedesInputSetId: '80000000-0000-4000-8000-000000000002',
      supersedesInputHash: '1'.repeat(64),
      supersedesResultHash: '2'.repeat(64),
      supersedesSourceSnapshotId: '90000000-0000-4000-8000-000000000002',
      supersedesSourceHash: '3'.repeat(64),
      successorInputSetId: '80000000-0000-4000-8000-000000000001',
      successorInputHash: inputHash,
      successorSourceSnapshotId: '90000000-0000-4000-8000-000000000001',
      successorSourceHash: sourceHash,
    }
    inputReference.input_provenance_json.supersession = supersession

    const jsonArtifact = await createPayrun01TechnicalJsonArtifact({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId: kinderopvangEmployeeId,
      kind: 'KINDEROPVANG_TEST',
      runId,
    }, dependencies)
    const payload = JSON.parse(Buffer.from(jsonArtifact.artifact_bytes).toString('utf8')) as { supersession: typeof supersession }

    expect(payload.supersession).toEqual(supersession)
    expect(jsonArtifact.provenance_json).toMatchObject({ supersession })

    await createPayrun01PayslipPdfArtifact({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId: kinderopvangEmployeeId,
      kind: 'KINDEROPVANG_TEST',
      runId,
    }, dependencies)
    expect(payrunRepository.insertArtifact).toHaveBeenLastCalledWith(
      expect.any(Object),
      '50000000-0000-4000-8000-000000000001',
      expect.objectContaining({ provenance_json: expect.objectContaining({ supersession }) }),
      pdfBytes,
    )
  })

  it('rejects PDF creation until the same run has concept, review, and finalization events', async () => {
    const { payrunRepository, dependencies } = fixture([{ calculation_run_id: runId, event_type: 'CONCEPT', event_sequence: 1 }])

    await expect(createPayrun01PayslipPdfArtifact({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId,
      kind: 'DEMO_COMPANY_TEST',
      runId,
    }, dependencies)).rejects.toMatchObject({ code: 'PAYROLL_INPUT_INVALID' })
    expect(renderPdf).not.toHaveBeenCalled()
    expect(payrunRepository.insertArtifact).not.toHaveBeenCalled()
  })
})
