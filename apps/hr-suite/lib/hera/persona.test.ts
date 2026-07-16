import { describe, expect, it } from 'vitest'
import { resolvePersona } from './persona'

describe('resolvePersona', () => {
  it('geeft een directe manager een bondige, actiegerichte toon zonder rechten te wijzigen', () => {
    const permissions = ['employee:read']

    const persona = resolvePersona({ activeRoles: ['DIRECT_MANAGER'], permissions }, 'nl')

    expect(persona.audience).toBe('MANAGER')
    expect(persona.instructions).toContain('bondig')
    expect(permissions).toEqual(['employee:read'])
  })
})
