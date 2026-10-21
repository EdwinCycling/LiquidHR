import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, requirePermission } = vi.hoisted(() => ({
  createClient: vi.fn(),
  requirePermission: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/permissions', () => ({
  requirePermission,
  AuthorizationError: class AuthorizationError extends Error {},
}))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { AuthorizationError } from '@/lib/auth/permissions'
import { createPayslipDownload, listEmployeePayslips } from './payslip-service'
import type { PayslipServiceError } from './payslip-service'

const employeeId = '10000000-0000-4000-8000-000000000001'
const payslipId = '20000000-0000-4000-8000-000000000001'

function createQuery(result: { data: unknown; error: unknown }) {
  const calls: Array<[string, ...unknown[]]> = []
  const builder: Record<string, (...args: unknown[]) => unknown> = {}
  for (const method of ['select', 'eq', 'order', 'limit']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args])
      return builder
    }
  }
  builder.maybeSingle = (...args: unknown[]) => {
    calls.push(['maybeSingle', ...args])
    return Promise.resolve(result)
  }
  builder.limit = (...args: unknown[]) => {
    calls.push(['limit', ...args])
    return Promise.resolve(result)
  }
  return { builder, calls }
}

describe('existing imported payslip source', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requirePermission.mockResolvedValue({ employeeId })
  })

  it('lists imported PDFs only after payslip permission and filters rows to the employee', async () => {
    const query = createQuery({ data: [{ id: payslipId, calendar_year: 2026, period_label: 'October 2026', content_type: 'application/pdf' }], error: null })
    createClient.mockResolvedValue({ from: vi.fn(() => query.builder) })

    const documents = await listEmployeePayslips(employeeId)

    expect(requirePermission).toHaveBeenCalledWith('payslip:read', employeeId)
    expect(query.calls).toContainEqual(['eq', 'employee_id', employeeId])
    expect(documents).toHaveLength(1)
  })

  it('does not query or sign another employee payslip when payslip:read is missing', async () => {
    requirePermission.mockRejectedValue(new AuthorizationError('Denied'))

    await expect(createPayslipDownload(employeeId, payslipId)).rejects.toBeInstanceOf(AuthorizationError)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('bounds imported payslip downloads to both document ID and employee ID', async () => {
    const query = createQuery({ data: { storage_key: 'private/object-key.pdf' }, error: null })
    const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: 'https://signed.example/document' }, error: null }))
    createClient.mockResolvedValue({
      from: vi.fn(() => query.builder),
      storage: { from: vi.fn(() => ({ createSignedUrl })) },
    })

    await expect(createPayslipDownload(employeeId, payslipId)).resolves.toBe('https://signed.example/document')
    expect(requirePermission).toHaveBeenCalledWith('payslip:read', employeeId)
    expect(query.calls).toContainEqual(['eq', 'id', payslipId])
    expect(query.calls).toContainEqual(['eq', 'employee_id', employeeId])
    expect(createSignedUrl).toHaveBeenCalledWith('private/object-key.pdf', 60)
  })

  it('does not create a signed URL for an imported payslip ID outside the employee scope', async () => {
    const query = createQuery({ data: null, error: null })
    const createSignedUrl = vi.fn()
    createClient.mockResolvedValue({
      from: vi.fn(() => query.builder),
      storage: { from: vi.fn(() => ({ createSignedUrl })) },
    })

    await expect(createPayslipDownload(employeeId, payslipId)).rejects.toMatchObject({
      code: 'PAYSLIP_NOT_FOUND',
      status: 404,
    } satisfies Pick<PayslipServiceError, 'code' | 'status'>)
    expect(query.calls).toContainEqual(['eq', 'employee_id', employeeId])
    expect(createSignedUrl).not.toHaveBeenCalled()
  })
})
