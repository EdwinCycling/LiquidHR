import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EmployeePayrollAccess } from './payroll-professional-service'

const mocks = vi.hoisted(() => ({
  calculate: vi.fn(),
}))

vi.mock('./payroll-pro-forma-service', async (importOriginal) => ({
  ...await importOriginal<typeof import('./payroll-pro-forma-service')>(),
  calculateAuthorizedTargetPayrollProForma: mocks.calculate,
}))

import { postPayrollProFormaTarget } from './payroll-pro-forma-http'

const employeeId = '91000000-0000-4000-8000-000000000001'
const access: EmployeePayrollAccess = {
  employeeId,
  actorUserId: '91000000-0000-4000-8000-000000000002',
  scope: {
    tenantId: '91000000-0000-4000-8000-000000000010',
    hrGroupId: '91000000-0000-4000-8000-000000000020',
    administrationId: '91000000-0000-4000-8000-000000000030',
  },
  payrollAdministrationId: '91000000-0000-4000-8000-000000000040',
}
function request(body: string, origin = 'http://127.0.0.1:3010'): Request {
  return new Request('http://127.0.0.1:3010/api/hr-admin/employees/target/pro-forma', {
    method: 'POST',
    headers: { origin, host: '127.0.0.1:3010', 'content-type': 'application/json' },
    body,
  })
}

describe('target Payroll pro-forma HTTP boundary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses only the URL target after server authorization and returns uncached preview data', async () => {
    const authorize = vi.fn(async () => access)
    mocks.calculate.mockResolvedValue({ status: 'SOURCE_GAP', sourceStatus: 'SOURCE_GAP' })
    const response = await postPayrollProFormaTarget(
      request(JSON.stringify({ type: 'SALARY_INCREASE', percentage: '5' })),
      employeeId,
      authorize,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(authorize).toHaveBeenCalledWith(employeeId)
    expect(mocks.calculate).toHaveBeenCalledWith(access, { type: 'SALARY_INCREASE', percentage: '5' })
  })

  it('rejects body selectors, invalid paths, oversized bodies, and cross-origin requests before authorization', async () => {
    const authorize = vi.fn(async () => access)
    const readOnlyBonus = await postPayrollProFormaTarget(
      request('{"type":"BONUS","amount":"250"}'), employeeId, authorize,
    )
    const withSelector = await postPayrollProFormaTarget(
      request(JSON.stringify({ type: 'BONUS', amount: '250', employeeId })), employeeId, authorize,
    )
    const invalidPath = await postPayrollProFormaTarget(request('{"type":"BONUS","amount":"250"}'), 'not-a-uuid', authorize)
    const oversized = await postPayrollProFormaTarget(request(' '.repeat(2049)), employeeId, authorize)
    const crossOrigin = await postPayrollProFormaTarget(
      request('{"type":"BONUS","amount":"250"}', 'https://attacker.invalid'), employeeId, authorize,
    )

    expect(readOnlyBonus.status).toBe(400)
    expect(withSelector.status).toBe(400)
    expect(invalidPath.status).toBe(404)
    expect(oversized.status).toBe(413)
    expect(crossOrigin.status).toBe(403)
    expect(authorize).not.toHaveBeenCalled()
    expect(mocks.calculate).not.toHaveBeenCalled()
  })
})
