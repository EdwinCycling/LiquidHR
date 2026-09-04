import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { archiveEmployeeBankAccount, permissionErrorResponse, updateEmployeeBankAccount } = vi.hoisted(() => ({
  archiveEmployeeBankAccount: vi.fn(),
  permissionErrorResponse: vi.fn((): Response | null => null),
  updateEmployeeBankAccount: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse }))
vi.mock('@/lib/employees/employee-service', () => ({ archiveEmployeeBankAccount, updateEmployeeBankAccount }))

import { PATCH } from './route'

const context = { params: Promise.resolve({ employeeId: 'employee-1', bankAccountId: 'bank-account-1' }) }

function request(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/employees/employee-1/bank-accounts/bank-account-1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const basePayload = {
  bic: 'ABNANL2A',
  accountHolder: 'Maya Bos',
  description: 'Testwijziging',
  isPrimary: true,
}

describe('PATCH /api/employees/[employeeId]/bank-accounts/[bankAccountId]', () => {
  beforeEach(() => {
    archiveEmployeeBankAccount.mockReset()
    permissionErrorResponse.mockReset()
    permissionErrorResponse.mockReturnValue(null)
    updateEmployeeBankAccount.mockReset()
    updateEmployeeBankAccount.mockResolvedValue(undefined)
  })

  it.each([
    ['zonder IBAN', {}],
    ['met lege IBAN', { iban: '' }],
    ['met gemaskeerde IBAN', { iban: '•••• 1032' }],
  ])('behoudt de bestaande versleutelde IBAN bij een metadatawijziging %s', async (_label, iban) => {
    const response = await PATCH(request({ ...basePayload, ...iban }), context)

    expect(response.status).toBe(200)
    expect(updateEmployeeBankAccount).toHaveBeenCalledWith('employee-1', 'bank-account-1', basePayload)
  })

  it('weigert een echte maar ongeldige IBAN vóór de service wordt aangeroepen', async () => {
    const response = await PATCH(request({ ...basePayload, iban: 'NL00FOUT' }), context)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'BANK_ACCOUNT_INPUT_INVALID' })
    expect(updateEmployeeBankAccount).not.toHaveBeenCalled()
  })

  it('geeft een autorisatiegrens veilig door zonder de foutinhoud te lekken', async () => {
    permissionErrorResponse.mockReturnValue(NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }))
    updateEmployeeBankAccount.mockRejectedValue(new Error('cross-scope'))

    const response = await PATCH(request(basePayload), context)

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'FORBIDDEN' })
  })
})
