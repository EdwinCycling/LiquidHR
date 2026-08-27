import { describe, expect, it } from 'vitest'
import {
  setupAssistantCompletionSchema,
  setupAssistantEnabledSchema,
} from './schemas'

describe('Setup Assistent schemas', () => {
  it('accepts future step keys without requiring a migration', () => {
    expect(setupAssistantCompletionSchema.parse({ stepKey: 'FUTURE-001', isCompleted: true })).toEqual({
      stepKey: 'FUTURE-001',
      isCompleted: true,
    })
  })

  it('rejects malformed setting payloads', () => {
    expect(setupAssistantEnabledSchema.safeParse({ isEnabled: 'true' }).success).toBe(false)
    expect(setupAssistantCompletionSchema.safeParse({ stepKey: ' ', isCompleted: false }).success).toBe(false)
  })
})
