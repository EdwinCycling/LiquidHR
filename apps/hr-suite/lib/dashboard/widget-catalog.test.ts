import { describe, expect, it } from 'vitest'
import { DASHBOARD_WIDGET_CATALOG, dashboardWidgetCategories, dashboardWidgetWidths, getWidgetCatalogEntry } from './widget-catalog'
import { dashboardWidgetSettingsSchema, dashboardWidgetTypeSchema } from './schemas'

describe('dashboard widget catalog', () => {
  it('contains all five categories with unique stable types', () => {
    expect(new Set(DASHBOARD_WIDGET_CATALOG.map((entry) => entry.type)).size).toBe(DASHBOARD_WIDGET_CATALOG.length)
    expect(new Set(DASHBOARD_WIDGET_CATALOG.map((entry) => entry.category))).toEqual(new Set(dashboardWidgetCategories))
  })

  it('contains only supported widths and schema types', () => {
    for (const entry of DASHBOARD_WIDGET_CATALOG) {
      expect(dashboardWidgetTypeSchema.safeParse(entry.type).success).toBe(true)
      expect(dashboardWidgetWidths).toContain(entry.defaultWidth)
      expect(entry.loader.length).toBeGreaterThan(0)
    }
  })

  it('defaults missing width and rejects invalid width', () => {
    expect(dashboardWidgetSettingsSchema.parse({})).toEqual({})
    expect(dashboardWidgetSettingsSchema.safeParse({ width: 'THREE_QUARTERS' }).success).toBe(false)
  })

  it('resolves a catalog entry by type', () => {
    expect(getWidgetCatalogEntry('MY_PROFILE')?.category).toBe('CORE_HR')
  })
})
