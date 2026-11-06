import { expect, it } from 'vitest'
import { matchingDevelopmentPlans } from './skill-gap-priorities'
import type { DevelopmentInsight } from './insights-service'

it('matches plans only when both employee and capability are explicitly the same', () => {
  const base = { employeeLabel: 'A', title: 'Plan', status: 'ACTIVE', progressPercent: 20, periodStart: '2026-01-01', periodEnd: null, completedAt: null, href: '/workforce/talent/goals' }
  const plans: DevelopmentInsight['plans'] = [
    { ...base, id: 'match', employeeId: 'a', capabilityId: 'skill' },
    { ...base, id: 'other-person', employeeId: 'b', capabilityId: 'skill' },
    { ...base, id: 'other-skill', employeeId: 'a', capabilityId: 'other' },
    { ...base, id: 'unlinked', employeeId: 'a', capabilityId: null },
  ]
  expect(matchingDevelopmentPlans(plans, 'a', 'skill').map(plan => plan.id)).toEqual(['match'])
})
