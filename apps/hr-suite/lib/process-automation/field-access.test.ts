import { describe, expect, it } from 'vitest'
import { resolveStepFieldAccessMode } from './field-access'
import type { FieldDefinition } from './definition-schemas'

const field: FieldDefinition = {
  key: 'manager-advice',
  label: { nl: 'Advies manager', en: 'Manager advice' },
  type: 'SHORT_TEXT',
  binding: { kind: 'PROCESS_ONLY' },
  access: [
    { participantKey: 'employee', mode: 'HIDDEN' },
    { participantKey: 'manager', mode: 'WRITE_OPTIONAL' },
    { participantKey: 'hr', mode: 'READ' },
  ],
  stepAccess: [
    { stepKey: 'employee-request', participantKey: 'employee', mode: 'HIDDEN' },
    { stepKey: 'manager-review', participantKey: 'manager', mode: 'WRITE_REQUIRED' },
    { stepKey: 'hr-decision', participantKey: 'hr', mode: 'READ' },
  ],
}

describe('step field access resolution', () => {
  it('supports hidden, read, optional write, and required write at the assigned step', () => {
    expect(resolveStepFieldAccessMode(field, 'employee', 'employee-request')).toBe('HIDDEN')
    expect(resolveStepFieldAccessMode(field, 'manager', 'manager-review')).toBe('WRITE_REQUIRED')
    expect(resolveStepFieldAccessMode(field, 'hr', 'hr-decision')).toBe('READ')
  })

  it('fails closed for another step, another participant, and a missing step rule', () => {
    expect(resolveStepFieldAccessMode(field, 'manager', 'employee-request')).toBe('HIDDEN')
    expect(resolveStepFieldAccessMode(field, 'employee', 'manager-review')).toBe('HIDDEN')
    expect(resolveStepFieldAccessMode({ ...field, stepAccess: field.stepAccess?.slice(0, 2) }, 'hr', 'hr-decision')).toBe('HIDDEN')
  })

  it('never permits more than the participant-level access ceiling', () => {
    const invalid = { ...field, stepAccess: [{ stepKey: 'hr-decision', participantKey: 'hr', mode: 'WRITE_OPTIONAL' as const }] }
    expect(resolveStepFieldAccessMode(invalid, 'hr', 'hr-decision')).toBe('READ')
  })

  it('retains participant-only behavior for legacy definitions', () => {
    const legacy = { ...field, stepAccess: undefined }
    expect(resolveStepFieldAccessMode(legacy, 'manager')).toBe('WRITE_OPTIONAL')
    expect(resolveStepFieldAccessMode(legacy, 'hr')).toBe('READ')
  })
})
