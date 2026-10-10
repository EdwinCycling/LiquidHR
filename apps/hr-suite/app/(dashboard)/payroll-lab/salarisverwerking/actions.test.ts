import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthenticationError } from '@/lib/auth/permissions'
import {
  finalizePayrun01Action,
  generatePayrun01PayslipPdfAction,
  generatePayrun01TechnicalJsonAction,
  reviewPayrun01Action,
  runPayrun01Action,
} from './actions'

const PERSON_ID = '79091d14-ef66-41fe-a2d5-92df108727e5'
const OTHER_PERSON_ID = '64ad3a23-f59a-4ed0-af41-26dda20ff067'
const RUN_ID = '40000000-0000-4000-8000-000000000001'

const { access, runPayroll, reviewPayroll, finalizePayroll, createArtifact, createPdfArtifact, revalidate } = vi.hoisted(() => ({
  access: vi.fn(),
  runPayroll: vi.fn(),
  reviewPayroll: vi.fn(),
  finalizePayroll: vi.fn(),
  createArtifact: vi.fn(),
  createPdfArtifact: vi.fn(),
  revalidate: vi.fn(),
}))

vi.mock('@/lib/payroll/component-library-access', () => ({ requireComponentLibraryAccess: access }))
vi.mock('@/lib/payroll/payrun01-service', () => ({
  runPayrun01Payroll: runPayroll,
  reviewPayrun01Payroll: reviewPayroll,
  finalizePayrun01Payroll: finalizePayroll,
  createPayrun01TechnicalJsonArtifact: createArtifact,
  createPayrun01PayslipPdfArtifact: createPdfArtifact,
  payrun01PeriodFromKey: (period: string, kind: string) => period === '2026-10' || (period === '2026-09' && kind === 'KINDEROPVANG_TEST')
    ? { year: 2026, month: Number(period.slice(-2)) }
    : null,
  payrun01PeriodKey: (period: { year: number; month: number }) => `${period.year}-${String(period.month).padStart(2, '0')}`,
  payrun01ScenarioForTestPersona: (employeeId: string) => {
    if (employeeId === PERSON_ID) return 'KINDEROPVANG_TEST'
    if (employeeId === OTHER_PERSON_ID) return 'DEMO_COMPANY_TEST'
    return null
  },
}))
vi.mock('@/lib/payroll/synthetic-calculation-service', () => ({
  SyntheticPayrollServiceError: class SyntheticPayrollServiceError extends Error {
    constructor(readonly code: string) { super(code) }
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: revalidate }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`) } }))

function makeForm(fields: readonly (readonly [string, string])[]): FormData {
  const formData = new FormData()
  for (const [key, value] of fields) formData.append(key, value)
  return formData
}

const runForm = () => makeForm([
  ['employeeId', PERSON_ID],
  ['scenarioKind', 'KINDEROPVANG_TEST'],
  ['period', '2026-10'],
])

const lifecycleForm = () => makeForm([
  ['employeeId', PERSON_ID],
  ['scenarioKind', 'KINDEROPVANG_TEST'],
  ['period', '2026-10'],
  ['runId', RUN_ID],
])

describe('PAYRUN01 server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    access.mockResolvedValue({
      scope: { tenantId: 'tenant', hrGroupId: 'group', administrationId: 'administration' },
      administration: { id: 'payroll-administration' },
      actorUserId: 'authenticated-actor',
      canCopy: true,
    })
    runPayroll.mockResolvedValue({ runId: RUN_ID, status: 'SUCCEEDED' })
    reviewPayroll.mockResolvedValue(undefined)
    finalizePayroll.mockResolvedValue(undefined)
    createArtifact.mockResolvedValue({ artifact_type: 'TECHNICAL_JSON' })
    createPdfArtifact.mockResolvedValue({ artifact_type: 'PAYSLIP_PDF' })
  })

  it('rejects additional and repeated fields before resolving access', async () => {
    const extraField = makeForm([
      ['employeeId', PERSON_ID],
      ['scenarioKind', 'KINDEROPVANG_TEST'],
      ['actorUserId', 'forged-actor'],
    ])
    await expect(runPayrun01Action(extraField)).rejects.toThrow('redirect:/payroll-lab/salarisverwerking?error=invalid-input')

    const duplicateField = makeForm([
      ['employeeId', PERSON_ID],
      ['employeeId', OTHER_PERSON_ID],
      ['scenarioKind', 'KINDEROPVANG_TEST'],
    ])
    await expect(runPayrun01Action(duplicateField)).rejects.toThrow('redirect:/payroll-lab/salarisverwerking?error=invalid-input')
    expect(access).not.toHaveBeenCalled()
  })

  it('derives scope, administration, and actor from the authenticated access guard', async () => {
    await expect(runPayrun01Action(runForm())).rejects.toThrow(
      `redirect:/payroll-lab/salarisverwerking?employee=${PERSON_ID}&event=run&run=${RUN_ID}&period=2026-10`,
    )

    expect(access).toHaveBeenCalledWith(true)
    expect(runPayroll).toHaveBeenCalledWith({
      scope: { tenantId: 'tenant', hrGroupId: 'group', administrationId: 'administration' },
      payrollAdministrationId: 'payroll-administration',
      actorUserId: 'authenticated-actor',
      employeeId: PERSON_ID,
      kind: 'KINDEROPVANG_TEST',
      period: { year: 2026, month: 10 },
    })
    expect(revalidate).toHaveBeenCalledWith('/payroll-lab/salarisverwerking')
  })

  it.each([
    ['review', reviewPayrun01Action, reviewPayroll, 'reviewed'],
    ['finalize', finalizePayrun01Action, finalizePayroll, 'finalized'],
  ] as const)('uses the access guard and exact run reference for %s', async (_name, action, service, event) => {
    await expect(action(lifecycleForm())).rejects.toThrow(
      `redirect:/payroll-lab/salarisverwerking?employee=${PERSON_ID}&event=${event}&run=${RUN_ID}&period=2026-10`,
    )
    expect(access).toHaveBeenCalledWith(true)
    expect(service).toHaveBeenCalledWith({
      scope: { tenantId: 'tenant', hrGroupId: 'group', administrationId: 'administration' },
      payrollAdministrationId: 'payroll-administration',
      actorUserId: 'authenticated-actor',
      employeeId: PERSON_ID,
      kind: 'KINDEROPVANG_TEST',
      runId: RUN_ID,
    })
  })

  it('generates technical JSON only through the authorized scoped lifecycle service', async () => {
    await expect(generatePayrun01TechnicalJsonAction(lifecycleForm())).rejects.toThrow(
      `redirect:/payroll-lab/salarisverwerking?employee=${PERSON_ID}&event=artifact&run=${RUN_ID}&period=2026-10&artifact=TECHNICAL_JSON`,
    )
    expect(access).toHaveBeenCalledWith(true)
    expect(createArtifact).toHaveBeenCalledWith({
      scope: { tenantId: 'tenant', hrGroupId: 'group', administrationId: 'administration' },
      payrollAdministrationId: 'payroll-administration',
      actorUserId: 'authenticated-actor',
      employeeId: PERSON_ID,
      kind: 'KINDEROPVANG_TEST',
      runId: RUN_ID,
    })
  })

  it('generates the TEST payslip PDF only through the authorized scoped lifecycle service', async () => {
    await expect(generatePayrun01PayslipPdfAction(lifecycleForm())).rejects.toThrow(
      `redirect:/payroll-lab/salarisverwerking?employee=${PERSON_ID}&event=artifact&run=${RUN_ID}&period=2026-10&artifact=PAYSLIP_PDF`,
    )
    expect(access).toHaveBeenCalledWith(true)
    expect(createPdfArtifact).toHaveBeenCalledWith({
      scope: { tenantId: 'tenant', hrGroupId: 'group', administrationId: 'administration' },
      payrollAdministrationId: 'payroll-administration',
      actorUserId: 'authenticated-actor',
      employeeId: PERSON_ID,
      kind: 'KINDEROPVANG_TEST',
      runId: RUN_ID,
    })
  })

  it('maps authentication errors to the login route without exposing details', async () => {
    access.mockRejectedValue(new AuthenticationError())
    await expect(runPayrun01Action(runForm())).rejects.toThrow('redirect:/login')
  })
})
