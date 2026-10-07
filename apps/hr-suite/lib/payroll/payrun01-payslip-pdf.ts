import 'server-only'

import { renderPayrollLabHtmlToPdf } from './validation-pack-pdf'

export interface Payrun01PayslipPdfInput {
  readonly period: {
    readonly year: number
    readonly month: number
    readonly startsOn: string
    readonly endsOn: string
  }
  readonly run: {
    readonly id: string
    readonly resultHash: string
  }
  readonly versions: {
    readonly sourceHash: string
    readonly inputHash: string
    readonly configurationHash: string
    readonly compositionId: string
    readonly engineVersion: string
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
    readonly minimumHourlyWage: string
    readonly minimumHourlyWageEffectiveFrom: string
    readonly minimumHourlyWageAgeCategory: 'AGE_21_PLUS'
    readonly source: string
  }
  readonly components: readonly { readonly key: string; readonly amount: string }[]
}

const MONEY_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/
const HASH_PATTERN = /^[0-9a-f]{64}$/
const COMPONENT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  contractual_salary: 'Contractueel maandsalaris',
  additional_cash_amount: 'Uitbetaling aanvullende uren',
  gross_salary: 'Bruto loon',
  employee_pension: 'Pensioenpremie werknemer',
  wage_tax: 'Loonheffing',
  net_salary: 'Netto loon na inhoudingen',
  employer_pension: 'Werkgeverspremie pensioen',
  employer_insurance: 'Werkgeverslasten',
  holiday_allowance_reserve: 'Reservering vakantietoeslag',
  year_end_reserve: 'Reservering eindejaarsuitkering',
  total_employer_cost: 'Totale werkgeverskosten',
})
const EMPLOYEE_KEYS = ['gross_salary', 'employee_pension', 'wage_tax', 'net_salary'] as const

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character)
}

function money(value: string): string {
  if (!MONEY_PATTERN.test(value)) throw new Error('PAYRUN01_PAYSLIP_MONEY_INVALID')
  const [whole, fraction = '00'] = value.split('.')
  const grouped = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 }).format(BigInt(whole))
  return `€\u00a0${grouped},${fraction.padEnd(2, '0')}`
}

function validateInput(input: Payrun01PayslipPdfInput): void {
  if (!Number.isInteger(input.period.year) || !Number.isInteger(input.period.month)
    || input.period.month < 1 || input.period.month > 12
    || input.run.id.length === 0
    || !HASH_PATTERN.test(input.run.resultHash)
    || !HASH_PATTERN.test(input.versions.sourceHash)
    || !HASH_PATTERN.test(input.versions.inputHash)
    || !HASH_PATTERN.test(input.versions.configurationHash)
    || input.profile.status !== 'SYNTHETIC_TEST_PROFILE'
    || input.profile.employerName.trim().length === 0
    || input.profile.employeeName.trim().length === 0
    || input.profile.source.trim().length === 0
    || !Number.isFinite(input.profile.contractHoursPerWeek)
    || !Number.isFinite(input.profile.fulltimeHoursPerWeek)
    || input.profile.contractHoursPerWeek <= 0
    || input.profile.fulltimeHoursPerWeek <= 0
    || !/^\d{4}-\d{2}-\d{2}$/.test(input.profile.minimumHourlyWageEffectiveFrom)
    || !MONEY_PATTERN.test(input.profile.minimumHourlyWage)) {
    throw new Error('PAYRUN01_PAYSLIP_PROFILE_INVALID')
  }
  const amounts = new Map(input.components.map((component) => [component.key, component.amount]))
  for (const key of EMPLOYEE_KEYS) {
    const amount = amounts.get(key)
    if (!amount || !MONEY_PATTERN.test(amount)) throw new Error('PAYRUN01_PAYSLIP_RESULT_INCOMPLETE')
  }
}

function resultRows(input: Payrun01PayslipPdfInput, keys: readonly string[]): string {
  const amounts = new Map(input.components.map((component) => [component.key, component.amount]))
  return keys.flatMap((key) => {
    const amount = amounts.get(key)
    const label = COMPONENT_LABELS[key]
    return amount && label
      ? [`<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(money(amount))}</td></tr>`]
      : []
  }).join('')
}

