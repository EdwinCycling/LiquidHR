import { describe, expect, it } from 'vitest'
import { EmployeeServiceError } from './errors'
import { employeeErrorPayload } from './http-errors'

describe('employeeErrorPayload', () => {
  it('behoudt veilige typed details voor een conflict', () => {
    expect(employeeErrorPayload(new EmployeeServiceError('EMPLOYEE_NUMBER_CONFLICT', 409, {
      suggestedEmployeeNumber: '100042',
    }))).toEqual({
      status: 409,
      body: { error: 'EMPLOYEE_NUMBER_CONFLICT', details: { suggestedEmployeeNumber: '100042' } },
    })
  })

  it('verbergt onbekende interne fouten', () => {
    expect(employeeErrorPayload(new Error('database-secret'))).toEqual({
      status: 500,
      body: { error: 'EMPLOYEE_INTERNAL_ERROR' },
    })
  })
})
