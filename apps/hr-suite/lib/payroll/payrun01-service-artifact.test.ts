import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payrun01ServiceDependencies } from './payrun01-service'
import type { Payrun01Artifact, Payrun01ArtifactMetadata } from './payrun01-repository'
import type { PayrollScope } from './scope'
import type { PayrollControlStatus, PayrollJson } from './database'

const { renderPdf, pdfModuleLoads } = vi.hoisted(() => ({ renderPdf: vi.fn(), pdfModuleLoads: { count: 0 } }))
vi.mock('./payrun01-payslip-pdf', () => {
  pdfModuleLoads.count += 1
  return {
    LIQUIDHR_STANDARD_PAYSLIP_TEMPLATE_ID: 'LIQUIDHR_STANDARD_V1',
    PAYROLL_TEST_DOCUMENT_NOTICE: 'TEST / NIET VOOR UITBETALING',
    renderPayrun01PayslipPdf: renderPdf,
  }
})

import {
  createPayrun01PayslipPdfArtifact,
  createPayrun01TechnicalJsonArtifact,
  createFinalizedEmployeePayslipPdfArtifact,
  finalizePayrun01Payroll,
  getPayrun01Lifecycle,
  getPayrollProfessionalPayslipPdfArtifactForRun,
  renderFinalizedEmployeePayslipPdf,
  renderGenericEmployeePayslipConceptPdfPreview,
  renderPayrun01PayslipPdfPreviewForRun,
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
  created_at?: string
  event_payload?: Record<string, unknown>
}

const genericLifecycleEvents: LifecycleEventFixture[] = [
  { calculation_run_id: runId, event_type: 'CONCEPT', event_sequence: 1, revision: 4, id: 'concept-event', created_at: '2026-10-01T09:00:00.000Z', event_payload: { sourceHash, inputHash, resultHash } },
  { calculation_run_id: runId, event_type: 'REVIEWED', event_sequence: 2, revision: 4, id: 'review-event', created_at: '2026-10-01T10:00:00.000Z', event_payload: { sourceHash, inputHash, resultHash } },
  { calculation_run_id: runId, event_type: 'FINALIZED', event_sequence: 3, revision: 4, id: 'final-event', created_at: '2026-10-01T11:00:00.000Z', event_payload: { sourceHash, inputHash, resultHash } },
]

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
  const genericInputReference = {
    source_employee_id: sourceEmployeeId,
    source_employment_id: employmentId,
    source_hash: sourceHash,
    input_hash: inputHash,
    input_reference_json: {
      schemaVersion: 'PAYCALC-REAL-01B-COMPLETENESS-1',
      sourceHash,
      inputHash,
      incompleteComponents: [],
    },
  }
  const assignmentVersion = { id: assignmentVersionId, assignment_hash: assignmentHash, assignment_json: { payslipProfile: profile } }
  const configVersion: { id: string; config_hash: string; config_json: Record<string, unknown> } = {
    id: configId,
    config_hash: configHash,
    config_json: { pension: { mode: 'DISABLED' } },
  }
  const payrunRepository = {
    getGenericInputReference: vi.fn(async () => null),
    getInputReference: vi.fn(async () => inputReference),
    listLifecycleEvents: vi.fn(async () => events),
    insertLifecycleEvent: vi.fn(async (_scope: PayrollScope, _administrationId: string, row: Record<string, unknown>) => row),
    getAssignmentVersion: vi.fn(async () => assignmentVersion),
    getCalculationConfigVersion: vi.fn(async () => configVersion),
    getArtifact: vi.fn(async (): Promise<Payrun01Artifact | null> => null),
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
  return { artifacts, configVersion, genericInputReference, inputReference, payrunRepository, dependencies }
}

