import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ProcessInsightsQuery, ProcessInsightsReport } from '@/lib/insights/process-automation-insights'
import { ProcessAutomationInsightsReport, type ProcessAutomationInsightsLabels } from './process-automation-insights-report'

const labels = new Proxy({} as ProcessAutomationInsightsLabels, {
  get: (_target, key) => String(key),
})

const query: ProcessInsightsQuery = {
  from: '2026-10-01',
  to: '2026-10-31',
  page: 1,
}

const report: ProcessInsightsReport = {
  fromDate: query.from,
  toDate: query.to,
  generatedAt: '2026-10-31T22:00:00',
  summary: {
    started: 5,
    completed: 2,
    runningNow: 1,
    rejected: 1,
    cancelled: 1,
    averageLeadSeconds: 86400,
    medianLeadSeconds: 43200,
    slaDenominator: 3,
    slaWithin: 1,
    slaOutside: 2,
  },
  processTotal: 1,
  processes: [{
    processDefinitionId: '00000000-0000-4000-8000-000000000101',
    processTitle: 'Onboarding',
    versionNumber: 2,
    started: 5,
    completed: 2,
    runningNow: 1,
    rejected: 1,
    cancelled: 1,
    averageLeadSeconds: 86400,
    medianLeadSeconds: 43200,
    slaDenominator: 3,
    slaWithin: 1,
    slaOutside: 2,
    sampleWorkItemId: '00000000-0000-4000-8000-000000000501',
  }],
  stepTotal: 1,
  steps: [{
    processTitle: 'Onboarding',
    versionNumber: 2,
    stepTitle: 'Beoordelen',
    waitSampleCount: 2,
    awaitingFirstClaimCount: 1,
    averageWaitSeconds: 7200,
    medianWaitSeconds: 3600,
    slaDenominator: 3,
    slaWithin: 1,
    slaOutside: 2,
  }],
  processOptions: [{ id: '00000000-0000-4000-8000-000000000101', title: 'Onboarding' }],
  page: 1,
  pageSize: 20,
}

describe('ProcessAutomationInsightsReport', () => {
  it('renders accessible filters, versioned aggregates, definitions, and an authorized task-detail link', () => {
    const html = renderToStaticMarkup(createElement(ProcessAutomationInsightsReport, {
      labels,
      locale: 'nl-NL',
      query,
      report,
      state: 'ready',
    }))
    expect(html).toContain('for="process-insights-from"')
    expect(html).toContain('id="process-insights-process"')
    expect(html).toContain('aria-labelledby="process-insights-summary"')
    expect(html).toContain('aria-label="pagination"')
    expect(html).not.toContain('processDefinitionId')
    expect(html).not.toContain('>00000000-0000-4000-8000-000000000101<')
    expect(html).toContain('href="/work/00000000-0000-4000-8000-000000000501"')
    expect(html).toContain('<details')
    expect(html).toContain('33% (1/3)')
    expect(html).toContain('repeatedSlaOverrun')
  })

  it('shows explicit denied, invalid-filter, and empty states without relying on color', () => {
    const denied = renderToStaticMarkup(createElement(ProcessAutomationInsightsReport, {
      labels,
      locale: 'en-US',
      query: null,
      report: null,
      state: 'denied',
    }))
    const invalid = renderToStaticMarkup(createElement(ProcessAutomationInsightsReport, {
      labels,
      locale: 'en-US',
      query: null,
      report: null,
      state: 'invalid',
    }))
    const empty = renderToStaticMarkup(createElement(ProcessAutomationInsightsReport, {
      labels,
      locale: 'en-US',
      query,
      report: { ...report, processTotal: 0, processes: [], stepTotal: 0, steps: [], processOptions: [] },
      state: 'ready',
    }))
    expect(denied).toContain('deniedTitle')
    expect(invalid).toContain('invalidFilters')
    expect(empty).toContain('emptyTitle')
    expect(empty).toContain('noProcesses')
  })
})
