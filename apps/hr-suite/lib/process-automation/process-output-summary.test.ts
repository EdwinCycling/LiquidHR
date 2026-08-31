import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { processOutputSummaryText } from './process-output-summary'

describe('process output summary rendering', () => {
  it('maakt door een RPC aangeleverde HTML inert voordat de UI deze toont', () => {
    const summary = '<article><h1>Overplaatsing</h1><img src=x onerror="alert(1)"><dl><dt>Reden</dt><dd>&lt;script&gt;alert(2)&lt;/script&gt;</dd></dl></article>'

    const text = processOutputSummaryText(summary)

    expect(text).toContain('Overplaatsing')
    expect(text).toContain('Reden')
    expect(text).toContain('<script>alert(2)</script>')
    expect(text).not.toContain('<img')
    expect(text).not.toContain('onerror')
  })

  it('begrenst de weergegeven samenvatting', () => {
    expect(processOutputSummaryText(`<p>${'a'.repeat(20_000)}</p>`)).toHaveLength(10_000)
  })

  it('laat de procesoutputcomponent geen onbewerkte HTML injecteren', () => {
    const renderer = readFileSync(
      new URL('../../components/process-automation/process-work-detail.tsx', import.meta.url),
      'utf8',
    )

    expect(renderer).toContain('processOutputSummaryText(output.htmlSummary)')
    expect(renderer).not.toContain('dangerouslySetInnerHTML')
  })
})
