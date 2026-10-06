import { describe, expect, it } from 'vitest'
import {
  canUseSourceForEmployee,
  getPayrollImportFieldPolicy,
  PAYROLL_IMPORT_FIELD_CONFLICT_POLICY,
} from './field-conflict-policy'

describe('CONTROL02 centralized source field conflict policy', () => {
  it('requires human decisions and never permits automatic overwrites', () => {
    for (const policy of Object.values(PAYROLL_IMPORT_FIELD_CONFLICT_POLICY)) {
      expect(policy.requiresHumanDecision).toBe(true)
      expect(policy.automaticOverwrite).toBe(false)
    }
  })

  it('limits existing Employee updates to explicitly confirmed name fields', () => {
    expect(canUseSourceForEmployee('firstName', 'UPDATE')).toBe(true)
    expect(canUseSourceForEmployee('birthName', 'UPDATE')).toBe(true)
    expect(canUseSourceForEmployee('birthDate', 'UPDATE')).toBe(false)
    expect(canUseSourceForEmployee('gender', 'UPDATE')).toBe(false)
    expect(canUseSourceForEmployee('nationality', 'UPDATE')).toBe(false)
    expect(canUseSourceForEmployee('address', 'UPDATE')).toBe(false)
  })

  it('keeps employment, salary and fiscal identity fields outside Employee mutation', () => {
    for (const field of ['hours', 'contractType', 'salary', 'laborConditionGroup', 'payrollTaxNumber', 'ikvNumber']) {
      expect(canUseSourceForEmployee(field, 'CREATE')).toBe(false)
      expect(canUseSourceForEmployee(field, 'UPDATE')).toBe(false)
    }
  })

  it('rejects unknown fields instead of silently treating them as importable', () => {
    expect(getPayrollImportFieldPolicy('administratorAddedField')).toBeNull()
    expect(canUseSourceForEmployee('administratorAddedField', 'UPDATE')).toBe(false)
  })
})
