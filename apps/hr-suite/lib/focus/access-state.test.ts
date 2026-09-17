import { describe, expect, it } from 'vitest'
import {
  PREBOARDING_ALLOWED_SELF_PERMISSIONS,
  daysUntil,
  isPreboardingAllowedSelfPermission,
  resolveEmploymentAccessState,
  resolveFocusExperience,
  resolvePresentation,
} from './access-state'

describe('Focus access state', () => {
  it('keeps a future confirmed employee in Preboarding until the start date', () => {
    const future = resolveEmploymentAccessState('2026-09-17', [{
      startsOn: '2026-09-18',
      endsOn: null,
      recordStatus: 'CONFIRMED',
    }])

    expect(future).toEqual({ experience: 'PREBOARDING', effectiveStartDate: '2026-09-18' })
    expect(resolveFocusExperience(future, ['EMPLOYEE'])).toBe('PREBOARDING')
  })

  it('transitions on the effective start date and does not use a second source of truth', () => {
    const active = resolveEmploymentAccessState('2026-09-18', [{
      startsOn: '2026-09-18',
      endsOn: null,
      recordStatus: 'CONFIRMED',
    }])

    expect(active.experience).toBe('EMPLOYEE')
    expect(resolveFocusExperience(active, ['EMPLOYEE'])).toBe('EMPLOYEE')
  })

  it('prefers an active employment over a later future employment', () => {
    const state = resolveEmploymentAccessState('2026-09-17', [
      { startsOn: '2026-09-01', endsOn: null, recordStatus: 'CONFIRMED' },
      { startsOn: '2026-10-01', endsOn: null, recordStatus: 'CONFIRMED' },
    ])

    expect(state.experience).toBe('EMPLOYEE')
  })

  it('uses Focus for employees and managers, and Full for administrators by default', () => {
    expect(resolvePresentation({ experience: 'EMPLOYEE', activeRoles: ['EMPLOYEE'], device: 'DESKTOP' })).toBe('FOCUS')
    expect(resolvePresentation({ experience: 'MANAGER', activeRoles: ['DIRECT_MANAGER'], device: 'DESKTOP' })).toBe('FOCUS')
    expect(resolvePresentation({ experience: 'MANAGER', activeRoles: ['DIRECT_MANAGER', 'TENANT_ADMIN'], device: 'DESKTOP' })).toBe('FULL')
  })

  it('lets an explicit browser preference override the role default, except during Preboarding', () => {
    expect(resolvePresentation({ experience: 'EMPLOYEE', activeRoles: ['EMPLOYEE'], device: 'DESKTOP', explicitPreference: 'FULL' })).toBe('FULL')
    expect(resolvePresentation({ experience: 'PREBOARDING', activeRoles: ['EMPLOYEE'], device: 'DESKTOP', explicitPreference: 'FULL' })).toBe('FOCUS')
    expect(resolvePresentation({ experience: 'NO_EMPLOYMENT', activeRoles: ['TENANT_ADMIN'], device: 'DESKTOP', explicitPreference: 'FULL' })).toBe('FOCUS')
  })

  it('keeps the preboarding whitelist explicit and excludes general ESS permissions', () => {
    expect(PREBOARDING_ALLOWED_SELF_PERMISSIONS).toContain('self:journey:read')
    expect(PREBOARDING_ALLOWED_SELF_PERMISSIONS).toContain('self:bank-account:write')
    expect(isPreboardingAllowedSelfPermission('self:document-signing:write')).toBe(true)
    expect(isPreboardingAllowedSelfPermission('self:leave:read')).toBe(false)
    expect(isPreboardingAllowedSelfPermission('self:employee-bsn:read')).toBe(false)
    expect(isPreboardingAllowedSelfPermission('self:organization-chart:read')).toBe(false)
  })

  it('calculates a non-negative day countdown at a date boundary', () => {
    expect(daysUntil('2026-09-18', '2026-09-17')).toBe(1)
    expect(daysUntil('2026-09-17', '2026-09-17')).toBe(0)
    expect(daysUntil('2026-09-16', '2026-09-17')).toBe(0)
  })
})
