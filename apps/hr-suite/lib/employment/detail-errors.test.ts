import { describe, expect, it } from 'vitest'
import { employeeDetailReadFailureCode } from './detail-errors'

describe('employeeDetailReadFailureCode', () => {
  it('identificeert een mislukte adresquery', () => {
    expect(employeeDetailReadFailureCode({
      addresses: true,
      bankAccounts: false,
      relations: false,
    })).toBe('EMPLOYEE_ADDRESSES_READ_FAILED')
  })

  it('identificeert een mislukte bankrekeningquery', () => {
    expect(employeeDetailReadFailureCode({
      addresses: false,
      bankAccounts: true,
      relations: false,
    })).toBe('EMPLOYEE_BANK_ACCOUNTS_READ_FAILED')
  })

  it('identificeert een mislukte relatiequery', () => {
    expect(employeeDetailReadFailureCode({
      addresses: false,
      bankAccounts: false,
      relations: true,
    })).toBe('EMPLOYEE_RELATIONS_READ_FAILED')
  })
})