describe('PAYRUN01 lifecycle source identity', () => {
  it('does not load the Chromium PDF runtime while reading lifecycle data', async () => {
    expect(pdfModuleLoads.count).toBe(0)
    const { dependencies } = fixture([{ calculation_run_id: runId, event_type: 'CONCEPT', event_sequence: 1 }])

    await getPayrun01Lifecycle({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId,
      kind: 'DEMO_COMPANY_TEST',
      runId,
    }, dependencies)

    expect(pdfModuleLoads.count).toBe(0)
  })

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

describe('generic HR concept payslip preview', () => {
  beforeEach(() => {
    renderPdf.mockReset().mockResolvedValue(pdfBytes)
  })

  function conceptFixture(events: LifecycleEventFixture[] = [
    { calculation_run_id: runId, event_type: 'CONCEPT', event_sequence: 1, revision: 4, id: 'concept-event', created_at: '2026-10-01T09:00:00.000Z', event_payload: { sourceHash, inputHash, resultHash } },
  ]) {
    const result = fixture(events)
    result.payrunRepository.getGenericInputReference.mockResolvedValue(result.genericInputReference as never)
    result.dependencies.sourceProvider.getPayrollSourceSnapshot = vi.fn(async () => ({
      sourceEmployeeId: employeeId,
      sourceEmploymentId: employmentId,
      sourceHash,
      sourceGaps: [],
    })) as never
    return result
  }

  it('renders a current complete concept PDF in memory without storing an artifact', async () => {
    const { dependencies, payrunRepository } = conceptFixture([
      { calculation_run_id: runId, event_type: 'CONCEPT', event_sequence: 1, revision: 4, event_payload: { sourceHash, inputHash, resultHash } },
      { calculation_run_id: runId, event_type: 'REVIEWED', event_sequence: 2, revision: 4, event_payload: { sourceHash, inputHash, resultHash } },
    ])

    const preview = await renderGenericEmployeePayslipConceptPdfPreview({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId,
      runId,
      genericPayslipProfile: { employeeName: 'Lisa Medewerker', employerName: 'Retail Administratie' },
    }, dependencies)

    expect(preview).toMatchObject({
      artifact_bytes: pdfBytes,
      content_type: 'application/pdf',
      source_hash: sourceHash,
      input_hash: inputHash,
      result_hash: resultHash,
      document_hash: createHash('sha256').update(pdfBytes).digest('hex'),
    })
    expect(renderPdf).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ lifecycle: 'CONCEPT', sourceWarnings: [] }),
    }))
    expect(payrunRepository.insertArtifact).not.toHaveBeenCalled()
  })

  it('refuses a changed source and leaves the preview renderer untouched', async () => {
    const { dependencies } = conceptFixture()
    dependencies.sourceProvider.getPayrollSourceSnapshot = vi.fn(async () => ({
      sourceEmployeeId: employeeId,
      sourceEmploymentId: employmentId,
      sourceHash: 'e'.repeat(64),
      sourceGaps: [],
    })) as never

    await expect(renderGenericEmployeePayslipConceptPdfPreview({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId,
      runId,
      genericPayslipProfile: { employeeName: 'Lisa Medewerker', employerName: 'Retail Administratie' },
    }, dependencies)).rejects.toMatchObject({
      code: 'PAYROLL_INPUT_INVALID',
      reasonCode: 'PAYROLL_SOURCE_CHANGED_RECALCULATE_REQUIRED',
    })
    expect(renderPdf).not.toHaveBeenCalled()
  })

  it('refuses finalized, incomplete, or non-passing calculations', async () => {
    const finalized = conceptFixture(genericLifecycleEvents)
    await expect(renderGenericEmployeePayslipConceptPdfPreview({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId,
      runId,
      genericPayslipProfile: { employeeName: 'Lisa Medewerker', employerName: 'Retail Administratie' },
    }, finalized.dependencies)).rejects.toMatchObject({ reasonCode: 'GENERIC_PAYSLIP_LIFECYCLE_INVALID' })

    const incomplete = conceptFixture()
    incomplete.artifacts.controls[0]!.status = 'WARN'
    await expect(renderGenericEmployeePayslipConceptPdfPreview({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId,
      runId,
      genericPayslipProfile: { employeeName: 'Lisa Medewerker', employerName: 'Retail Administratie' },
    }, incomplete.dependencies)).rejects.toMatchObject({ reasonCode: 'GENERIC_PAYSLIP_REFERENCE_INVALID' })
    expect(renderPdf).not.toHaveBeenCalled()
  })
})