export function renderPayrun01PayslipHtml(input: Payrun01PayslipPdfInput): string {
  validateInput(input)
  const employeeRows = resultRows(input, EMPLOYEE_KEYS.filter((key) => key !== 'net_salary'))
  const employerRows = resultRows(input, [
    'employer_pension', 'employer_insurance', 'holiday_allowance_reserve',
    'year_end_reserve', 'total_employer_cost',
  ])
  const month = String(input.period.month).padStart(2, '0')
  const payPeriod = `${input.period.year}-${month}`
  const contractType = input.profile.contractType === 'DEFINITE' ? 'Bepaalde tijd' : 'Onbepaalde tijd'
  const written = input.profile.writtenContract ? 'Ja (synthetische TEST-aanname)' : 'Nee (synthetische TEST-aanname)'
  const onCall = input.profile.isOnCall ? 'Ja' : 'Nee'
  const contractHours = `${input.profile.contractHoursPerWeek} / ${input.profile.fulltimeHoursPerWeek} uur per week`
  const versions = [input.versions.sourceHash, input.versions.inputHash, input.versions.configurationHash, input.run.resultHash]

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PAYRUN01 TEST-loonstrook ${escapeHtml(payPeriod)}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { color: #17212b; font: 10pt/1.45 'Work Sans', Arial, sans-serif; margin: 0; }
    h1, h2, p { margin: 0; }
    h1 { font-size: 22pt; line-height: 1.15; }
    h2 { font-size: 12pt; margin: 15pt 0 5pt; }
    p { margin-top: 5pt; }
    .banner { background: #fff4cf; border: 1px solid #9b6a00; color: #442f00; font-weight: 700; margin-bottom: 15pt; padding: 9pt; }
    .metadata { border-bottom: 1px solid #ccd3da; display: grid; gap: 9pt 16pt; grid-template-columns: 1fr 1fr; margin: 13pt 0; padding-bottom: 12pt; }
    .meta-label { color: #52606d; display: block; font-size: 8pt; }
    .meta-value { display: block; font-weight: 600; margin-top: 2pt; overflow-wrap: anywhere; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid #d9dee3; padding: 6pt 4pt; text-align: left; vertical-align: top; }
    th { font-weight: 500; }
    td { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
    .net th, .net td { border-top: 2px solid #17212b; font-size: 12pt; font-weight: 700; }
    .subtle { color: #52606d; font-size: 8pt; }
    .mono { font-family: monospace; overflow-wrap: anywhere; }
    .versions { margin-top: 12pt; }
    .versions li { overflow-wrap: anywhere; margin: 2pt 0; }
  </style>
</head>
<body>
  <main>
    <div class="banner">TEST ONLY — synthetische Payroll Lab-presentatie, geen loonstrook voor betaling of juridisch gebruik.</div>
    <h1>Loonstrook</h1>
    <p class="subtle">PAYRUN01 · definitieve, opgeslagen rekenuitkomst · periode ${escapeHtml(payPeriod)}</p>
    <dl class="metadata">
      <div><dt class="meta-label">Werkgever</dt><dd class="meta-value">${escapeHtml(input.profile.employerName)}</dd></div>
      <div><dt class="meta-label">Werknemer</dt><dd class="meta-value">${escapeHtml(input.profile.employeeName)}</dd></div>
      <div><dt class="meta-label">Loonperiode</dt><dd class="meta-value">${escapeHtml(input.period.startsOn)} t/m ${escapeHtml(input.period.endsOn)}</dd></div>
      <div><dt class="meta-label">Contracturen</dt><dd class="meta-value">${escapeHtml(contractHours)}</dd></div>
      <div><dt class="meta-label">Contractvorm</dt><dd class="meta-value">${contractType}</dd></div>
      <div><dt class="meta-label">Schriftelijke overeenkomst</dt><dd class="meta-value">${written}</dd></div>
      <div><dt class="meta-label">Oproepovereenkomst</dt><dd class="meta-value">${onCall}</dd></div>
      <div><dt class="meta-label">Minimumuurloon 21+</dt><dd class="meta-value">${escapeHtml(money(input.profile.minimumHourlyWage))} per uur vanaf ${escapeHtml(input.profile.minimumHourlyWageEffectiveFrom)}</dd></div>
    </dl>
    <section aria-labelledby="employee-heading">
      <h2 id="employee-heading">Loon en inhoudingen</h2>
      <table><tbody>${employeeRows}<tr class="net"><th>Netto loon na inhoudingen</th><td>${escapeHtml(money(input.components.find((component) => component.key === 'net_salary')!.amount))}</td></tr></tbody></table>
    </section>
    <section aria-labelledby="employer-heading">
      <h2 id="employer-heading">Werkgeverskosten en reserveringen</h2>
      <table><tbody>${employerRows || '<tr><td colspan="2">Geen werkgeverscomponenten vastgelegd</td></tr>'}</tbody></table>
    </section>
    <p class="subtle">Contractstatus en identificatie in deze presentatie zijn expliciete PAYRUN01 TEST-velden; zij zijn geen Core-contractbewijs. ${escapeHtml(input.profile.source)}</p>
    <section class="versions" aria-labelledby="versions-heading">
      <h2 id="versions-heading">Herkomst van de opgeslagen uitkomst</h2>
      <p class="subtle">Run <span class="mono">${escapeHtml(input.run.id)}</span> · samenstelling <span class="mono">${escapeHtml(input.versions.compositionId)}</span> · engine <span class="mono">${escapeHtml(input.versions.engineVersion)}</span></p>
      <ul class="subtle">${versions.map((hash) => `<li class="mono">${escapeHtml(hash)}</li>`).join('')}</ul>
    </section>
  </main>
</body>
</html>`
}

export async function renderPayrun01PayslipPdf(input: Payrun01PayslipPdfInput): Promise<Uint8Array> {
  return await renderPayrollLabHtmlToPdf(renderPayrun01PayslipHtml(input))
}
