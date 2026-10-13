import { describe, expect, it } from 'vitest'
import {
  LIQUIDHR_STANDARD_PAYSLIP_TEMPLATE_ID,
  renderPayrun01PayslipHtml,
  renderPayrun01PayslipPdf,
  type Payrun01PayslipPdfInput,
} from './payrun01-payslip-pdf'

const input: Payrun01PayslipPdfInput = {
  data: {
    period: { year: 2026, month: 10, startsOn: '2026-10-01', endsOn: '2026-10-31' },
    profile: {
      status: 'SYNTHETIC_TEST_PROFILE',
      employerName: 'LiquidHR Demo Company TEST',
      employeeName: '<Lisa TEST>',
      writtenContract: true,
      contractType: 'INDEFINITE',
      isOnCall: false,
      contractHoursPerWeek: 40,
      fulltimeHoursPerWeek: 40,
    },
    components: [
      { key: 'contractual_salary', amount: '5500.00' },
      { key: 'gross_salary', amount: '5500.00' },
      { key: 'employee_pension', amount: '195.12' },
      { key: 'taxable_wage', amount: '5304.88' },
      { key: 'wage_tax', amount: '1477.33' },
      { key: 'net_salary', amount: '3827.55' },
      { key: 'employer_pension', amount: '390.23' },
      { key: 'employer_insurance', amount: '1189.36' },
      { key: 'holiday_reserve', amount: '440.00' },
      { key: 'year_end_reserve', amount: '0.00' },
      { key: 'total_employer_cost', amount: '7519.59' },
      { key: 'cumulative_gross', amount: '55000.00' },
      { key: 'cumulative_holiday_reserve', amount: '4400.00' },
      { key: 'cumulative_year_end_reserve', amount: '0.00' },
    ],
    sourceWarnings: ['Fiscale profielgegevens zijn niet bevestigd in de bron.'],
  },
  presentation: { templateId: LIQUIDHR_STANDARD_PAYSLIP_TEMPLATE_ID },
}

describe('PAYRUN01 LiquidHR Standard payslip PDF', () => {
  it('renders saved amounts and warnings in the standard employee-facing format without synthetic labels or provenance', () => {
    const html = renderPayrun01PayslipHtml(input)

    expect(html).toContain('LiquidHR Standard')
    expect(html).toContain('&lt;Lisa&gt;')
    expect(html).toContain('LiquidHR Company')
    expect(html).toContain('Onbepaalde tijd')
    expect(html).toContain('Schriftelijke overeenkomst')
    expect(html).toContain('40 / 40 uur per week')
    expect(html).toContain('€\u00a05.500,00')
    expect(html).toContain('€\u00a0195,12')
    expect(html).toContain('€\u00a01.477,33')
    expect(html).toContain('€\u00a03.827,55')
    expect(html).toContain('€\u00a07.519,59')
    expect(html).toContain('€\u00a055.000,00')
    expect(html).toContain('Fiscale profielgegevens zijn niet bevestigd in de bron.')
    expect(html).not.toMatch(/test|synthetisch|demo/i)
    expect(html).not.toContain('<Lisa>')
    expect(html).not.toContain('resultHash')
    expect(html).not.toContain('engineVersion')
    expect(html).not.toContain('BSN')
  })

  it('uses LiquidHR and employer branding when supplied and has a wordmark fallback', () => {
    const branded = renderPayrun01PayslipHtml({
      ...input,
      branding: {
        liquidHrLogoDataUrl: 'data:image/png;base64,aGVsbG8=',
        employerLogoDataUrl: 'data:image/jpeg;base64,aGVsbG8=',
      },
    })
    expect(branded).toContain('alt="LiquidHR"')
    expect(branded).toContain('alt="LiquidHR Company"')

    const fallback = renderPayrun01PayslipHtml({ ...input, branding: { liquidHrLogoDataUrl: null } })
    expect(fallback).toContain('class="wordmark-fallback">LiquidHR</span>')
    expect(fallback).toContain('class="employer-wordmark">LiquidHR Company</span>')
  })

  it('does not invent a name when only a synthetic marker remains', () => {
    expect(() => renderPayrun01PayslipHtml({
      ...input,
      data: { ...input.data, profile: { ...input.data.profile, employeeName: 'Testmedewerker' } },
    })).toThrow('PAYRUN01_PAYSLIP_PROFILE_INVALID')
  })

  it('requires a complete saved monetary result', () => {
    const incomplete: Payrun01PayslipPdfInput = {
      ...input,
      data: { ...input.data, components: input.data.components.filter((row) => row.key !== 'wage_tax') },
    }
    expect(() => renderPayrun01PayslipHtml(incomplete)).toThrow('PAYRUN01_PAYSLIP_RESULT_INCOMPLETE')
  })

  it('renders valid A4 PDF bytes from the saved-result presentation', async () => {
    const bytes = await renderPayrun01PayslipPdf({
      ...input,
      branding: { liquidHrLogoDataUrl: null },
    })

    expect(Buffer.from(bytes).subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bytes.byteLength).toBeGreaterThan(1000)
  })
})
