import { describe, expect, it } from 'vitest'
import {
  canOpenSetupAssistantRoute,
  SETUP_ASSISTANT_GUIDE,
  getVisibleSetupAssistantSteps,
} from './guide'

describe('Setup Assistent guide', () => {
  it('contains the frozen CORE checklist and hides salary until a reliable resolver exists', () => {
    const allSteps = SETUP_ASSISTANT_GUIDE.flatMap((category) => category.steps)
    const visibleSteps = getVisibleSetupAssistantSteps({ permissions: allSteps.flatMap((step) => step.primaryRoute.requiredPermissions) })

    expect(allSteps).toHaveLength(17)
    expect(visibleSteps).toHaveLength(16)
    expect(visibleSteps.some((step) => step.stepKey === 'EMP-003')).toBe(false)
  })

  it('filters inaccessible primary destinations without changing the static guide', () => {
    const steps = getVisibleSetupAssistantSteps({ permissions: ['settings:read', 'department:read'] })

    expect(steps.map((step) => step.stepKey)).toEqual(['ORG-001', 'BAS-003', 'SET-002'])
    expect(SETUP_ASSISTANT_GUIDE.flatMap((category) => category.steps)).toHaveLength(17)
  })

  it('keeps employment conditions on the canonical employment settings route', () => {
    const step = SETUP_ASSISTANT_GUIDE
      .flatMap((category) => category.steps)
      .find((candidate) => candidate.stepKey === 'EMP-002')

    expect(step?.primaryRoute.href).toBe('/settings/employment-contracts')
  })

  it('filters related destinations with their own permission contract', () => {
    const step = SETUP_ASSISTANT_GUIDE
      .flatMap((category) => category.steps)
      .find((candidate) => candidate.stepKey === 'SET-004')

    if (!step?.relatedRoute) throw new Error('SET-004 related route is missing')

    expect(canOpenSetupAssistantRoute(step.relatedRoute, { permissions: ['settings:read'] })).toBe(true)
    expect(canOpenSetupAssistantRoute(step.relatedRoute, { permissions: [] })).toBe(false)
  })
})
