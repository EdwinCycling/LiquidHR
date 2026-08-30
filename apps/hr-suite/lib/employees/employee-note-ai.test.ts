import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { createEmployeeNoteAiContextLoader, createEmployeeNoteAiInvocationInput, employeeNoteAiProposalValidator, employeeNoteAiRequestSchema } from './employee-note-ai'

describe('employee note AI capability', () => {
  const request = { sourceText: 'De cursus is afgerond.', transformation: 'improve_writing' as const, locale: 'nl' as const }

  it('accepts only the three transformations and rejects empty input', () => {
    expect(employeeNoteAiRequestSchema.safeParse(request).success).toBe(true)
    expect(employeeNoteAiRequestSchema.safeParse({ ...request, transformation: 'summarize' }).success).toBe(false)
    expect(employeeNoteAiRequestSchema.safeParse({ ...request, sourceText: '   ' }).success).toBe(false)
  })

  it('loads exactly source text, transformation and locale, without target metadata', async () => {
    const loader = createEmployeeNoteAiContextLoader(request)
    const businessObject = createEmployeeNoteAiInvocationInput('employee-secret-id', request, 'key-1').businessObject
    const context = await loader.load({
      authContext: {} as never,
      scope: { tenantId: 'tenant-1', hrGroupId: 'group-1', administrationId: 'admin-1' },
      feature: {} as never,
      businessObject,
    })

    expect(context.fields).toEqual({ sourceText: request.sourceText, transformation: request.transformation, locale: request.locale })
    expect(JSON.stringify(context.fields)).not.toContain('employee-secret-id')
    expect(businessObject.id).not.toContain('employee-secret-id')
  })

  it('accepts only the canonical human-review proposal shape', () => {
    expect(employeeNoteAiProposalValidator.validate({ resultType: 'PROPOSAL', proposedText: 'Voorstel.', requiresHumanReview: true })).toEqual({ resultType: 'PROPOSAL', proposedText: 'Voorstel.', requiresHumanReview: true })
    expect(() => employeeNoteAiProposalValidator.validate({ resultType: 'PROPOSAL', proposedText: 'Voorstel.', requiresHumanReview: false })).toThrowError(/INVALID_RESULT/)
    expect(() => employeeNoteAiProposalValidator.validate({ resultType: 'PROPOSAL', proposedText: 'Voorstel.', requiresHumanReview: true, employeeId: 'leak' })).toThrowError(/INVALID_RESULT/)
  })
})
