import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { AuthorizationError, getPayrollProfessionalRun, getArtifactStatus, getTranslator, getLocale, notFound } = vi.hoisted(() => {
  class AuthorizationError extends Error {}
  return {
    AuthorizationError,
    getPayrollProfessionalRun: vi.fn(),
    getArtifactStatus: vi.fn(),
    getTranslator: vi.fn(),
    getLocale: vi.fn(),
    notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }),
  }
})

vi.mock('next/navigation', () => ({ notFound }))
vi.mock('@/lib/auth/permissions', () => ({ AuthorizationError }))
vi.mock('@/lib/i18n/server', () => ({ getTranslator, getLocale }))
vi.mock('@/lib/payroll/payroll-professional-service', () => ({
  getPayrollProfessionalPayslipPdfArtifactStatusForRun: getArtifactStatus,
  getPayrollProfessionalRun,
}))
vi.mock('@/components/payroll/payroll-professional-view', () => ({ PayrollRunReconciliation: () => null }))
vi.mock('../actions', () => ({ finalizePayrollRun: vi.fn(), generatePayrollPayslipPdfArtifact: vi.fn(), reviewPayrollRun: vi.fn() }))

import PayrollRunDetailPage from './page'

describe('Payroll run detail page authorization', () => {
  beforeEach(() => {
    getPayrollProfessionalRun.mockReset()
    getArtifactStatus.mockReset()
    getTranslator.mockReset().mockResolvedValue((key: string) => key)
    getLocale.mockReset().mockResolvedValue('nl')
    notFound.mockClear()
  })

  it('returns not found when the authenticated actor lacks payroll access', async () => {
    getPayrollProfessionalRun.mockRejectedValue(new AuthorizationError('PAYROLL_UNAVAILABLE'))

    await expect(PayrollRunDetailPage({
      params: Promise.resolve({ runId: 'run-outside-scope' }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow('NEXT_NOT_FOUND')

    expect(notFound).toHaveBeenCalledOnce()
  })

  it('offers a concept payslip to HR while keeping source and run identifiers out of visible copy', async () => {
    const runId = '10000000-0000-4000-8000-000000000001'
    const sourceEmployeeId = '90000000-0000-4000-8000-000000000009'
    getPayrollProfessionalRun.mockResolvedValue({
      run: { id: runId, status: 'SUCCEEDED', result_hash: 'b'.repeat(64) },
      sourceSnapshot: { source_employee_id: sourceEmployeeId, source_employment_id: '80000000-0000-4000-8000-000000000008', source_hash: 'a'.repeat(64), source_payload: {} },
      inputSet: { input_hash: 'c'.repeat(64), engine_version: 'payroll-engine-2026.1', rule_package_composition_id: 'NL-2026' },
      payrollPeriod: { period_year: 2026, period_month: 10 },
      lifecycleEvents: [{ id: 'event', calculation_run_id: runId, event_type: 'CONCEPT', event_sequence: 1, revision: 1, created_at: '2026-10-01T00:00:00.000Z' }],
      controls: [{ control_key: 'CONTROL', status: 'PASS', detail_payload: {} }],
      componentResults: [],
      trace: null,
      employeeName: 'Lisa Medewerker',
      canTransition: true,
      hasGenericInputReference: true,
      hasPayslipPdfArtifact: false,
    })

    const markup = renderToStaticMarkup(await PayrollRunDetailPage({
      params: Promise.resolve({ runId }),
      searchParams: Promise.resolve({}),
    }))

    expect(markup).toContain('Lisa Medewerker')
    expect(markup).toContain('viewConceptPayslip')
    expect(markup).toContain(`/api/payroll/runs/${runId}/payslip-concept-preview`)
    const visibleMarkup = markup.replace(/<input\b[^>]*>/g, '')
    expect(visibleMarkup).not.toContain(`>Run-ID: ${runId}<`)
    expect(visibleMarkup).not.toContain(sourceEmployeeId.slice(-8))
  })

  it('hides the concept preview action when controls are not complete', async () => {
    const runId = '10000000-0000-4000-8000-000000000001'
    getPayrollProfessionalRun.mockResolvedValue({
      run: { id: runId, status: 'SUCCEEDED', result_hash: 'b'.repeat(64) },
      sourceSnapshot: { source_employee_id: '90000000-0000-4000-8000-000000000009', source_employment_id: '80000000-0000-4000-8000-000000000008', source_hash: 'a'.repeat(64), source_payload: {} },
      inputSet: { input_hash: 'c'.repeat(64), engine_version: 'payroll-engine-2026.1', rule_package_composition_id: 'NL-2026' },
      payrollPeriod: { period_year: 2026, period_month: 10 },
      lifecycleEvents: [{ id: 'event', calculation_run_id: runId, event_type: 'CONCEPT', event_sequence: 1, revision: 1, created_at: '2026-10-01T00:00:00.000Z' }],
      controls: [{ control_key: 'CONTROL', status: 'WARN', detail_payload: {} }],
      componentResults: [],
      trace: null,
      employeeName: 'Lisa Medewerker',
      canTransition: true,
      hasGenericInputReference: true,
      hasPayslipPdfArtifact: false,
    })

    const markup = renderToStaticMarkup(await PayrollRunDetailPage({
      params: Promise.resolve({ runId }),
      searchParams: Promise.resolve({}),
    }))

    expect(markup).not.toContain('viewConceptPayslip')
  })
})
