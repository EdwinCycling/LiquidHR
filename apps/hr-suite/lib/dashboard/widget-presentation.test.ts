import { describe, expect, it } from 'vitest'
import { DASHBOARD_WIDGET_CATALOG } from './widget-catalog'
import { buildWidgetPresentation, buildWidgetPresentationMap } from './widget-presentation'

describe('dashboard widget presentation', () => {
  it('maakt technische widgetcodes nooit zichtbaar', () => {
    const entry = DASHBOARD_WIDGET_CATALOG.find((item) => item.type === 'EXPIRING_CONTRACTS')!
    const view = buildWidgetPresentation(entry, (key) => ({
      'widgets.expiringContracts.title': 'Aflopende contracten',
      'widgets.expiringContracts.description': 'Contracten die binnenkort eindigen.',
      'categories.EMPLOYMENT': 'Dienstverband',
      'visualizations.TABLE': 'Tabel',
      'widths.TWO_THIRDS': 'Twee derde',
    })[key] ?? key)

    expect(view.title).toBe('Aflopende contracten')
    expect(view.description).toBe('Contracten die binnenkort eindigen.')
    expect(view.title).not.toContain('EXPIRING_CONTRACTS')
  })

  it('maakt voor ieder catalogustype complete presentatiemetadata', () => {
    const map = buildWidgetPresentationMap(DASHBOARD_WIDGET_CATALOG, (key) => `vertaald:${key}`)

    expect(map.size).toBe(DASHBOARD_WIDGET_CATALOG.length)
    for (const view of map.values()) {
      expect(view.title.startsWith('vertaald:')).toBe(true)
      expect(view.description.startsWith('vertaald:')).toBe(true)
      expect(view.categoryLabel.startsWith('vertaald:')).toBe(true)
    }
  })
})
