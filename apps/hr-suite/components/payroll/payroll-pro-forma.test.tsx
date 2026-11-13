// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PayrollProForma, type Labels } from './payroll-pro-forma'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const labels: Labels = {
  scenarioType: 'Scenario', bonus: 'Eenmalige bruto bonus',
  bonusUnavailable: 'Toekomstige uitbreiding.',
  extraPaidHours: 'Extra betaalde uren', salaryIncrease: 'Salarisverhoging', contractHours: 'Wijziging contracturen',
  amount: 'Bruto bedrag in euro\'s', hours: 'Extra uren', percentage: 'Verhoging in procenten', hoursPerWeek: 'Contracturen per week',
  calculate: 'Bereken scenario', calculating: 'Berekenen…', baseline: 'Huidig', scenario: 'Scenario', difference: 'Verschil', metric: 'Loononderdeel',
  gross: 'Bruto', employeePension: 'Werknemerspensioen', employerPension: 'Werkgeverspensioen', taxableWage: 'Fiscaal loon',
  wageTax: 'Loonheffing', net: 'Netto', employerCosts: 'Werkgeverskosten', sourceReady: 'Bronnen compleet.', sourceGap: 'Brongegevens ontbreken.',
  sourceIncomplete: 'Payroll-bronnen zijn onvolledig.', scenarioUnsupported: 'Scenario wordt niet ondersteund.',
  calculationFailed: 'Berekening is niet afgerond.', warning: 'Er wordt niets opgeslagen.', explanation: 'Uitleg',
  inputInstruction: 'Kies één loonregel en pas de invoer aan.', noResult: 'De proefloonstrook verschijnt na een berekening.',
  paySlip: 'Proefloonstrook', netDifference: 'Verschil in nettoloon',
  sourceHash: 'Bronhash', inputHash: 'Invoerhash', resultHash: 'Resultaathash', traceSteps: 'Tracestappen',
  serviceUnavailable: 'Service niet beschikbaar.', period: 'Periode',
}

const englishLabels: Labels = {
  ...labels,
  scenarioType: 'Scenario', bonus: 'One-time gross bonus',
  bonusUnavailable: 'Future enhancement.',
  extraPaidHours: 'Extra paid hours', salaryIncrease: 'Salary increase', contractHours: 'Change in contract hours',
  amount: 'Gross amount in euros', hours: 'Extra hours', percentage: 'Increase percentage', hoursPerWeek: 'Contract hours per week',
  calculate: 'Calculate scenario', calculating: 'Calculating…', baseline: 'Current', difference: 'Difference', metric: 'Pay item',
  gross: 'Gross', employeePension: 'Employee pension', employerPension: 'Employer pension', taxableWage: 'Taxable wage',
  wageTax: 'Wage tax', net: 'Net', employerCosts: 'Employer costs', sourceReady: 'Sources are complete.',
  sourceGap: 'Source data is missing.', sourceIncomplete: 'Payroll sources are incomplete.', scenarioUnsupported: 'Scenario is unsupported.',
  calculationFailed: 'Calculation failed.', warning: 'Nothing is saved.', explanation: 'Details',
  inputInstruction: 'Choose one pay item and edit its input.', noResult: 'The preview payslip appears after a calculation.',
  paySlip: 'Preview payslip', netDifference: 'Change in net pay', sourceHash: 'Source hash', inputHash: 'Input hash',
  resultHash: 'Result hash', traceSteps: 'Trace steps', serviceUnavailable: 'Service unavailable.', period: 'Period',
  scenario: 'Scenario',
}

const resultBody = {
  status: 'CALCULATED',
  sourceStatus: 'READY',
  scenarioType: 'EXTRA_PAID_HOURS',
  period: { year: 2026, month: 11 },
  sourceHash: 'source-hash',
  baseline: { gross: '3000.00', employeePension: '100.00', employerPension: '200.00', taxableWage: '2900.00', wageTax: '500.00', net: '2300.00', employerCosts: '3300.00' },
  scenario: { gross: '3125.00', employeePension: '104.17', employerPension: '208.33', taxableWage: '3020.83', wageTax: '520.00', net: '2425.50', employerCosts: '3433.33' },
  difference: { gross: '125.00', employeePension: '4.17', employerPension: '8.33', taxableWage: '120.83', wageTax: '20.00', net: '125.50', employerCosts: '133.33' },
  hashes: { baselineInput: 'baseline-input', baselineResult: 'baseline-result', scenarioInput: 'scenario-input', scenarioResult: 'scenario-result' },
  traceSteps: 12,
  gaps: [],
}

