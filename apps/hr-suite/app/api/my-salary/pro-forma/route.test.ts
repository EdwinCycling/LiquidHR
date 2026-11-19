import { beforeEach, describe, expect, it, vi } from 'vitest'

const { calculateMySalaryProForma } = vi.hoisted(() => ({ calculateMySalaryProForma: vi.fn() }))

vi.mock('@/lib/payroll/payroll-pro-forma-service', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/payroll/payroll-pro-forma-service')>(),
  calculateMySalaryProForma,
}))

import { POST } from './route'

describe('POST /api/my-salary/pro-forma', () => {
  beforeEach(() => vi.clearAllMocks())

  it('accepts only a scenario and delegates current-user scope to the server service', async () => {
    calculateMySalaryProForma.mockResolvedValue({
      status: 'CALCULATED', sourceStatus: 'READY', scenarioType: 'SALARY_INCREASE',
      period: { year: 2026, month: 11 }, sourceHash: 'server-only-source-hash',
      baseline: { net: '100.00' }, scenario: { net: '105.00' }, difference: { net: '5.00' },
      hashes: { baselineInput: 'server-only-baseline-input', baselineResult: 'server-only-baseline-result', scenarioInput: 'server-only-scenario-input', scenarioResult: 'server-only-scenario-result' },
      traceSteps: 7, gaps: [{ field: 'protected-source-field', status: 'MISSING', reasonCode: 'PRIVATE_SOURCE_REASON' }],
    })
    const response = await POST(new Request('http://localhost:3000/api/my-salary/pro-forma', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ type: 'SALARY_INCREASE', percentage: '5' }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(calculateMySalaryProForma).toHaveBeenCalledWith({ type: 'SALARY_INCREASE', percentage: '5' })
    const body: unknown = await response.json()
    expect(body).toMatchObject({ status: 'CALCULATED', sourceStatus: 'READY', hasGaps: true })
    expect(body).not.toHaveProperty('sourceHash')
    expect(body).not.toHaveProperty('hashes')
    expect(body).not.toHaveProperty('traceSteps')
    expect(body).not.toHaveProperty('gaps')
    expect(JSON.stringify(body)).not.toContain('server-only')
    expect(JSON.stringify(body)).not.toContain('PRIVATE_SOURCE_REASON')
  })

  it('rejects employee, tenant and administration selectors before reading a source', async () => {
    const response = await POST(new Request('http://localhost:3000/api/my-salary/pro-forma', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ type: 'BONUS', amount: '250.00', employeeId: 'other', tenantId: 'other', administrationId: 'other' }),
    }))

    expect(response.status).toBe(400)
    expect(calculateMySalaryProForma).not.toHaveBeenCalled()
  })

  it('rejects malformed and oversized requests', async () => {
    const readOnlyBonus = await POST(new Request('http://localhost:3000/api/my-salary/pro-forma', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ type: 'BONUS', amount: '250.00' }),
    }))
    const malformed = await POST(new Request('http://localhost:3000/api/my-salary/pro-forma', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' }, body: '{',
    }))
    const oversized = await POST(new Request('http://localhost:3000/api/my-salary/pro-forma', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' }, body: ' '.repeat(2049),
    }))

    expect(readOnlyBonus.status).toBe(400)
    expect(malformed.status).toBe(400)
    expect(oversized.status).toBe(413)
    expect(calculateMySalaryProForma).not.toHaveBeenCalled()
  })

  it('rejects cross-origin requests before the salary source service runs', async () => {
    const response = await POST(new Request('http://localhost:3000/api/my-salary/pro-forma', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://attacker.invalid' },
      body: JSON.stringify({ type: 'SALARY_INCREASE', percentage: '5' }),
    }))

    expect(response.status).toBe(403)
    expect(calculateMySalaryProForma).not.toHaveBeenCalled()
  })
})
