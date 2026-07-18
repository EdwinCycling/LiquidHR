import { describe, expect, it } from 'vitest'
import { dashboardWidgetSettingUpdateSchema } from './widget-settings-service'

describe('dashboard widget setting update', () => {
  it('weigert ongeldige rol-identifiers', () => {
    expect(dashboardWidgetSettingUpdateSchema.safeParse({ widgetType: 'EXPIRING_CONTRACTS', isEnabled: true, roleIds: ['geen-uuid'] }).success).toBe(false)
  })

  it('accepteert een uitgeschakelde widget zonder rollen', () => {
    expect(dashboardWidgetSettingUpdateSchema.safeParse({ widgetType: 'EXPIRING_CONTRACTS', isEnabled: false, roleIds: [] }).success).toBe(true)
  })
})
