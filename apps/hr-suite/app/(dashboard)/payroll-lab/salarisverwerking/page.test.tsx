import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Payrun01Page from './page'

const PERSON_ID = '66ef22a5-5777-44dc-9bde-44a65d0a6d60'
const RUN_ID = '40000000-0000-4000-8000-000000000001'

const { access, candidates, latestPayroll, lifecycle, technicalJson, payslipPdf, redirect } = vi.hoisted(() => ({
  access: vi.fn(),
  candidates: vi.fn(),
  latestPayroll: vi.fn(),
  lifecycle: vi.fn(),
  technicalJson: vi.fn(),
  payslipPdf: vi.fn(),
  redirect: vi.fn((path: string): never => { throw new Error(`redirect:${path}`) }),
}))

vi.mock('@/lib/payroll/component-library-access', () => ({ requireComponentLibraryAccess: access }))
vi.mock('@/lib/payroll/payrun01-service', () => ({
  getLatestPayrun01Payroll: latestPayroll,
  getPayrun01Lifecycle: lifecycle,
  getPayrun01TechnicalJsonArtifact: technicalJson,
  getPayrun01PayslipPdfArtifactForRun: payslipPdf,
  listPayrun01Candidates: candidates,
}))
vi.mock('@/lib/i18n/server', () => ({
  getLocale: vi.fn(async () => 'en'),
  getTranslator: vi.fn(async () => (key: string) => key),
}))
vi.mock('./actions', () => ({
  finalizePayrun01Action: vi.fn(),
  generatePayrun01PayslipPdfAction: vi.fn(),
  generatePayrun01TechnicalJsonAction: vi.fn(),
  reviewPayrun01Action: vi.fn(),
  runPayrun01Action: vi.fn(),
}))
vi.mock('next/navigation', () => ({ redirect }))

const latest = {
  runId: RUN_ID,
  status: 'SUCCEEDED',
  runType: 'INDIVIDUAL_PAYROLL',
  payrollAdministrationId: 'payroll-administration',
  employeeId: PERSON_ID,
  sourceSnapshotId: 'source-snapshot',
  inputSetId: 'input-set',
  sourcePayload: {},
  sourceVersionVector: { employment: 'version-1' },
  payrollPeriod: { year: 2026, month: 10 },
  sourceHash: 'a'.repeat(64),
  inputHash: 'b'.repeat(64),
  resultHash: 'c'.repeat(64),
  rulePackageCompositionId: 'PAYRUN01-KINDEROPVANG',
  engineVersion: 'engine-1',
  components: [{ key: 'NL_GROSS_WAGE', amount: '3044.44', payload: { amount: '3044.44' } }],
  trace: null,
  controls: [{ key: 'SOURCE_MATCHES_PERSONA', status: 'PASS', details: { expected: 'Jan', actual: 'Jan' } }],
  startedAt: '2026-10-01T08:00:00.000Z',
  finishedAt: '2026-10-01T08:00:02.000Z',
  createdAt: '2026-10-01T08:00:00.000Z',
  errorCode: null,
}

const lifecycleView = (eventType = 'CONCEPT') => {
  const latestEvent = {
    calculation_run_id: RUN_ID,
    event_sequence: eventType === 'FINALIZED' ? 3 : eventType === 'REVIEWED' ? 2 : 1,
    event_type: eventType,
    created_at: '2026-10-01T08:01:00.000Z',
  }
  return {
    runId: RUN_ID,
    status: 'SUCCEEDED',
    resultHash: 'c'.repeat(64),
    latestEvent,
    events: [latestEvent],
    controls: [{ key: 'SOURCE_MATCHES_PERSONA', status: 'PASS', details: {} }],
    paymentStatus: 'DOWNSTREAM_PAYMENT_NOT_ASSESSED',
    declarationStatus: 'DECLARATION_PROJECTION_OUT_OF_SCOPE',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  access.mockResolvedValue({
    scope: { tenantId: 'tenant', hrGroupId: 'group', administrationId: 'administration' },
    administration: { id: 'payroll-administration' },
    actorUserId: 'authenticated-actor',
    canCopy: true,
  })
  candidates.mockResolvedValue([{
    employeeId: PERSON_ID,
    employeeNumber: 'TEST-01',
    firstName: 'Jan',
    confirmedOctoberEmploymentCount: 1,
    scenarioKind: 'KINDEROPVANG_TEST',
  }])
  latestPayroll.mockResolvedValue(latest)
  lifecycle.mockResolvedValue(lifecycleView())
  technicalJson.mockResolvedValue(null)
  payslipPdf.mockResolvedValue(null)
})

