import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { PayrollProfessionalEmployee, PayrollProfessionalPeriod } from '@/lib/payroll/payroll-professional-run-service'
import type { PayrollProfessionalPeriodSummary } from '@/lib/payroll/payroll-professional-workspace-model'

const { calculateSelected, openPeriod, recalculateEmployee } = vi.hoisted(() => ({
  calculateSelected: vi.fn(),
  openPeriod: vi.fn(),
  recalculateEmployee: vi.fn(),
}))

vi.mock('@/app/(dashboard)/payroll/runs/actions', () => ({
  calculateSelectedPayroll: calculateSelected,
  openSelectedPayrollPeriod: openPeriod,
  recalculatePayrollEmployee: recalculateEmployee,
}))

import { PayrollProfessionalRunWorkbench } from './payroll-professional-run-workbench'

const period: PayrollProfessionalPeriod = {
  key: '2026-10',
  year: 2026,
  month: 10,
  startsOn: '2026-10-01',
  endsOn: '2026-10-31',
  status: 'OPEN',
}

const summary: PayrollProfessionalPeriodSummary = {
  totalEmployees: 2,
  counts: { NOT_CALCULATED: 0, CONCEPT: 1, REVIEWED: 0, FINALIZED: 1, BLOCKED: 0 },
  grossTotal: '9000.00',
  netTotal: '6700.00',
  employerCostsTotal: '11000.00',
  employeesWithExceptions: 0,
  exceptionCount: 0,
}

const employees: readonly PayrollProfessionalEmployee[] = [
  {
    employeeId: '10000000-0000-4000-8000-000000000001',
    employmentId: '20000000-0000-4000-8000-000000000001',
    employeeNumber: 'W-001',
    employeeName: 'Concept Medewerker',
    employmentNumber: 'D-001',
    startsOn: '2024-01-01',
    endsOn: null,
    isPrimary: true,
    status: 'CONCEPT',
    technicalStatus: 'SUCCEEDED',
    businessStatus: 'CONCEPT',
    runId: '30000000-0000-4000-8000-000000000001',
    previousRunId: null,
    grossAmount: '4000.00',
    netAmount: '3000.00',
    employerCosts: '5000.00',
    lastCalculatedAt: '2026-10-10T10:00:00.000Z',
    exceptions: [],
    sourceDiagnostics: [],
    stale: false,
    correctionSuccessorRequired: false,
    canCalculate: true,
    canReview: true,
    canFinalize: false,
    canViewPayslip: false,
  },
  {
    employeeId: '10000000-0000-4000-8000-000000000002',
    employmentId: '20000000-0000-4000-8000-000000000002',
    employeeNumber: 'W-002',
    employeeName: 'Definitief',
    employmentNumber: 'D-002',
    startsOn: '2024-01-01',
    endsOn: null,
    isPrimary: true,
    status: 'FINALIZED',
    technicalStatus: 'SUCCEEDED',
    businessStatus: 'FINALIZED',
    runId: '30000000-0000-4000-8000-000000000002',
    previousRunId: null,
    grossAmount: '5000.00',
    netAmount: '3700.00',
    employerCosts: '6000.00',
    lastCalculatedAt: '2026-10-10T10:00:00.000Z',
    exceptions: [],
    sourceDiagnostics: [],
    stale: false,
    correctionSuccessorRequired: false,
    canCalculate: false,
    canReview: false,
    canFinalize: false,
    canViewPayslip: true,
  },
]

const labels: Readonly<Record<string, string>> = new Proxy({}, {
  get: (_target, key) => String(key),
})

describe('Payroll Professional monthly workbench', () => {
  it('renders period summary, separate employee statuses, responsive rows and final payslip action', () => {
    const markup = renderToStaticMarkup(<PayrollProfessionalRunWorkbench
      administrationName="Demo administratie"
      periods={[period]}
      selectedPeriod={period}
      employees={employees}
      summary={summary}
      rosterComplete
      canOpenPayrollCycle={false}
      locale="nl-NL"
      labels={labels}
    />)

    expect(markup).toContain('periodSummaryTitle')
    expect(markup).toContain('status_CONCEPT')
    expect(markup).toContain('status_FINALIZED')
    expect(markup).toContain('calculateEmployee')
    expect(markup).toContain('reviewEmployee')
    expect(markup).toContain('/api/payroll/runs/30000000-0000-4000-8000-000000000002/payslip-preview')
    expect(markup).toContain('lg:grid-cols-[minmax(14rem,1.5fr)_repeat(3,minmax(8rem,1fr))_minmax(13rem,1.1fr)]')
    expect(markup).toContain('9.000,00')
  })

  it('renders source category, safe error code and correlation ID without raw diagnostic data', () => {
    const blockedEmployee: PayrollProfessionalEmployee = {
      ...employees[0]!,
      employeeNumber: 'W-003',
      employmentNumber: 'D-003',
      employmentId: '20000000-0000-4000-8000-000000000003',
      status: 'BLOCKED',
      businessStatus: null,
      runId: null,
      exceptions: [{ kind: 'SOURCE_GAP', field: 'pension', reasonCode: 'NO_EFFECTIVE_PENSION_ASSIGNMENT' }],
      sourceDiagnostics: [
        { sourceCategory: 'pension', errorCode: 'NO_EFFECTIVE_PENSION_ASSIGNMENT', correlationId: '90000000-0000-4000-8000-000000000009' },
        { sourceCategory: 'private diagnostic', errorCode: 'raw database detail', correlationId: null },
      ],
      canReview: false,
      canFinalize: false,
      canViewPayslip: false,
    }
    const markup = renderToStaticMarkup(<PayrollProfessionalRunWorkbench
      administrationName="Demo administratie"
      periods={[period]}
      selectedPeriod={period}
      employees={[blockedEmployee]}
      summary={summary}
      rosterComplete
      canOpenPayrollCycle={false}
      locale="nl-NL"
      labels={labels}
    />)

    expect(markup).toContain('pension')
    expect(markup).toContain('NO_EFFECTIVE_PENSION_ASSIGNMENT')
    expect(markup).toContain('90000000-0000-4000-8000-000000000009')
    expect(markup).not.toContain('raw database detail')
    expect(markup).toContain('diagnosticUnavailable')
  })
})
