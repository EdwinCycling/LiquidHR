import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import en from '@/messages/en/navigation.json'
import nl from '@/messages/nl/navigation.json'
import { PayrollGrossOnlyConceptSlip, type PayrollGrossOnlyConceptSlipData, type PayrollGrossOnlyConceptSlipTranslator } from './gross-only-concept-slip'

const data: PayrollGrossOnlyConceptSlipData = {
  caseKey: 'CAO-BENCH02-K1',
  syntheticAdminLabel: 'CAO-BENCH02 (synthetic administration)',
  syntheticEmployeeLabel: 'CAO-BENCH02 K1 (synthetic employee)',
  periodLabel: 'August 2026',
  arrangementName: 'Kinderopvang',
  arrangementVersion: '2025–2026',
  statusLabel: 'SUCCEEDED',
  grossComponents: [{
    id: 'base-gross',
    label: 'Basic gross salary',
    amountLabel: 'server-supplied component amount',
    basisLabel: 'server-supplied basis',
    methodLabel: 'server-supplied method',
    percentageLabel: 'server-supplied percentage',
    hoursLabel: 'server-supplied hours',
    roundingLabel: 'server-supplied rounding',
    ruleRefs: ['kinderopvang.base-gross@1'],
  }],
  grossTotalLabel: 'Server-supplied gross total label',
  grossTotalAmountLabel: 'server-supplied gross total amount',
  technical: {
    runId: 'run-1',
    sourceSnapshotId: 'source-1',
    inputSetId: 'input-1',
    packageId: 'package-1',
    ruleIds: ['kinderopvang.base-gross@1'],
    engineVersion: 'engine-1',
    trace: ['trace-step-1'],
    hashes: { source: 'source-hash', input: 'input-hash', run: 'run-hash' },
    controls: ['control-1:PASS'],
  },
}

function translator(messages: Record<string, string>): PayrollGrossOnlyConceptSlipTranslator {
  return (key) => messages[key] ?? key
}

function render(localeMessages: Record<string, string>, overrides: Partial<PayrollGrossOnlyConceptSlipData> = {}) {
  return renderToStaticMarkup(createElement(PayrollGrossOnlyConceptSlip, { data: { ...data, ...overrides }, t: translator(localeMessages) }))
}

describe('PayrollGrossOnlyConceptSlip', () => {
  it('renders a Dutch gross-only concept with clearly uncalculated deductions, net and employer costs', () => {
    const markup = render(nl)

    expect(markup).toContain('TEST — CONCEPTBEREKENING — NIET VOOR LOONBETALING')
    expect(markup).toContain('Berekende brutocomponenten')
    expect(markup).toContain('CAO-BENCH02 K1 (synthetic employee)')
    expect(markup.match(/NIET BEREKEND/g)).toHaveLength(3)
    expect(markup).not.toContain('server-supplied net amount')
    expect(markup).toContain('<details')
  })

  it('renders English labels and the server-provided line calculation details', () => {
    const markup = render(en)

    expect(markup).toContain('TEST — CONCEPT CALCULATION — NOT FOR PAYROLL')
    expect(markup).toContain('NOT CALCULATED')
    expect(markup).toContain('Basic gross salary')
    expect(markup).toContain('server-supplied component amount')
    expect(markup).toContain('server-supplied basis')
    expect(markup).toContain('server-supplied method')
    expect(markup).toContain('server-supplied percentage')
    expect(markup).toContain('server-supplied hours')
    expect(markup).toContain('server-supplied rounding')
    expect(markup).toContain('kinderopvang.base-gross@1')
  })

  it('labels the arrangement version distinctly from the rule version in Dutch and English', () => {
    const dutchMarkup = render(nl, { arrangementVersion: '2026.07' })
    const englishMarkup = render(en, { arrangementVersion: '2026.07' })

    expect(dutchMarkup).toContain('Arrangementversie')
    expect(englishMarkup).toContain('Arrangement version')
    expect(dutchMarkup).not.toContain('Regelversie')
    expect(englishMarkup).not.toContain('Rule version')
    expect(dutchMarkup).toContain('2026.07')
    expect(englishMarkup).toContain('2026.07')
  })

  it('shows a specific note when exact total rounding differs from rounded lines', () => {
    const markup = render(en, {
      caseKey: 'CAO-BENCH02-K2',
      roundingNote: 'The displayed lines add to a different amount than the exact gross total.',
    })

    expect(markup).toContain('The displayed lines add to a different amount than the exact gross total.')
  })

  it('exposes all run provenance, hashes, trace and control data in the technical disclosure', () => {
    const markup = render(en)

    for (const value of [
      'run-1', 'source-1', 'input-1', 'package-1', 'engine-1',
      'source-hash', 'input-hash', 'run-hash', 'trace-step-1', 'control-1:PASS',
    ]) {
      expect(markup).toContain(value)
    }
    expect(markup).toContain('Calculation and technical details')
  })
})
