import 'server-only'

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { renderPayrollLabHtmlToPdf } from './validation-pack-pdf'

export const LIQUIDHR_STANDARD_PAYSLIP_TEMPLATE_ID = 'LIQUIDHR_STANDARD_V1' as const

export interface Payrun01PayslipData {
  readonly period: {
    readonly year: number
    readonly month: number
    readonly startsOn: string
    readonly endsOn: string
  }
  readonly profile: {
    readonly status: 'SYNTHETIC_TEST_PROFILE'
    readonly employerName: string
    readonly employeeName: string
    readonly writtenContract: boolean
    readonly contractType: 'DEFINITE' | 'INDEFINITE'
    readonly isOnCall: boolean
    readonly contractHoursPerWeek: number
    readonly fulltimeHoursPerWeek: number
    readonly pensionTreatment?: 'DISABLED' | 'EXCLUDED_SOURCE_GAP'
  }
  readonly components: readonly { readonly key: string; readonly amount: string }[]
  readonly sourceWarnings: readonly string[]
}

export interface Payrun01PayslipBranding {
  readonly liquidHrLogoDataUrl: string | null
  readonly employerLogoDataUrl?: string | null
}

export interface Payrun01PayslipPdfInput {
  readonly data: Payrun01PayslipData
  readonly branding?: Payrun01PayslipBranding
  readonly presentation: { readonly templateId: typeof LIQUIDHR_STANDARD_PAYSLIP_TEMPLATE_ID }
}

const MONEY_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/
const COMPONENT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  contractual_salary: 'Contractueel salaris',
  additional_cash_amount: 'Toeslagen en vergoedingen',
  additional_hours_pay: 'Uitbetaling aanvullende uren',
  gross_salary: 'Bruto loon',
  employee_pension: 'Pensioenpremie werknemer',
  taxable_wage: 'Loon voor loonheffing',
  wage_tax: 'Loonheffing',
  employer_pension: 'Pensioenpremie werkgever',
  employer_insurance: 'Werkgeverslasten',
  holiday_allowance_reserve: 'Reservering vakantietoeslag',
  holiday_reserve: 'Reservering vakantietoeslag',
  year_end_reserve: 'Reservering eindejaarsuitkering',
  total_employer_cost: 'Totale werkgeverskosten',
  cumulative_gross: 'Cumulatief bruto loon',
  cumulative_holiday_reserve: 'Cumulatieve reservering vakantietoeslag',
  cumulative_year_end_reserve: 'Cumulatieve reservering eindejaarsuitkering',
})
const EARNINGS_KEYS = ['contractual_salary', 'additional_cash_amount', 'additional_hours_pay'] as const
const DEDUCTION_KEYS = ['employee_pension', 'wage_tax'] as const
const EMPLOYER_KEYS = [
  'employer_pension',
  'employer_insurance',
  'holiday_allowance_reserve',
  'holiday_reserve',
  'year_end_reserve',
  'total_employer_cost',
] as const
const CUMULATIVE_KEYS = ['cumulative_gross', 'cumulative_holiday_reserve', 'cumulative_year_end_reserve'] as const

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character)
}

function professionalDisplayName(value: string): string {
  return value
    .replace(/\b(?:synthetic|synthetisch(?:e|en)?|test(?:medewerker)?|demo)\b/gi, ' ')
    .replace(/\s+([,.;>])/g, '$1')
    .replace(/[\s\u00a0]+/g, ' ')
    .replace(/^[\s|,./·:–—-]+|[\s|,./·:–—-]+$/g, '')
}

function money(value: string): string {
  if (!MONEY_PATTERN.test(value)) throw new Error('PAYRUN01_PAYSLIP_MONEY_INVALID')
  const [whole, fraction = '00'] = value.split('.')
  const grouped = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 }).format(BigInt(whole))
  return `€\u00a0${grouped},${fraction.padEnd(2, '0')}`
}

function componentAmounts(data: Payrun01PayslipData): ReadonlyMap<string, string> {
  const amounts = new Map<string, string>()
  for (const component of data.components) {
    if (!component.key || !MONEY_PATTERN.test(component.amount)) throw new Error('PAYRUN01_PAYSLIP_MONEY_INVALID')
    amounts.set(component.key, component.amount)
  }
  return amounts
}