describe('PAYRUN01 individual payroll route', () => {
  it('shows the assigned persona, period, persisted run hashes, components, controls, and separate downstream states', async () => {
    const markup = renderToStaticMarkup(await Payrun01Page({ searchParams: Promise.resolve({}) }))

    expect(markup).toContain('payrun01PeriodOctober2026')
    expect(markup).toContain('Jan')
    expect(markup).toContain('payrun01AssignmentKinderopvang')
    expect(markup).toContain(RUN_ID)
    expect(markup).toContain('a'.repeat(64))
    expect(markup).toContain('b'.repeat(64))
    expect(markup).toContain('c'.repeat(64))
    expect(markup).toContain('NL_GROSS_WAGE')
    expect(markup).toContain('payrun01ControlPass')
    expect(markup).toContain('payrun01PaymentNotAssessed')
    expect(markup).toContain('payrun01DeclarationOutOfScope')
    expect(markup).not.toContain('/artifact/PAYSLIP_PDF')
  })

  it('exposes technical JSON generation and download only after the matching run is finalized', async () => {
    lifecycle.mockResolvedValue(lifecycleView('FINALIZED'))
    const beforeGeneration = renderToStaticMarkup(await Payrun01Page({ searchParams: Promise.resolve({}) }))
    expect(beforeGeneration).toContain('payrun01GenerateTechnicalJson')
    expect(beforeGeneration).toContain('payrun01GeneratePayslipPdf')
    expect(beforeGeneration).not.toContain(`/api/payroll-lab/payrun01/${RUN_ID}/artifact/TECHNICAL_JSON`)
    expect(beforeGeneration).not.toContain(`/api/payroll-lab/payrun01/${RUN_ID}/artifact/PAYSLIP_PDF`)

    technicalJson.mockResolvedValue({ artifact_type: 'TECHNICAL_JSON' })
    const afterGeneration = renderToStaticMarkup(await Payrun01Page({ searchParams: Promise.resolve({}) }))
    expect(afterGeneration).toContain(`/api/payroll-lab/payrun01/${RUN_ID}/artifact/TECHNICAL_JSON`)
    expect(afterGeneration).toContain('payrun01DownloadTechnicalJson')
    expect(afterGeneration).not.toContain(`/api/payroll-lab/payrun01/${RUN_ID}/artifact/PAYSLIP_PDF`)

    payslipPdf.mockResolvedValue({ artifact_type: 'PAYSLIP_PDF' })
    const withPdf = renderToStaticMarkup(await Payrun01Page({ searchParams: Promise.resolve({}) }))
    expect(withPdf).toContain(`/api/payroll-lab/payrun01/${RUN_ID}/artifact/PAYSLIP_PDF`)
    expect(withPdf).toContain('payrun01DownloadPayslipPdf')
  })

  it.each([
    ['TECHNICAL_JSON', false, true],
    ['PAYSLIP_PDF', true, false],
  ] as const)('shows no artifact success when only the other artifact is available (%s)', async (requestedArtifact, technicalJsonAvailable, payslipPdfAvailable) => {
    lifecycle.mockResolvedValue(lifecycleView('FINALIZED'))
    technicalJson.mockResolvedValue(technicalJsonAvailable ? { artifact_type: 'TECHNICAL_JSON' } : null)
    payslipPdf.mockResolvedValue(payslipPdfAvailable ? { artifact_type: 'PAYSLIP_PDF' } : null)

    const markup = renderToStaticMarkup(await Payrun01Page({
      searchParams: Promise.resolve({ event: 'artifact', artifact: requestedArtifact, run: RUN_ID }),
    }))

    expect(markup).not.toContain('payrun01ArtifactGenerated')
  })

  it.each([
    ['TECHNICAL_JSON', true, false],
    ['PAYSLIP_PDF', false, true],
  ] as const)('shows artifact success only after the requested artifact is read back (%s)', async (requestedArtifact, technicalJsonAvailable, payslipPdfAvailable) => {
    lifecycle.mockResolvedValue(lifecycleView('FINALIZED'))
    technicalJson.mockResolvedValue(technicalJsonAvailable ? { artifact_type: 'TECHNICAL_JSON' } : null)
    payslipPdf.mockResolvedValue(payslipPdfAvailable ? { artifact_type: 'PAYSLIP_PDF' } : null)

    const markup = renderToStaticMarkup(await Payrun01Page({
      searchParams: Promise.resolve({ event: 'artifact', artifact: requestedArtifact, run: RUN_ID }),
    }))

    expect(markup).toContain('payrun01ArtifactGenerated')
  })
})
