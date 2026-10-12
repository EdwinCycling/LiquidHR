import { describe, expect, it } from 'vitest'
import {
  CHATGPT_FOCUS_PLAN_SCHEMA,
  projectChatGptFocusPlans,
  projectSelectedChatGptFocusPlan,
} from './focus-widget-contract'

describe('ChatGPT Focus context projection', () => {
  it('rebuilds one selected plan from only the five approved status fields', () => {
    const projected = projectSelectedChatGptFocusPlan({
      goalId: '00000000-0000-4000-8000-000000000001',
      title: 'Private development title',
      capability: 'Private capability text',
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      progressPercent: 40,
      status: 'ACTIVE',
      completedAt: null,
      archivedAt: null,
      tenantId: '00000000-0000-4000-8000-000000000002',
    })

    expect(projected).toEqual({
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      progressPercent: 40,
      status: 'ACTIVE',
      completedAt: null,
    })
    expect(Object.keys(projected)).toEqual([
      'periodStart',
      'periodEnd',
      'progressPercent',
      'status',
      'completedAt',
    ])
    expect(JSON.stringify(projected)).not.toContain('Private')
    expect(JSON.stringify(projected)).not.toContain('tenantId')
  })

  it('validates every plan while projecting an app-only list', () => {
    expect(projectChatGptFocusPlans({ plans: [
      { periodStart: '2026-01-01', periodEnd: null, progressPercent: 100, status: 'COMPLETED', completedAt: '2026-10-01T12:00:00Z', title: 'stripped' },
    ] })).toEqual([{
        periodStart: '2026-01-01',
        periodEnd: null,
        progressPercent: 100,
        status: 'COMPLETED',
        completedAt: '2026-10-01T12:00:00Z',
      }])
    expect(projectChatGptFocusPlans({ plans: [{ periodStart: 'invalid' }] })).toBeNull()
    expect(CHATGPT_FOCUS_PLAN_SCHEMA.safeParse({
      periodStart: '2026-01-01',
      periodEnd: null,
      progressPercent: 10,
      status: 'ACTIVE',
      completedAt: null,
      title: 'extra',
    }).success).toBe(false)
  })
})