function mount(endpoint: string, locale = 'nl', activeLabels: Labels = labels) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(createElement(PayrollProForma, { endpoint, labels: activeLabels, locale })))
  return { host, unmount: () => act(() => root.unmount()) }
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('PayrollProForma editable preview payslip', () => {
  it.each([
    '/api/my-salary/pro-forma',
    '/api/hr-admin/employees/91000000-0000-4000-8000-000000000001/pro-forma',
  ])('keeps BONUS blank, read-only and disabled for %s', async (endpoint) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const mounted = mount(endpoint)
    const input = mounted.host.querySelector<HTMLInputElement>('#pro-forma-bonus-input')
    const bonusRadio = mounted.host.querySelector<HTMLInputElement>('#pro-forma-option-bonus')
    const button = mounted.host.querySelector<HTMLButtonElement>('button[type="submit"]')
    const form = mounted.host.querySelector('form')

    expect(mounted.host.textContent).toContain(labels.bonus)
    expect(mounted.host.textContent).toContain(labels.bonusUnavailable)
    expect(input?.readOnly).toBe(true)
    expect(input?.getAttribute('aria-readonly')).toBe('true')
    expect(input?.value).toBe('')
    expect(bonusRadio?.disabled).toBe(true)
    expect(button?.disabled).toBe(true)

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(fetchMock).not.toHaveBeenCalled()

    mounted.unmount()
  })

  it.each([
    { type: 'EXTRA_PAID_HOURS', inputId: 'pro-forma-input-extra_paid_hours', value: '2', expected: { type: 'EXTRA_PAID_HOURS', hours: '2' } },
    { type: 'SALARY_INCREASE', inputId: 'pro-forma-input-salary_increase', value: '5', expected: { type: 'SALARY_INCREASE', percentage: '5' } },
    { type: 'CONTRACT_HOURS', inputId: 'pro-forma-input-contract_hours', value: '32', expected: { type: 'CONTRACT_HOURS', hoursPerWeek: '32' } },
  ])('sends only the selected editable pay line: $type', async ({ type, inputId, value, expected }) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...resultBody, scenarioType: type }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const mounted = mount('/api/my-salary/pro-forma')
    const radio = mounted.host.querySelector<HTMLInputElement>(`#pro-forma-option-${type.toLowerCase()}`)
    const input = mounted.host.querySelector<HTMLInputElement>(`#${inputId}`)
    const button = mounted.host.querySelector<HTMLButtonElement>('button[type="submit"]')

    if (!radio || !input || !button) throw new Error(`Missing input for ${type}`)
    act(() => radio.click())
    setInputValue(input, value)
    expect(radio.checked).toBe(true)
    expect(mounted.host.querySelectorAll<HTMLInputElement>('input[name="pro-forma-scenario"]:checked')).toHaveLength(1)
    expect(button.disabled).toBe(false)

    await act(async () => button.click())

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(request.body))).toEqual(expected)
    expect(mounted.host.textContent).toContain(labels.paySlip)
    expect(mounted.host.textContent).toContain(labels.netDifference)
    expect(mounted.host.querySelector('[data-testid="pro-forma-net-difference"]')?.textContent).toContain('+')
    expect(mounted.host.textContent).toContain('scenario-result')

    mounted.unmount()
  })

  it('formats the result for English and keeps the payslip layout responsive', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(resultBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const mounted = mount('/api/my-salary/pro-forma', 'en', englishLabels)
    const input = mounted.host.querySelector<HTMLInputElement>('#pro-forma-input-extra_paid_hours')
    const button = mounted.host.querySelector<HTMLButtonElement>('button[type="submit"]')
    if (!input || !button) throw new Error('Missing extra hours controls')
    setInputValue(input, '2')
    await act(async () => button.click())

    expect(mounted.host.textContent).toContain('Preview payslip')
    expect(mounted.host.textContent).toContain('Change in net pay')
    const table = mounted.host.querySelector('table')
    const desktopLayout = table?.parentElement
    const mobileLayout = mounted.host.querySelector('.md\\:hidden')
    expect(table?.className).not.toContain('min-w-')
    expect(desktopLayout?.className).toContain('md:block')
    expect(mobileLayout?.className).toContain('md:hidden')
    expect(mounted.host.textContent).toContain('€125.50')

    mounted.unmount()
  })
})
