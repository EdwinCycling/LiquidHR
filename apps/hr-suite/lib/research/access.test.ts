import { describe, expect, it } from 'vitest'
import { resolveResearchAccess } from './access'

describe('research access', () => {
  it('geeft een medewerker alleen de respondent-werkruimte', () => {
    expect(resolveResearchAccess({ employeeId: 'employee', permissions: [] })).toEqual({
      canOpenHub: true,
      canManage: false,
      canMonitor: false,
      canReadResults: false,
    })
  })

  it('geeft een HR-admin beheer, monitor en resultaten', () => {
    expect(resolveResearchAccess({
      employeeId: null,
      permissions: ['research:read', 'research:write', 'research-result:read'],
    })).toEqual({
      canOpenHub: true,
      canManage: true,
      canMonitor: true,
      canReadResults: true,
    })
  })

  it('geeft een leidinggevende zonder researchrechten geen monitor of resultaten', () => {
    expect(resolveResearchAccess({ employeeId: 'manager', permissions: ['employee:read'] })).toMatchObject({
      canManage: false,
      canMonitor: false,
      canReadResults: false,
    })
  })
})
