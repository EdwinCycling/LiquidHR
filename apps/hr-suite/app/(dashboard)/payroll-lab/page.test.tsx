import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthorizationError } from '@/lib/auth/permissions'
import { redirect } from 'next/navigation'
import PayrollLabPage from './calculations/page'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string): never => { throw new Error(`redirect:${path}`) }),
}))

vi.mock('@/lib/auth/permissions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/permissions')>()),
  requirePermission: vi.fn(),
}))

vi.mock('@/lib/payroll/access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/payroll/access')>()),
  resolvePayrollLabAdministration: vi.fn(),
}))

vi.mock('@/lib/payroll/nl-2026-calculation-service', () => ({ getLatestNl2026Payroll: vi.fn() }))
vi.mock('@/lib/payroll/synthetic-calculation-service', () => ({ getLatestSyntheticPayroll: vi.fn() }))
vi.mock('./actions', () => ({ runNl2026PayrollAction: vi.fn(), runSyntheticPayrollAction: vi.fn() }))

vi.mock('@/lib/i18n/server', () => ({
  getLocale: vi.fn(async () => 'nl'),
  getTranslator: vi.fn(async () => (key: string) => ({
    payrollLabTestEmployee: 'PAYLAB Test Employee',
    payrollLabDeductions: 'Inhoudingen',
    payrollLabEmployerCosts: 'Werkgever',
    payrollLabAmountGrossSalary: 'Bruto salaris',
    payrollLabAmountEmployeePension: 'Werknemerspensioen',
    payrollLabAmountWageTax: 'Loonheffing',
    payrollLabAmountNetSalary: 'Netto salaris',
    payrollLabAmountEmployerPension: 'Werkgeverspensioen',
    payrollLabAmountEmployerInsurance: 'Werkgeversverzekeringen',
    payrollLabAmountEmployerZvw: 'Werkgeversbijdrage Zvw',
    payrollLabAmountHolidayAllowanceAccrual: 'Opbouw vakantiegeld',
    payrollLabAmountTotalEmployerCost: 'Totale werkgeverslasten',
    payrollLabNl2026Run: 'Bereken NL-2026 test payroll',
    payrollLabGcNl001Run: 'Bereken synthetische case GC-NL-001',
    payrollLabGcNl001Description: 'Synthetische GC-NL-001-testcase. Geen fiscale NL-2026-berekening.',
    payrollLabNl2026Description: 'Nederlandse wettelijke loonheffing voor 2026.',
    payrollLabCaseSelector: 'Payrollcase selecteren',
    payrollLabViewNl2026: 'NL-2026-berekening',
    payrollLabViewGcNl001: 'GC-NL-001 (synthetisch)',
    payrollLabRequestedRunUnavailable: 'De gevraagde berekening is niet beschikbaar voor deze case.',
  }[key] ?? key)),
}))

import { requirePermission } from '@/lib/auth/permissions'
import { resolvePayrollLabAdministration } from '@/lib/payroll/access'
import { getLatestNl2026Payroll } from '@/lib/payroll/nl-2026-calculation-service'
import { getLatestSyntheticPayroll } from '@/lib/payroll/synthetic-calculation-service'

const hrAdminContext = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  hrGroupId: '10000000-0000-4000-8000-000000000002',
  administrationId: '10000000-0000-4000-8000-000000000003',
  userId: '20000000-0000-4000-8000-000000000005',
  employeeId: null,
  activeRoles: ['HR_ADMIN'],
  permissions: ['salary:read', 'salary:write'],
}

const payrollAdministration = {
  id: '30000000-0000-4000-8000-000000000004',
  displayName: 'Synthetic Payroll Lab',
  capabilityEnabled: true,
  status: 'ACTIVE' as const,
}

const syntheticResult = {
  runId: '40000000-0000-4000-8000-000000000001',
  status: 'SUCCEEDED',
  runType: 'GOLDEN_CASE',
  payrollAdministrationId: payrollAdministration.id,
  payrollPeriod: { year: 2026, month: 9 },
  employeeId: '50000000-0000-4000-8000-000000000009',
  sourceHash: 'a'.repeat(64),
  inputHash: 'b'.repeat(64),
  resultHash: 'c'.repeat(64),
  components: [
    ['gross_salary', '4000.00'],
    ['taxable_wage', '4000.00'],
    ['wage_tax', '818.67'],
    ['net_salary', '3181.33'],
  ].map(([key, amount]) => ({ key, amount, payload: { output: amount } })),
  trace: [{ sequence: 1, componentCode: 'GC-NL-001' }],
  controls: [{ key: 'NET_PAYABLE_MATCHES', status: 'PASS', details: { actual: '3181.00' } }],
  startedAt: '2026-09-30T10:00:00.000Z',
  finishedAt: '2026-09-30T10:00:01.000Z',
  createdAt: '2026-09-30T10:00:00.000Z',
  errorCode: null,
  caseKey: 'CC-NL-2026-001',
}

