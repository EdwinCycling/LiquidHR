import { describe, expect, it } from 'vitest'

import { createDevelopmentGoalSmartContextLoader, createDevelopmentGoalSmartInvocationInput, developmentGoalSmartRequestSchema } from './goal-ai'

describe('Development goal SMART AI contract', () => {
  const request = { employeeId: '11111111-1111-4111-8111-111111111111', sourceText: 'Beter worden in presenteren.', locale: 'nl' as const }

  it('keeps the original goal as source context and exposes a proposal-only SMART prompt', async () => {
    expect(developmentGoalSmartRequestSchema.safeParse(request).success).toBe(true)
    const loader = createDevelopmentGoalSmartContextLoader(request, { title: 'Presenteren', description: 'Beter worden in presenteren.', periodStart: '2026-01-01', periodEnd: '2026-12-31' })
    const context = await loader.load({ businessObject: { type: 'development-goal', id: 'goal-1' } })

    expect(context.fields).toEqual({ sourceText: request.sourceText, existingTitle: 'Presenteren', existingDescription: request.sourceText, periodStart: '2026-01-01', periodEnd: '2026-12-31', locale: 'nl' })
    expect(context.prompt?.instructions).toContain('overschrijf of bewaar het bestaande doel niet')
    expect(createDevelopmentGoalSmartInvocationInput(request, request.employeeId, 'key-1')).toMatchObject({ featureCode: 'DEVELOPMENT_GOAL_SMART', businessObject: { type: 'development-goal' }, businessPermissionCode: 'talent-goal:write', businessPermissionTargetId: request.employeeId })
  })

  it('rejects empty source text', () => {
    expect(developmentGoalSmartRequestSchema.safeParse({ ...request, sourceText: ' ' }).success).toBe(false)
  })

  it('supports the HR-admin goal permission for tenant-wide goal scope', () => {
    expect(createDevelopmentGoalSmartInvocationInput(request, request.employeeId, 'key-1', 'talent-goal:manage')).toMatchObject({
      businessPermissionCode: 'talent-goal:manage',
      businessPermissionTargetId: request.employeeId,
    })
  })
})
