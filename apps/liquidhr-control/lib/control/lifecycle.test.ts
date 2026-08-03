import { describe, expect, it } from 'vitest'
import {
  allowedTenantTransitions,
  canTransitionTenant,
  lifecycleKeepsApplicationActive,
} from './lifecycle'

describe('tenant lifecycle', () => {
  it('ondersteunt activeren, pauzeren en hervatten', () => {
    expect(canTransitionTenant('PROVISIONING', 'ACTIVE')).toBe(true)
    expect(canTransitionTenant('ACTIVE', 'PAUSED')).toBe(true)
    expect(canTransitionTenant('PAUSED', 'ACTIVE')).toBe(true)
  })

  it('vereist een aparte beeindigingsfase', () => {
    expect(canTransitionTenant('ACTIVE', 'TERMINATED')).toBe(false)
    expect(canTransitionTenant('ACTIVE', 'TERMINATING')).toBe(true)
    expect(canTransitionTenant('TERMINATING', 'TERMINATED')).toBe(true)
  })

  it('maakt een beeindigde tenant onomkeerbaar', () => {
    expect(allowedTenantTransitions('TERMINATED')).toEqual([])
    expect(canTransitionTenant('TERMINATED', 'ACTIVE')).toBe(false)
  })

  it('houdt alleen ACTIVE toegankelijk voor de HR-app', () => {
    expect(lifecycleKeepsApplicationActive('ACTIVE')).toBe(true)
    expect(lifecycleKeepsApplicationActive('PAUSED')).toBe(false)
    expect(lifecycleKeepsApplicationActive('TERMINATED')).toBe(false)
  })
})
