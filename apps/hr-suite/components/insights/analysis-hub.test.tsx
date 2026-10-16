import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AnalysisHub, type AnalysisHubLabels } from './analysis-hub'

const labels: AnalysisHubLabels = {
  eyebrow: 'Liquid Analyse',
  title: 'Analyse',
  intro: 'Kies hoe je HR-informatie wilt verkennen.',
  exploreTitle: 'Verkennen',
  exploreDescription: 'Begin bij een medewerker, afdeling, functie of andere HR-entiteit.',
  myAnalysesTitle: 'Mijn analyses',
  myAnalysesDescription: 'Open je opgeslagen persoonlijke analyses.',
  reportsTitle: 'Rapporten',
  reportsDescription: 'Open vaste, gecertificeerde HR-rapportages.',
  openExplore: 'Open verkennen',
  openMyAnalyses: 'Open mijn analyses',
  openReports: 'Open rapporten',
}

describe('Liquid Analyse hub', () => {
  it('renders only the three available analysis destinations', () => {
    const markup = renderToStaticMarkup(<AnalysisHub labels={labels} />)

    expect((markup.match(/data-analysis-tile=/g) ?? [])).toHaveLength(3)
    expect(markup).not.toContain('data-analysis-status')
    expect(markup).not.toContain('Nieuwe analyse')
    expect(markup).toContain('Verkennen')
    expect(markup).toContain('Mijn analyses')
    expect(markup).toContain('Rapporten')
    expect(markup).toContain('href="/insights"')
    expect(markup).toContain('href="/insights/analysis/explore"')
    expect(markup).toContain('href="/insights/analysis/my-analyses"')
    expect(markup).not.toContain('new-analysis')
  })
})
