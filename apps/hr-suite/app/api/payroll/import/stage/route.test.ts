import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

const mocks = vi.hoisted(() => ({
  analyzePayrollImport: vi.fn(),
  stagePayrollImport: vi.fn(),
  permissionErrorResponse: vi.fn(() => null),
}))

vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse: mocks.permissionErrorResponse }))
vi.mock('@/lib/payroll-import/service', () => ({
  analyzePayrollImport: mocks.analyzePayrollImport,
  stagePayrollImport: mocks.stagePayrollImport,
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('payroll import staging route', () => {
  it('rejects XML before reading a file or invoking either import service', async () => {
    const form = new FormData()
    form.set('sourceType', 'LOONAANGIFTE_XML')
    form.set('taxYear', '2026')
    form.set('administrationId', '8483abc9-f275-c80b-5a23-fedc54ce9f0a')
    const response = await POST(new Request('http://localhost/api/payroll/import/stage', { method: 'POST', body: form }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: 'REAL_XML_STAGING_PENDING' })
    expect(mocks.analyzePayrollImport).not.toHaveBeenCalled()
    expect(mocks.stagePayrollImport).not.toHaveBeenCalled()
  })
})
