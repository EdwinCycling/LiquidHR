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

  it('toont de open-onderzoekenwidget alleen met een medewerkerscontext', () => {
    const entry = getWidgetCatalogEntry('OPEN_RESEARCH')!
    const base = { configs: [{ widgetType: 'OPEN_RESEARCH', isEnabled: true }], roleAccess: [], activeRoleIds: new Set<string>(), permissions: new Set(['self:research:respond']), entries: [entry] }
    expect(resolveVisibleWidgetTypes({ ...base, hasEmployeeContext: false }).has('OPEN_RESEARCH')).toBe(false)
    expect(resolveVisibleWidgetTypes({ ...base, hasEmployeeContext: true }).has('OPEN_RESEARCH')).toBe(true)
  })

  it('toont de onderzoeksmonitor alleen met het onderzoeksleesrecht van HR', () => {
    const entry = getWidgetCatalogEntry('RESEARCH_MONITOR')!
    const base = {
      configs: [{ widgetType: 'RESEARCH_MONITOR', isEnabled: true }],
      roleAccess: [],
      activeRoleIds: new Set<string>(),
      entries: [entry],
    }

    expect(resolveVisibleWidgetTypes({ ...base, permissions: new Set(['research:read']) }).has('RESEARCH_MONITOR')).toBe(true)
    expect(resolveVisibleWidgetTypes({ ...base, permissions: new Set(['employee:manager-read']) }).has('RESEARCH_MONITOR')).toBe(false)
  })
})
