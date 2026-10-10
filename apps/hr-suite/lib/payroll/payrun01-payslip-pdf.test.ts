import { describe, expect, it } from 'vitest'
import { renderPayrun01PayslipHtml, renderPayrun01PayslipPdf, type Payrun01PayslipPdfInput } from './payrun01-payslip-pdf'

const input: Payrun01PayslipPdfInput = {
  period: { year: 2026, month: 10, startsOn: '2026-10-01', endsOn: '2026-10-31' },
  run: { id: '11111111-1111-4111-8111-111111111111', resultHash: 'a'.repeat(64) },
  versions: {
    sourceHash: 'b'.repeat(64),
    inputHash: 'c'.repeat(64),
    configurationHash: 'd'.repeat(64),
    compositionId: 'payrun01-demo-company-test-2026.1',
    engineVersion: 'payroll-engine-test-1',
  },
  profile: {
    status: 'SYNTHETIC_TEST_PROFILE',
    employerName: 'LiquidHR Demo Company TEST',
    employeeName: '<Lisa TEST>',
    writtenContract: true,
    contractType: 'INDEFINITE',
    isOnCall: false,
    contractHoursPerWeek: 40,
    fulltimeHoursPerWeek: 40,
    minimumHourlyWage: '14.99',
    minimumHourlyWageEffectiveFrom: '2026-07-01',
    minimumHourlyWageAgeCategory: 'AGE_21_PLUS',
    source: 'PAYRUN01 synthetic payslip presentation inputs; not Core contract evidence.',
  },
  components: [
    { key: 'contractual_salary', amount: '5500.00' },
    { key: 'gross_salary', amount: '5500.00' },
    { key: 'employee_pension', amount: '0.00' },
    { key: 'wage_tax', amount: '1577.17' },
    { key: 'net_salary', amount: '3922.83' },
    { key: 'employer_pension', amount: '0.00' },
    { key: 'employer_insurance', amount: '1233.10' },
    { key: 'holiday_allowance_reserve', amount: '440.00' },
    { key: 'year_end_reserve', amount: '0.00' },
    { key: 'total_employer_cost', amount: '7173.10' },
  ],
}

describe('PAYRUN01 persisted TEST payslip PDF', () => {
  it('renders the statutory presentation fields and escapes persona-supplied text', () => {
    const html = renderPayrun01PayslipHtml(input)

    expect(html).toContain('TEST ONLY')
    expect(html).toContain('&lt;Lisa TEST&gt;')
    expect(html).toContain('Onbepaalde tijd')
    expect(html).toContain('Schriftelijke overeenkomst')
    expect(html).toContain('Oproepovereenkomst')
    expect(html).toContain('40 / 40 uur per week')
    expect(html).toContain('€\u00a014,99 per uur vanaf 2026-07-01')
    expect(html).toContain('€\u00a05.500,00')
    expect(html).toContain('€\u00a01.577,17')
    expect(html).toContain('€\u00a03.922,83')
    expect(html).toContain('not Core contract evidence')
    expect(html).not.toContain('<Lisa TEST>')
    expect(html).not.toContain('BSN')
  })

  it('requires a complete persisted monetary result', () => {
    const incomplete = { ...input, components: input.components.filter((row) => row.key !== 'wage_tax') }
    expect(() => renderPayrun01PayslipHtml(incomplete)).toThrow('PAYRUN01_PAYSLIP_RESULT_INCOMPLETE')
  })

  it('excludes unresolved PFZW amounts and labels the net and employer total as provisional', () => {
    const janInput: Payrun01PayslipPdfInput = {
      ...input,
      profile: { ...input.profile, pensionTreatment: 'EXCLUDED_SOURCE_GAP' },
      components: [
        ...input.components.filter((row) => row.key !== 'employee_pension' && row.key !== 'employer_pension'),
        { key: 'employee_pension', amount: '0.00' },
        { key: 'employer_pension', amount: '0.00' },
      ],
    }

    const html = renderPayrun01PayslipHtml(janInput)

    expect(html).toContain('PFZW is van toepassing op deze synthetische TEST-situatie, maar de maandpremie is niet berekend.')
    expect(html).toContain('Netto vóór niet-berekende PFZW-premie')
    expect(html).toContain('Totale werkgeverskosten vóór PFZW')
    expect(html).not.toContain('Pensioenpremie werknemer')
    expect(html).not.toContain('Werkgeverspremie pensioen')
  })

  it('renders valid PDF bytes from the stored-result presentation', async () => {
    const bytes = await renderPayrun01PayslipPdf(input)

    expect(Buffer.from(bytes).subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bytes.byteLength).toBeGreaterThan(1000)
  })
})
