import { describe, expect, it } from 'vitest'
import { buildMinimalEmployeeTransfer, hireChoiceSchema, requireHumanHireChoice } from './employee-link-service'

describe('hire conversion contract', () => {
  it('kopieert alleen minimale identiteitsgegevens naar Core HR', () => {
    expect(buildMinimalEmployeeTransfer({ firstName: 'Lisa', lastName: 'Jansen', privateEmail: 'lisa@example.invalid', phone: '+31 6 12345678', motivation: 'do not copy' })).toEqual({
      firstName: 'Lisa', lastName: 'Jansen', privateEmail: 'lisa@example.invalid', phone: '+31 6 12345678',
    })
  })

  it('vereist expliciete keuze voor bestaand, nieuw of rehire', () => {
    expect(hireChoiceSchema.safeParse({ choice: 'EXISTING', employeeId: '11111111-1111-4111-8111-111111111111' }).success).toBe(true)
    expect(() => requireHumanHireChoice({ choice: 'EXISTING', employeeId: null })).toThrowError('RECRUITMENT_EMPLOYEE_CHOICE_REQUIRED')
  })
})
