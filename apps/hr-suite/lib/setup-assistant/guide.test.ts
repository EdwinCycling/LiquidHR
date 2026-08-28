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

    expect(allSteps).toHaveLength(16)
    expect(visibleSteps).toHaveLength(15)
    expect(visibleSteps.some((step) => step.stepKey === 'EMP-003')).toBe(false)
  })

  it('filters inaccessible primary destinations without changing the static guide', () => {
    const steps = getVisibleSetupAssistantSteps({ permissions: ['settings:read', 'department:read'] })

    expect(steps.map((step) => step.stepKey)).toEqual(['ORG-001', 'BAS-003', 'SET-002'])
    expect(SETUP_ASSISTANT_GUIDE.flatMap((category) => category.steps)).toHaveLength(16)
  })

  it('keeps employment conditions on the canonical employment settings route', () => {
    const step = SETUP_ASSISTANT_GUIDE
      .flatMap((category) => category.steps)
      .find((candidate) => candidate.stepKey === 'EMP-002')

    expect(step?.primaryRoute.href).toBe('/settings/employment-contracts')
  })

  it('does not expose the retired Dashboard Widgets destination', () => {
    const steps = SETUP_ASSISTANT_GUIDE.flatMap((category) => category.steps)

    expect(steps.some((step) => step.stepKey === 'SET-004')).toBe(false)
    expect(steps.some((step) => step.primaryRoute.href === '/settings/dashboard-widgets')).toBe(false)
    expect(canOpenSetupAssistantRoute({ href: '/settings/menu-order', requiredPermissions: ['settings:read'] }, { permissions: ['settings:read'] })).toBe(true)
  })
})
