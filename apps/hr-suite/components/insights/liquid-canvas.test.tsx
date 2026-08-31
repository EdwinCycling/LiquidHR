import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AnalysisResult } from '@/lib/insights/analysis-result'
import { LiquidCanvas, type LiquidCanvasLabels } from './liquid-canvas'

const labels: LiquidCanvasLabels = {
  title: 'Liquid Canvas',
  summary: 'Een vaste analyseweergave.',
  table: 'Analysetabel',
  dimension: 'Groepering',
  headcount: 'Aantal medewerkers',
  noResults: 'Geen resultaten',
  selectRow: 'Rij selecteren',
  unknown: 'Onbekend',
  fallback: 'Tabelweergave gebruikt.',
}

const kpiResult: AnalysisResult = {
  version: 1,
  source: 'workforce',
  entity: 'employees',
  measures: ['headcount'],
  dimensions: [],
  metadata: { matchedRecordCount: 4, groupCount: 0 },
  columns: [{ key: 'headcount', dataType: 'integer' }],
  rows: [{ values: { headcount: 4 } }],
  summary: { headcount: 4 },
  presentationHints: { preferred: 'kpi', fallback: 'table' },
}

const tableResult: AnalysisResult = {
  ...kpiResult,
  dimensions: ['department'],
  metadata: { matchedRecordCount: 3, groupCount: 2 },
  columns: [{ key: 'dimension', dataType: 'string' }, { key: 'headcount', dataType: 'integer' }],
  rows: [
    { values: { dimension: 'Engineering', headcount: 2 } },
    { values: { dimension: null, headcount: 1 } },
  ],
  summary: { headcount: 3 },
  presentationHints: { preferred: 'table', fallback: 'table' },
}

describe('Liquid Canvas', () => {
  it('renders a deterministic KPI when the result has no dimension', () => {
    const markup = renderToStaticMarkup(<LiquidCanvas labels={labels} result={kpiResult} />)

    expect(markup).toContain('data-liquid-canvas-view="kpi"')
    expect(markup).toContain('<output')
    expect(markup).toContain('>4</output>')
    expect(markup).not.toContain('<table')
  })

  it('renders grouped results as a Foundation table and keeps unknown visible', () => {
    const markup = renderToStaticMarkup(<LiquidCanvas labels={labels} result={tableResult} />)

    expect(markup).toContain('data-liquid-canvas-view="table"')
    expect(markup).toContain('<table')
    expect(markup).toContain('Engineering')
    expect(markup).toContain('Onbekend')
    expect(markup).not.toContain('tenant-a')
    expect(markup).not.toContain('employee-1')
  })

  it('falls back to a table for an unsupported presentation hint', () => {
    const markup = renderToStaticMarkup(<LiquidCanvas labels={labels} result={{ ...tableResult, presentationHints: { preferred: 'unsupported', fallback: 'table' } }} />)

    expect(markup).toContain('data-liquid-canvas-fallback="true"')
    expect(markup).toContain('<table')
  })

  it('shows a Foundation empty state for an empty grouped result', () => {
    const markup = renderToStaticMarkup(<LiquidCanvas labels={labels} result={{ ...tableResult, rows: [], metadata: { matchedRecordCount: 0, groupCount: 0 } }} />)

    expect(markup).toContain('Geen resultaten')
    expect(markup).not.toContain('<tbody')
  })
})