const gcNl001Result = {
  ...syntheticResult,
  runId: '40000000-0000-4000-8000-000000000002',
  caseKey: 'GC-NL-001',
  components: [
    ['gross_salary', '4000.00'],
    ['employee_pension', '125.00'],
    ['wage_tax', '700.00'],
    ['net_salary', '3175.00'],
    ['employer_pension', '250.00'],
    ['employer_insurance', '400.00'],
    ['employer_zvw', '260.00'],
    ['holiday_allowance_accrual', '320.00'],
    ['total_employer_cost', '4910.00'],
  ].map(([key, amount]) => ({ key, amount, payload: { output: amount } })),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getLatestNl2026Payroll).mockResolvedValue(null)
  vi.mocked(getLatestSyntheticPayroll).mockResolvedValue(null)
})

describe('Payroll Lab protected shell route', () => {
  it('rejects direct visits without salary:read', async () => {
    vi.mocked(requirePermission).mockRejectedValue(new AuthorizationError('forbidden'))

    await expect(PayrollLabPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('redirect:/geen-toegang')
    expect(requirePermission).toHaveBeenCalledWith('salary:read')
    expect(resolvePayrollLabAdministration).not.toHaveBeenCalled()
    expect(redirect).toHaveBeenCalledWith('/geen-toegang')
  })

  it('rejects direct visits when the global flag or administration capability denies access', async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      tenantId: '11111111-1111-4111-8111-111111111111',
      hrGroupId: '22222222-2222-4222-8222-222222222222',
      administrationId: '33333333-3333-4333-8333-333333333333',
      userId: '44444444-4444-4444-8444-444444444444',
      employeeId: null,
      activeRoles: ['HR_ADMIN'],
      permissions: ['salary:read'],
    })
    vi.mocked(resolvePayrollLabAdministration).mockResolvedValue(null)

    await expect(PayrollLabPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('redirect:/geen-toegang')
    expect(resolvePayrollLabAdministration).toHaveBeenCalled()
    expect(redirect).toHaveBeenCalledWith('/geen-toegang')
  })

  it('shows the NL 2026 statutory amounts and scoped run details to an authorized Payroll admin', async () => {
    vi.mocked(requirePermission).mockResolvedValue(hrAdminContext)
    vi.mocked(resolvePayrollLabAdministration).mockResolvedValue(payrollAdministration)
    vi.mocked(getLatestNl2026Payroll).mockResolvedValue(syntheticResult as never)

    const page = await PayrollLabPage({ searchParams: Promise.resolve({}) })
    const markup = renderToStaticMarkup(page)

    expect(requirePermission).toHaveBeenCalledWith('salary:read')
    expect(getLatestNl2026Payroll).toHaveBeenCalledWith({
      tenantId: hrAdminContext.tenantId,
      hrGroupId: hrAdminContext.hrGroupId,
      administrationId: hrAdminContext.administrationId,
    }, payrollAdministration.id, undefined)
    for (const [key, amount] of [
      ['gross_salary', '4000.00'],
      ['taxable_wage', '4000.00'],
      ['wage_tax', '818.67'],
      ['net_salary', '3181.33'],
    ]) {
      expect(markup).toContain(key)
      expect(markup).toContain(amount)
    }
    expect(markup).toContain('payrollLabTrace')
    expect(markup).toContain('payrollLabControls')
    expect(markup).toContain('GOLDEN_CASE')
    expect(markup).toContain('PAYLAB Test Employee · September 2026')
    expect(markup).not.toContain('total_employer_cost')
    expect(markup).not.toContain('employer_pension')
    expect(markup.indexOf('PAYLAB Test Employee')).toBeLessThan(markup.indexOf('payrollLabRunStatus'))
  })

  it('keeps the statutory and synthetic actions separate and labels the selected result clearly', async () => {
    vi.mocked(requirePermission).mockResolvedValue(hrAdminContext)
    vi.mocked(resolvePayrollLabAdministration).mockResolvedValue(payrollAdministration)

    const nlPage = await PayrollLabPage({ searchParams: Promise.resolve({}) })
    const nlMarkup = renderToStaticMarkup(nlPage)
    expect(nlMarkup).toContain('Bereken NL-2026 test payroll')
    expect(nlMarkup).toContain('Bereken synthetische case GC-NL-001')
    expect(nlMarkup).toContain('Nederlandse wettelijke loonheffing voor 2026.')
    expect(nlMarkup).not.toContain('Synthetische GC-NL-001-testcase. Geen fiscale NL-2026-berekening.')

    vi.mocked(getLatestSyntheticPayroll).mockResolvedValue(gcNl001Result as never)
    const syntheticPage = await PayrollLabPage({ searchParams: Promise.resolve({ case: 'GC-NL-001' }) })
    const syntheticMarkup = renderToStaticMarkup(syntheticPage)
    expect(syntheticMarkup).toContain('Bereken NL-2026 test payroll')
    expect(syntheticMarkup).toContain('Bereken synthetische case GC-NL-001')
    expect(syntheticMarkup).toContain('Synthetische GC-NL-001-testcase. Geen fiscale NL-2026-berekening.')
    expect(syntheticMarkup).toContain('3175.00')
    expect(syntheticMarkup).toContain('4910.00')
    expect(syntheticMarkup).not.toContain('3181.33')
  })

  it('loads an exact legacy M0 run when the deep link has no case selector', async () => {
    vi.mocked(requirePermission).mockResolvedValue(hrAdminContext)
    vi.mocked(resolvePayrollLabAdministration).mockResolvedValue(payrollAdministration)
    vi.mocked(getLatestSyntheticPayroll).mockResolvedValue(gcNl001Result as never)

    const page = await PayrollLabPage({ searchParams: Promise.resolve({
      run: gcNl001Result.runId,
    }) })
    const markup = renderToStaticMarkup(page)
    const scope = {
      tenantId: hrAdminContext.tenantId,
      hrGroupId: hrAdminContext.hrGroupId,
      administrationId: hrAdminContext.administrationId,
    }

    expect(getLatestNl2026Payroll).toHaveBeenCalledWith(scope, payrollAdministration.id, gcNl001Result.runId)
    expect(getLatestSyntheticPayroll).toHaveBeenCalledWith(scope, payrollAdministration.id, gcNl001Result.runId)
    expect(markup).toContain('GC-NL-001')
    expect(markup).toContain('Synthetische GC-NL-001-testcase. Geen fiscale NL-2026-berekening.')
    expect(markup).toContain('3175.00')
    expect(markup).toContain('4910.00')
    expect(markup).not.toContain('3181.33')
    for (const [key, amount] of [
      ['gross_salary', '4000.00'],
      ['employee_pension', '125.00'],
      ['wage_tax', '700.00'],
      ['net_salary', '3175.00'],
      ['employer_pension', '250.00'],
      ['employer_insurance', '400.00'],
      ['employer_zvw', '260.00'],
      ['holiday_allowance_accrual', '320.00'],
      ['total_employer_cost', '4910.00'],
    ]) {
      expect(markup).toContain(`data-component-key="${key}"`)
      expect(markup).toContain(`data-amount="${amount}"`)
    }
    for (const label of [
      'Bruto salaris',
      'Werknemerspensioen',
      'Loonheffing',
      'Netto salaris',
      'Werkgeverspensioen',
      'Werkgeversverzekeringen',
      'Werkgeversbijdrage Zvw',
      'Opbouw vakantiegeld',
      'Totale werkgeverslasten',
    ]) expect(markup).toContain(label)
  })

  it('does not replace an explicit NL case with a matching M0 run', async () => {
    vi.mocked(requirePermission).mockResolvedValue(hrAdminContext)
    vi.mocked(resolvePayrollLabAdministration).mockResolvedValue(payrollAdministration)
    vi.mocked(getLatestSyntheticPayroll).mockResolvedValue(gcNl001Result as never)

    const page = await PayrollLabPage({ searchParams: Promise.resolve({
      case: 'CC-NL-2026-001',
      run: gcNl001Result.runId,
    }) })
    const markup = renderToStaticMarkup(page)

    expect(getLatestNl2026Payroll).toHaveBeenCalledWith({
      tenantId: hrAdminContext.tenantId,
      hrGroupId: hrAdminContext.hrGroupId,
      administrationId: hrAdminContext.administrationId,
    }, payrollAdministration.id, gcNl001Result.runId)
    expect(getLatestSyntheticPayroll).not.toHaveBeenCalled()
    expect(markup).toContain('De gevraagde berekening is niet beschikbaar voor deze case.')
    expect(markup).toContain('Nederlandse wettelijke loonheffing voor 2026.')
    expect(markup).not.toContain('Synthetische GC-NL-001-testcase. Geen fiscale NL-2026-berekening.')
    expect(markup).not.toContain('3175.00')
    expect(markup).not.toContain('4910.00')
  })

  it('does not substitute a different latest NL run when the requested exact id is absent', async () => {
    vi.mocked(requirePermission).mockResolvedValue(hrAdminContext)
    vi.mocked(resolvePayrollLabAdministration).mockResolvedValue(payrollAdministration)
    vi.mocked(getLatestNl2026Payroll).mockResolvedValue(syntheticResult as never)
    vi.mocked(getLatestSyntheticPayroll).mockResolvedValue(gcNl001Result as never)

    const page = await PayrollLabPage({ searchParams: Promise.resolve({
      case: 'CC-NL-2026-001',
      run: '90000000-0000-4000-8000-000000000009',
    }) })
    const markup = renderToStaticMarkup(page)
    const scope = {
      tenantId: hrAdminContext.tenantId,
      hrGroupId: hrAdminContext.hrGroupId,
      administrationId: hrAdminContext.administrationId,
    }

    expect(getLatestNl2026Payroll).toHaveBeenCalledWith(scope, payrollAdministration.id, '90000000-0000-4000-8000-000000000009')
    expect(getLatestSyntheticPayroll).not.toHaveBeenCalled()
    expect(markup).toContain('De gevraagde berekening is niet beschikbaar voor deze case.')
    expect(markup).toContain('90000000-0000-4000-8000-000000000009')
    expect(markup).not.toContain('40000000-0000-4000-8000-000000000001')
    expect(markup).not.toContain('40000000-0000-4000-8000-000000000002')
    expect(markup).not.toContain('3181.33')
    expect(markup).not.toContain('3175.00')
    expect(markup).not.toContain('4910.00')
  })

  it('shows a scoped failed run code and reference without exposing raw service details', async () => {
    vi.mocked(requirePermission).mockResolvedValue(hrAdminContext)
    vi.mocked(resolvePayrollLabAdministration).mockResolvedValue(payrollAdministration)
    vi.mocked(getLatestNl2026Payroll).mockResolvedValue({
      ...syntheticResult,
      status: 'FAILED',
      errorCode: 'PAYROLL_CALCULATION_FAILED',
    } as never)

    const page = await PayrollLabPage({ searchParams: Promise.resolve({
      error: 'PAYROLL_CALCULATION_FAILED',
      run: syntheticResult.runId,
    }) })
    const markup = renderToStaticMarkup(page)

    expect(getLatestNl2026Payroll).toHaveBeenCalledWith({
      tenantId: hrAdminContext.tenantId,
      hrGroupId: hrAdminContext.hrGroupId,
      administrationId: hrAdminContext.administrationId,
    }, payrollAdministration.id, syntheticResult.runId)
    expect(getLatestSyntheticPayroll).toHaveBeenCalledWith({
      tenantId: hrAdminContext.tenantId,
      hrGroupId: hrAdminContext.hrGroupId,
      administrationId: hrAdminContext.administrationId,
    }, payrollAdministration.id, syntheticResult.runId)
    expect(markup).toContain('PAYROLL_CALCULATION_FAILED')
    expect(markup).toContain(syntheticResult.runId)
    expect(markup).not.toContain('private database detail')
  })

  it('does not render the run action for an actor with read access only', async () => {
    vi.mocked(requirePermission).mockResolvedValue({ ...hrAdminContext, permissions: ['salary:read'] })
    vi.mocked(resolvePayrollLabAdministration).mockResolvedValue(payrollAdministration)
    vi.mocked(getLatestNl2026Payroll).mockResolvedValue(null)

    const page = await PayrollLabPage({ searchParams: Promise.resolve({}) })
    const markup = renderToStaticMarkup(page)

    expect(markup).not.toContain('form')
    expect(markup).toContain('payrollLabEmptyTitle')
  })
})
