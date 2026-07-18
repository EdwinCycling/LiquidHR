import { describe, expect, it } from 'vitest'
import { getWidgetCatalogEntry } from './widget-catalog'
import { resolveVisibleWidgetTypes } from './widget-access'

describe('dashboard widget access', () => {
  it('vereist enabled config, actieve rol en alle gewone permissions', () => {
    const visible = resolveVisibleWidgetTypes({
      configs: [{ widgetType: 'EXPIRING_CONTRACTS', isEnabled: true }],
      roleAccess: [{ widgetType: 'EXPIRING_CONTRACTS', roleId: 'hr' }],
      activeRoleIds: new Set(['hr']),
      permissions: new Set(['employee:read', 'contract:read']),
      entries: [getWidgetCatalogEntry('EXPIRING_CONTRACTS')!],
    })

    expect(visible).toEqual(new Set(['EXPIRING_CONTRACTS']))
  })

  it('weigert een widget zodra een vereist recht ontbreekt', () => {
    const visible = resolveVisibleWidgetTypes({
      configs: [{ widgetType: 'EXPIRING_CONTRACTS', isEnabled: true }],
      roleAccess: [], activeRoleIds: new Set(), permissions: new Set(['employee:read']),
      entries: [getWidgetCatalogEntry('EXPIRING_CONTRACTS')!],
    })

    expect(visible.size).toBe(0)
  })

  it('vertaalt selfOnly permissions naar exacte selfrechten', () => {
    const visible = resolveVisibleWidgetTypes({
      configs: [{ widgetType: 'MY_SALARY_HISTORY', isEnabled: true }],
      roleAccess: [{ widgetType: 'MY_SALARY_HISTORY', roleId: 'employee' }],
      activeRoleIds: new Set(['employee']),
      permissions: new Set(['self:employee:read', 'self:salary:read']),
      entries: [getWidgetCatalogEntry('MY_SALARY_HISTORY')!],
    })

    expect(visible.has('MY_SALARY_HISTORY')).toBe(true)
  })
})
