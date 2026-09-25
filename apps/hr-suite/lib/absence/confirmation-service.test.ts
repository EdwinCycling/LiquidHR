import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, rpc } = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { registerAbsenceConfirmation } from './confirmation-service'

describe('registerAbsenceConfirmation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    rpc.mockResolvedValue({ data: 'confirmation-id', error: null })
    createClient.mockResolvedValue({ rpc })
  })

  it('uses the database default when the subject employee is omitted', async () => {
    await expect(registerAbsenceConfirmation('case-id')).resolves.toBe('confirmation-id')

    expect(rpc).toHaveBeenCalledWith('register_absence_confirmation', {
      requested_case_id: 'case-id',
    })
  })

  it('passes an explicit subject employee when provided', async () => {
    await registerAbsenceConfirmation('case-id', 'employee-id')

    expect(rpc).toHaveBeenCalledWith('register_absence_confirmation', {
      requested_case_id: 'case-id',
      requested_subject_employee_id: 'employee-id',
    })
  })
})
