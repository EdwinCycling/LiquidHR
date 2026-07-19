import { describe, expect, it } from 'vitest'
import type { DashboardWidgetPresentation } from '@/lib/dashboard/widget-presentation'
import { filterWidgetPresentations } from './widget-picker-model'

function fixture(type: DashboardWidgetPresentation['type'], title: string): DashboardWidgetPresentation {
  return { type, title, description: `${title} voor medewerkers`, category: 'EMPLOYMENT', categoryLabel: 'Dienstverband', visualization: 'TABLE', visualizationLabel: 'Tabel', defaultWidth: 'TWO_THIRDS', widthLabel: 'Twee derde' }
}

describe('widget picker model', () => {
  it('zoekt titel en omschrijving hoofdletterongevoelig', () => {
    const result = filterWidgetPresentations([fixture('MY_CONTRACT_DETAILS', 'Mijn contract'), fixture('EXPIRING_CONTRACTS', 'Aflopende contracten')], { query: 'CONTRACT', category: 'EMPLOYMENT', locale: 'nl' })
    expect(result.map((item) => item.type)).toEqual(['EXPIRING_CONTRACTS', 'MY_CONTRACT_DETAILS'])
  })
})
