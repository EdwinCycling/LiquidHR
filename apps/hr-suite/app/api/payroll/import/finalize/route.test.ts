import { afterEach, describe, expect, it, vi } from 'vitest'
import { PayrollImportError } from '@/lib/payroll-import/model'
import { POST } from './route'

const mocks = vi.hoisted(() => ({
  finalizePayrollImport: vi.fn(),
  permissionErrorResponse: vi.fn(() => null),
}))

vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse: mocks.permissionErrorResponse }))
vi.mock('@/lib/payroll-import/service', () => ({ finalizePayrollImport: mocks.finalizePayrollImport }))

afterEach(() => {
  vi.clearAllMocks()
})

describe('payroll import finalize route', () => {
  it('passes PostgreSQL UUIDs through to the service finalization guard', async () => {
    mocks.finalizePayrollImport.mockRejectedValue(new PayrollImportError('REAL_XML_FINALIZATION_PENDING', 409))
    const input = {
      batchId: '917d11e0-2ca5-c80b-5a23-fedc54ce9f0a',
      administrationId: '8483abc9-f275-c80b-5a23-fedc54ce9f0a',
      selectedRowNumbers: [1],
    }

    const response = await POST(new Request('http://localhost/api/payroll/import/finalize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: 'REAL_XML_FINALIZATION_PENDING' })
    expect(mocks.finalizePayrollImport).toHaveBeenCalledWith(input)
  })
})
