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
    calculateMySalaryProForma.mockResolvedValue({ status: 'CALCULATED', sourceHash: 'a'.repeat(64) })
    const response = await POST(new Request('http://localhost:3000/api/my-salary/pro-forma', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ type: 'SALARY_INCREASE', percentage: '5' }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(calculateMySalaryProForma).toHaveBeenCalledWith({ type: 'SALARY_INCREASE', percentage: '5' })
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
    const malformed = await POST(new Request('http://localhost:3000/api/my-salary/pro-forma', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' }, body: '{',
    }))
    const oversized = await POST(new Request('http://localhost:3000/api/my-salary/pro-forma', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' }, body: ' '.repeat(2049),
    }))

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