describe('PAYRUN01 persisted payslip PDF artifact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    renderPdf.mockResolvedValue(pdfBytes)
  })

  it('renders the finalized stored components with the standard template before inserting the artifact', async () => {
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
      presentation: { templateId: 'LIQUIDHR_STANDARD_V1' },
      data: expect.objectContaining({
        profile: expect.objectContaining({ contractType: 'INDEFINITE' }),
        components: expect.arrayContaining([
          { key: 'gross_salary', amount: '5500.00' },
          { key: 'wage_tax', amount: '1577.17' },
          { key: 'net_salary', amount: '3922.83' },
        ]),
      }),
    }))
    expect(payrunRepository.insertArtifact).toHaveBeenCalledWith(
      expect.any(Object),
      '50000000-0000-4000-8000-000000000001',
      expect.objectContaining({ artifact_type: 'PAYSLIP_PDF', content_type: 'application/pdf' }),
      pdfBytes,
    )
    expect(artifact.artifact_type).toBe('PAYSLIP_PDF')
  })

  it('returns a historical PDF unchanged without rendering or inserting a replacement', async () => {
    const { payrunRepository, dependencies } = fixture()
    const originalBytes = Buffer.from('%PDF-1.4\nhistorical payslip bytes')
    const historicalArtifact = {
      artifact_type: 'PAYSLIP_PDF',
      artifact_bytes: originalBytes,
      file_name: 'existing-payroll-payslip.pdf',
    } as unknown as Payrun01Artifact
    payrunRepository.getArtifact.mockResolvedValue(historicalArtifact)

    const artifact = await createPayrun01PayslipPdfArtifact({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId,
      kind: 'DEMO_COMPANY_TEST',
      runId,
    }, dependencies)

    expect(artifact).toBe(historicalArtifact)
    expect(Buffer.from(artifact.artifact_bytes)).toEqual(originalBytes)
    expect(renderPdf).not.toHaveBeenCalled()
    expect(payrunRepository.insertArtifact).not.toHaveBeenCalled()
  })

  it('renders an authorized preview from the finalized stored data without inserting an artifact', async () => {
    const { artifacts, dependencies, payrunRepository } = fixture()
    artifacts.sourceSnapshot.source_payload = {
      employment: { contractType: 'INDEFINITE' },
      incomeRelationship: { status: 'UNSUPPORTED' },
      payrollOwned: {
        provenance: {
          resolvedSourceGaps: [
            { field: 'taxProfile', status: 'SOURCE_GAP' },
            { field: 'incomeRelationship', status: 'UNSUPPORTED' },
          ],
        },
      },
    }

    const preview = await renderPayrun01PayslipPdfPreviewForRun({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      runId,
    }, dependencies)

    expect(preview).toMatchObject({ content_type: 'application/pdf', artifact_bytes: pdfBytes })
    expect(renderPdf).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        sourceWarnings: expect.arrayContaining([
          'Fiscale brongegevens zijn niet bevestigd in de bron.',
          'Gegevens over de inkomensverhouding zijn niet volledig bevestigd in de bron.',
        ]),
      }),
    }))
    expect(payrunRepository.insertArtifact).not.toHaveBeenCalled()
  })

  it('renders a read-only self payslip for a stored employee without a hardcoded persona lookup', async () => {
    const genericEmployeeId = 'fb7a3aa1-9b22-44f1-8d8c-d519260230bb'
    const { dependencies, payrunRepository } = fixture(undefined, genericEmployeeId)
    const rendered = await renderFinalizedEmployeePayslipPdf({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId: genericEmployeeId,
      runId,
    }, dependencies)

    expect(rendered).toMatchObject({ artifact_bytes: pdfBytes, content_type: 'application/pdf', file_name: 'liquidhr-loonstrook-2026-10.pdf' })
    expect(renderPdf).toHaveBeenCalledOnce()
    expect(payrunRepository.insertArtifact).not.toHaveBeenCalled()
  })

  it('renders a complete generic input_reference_json run with the employee-facing component allowlist', async () => {
    const genericEmployeeId = 'fb7a3aa1-9b22-44f1-8d8c-d519260230bb'
    const { artifacts, dependencies, genericInputReference, payrunRepository } = fixture(genericLifecycleEvents, genericEmployeeId)
    payrunRepository.getGenericInputReference.mockResolvedValue(genericInputReference as never)
    artifacts.componentResults.push(
      { component_key: 'contractual_salary', result_payload: { amount: '5500.00' } },
      { component_key: 'employee_insurance_base', result_payload: { amount: '5304.88' } },
      { component_key: 'zvw_base', result_payload: { amount: '5304.88' } },
      { component_key: 'net_reimbursement', result_payload: { amount: '45.00' } },
      { component_key: 'net_deduction', result_payload: { amount: '20.00' } },
      { component_key: 'net_correction', result_payload: { amount: '0.00' } },
      { component_key: 'cumulative_gross', result_payload: { amount: '55000.00' } },
      { component_key: 'cumulative_taxable_wage', result_payload: { amount: '53048.80' } },
      { component_key: 'cumulative_wage_tax', result_payload: { amount: '14773.30' } },
      { component_key: 'employer_pension', result_payload: { amount: '390.23' } },
      { component_key: 'employer_awf', result_payload: { amount: '425.70' } },
      { component_key: 'holiday_allowance_reserve', result_payload: { amount: '440.00' } },
      { component_key: 'total_employer_cost', result_payload: { amount: '7519.59' } },
    )

    const rendered = await renderFinalizedEmployeePayslipPdf({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId: genericEmployeeId,
      runId,
      genericPayslipProfile: { employeeName: 'Mars Werknemer', employerName: 'Mars Administratie' },
    }, dependencies)

    expect(rendered).toMatchObject({ artifact_bytes: pdfBytes, content_type: 'application/pdf' })
    expect(payrunRepository.listLifecycleEvents).toHaveBeenCalledWith(
      expect.any(Object), '50000000-0000-4000-8000-000000000001', artifacts.payrollPeriod.id, employmentId,
    )
    expect(payrunRepository.getInputReference).not.toHaveBeenCalled()
    expect(renderPdf).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        profile: { status: 'PAYROLL_SOURCE_PROFILE', employeeName: 'Mars Werknemer', employerName: 'Mars Administratie' },
        components: expect.arrayContaining([
          { key: 'gross_salary', amount: '5500.00' },
          { key: 'net_reimbursement', amount: '45.00' },
          { key: 'cumulative_taxable_wage', amount: '53048.80' },
        ]),
      }),
    }))
    const passedComponents = renderPdf.mock.calls.at(-1)?.[0]?.data?.components as Array<{ key: string }>
    expect(passedComponents.map(({ key }) => key)).not.toEqual(expect.arrayContaining([
      'employer_pension', 'employer_awf', 'holiday_allowance_reserve', 'total_employer_cost',
    ]))
    expect(payrunRepository.insertArtifact).not.toHaveBeenCalled()
  })

  it('persists a generic finalized payslip with run hashes and exact FINALIZED event provenance, then retries idempotently', async () => {
    const genericEmployeeId = 'fb7a3aa1-9b22-44f1-8d8c-d519260230bb'
    const { dependencies, genericInputReference, payrunRepository } = fixture(genericLifecycleEvents, genericEmployeeId)
    payrunRepository.getGenericInputReference.mockResolvedValue(genericInputReference as never)
    const pdfHash = createHash('sha256').update(pdfBytes).digest('hex')
    payrunRepository.insertArtifact.mockImplementation(async (_scope, _administrationId, metadata, bytes) => ({
      ...metadata,
      id: 'b0000000-0000-4000-8000-000000000001',
      artifact_hash: createHash('sha256').update(bytes).digest('hex'),
      artifact_bytes: Uint8Array.from(bytes),
      created_at: '2026-10-16T10:00:00.000Z',
    }))
    const input = {
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId: genericEmployeeId,
      runId,
      genericPayslipProfile: { employeeName: 'Mars Werknemer', employerName: 'Mars Administratie' },
    }

    const created = await createFinalizedEmployeePayslipPdfArtifact(input, dependencies)
    expect(created.artifact_hash).toBe(pdfHash)
    expect(created.provenance_json).toMatchObject({
      schemaVersion: 'PAYFULL02_GENERIC_PAYSLIP_PDF_V1',
      templateId: 'LIQUIDHR_STANDARD_V1',
      sourceHash,
      inputHash,
      resultHash,
      finalizedEventId: 'final-event',
      finalizedAt: '2026-10-01T11:00:00.000Z',
      sizeBytes: pdfBytes.byteLength,
      pdfHash,
    })
    expect(payrunRepository.insertArtifact).toHaveBeenCalledOnce()
    expect(payrunRepository.insertArtifact.mock.calls[0]?.[2]).toMatchObject({
      calculation_run_id: runId,
      artifact_type: 'PAYSLIP_PDF',
      content_type: 'application/pdf',
      created_by_user_id: input.actorUserId,
    })

    payrunRepository.getArtifact.mockResolvedValue(created)
    const retry = await createFinalizedEmployeePayslipPdfArtifact(input, dependencies)
    expect(retry.artifact_bytes).toEqual(created.artifact_bytes)
    expect(retry.artifact_hash).toBe(pdfHash)
    expect(payrunRepository.insertArtifact).toHaveBeenCalledOnce()
    expect(renderPdf).toHaveBeenCalledOnce()

    const readback = await getPayrollProfessionalPayslipPdfArtifactForRun({
      scope: input.scope,
      payrollAdministrationId: input.payrollAdministrationId,
      actorUserId: input.actorUserId,
      runId,
    }, dependencies)
    expect(readback?.artifact_bytes).toEqual(created.artifact_bytes)
    expect(readback?.artifact_hash).toBe(pdfHash)
  })

  it('does not persist a generic PDF for CONCEPT or lifecycle events with different source/input/result hashes', async () => {
    const genericEmployeeId = 'fb7a3aa1-9b22-44f1-8d8c-d519260230bb'
    const concept = fixture([{ calculation_run_id: runId, event_type: 'CONCEPT', event_sequence: 1, revision: 4 }], genericEmployeeId)
    concept.payrunRepository.getGenericInputReference.mockResolvedValue(concept.genericInputReference as never)
    await expect(createFinalizedEmployeePayslipPdfArtifact({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId: genericEmployeeId,
      runId,
      genericPayslipProfile: { employeeName: 'Mars Werknemer', employerName: 'Mars Administratie' },
    }, concept.dependencies)).rejects.toMatchObject({ code: 'PAYROLL_INPUT_INVALID' })
    expect(concept.payrunRepository.insertArtifact).not.toHaveBeenCalled()

    const mismatchEvents = genericLifecycleEvents.map((event) => ({
      ...event,
      event_payload: { sourceHash: 'e'.repeat(64), inputHash, resultHash },
    }))
    const mismatch = fixture(mismatchEvents, genericEmployeeId)
    mismatch.payrunRepository.getGenericInputReference.mockResolvedValue(mismatch.genericInputReference as never)
    await expect(createFinalizedEmployeePayslipPdfArtifact({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId: genericEmployeeId,
      runId,
      genericPayslipProfile: { employeeName: 'Mars Werknemer', employerName: 'Mars Administratie' },
    }, mismatch.dependencies)).rejects.toMatchObject({ code: 'PAYROLL_INPUT_INVALID' })
    expect(mismatch.payrunRepository.insertArtifact).not.toHaveBeenCalled()
    expect(renderPdf).not.toHaveBeenCalled()
  })

  it('rejects incomplete generic input references before rendering a finalized employee PDF', async () => {
    const genericEmployeeId = 'fb7a3aa1-9b22-44f1-8d8c-d519260230bb'
    const { dependencies, genericInputReference, payrunRepository } = fixture(undefined, genericEmployeeId)
    payrunRepository.getGenericInputReference.mockResolvedValue({
      ...genericInputReference,
      input_reference_json: { ...genericInputReference.input_reference_json, incompleteComponents: ['PENSION_EMPLOYEE_ALLOCATION'] },
    } as never)

    await expect(renderFinalizedEmployeePayslipPdf({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId: genericEmployeeId,
      runId,
      genericPayslipProfile: { employeeName: 'Mars Werknemer', employerName: 'Mars Administratie' },
    }, dependencies)).rejects.toMatchObject({ code: 'PAYROLL_INPUT_INVALID' })
    expect(renderPdf).not.toHaveBeenCalled()
  })

  it('does not render a generic employee PDF until that run has the complete FINALIZED lifecycle', async () => {
    const genericEmployeeId = 'fb7a3aa1-9b22-44f1-8d8c-d519260230bb'
    const { dependencies, genericInputReference, payrunRepository } = fixture([
      { calculation_run_id: runId, event_type: 'CONCEPT', event_sequence: 1, revision: 4 },
      { calculation_run_id: runId, event_type: 'REVIEWED', event_sequence: 2, revision: 4 },
    ], genericEmployeeId)
    payrunRepository.getGenericInputReference.mockResolvedValue(genericInputReference as never)

    await expect(renderFinalizedEmployeePayslipPdf({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId: genericEmployeeId,
      runId,
      genericPayslipProfile: { employeeName: 'Mars Werknemer', employerName: 'Mars Administratie' },
    }, dependencies)).rejects.toMatchObject({ code: 'PAYROLL_INPUT_INVALID' })
    expect(payrunRepository.listLifecycleEvents).toHaveBeenCalledOnce()
    expect(renderPdf).not.toHaveBeenCalled()
  })

  it('returns the existing finalized PDF unchanged when one is already stored', async () => {
    const genericEmployeeId = 'fb7a3aa1-9b22-44f1-8d8c-d519260230bb'
    const { dependencies, payrunRepository } = fixture(undefined, genericEmployeeId)
    const originalBytes = Buffer.from('%PDF-1.7\nexisting final payslip')
    payrunRepository.getArtifact.mockResolvedValue({
      calculation_run_id: runId,
      artifact_type: 'PAYSLIP_PDF',
      content_type: 'application/pdf',
      file_name: 'historical-final-payslip.pdf',
      artifact_bytes: originalBytes,
    } as unknown as Payrun01Artifact)

    const rendered = await renderFinalizedEmployeePayslipPdf({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId: genericEmployeeId,
      runId,
    }, dependencies)

    expect(Buffer.from(rendered.artifact_bytes)).toEqual(originalBytes)
    expect(renderPdf).not.toHaveBeenCalled()
    expect(payrunRepository.insertArtifact).not.toHaveBeenCalled()
  })

  it('does not render a PDF for a run without the complete finalized lifecycle', async () => {
    const genericEmployeeId = 'fb7a3aa1-9b22-44f1-8d8c-d519260230bb'
    const { dependencies, payrunRepository } = fixture([{ calculation_run_id: runId, event_type: 'CONCEPT', event_sequence: 1 }], genericEmployeeId)
    await expect(renderFinalizedEmployeePayslipPdf({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId: genericEmployeeId,
      runId,
    }, dependencies)).rejects.toMatchObject({ code: 'PAYROLL_INPUT_INVALID' })
    expect(renderPdf).not.toHaveBeenCalled()
    expect(payrunRepository.getArtifact).not.toHaveBeenCalled()
    expect(payrunRepository.insertArtifact).not.toHaveBeenCalled()
  })

  it('does not render a PDF when the selected run belongs to another employee', async () => {
    const genericEmployeeId = 'fb7a3aa1-9b22-44f1-8d8c-d519260230bb'
    const { dependencies, payrunRepository } = fixture(undefined, employeeId)
    await expect(renderFinalizedEmployeePayslipPdf({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      employeeId: genericEmployeeId,
      runId,
    }, dependencies)).rejects.toMatchObject({ code: 'PAYROLL_INPUT_INVALID' })
    expect(renderPdf).not.toHaveBeenCalled()
    expect(payrunRepository.insertArtifact).not.toHaveBeenCalled()
  })

  it('does not render a preview when the requested run is out of scope', async () => {
    const { dependencies, payrunRepository } = fixture()
    dependencies.payrollRepository.getLatestSyntheticArtifacts = vi.fn(async () => null)

    await expect(renderPayrun01PayslipPdfPreviewForRun({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      payrollAdministrationId: '50000000-0000-4000-8000-000000000001',
      actorUserId: '60000000-0000-4000-8000-000000000001',
      runId,
    }, dependencies)).rejects.toMatchObject({ code: 'PAYROLL_INPUT_INVALID' })
    expect(renderPdf).not.toHaveBeenCalled()
    expect(payrunRepository.insertArtifact).not.toHaveBeenCalled()
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
      data: expect.objectContaining({
        profile: expect.objectContaining({ pensionTreatment: 'EXCLUDED_SOURCE_GAP' }),
      }),
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
