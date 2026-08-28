import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { InsightsAnalysisDestination } from './insights-analysis-destination'

describe('Insights Analyse destination', () => {
  it('replaces the retired Dashboard destination with Analyse', () => {
    const markup = renderToStaticMarkup(<InsightsAnalysisDestination labels={{ title: 'Analyse', description: 'Open de analysehub.', active: 'Actief', open: 'Open Analyse' }} />)

    expect(markup).toContain('Analyse')
    expect(markup).toContain('href="/insights/analysis"')
    expect(markup).not.toContain('Dashboard')
  })
})