function validateInput(input: Payrun01PayslipPdfInput): void {
  const { data } = input
  const { period, profile } = data
  if (input.presentation.templateId !== LIQUIDHR_STANDARD_PAYSLIP_TEMPLATE_ID
    || !Number.isInteger(period.year) || !Number.isInteger(period.month)
    || period.month < 1 || period.month > 12
    || !ISO_DATE_PATTERN.test(period.startsOn) || !ISO_DATE_PATTERN.test(period.endsOn)
    || profile.status !== 'SYNTHETIC_TEST_PROFILE'
    || profile.employerName.trim().length === 0
    || profile.employeeName.trim().length === 0
    || !Number.isFinite(profile.contractHoursPerWeek)
    || !Number.isFinite(profile.fulltimeHoursPerWeek)
    || profile.contractHoursPerWeek <= 0
    || profile.fulltimeHoursPerWeek <= 0) {
    throw new Error('PAYRUN01_PAYSLIP_PROFILE_INVALID')
  }

  const amounts = componentAmounts(data)
  const requiredKeys = profile.pensionTreatment === 'EXCLUDED_SOURCE_GAP'
    ? ['gross_salary', 'wage_tax', 'net_salary']
    : ['gross_salary', 'employee_pension', 'wage_tax', 'net_salary']
  if (requiredKeys.some((key) => !amounts.has(key))) throw new Error('PAYRUN01_PAYSLIP_RESULT_INCOMPLETE')
}

function resultRows(data: Payrun01PayslipData, keys: readonly string[]): string {
  const amounts = componentAmounts(data)
  return keys.flatMap((key) => {
    const amount = amounts.get(key)
    const label = COMPONENT_LABELS[key]
    return amount && label
      ? [`<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(money(amount))}</td></tr>`]
      : []
  }).join('')
}

function safeLogo(dataUrl: string | null | undefined, alt: string): string {
  return dataUrl && IMAGE_DATA_URL_PATTERN.test(dataUrl)
    ? `<img class="brand-image" src="${dataUrl}" alt="${escapeHtml(alt)}">`
    : ''
}

function logoCandidates(): string[] {
  const candidates: string[] = []
  let root = resolve(process.cwd())
  for (let level = 0; level < 6; level += 1) {
    candidates.push(
      resolve(root, 'public/brand/logo/branding/logo-horizontal.png'),
      resolve(root, 'apps/hr-suite/public/brand/logo/branding/logo-horizontal.png'),
    )
    root = resolve(root, '..')
  }
  return [...new Set(candidates)]
}

async function liquidHrBranding(): Promise<Payrun01PayslipBranding> {
  for (const path of logoCandidates()) {
    try {
      const bytes = await readFile(path)
      return { liquidHrLogoDataUrl: `data:image/png;base64,${bytes.toString('base64')}` }
    } catch {
      // Missing branding assets use the wordmark fallback below.
    }
  }
  return { liquidHrLogoDataUrl: null }
}

