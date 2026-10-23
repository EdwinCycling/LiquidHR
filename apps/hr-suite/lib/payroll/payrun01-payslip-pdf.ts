import 'server-only'

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { renderPayrollLabHtmlToPdf } from './validation-pack-pdf'

export const LIQUIDHR_STANDARD_PAYSLIP_TEMPLATE_ID = 'LIQUIDHR_STANDARD_V1' as const
export const PAYROLL_TEST_DOCUMENT_NOTICE = 'TEST / NIET VOOR UITBETALING' as const

export interface Payrun01PayslipData {
  readonly period: {
    readonly year: number
    readonly month: number
    readonly startsOn: string
    readonly endsOn: string
  }
  /** Omitted for existing finalized artifacts; CONCEPT is an explicitly local preview only. */
  readonly lifecycle?: 'CONCEPT' | 'FINALIZED'
  readonly profile: {
    readonly status: 'SYNTHETIC_TEST_PROFILE' | 'PAYROLL_SOURCE_PROFILE'
    readonly employerName: string
    readonly employeeName: string
    readonly documentNotice?: typeof PAYROLL_TEST_DOCUMENT_NOTICE
    readonly writtenContract?: boolean
    readonly contractType?: 'DEFINITE' | 'INDEFINITE'
    readonly isOnCall?: boolean
    readonly contractHoursPerWeek?: number
    readonly fulltimeHoursPerWeek?: number
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
  variable_regular_wage: 'Variabel regulier loon',
  employee_pension: 'Pensioenpremie werknemer',
  taxable_wage: 'Loon voor loonheffing',
  employee_insurance_base: 'Loon voor werknemersverzekeringen',
  zvw_base: 'Loon voor Zvw',
  wage_tax: 'Loonheffing',
  net_reimbursement: 'Netto vergoeding',
  net_deduction: 'Netto inhouding',
  net_correction: 'Netto correctie',
  cumulative_gross: 'Cumulatief bruto loon',
  cumulative_taxable_wage: 'Cumulatief loon voor loonheffing',
  cumulative_wage_tax: 'Cumulatieve loonheffing',
})
const EARNINGS_KEYS = ['contractual_salary', 'additional_cash_amount', 'additional_hours_pay', 'variable_regular_wage'] as const
const DEDUCTION_KEYS = ['employee_pension', 'wage_tax', 'net_deduction'] as const
const TAX_BASE_KEYS = ['taxable_wage', 'employee_insurance_base', 'zvw_base'] as const
const OTHER_PAYMENT_KEYS = ['net_reimbursement', 'net_correction'] as const
const CUMULATIVE_KEYS = ['cumulative_gross', 'cumulative_taxable_wage', 'cumulative_wage_tax'] as const

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
    || (data.lifecycle !== undefined && data.lifecycle !== 'CONCEPT' && data.lifecycle !== 'FINALIZED')
    || (profile.status !== 'SYNTHETIC_TEST_PROFILE' && profile.status !== 'PAYROLL_SOURCE_PROFILE')
    || profile.employerName.trim().length === 0
    || profile.employeeName.trim().length === 0
    || (profile.documentNotice !== undefined && profile.documentNotice !== PAYROLL_TEST_DOCUMENT_NOTICE)
    || (profile.status === 'SYNTHETIC_TEST_PROFILE'
      && (profile.writtenContract === undefined
        || profile.contractType === undefined
        || profile.isOnCall === undefined
        || profile.contractHoursPerWeek === undefined
        || profile.fulltimeHoursPerWeek === undefined))
    || (profile.contractType !== undefined && profile.contractType !== 'DEFINITE' && profile.contractType !== 'INDEFINITE')
    || (profile.writtenContract !== undefined && typeof profile.writtenContract !== 'boolean')
    || (profile.isOnCall !== undefined && typeof profile.isOnCall !== 'boolean')
    || ((profile.contractHoursPerWeek === undefined) !== (profile.fulltimeHoursPerWeek === undefined))
    || (profile.contractHoursPerWeek !== undefined
      && (!Number.isFinite(profile.contractHoursPerWeek) || profile.contractHoursPerWeek <= 0))
    || (profile.fulltimeHoursPerWeek !== undefined
      && (!Number.isFinite(profile.fulltimeHoursPerWeek) || profile.fulltimeHoursPerWeek <= 0))) {
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

async function liquidHrBranding(): Promise<Payrun01PayslipBranding> {
  try {
    const bytes = await readFile(resolve(process.cwd(), 'public/brand/logo/branding/logo-horizontal.png'))
    return { liquidHrLogoDataUrl: `data:image/png;base64,${bytes.toString('base64')}` }
  } catch {
    try {
      const bytes = await readFile(resolve(process.cwd(), 'apps/hr-suite/public/brand/logo/branding/logo-horizontal.png'))
      return { liquidHrLogoDataUrl: `data:image/png;base64,${bytes.toString('base64')}` }
    } catch {
      // Missing branding assets use the wordmark fallback below.
      return { liquidHrLogoDataUrl: null }
    }
  }
}

export function renderPayrun01PayslipHtml(input: Payrun01PayslipPdfInput): string {
  validateInput(input)
  const { data } = input
  const employerName = professionalDisplayName(data.profile.employerName)
  const employeeName = professionalDisplayName(data.profile.employeeName)
  if (!employerName || !employeeName) throw new Error('PAYRUN01_PAYSLIP_PROFILE_INVALID')
  const pensionExcluded = data.profile.pensionTreatment === 'EXCLUDED_SOURCE_GAP'
  const period = `${data.period.year}-${String(data.period.month).padStart(2, '0')}`
  const isConcept = data.lifecycle === 'CONCEPT'
  const testNotice = data.profile.documentNotice === PAYROLL_TEST_DOCUMENT_NOTICE
    ? `<p class="payroll-safety-notice" role="note">${PAYROLL_TEST_DOCUMENT_NOTICE}</p>`
    : ''
  const earningsRows = resultRows(data, EARNINGS_KEYS)
  const deductionRows = resultRows(data, pensionExcluded ? ['wage_tax'] : DEDUCTION_KEYS)
  const taxBaseRows = resultRows(data, TAX_BASE_KEYS)
  const otherPaymentRows = resultRows(data, OTHER_PAYMENT_KEYS)
  const cumulativeRows = resultRows(data, CUMULATIVE_KEYS)
  const netAmount = data.components.find((component) => component.key === 'net_salary')?.amount
  if (!netAmount) throw new Error('PAYRUN01_PAYSLIP_RESULT_INCOMPLETE')

  const liquidHrLogo = safeLogo(input.branding?.liquidHrLogoDataUrl, 'LiquidHR')
  const employerLogo = safeLogo(input.branding?.employerLogoDataUrl, employerName)
  const employerBrand = employerLogo || `<span class="employer-wordmark">${escapeHtml(employerName)}</span>`
  const warnings = data.sourceWarnings.length > 0
    ? `<aside class="source-warnings" aria-label="Bronwaarschuwingen"><strong>Aandachtspunt bij brongegevens</strong><ul>${data.sourceWarnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul></aside>`
    : ''
  const contractType = data.profile.contractType === undefined
    ? null
    : data.profile.contractType === 'DEFINITE' ? 'Bepaalde tijd' : 'Onbepaalde tijd'
  const contractHours = data.profile.contractHoursPerWeek === undefined || data.profile.fulltimeHoursPerWeek === undefined
    ? null
    : `${data.profile.contractHoursPerWeek} / ${data.profile.fulltimeHoursPerWeek} uur per week`
  const contractDescription = contractType && contractHours
    ? `${escapeHtml(contractType)} · ${escapeHtml(contractHours)}${data.profile.isOnCall ? ' · oproep' : ''}`
    : null
  const netLabel = pensionExcluded ? 'Netto vóór niet-berekende pensioenpremie' : 'Netto-uitbetaling'
  const pensionNotice = pensionExcluded
    ? '<p class="pension-notice">De pensioenpremie is niet berekend. Het nettobedrag is niet definitief zolang de pensioenbron niet is geverifieerd.</p>'
    : ''
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
    .payroll-safety-notice { background: #fff0ef; border: 2px solid #b42318; border-radius: 4pt; color: #8c1d18; font-size: 11pt; font-weight: 800; letter-spacing: 0.4pt; margin: 0 0 10pt; padding: 8pt 10pt; text-align: center; }
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
      <div><h1>Loonstrook</h1><p class="subtitle">LiquidHR Standard${isConcept ? ' · CONCEPT — NIET DEFINITIEF' : ''}</p></div>
      <div class="period">LOONPERIODE&nbsp;&nbsp;${escapeHtml(period)}</div>
    </div>
    ${testNotice}
    <dl class="metadata">
      <div><dt class="meta-label">Werknemer</dt><dd class="meta-value">${escapeHtml(employeeName)}</dd></div>
      <div><dt class="meta-label">Werkgever</dt><dd class="meta-value">${escapeHtml(employerName)}</dd></div>
      <div><dt class="meta-label">Periode</dt><dd class="meta-value">${escapeHtml(data.period.startsOn)} t/m ${escapeHtml(data.period.endsOn)}</dd></div>
      ${contractDescription ? `<div><dt class="meta-label">Contract</dt><dd class="meta-value">${contractDescription}</dd></div>` : ''}
      ${data.profile.writtenContract === undefined ? '' : `<div><dt class="meta-label">Schriftelijke overeenkomst</dt><dd class="meta-value">${data.profile.writtenContract ? 'Ja' : 'Nee'}</dd></div>`}
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
      <section class="section" aria-labelledby="tax-bases-heading">
        <h2 id="tax-bases-heading">Fiscale grondslagen</h2>
        <table><tbody>${taxBaseRows}</tbody></table>
      </section>
      <section class="section" aria-labelledby="other-payments-heading">
        <h2 id="other-payments-heading">Netto vergoedingen en correcties</h2>
        <table><tbody>${otherPaymentRows}</tbody></table>
      </section>
    </div>
    <section class="net" aria-label="${escapeHtml(netLabel)}"><span class="net-label">${escapeHtml(netLabel)}</span><strong class="net-value">${escapeHtml(money(netAmount))}</strong></section>
    <div class="support-grid">
      <section class="section" aria-labelledby="cumulative-heading">
        <h2 id="cumulative-heading">Aantoonbare cumulatieven</h2>
        <table><tbody>${cumulativeRows || noCumulativeRows}</tbody></table>
      </section>
    </div>
    <p class="footer-note">${isConcept
    ? 'Lokale CONCEPT-proef op basis van synthetische TEST-invoer. Niet gebruiken voor uitbetaling; er is geen salarisrun of PDF opgeslagen.'
    : data.profile.documentNotice === PAYROLL_TEST_DOCUMENT_NOTICE
      ? 'TEST / NIET VOOR UITBETALING. Synthetische testfinalisatie in een geïsoleerde lokale testdatabase; de bedragen zijn geen loonrun voor een echte werknemer.'
      : 'De bedragen zijn overgenomen uit de opgeslagen definitieve salarisrun. Voor deze PDF is geen nieuwe loonberekening uitgevoerd.'}</p>
  </main>
</body>
</html>`
}

export async function renderPayrun01PayslipPdf(input: Payrun01PayslipPdfInput): Promise<Uint8Array> {
  const branding = input.branding ?? await liquidHrBranding()
  return await renderPayrollLabHtmlToPdf(renderPayrun01PayslipHtml({ ...input, branding }))
}
