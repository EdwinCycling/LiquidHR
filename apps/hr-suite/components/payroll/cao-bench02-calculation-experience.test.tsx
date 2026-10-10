import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import en from '@/messages/en/navigation.json'
import nl from '@/messages/nl/navigation.json'
import { CaoBench02CalculationExperience } from './cao-bench02-calculation-experience'

function render(messages: Record<string, string>) {
  return renderToStaticMarkup(createElement(CaoBench02CalculationExperience, {
    caseKey: 'CAO-BENCH02-R2',
    canRun: false,
    latest: null,
    errorMessage: null,
    locale: 'nl-NL',
    administrationName: 'Jupiter BV',
    t: (key: string) => messages[key] ?? key,
  }))
}

describe('CAO-BENCH02 Retail calculation scope notice', () => {
  it('provides the concept-slip gross total label in both locales', () => {
    expect(en.payrollLabConceptSlipGrossTotal).toBe('Gross total')
    expect(nl.payrollLabConceptSlipGrossTotal).toBe('Totaal bruto')
  })

  it('shows the excluded vacation allowance and supported table rows in Dutch before a run', () => {
    const markup = render(nl)

    expect(markup).toContain('Alleen de volwassen Mode-tabelrijen C/1 (R2) en I/15 (R1) zijn geïmplementeerd.')
    expect(markup).toContain('geen vakantietoeslag van 8%')
  })

  it('shows the matching scope notice in English', () => {
    const markup = render(en)

    expect(markup).toContain('Only adult Mode table rows C/1 (R2) and I/15 (R1) are implemented.')
    expect(markup).toContain('excludes the 8% vacation allowance (vakantietoeslag)')
  })
})