export function renderPayrun01PayslipHtml(input: Payrun01PayslipPdfInput): string {
  validateInput(input)
  const { data } = input
  const employerName = professionalDisplayName(data.profile.employerName)
  const employeeName = professionalDisplayName(data.profile.employeeName)
  if (!employerName || !employeeName) throw new Error('PAYRUN01_PAYSLIP_PROFILE_INVALID')
  const pensionExcluded = data.profile.pensionTreatment === 'EXCLUDED_SOURCE_GAP'
  const period = `${data.period.year}-${String(data.period.month).padStart(2, '0')}`
  const earningsRows = resultRows(data, EARNINGS_KEYS)
  const deductionRows = resultRows(data, pensionExcluded ? ['wage_tax'] : DEDUCTION_KEYS)
  const employerRows = resultRows(data, EMPLOYER_KEYS)
  const cumulativeRows = resultRows(data, CUMULATIVE_KEYS)
  const netAmount = data.components.find((component) => component.key === 'net_salary')?.amount
  if (!netAmount) throw new Error('PAYRUN01_PAYSLIP_RESULT_INCOMPLETE')

  const liquidHrLogo = safeLogo(input.branding?.liquidHrLogoDataUrl, 'LiquidHR')
  const employerLogo = safeLogo(input.branding?.employerLogoDataUrl, employerName)
  const employerBrand = employerLogo || `<span class="employer-wordmark">${escapeHtml(employerName)}</span>`
  const warnings = data.sourceWarnings.length > 0
    ? `<aside class="source-warnings" aria-label="Bronwaarschuwingen"><strong>Aandachtspunt bij brongegevens</strong><ul>${data.sourceWarnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul></aside>`
    : ''
  const contractType = data.profile.contractType === 'DEFINITE' ? 'Bepaalde tijd' : 'Onbepaalde tijd'
  const contractHours = `${data.profile.contractHoursPerWeek} / ${data.profile.fulltimeHoursPerWeek} uur per week`
  const netLabel = pensionExcluded ? 'Netto vóór niet-berekende pensioenpremie' : 'Netto-uitbetaling'
  const pensionNotice = pensionExcluded
    ? '<p class="pension-notice">De pensioenpremie is niet berekend. Het nettobedrag is niet definitief zolang de pensioenbron niet is geverifieerd.</p>'
    : ''
  const noEmployerRows = '<tr><td colspan="2" class="empty-row">Geen werkgeverskosten of reserveringen vastgelegd</td></tr>'
  const noCumulativeRows = '<tr><td colspan="2" class="empty-row">Geen cumulatieven vastgelegd</td></tr>'

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Loonstrook ${escapeHtml(period)}</title>
  <style>
    @page { size: A4; margin: 13mm 15mm 17mm; @bottom-right { content: "Pagina " counter(page) " / " counter(pages); color: #526777; font: 8pt 'Work Sans', Arial, sans-serif; } }
    * { box-sizing: border-box; }
    body { color: #122b45; font: 9.2pt/1.4 'Work Sans', Arial, sans-serif; margin: 0; }
    h1, h2, p, dl, ul { margin: 0; }
    h1 { font-size: 21pt; line-height: 1.1; letter-spacing: -0.4pt; }
    h2 { color: #1b4864; font-size: 9pt; font-weight: 700; letter-spacing: 0.5pt; margin: 0 0 5pt; text-transform: uppercase; }
    .header { align-items: center; border-bottom: 2px solid #16a6aa; display: flex; gap: 20pt; justify-content: space-between; min-height: 44pt; padding: 0 0 10pt; }
    .brand { align-items: center; display: flex; min-height: 34pt; }
    .brand-image { display: block; height: auto; max-height: 37pt; max-width: 158pt; object-fit: contain; }
    .wordmark-fallback { color: #082b50; font-size: 19pt; font-weight: 700; letter-spacing: -0.8pt; }
    .employer-brand { color: #526777; font-size: 9pt; font-weight: 600; max-width: 190pt; text-align: right; }
    .employer-brand .brand-image { max-height: 30pt; max-width: 150pt; margin-left: auto; }
    .title-row { align-items: end; display: flex; gap: 12pt; justify-content: space-between; margin: 13pt 0 10pt; }
    .subtitle { color: #526777; font-size: 8pt; margin-top: 3pt; }
    .period { border: 1px solid #c6e4e3; border-radius: 4pt; color: #0a666a; font-size: 8pt; font-weight: 700; padding: 6pt 8pt; white-space: nowrap; }
    .metadata { border-bottom: 1px solid #d5e0e5; display: grid; gap: 8pt 17pt; grid-template-columns: 1fr 1fr; margin: 0 0 11pt; padding: 0 0 10pt; }
    .meta-label { color: #526777; display: block; font-size: 7pt; }
    .meta-value { display: block; font-size: 9pt; font-weight: 600; margin-top: 1pt; overflow-wrap: anywhere; }
    .source-warnings, .pension-notice { background: #fff7e7; border: 1px solid #e7c77d; border-radius: 4pt; color: #5a4215; font-size: 8pt; margin: 0 0 10pt; padding: 7pt 9pt; }
    .source-warnings ul { margin-top: 3pt; padding-left: 13pt; }
    .pension-notice { margin-top: 8pt; }
    .calculation-grid { display: grid; gap: 15pt; grid-template-columns: 1.15fr 0.85fr; }
    .section { break-inside: avoid; margin-top: 10pt; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid #e2e9ec; padding: 5pt 3pt; vertical-align: top; }
    th { font-weight: 500; text-align: left; }
    td { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
    .total th, .total td { border-top: 1.5px solid #9eb3bd; color: #122b45; font-weight: 700; }
    .empty-row { color: #687e8a; font-size: 8pt; text-align: left; }
    .net { align-items: center; background: #eff8f7; border-left: 4px solid #16a6aa; border-radius: 4pt; display: flex; justify-content: space-between; margin-top: 12pt; padding: 10pt 12pt; }
    .net-label { color: #185263; font-size: 9pt; font-weight: 700; }
    .net-value { color: #082b50; font-size: 21pt; font-weight: 700; font-variant-numeric: tabular-nums; }
    .support-grid { display: grid; gap: 15pt; grid-template-columns: 1fr 1fr; }
    .footer-note { border-top: 1px solid #d5e0e5; color: #687e8a; font-size: 7pt; margin-top: 12pt; padding-top: 6pt; }
  </style>
</head>
<body>
  <main>
    <header class="header">
      <div class="brand">${liquidHrLogo || '<span class="wordmark-fallback">LiquidHR</span>'}</div>
      <div class="employer-brand">${employerBrand}</div>
    </header>
    <div class="title-row">
      <div><h1>Loonstrook</h1><p class="subtitle">LiquidHR Standard</p></div>
      <div class="period">LOONPERIODE&nbsp;&nbsp;${escapeHtml(period)}</div>
    </div>
    <dl class="metadata">
      <div><dt class="meta-label">Werknemer</dt><dd class="meta-value">${escapeHtml(employeeName)}</dd></div>
      <div><dt class="meta-label">Werkgever</dt><dd class="meta-value">${escapeHtml(employerName)}</dd></div>
      <div><dt class="meta-label">Periode</dt><dd class="meta-value">${escapeHtml(data.period.startsOn)} t/m ${escapeHtml(data.period.endsOn)}</dd></div>
      <div><dt class="meta-label">Contract</dt><dd class="meta-value">${escapeHtml(contractType)} · ${escapeHtml(contractHours)}${data.profile.isOnCall ? ' · oproep' : ''}</dd></div>
      <div><dt class="meta-label">Schriftelijke overeenkomst</dt><dd class="meta-value">${data.profile.writtenContract ? 'Ja' : 'Nee'}</dd></div>
      <div><dt class="meta-label">Template</dt><dd class="meta-value">LiquidHR Standard</dd></div>
    </dl>
    ${warnings}
    <div class="calculation-grid">
      <section class="section" aria-labelledby="earnings-heading">
        <h2 id="earnings-heading">Bruto-opbouw</h2>
        <table><tbody>${earningsRows}<tr class="total"><th scope="row">Bruto loon</th><td>${escapeHtml(money(data.components.find((component) => component.key === 'gross_salary')!.amount))}</td></tr></tbody></table>
      </section>
      <section class="section" aria-labelledby="deductions-heading">
        <h2 id="deductions-heading">Inhoudingen</h2>
        <table><tbody>${deductionRows}</tbody></table>
        ${pensionNotice}
      </section>
    </div>
    <section class="net" aria-label="${escapeHtml(netLabel)}"><span class="net-label">${escapeHtml(netLabel)}</span><strong class="net-value">${escapeHtml(money(netAmount))}</strong></section>
    <div class="support-grid">
      <section class="section" aria-labelledby="employer-heading">
        <h2 id="employer-heading">Werkgeverskosten en reserveringen</h2>
        <table><tbody>${employerRows || noEmployerRows}</tbody></table>
      </section>
      <section class="section" aria-labelledby="cumulative-heading">
        <h2 id="cumulative-heading">Aantoonbare cumulatieven</h2>
        <table><tbody>${cumulativeRows || noCumulativeRows}</tbody></table>
      </section>
    </div>
    <p class="footer-note">De bedragen zijn overgenomen uit de opgeslagen definitieve salarisrun. Voor deze PDF is geen nieuwe loonberekening uitgevoerd.</p>
  </main>
</body>
</html>`
}

export async function renderPayrun01PayslipPdf(input: Payrun01PayslipPdfInput): Promise<Uint8Array> {
  const branding = input.branding ?? await liquidHrBranding()
  return await renderPayrollLabHtmlToPdf(renderPayrun01PayslipHtml({ ...input, branding }))
}
