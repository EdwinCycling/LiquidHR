import 'server-only'

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import serverlessChromium from '@sparticuz/chromium'
import { chromium as playwrightChromium, type Browser } from 'playwright-core'
import { formatPayrollMoneyForDisplay } from '@/app/(dashboard)/payroll-lab/format-money'
import type { CaoBench02ValidationPack } from './validation-pack'
import { ValidationPackError } from './validation-pack'

const GROSS_LINE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  base_salary: 'Bruto basissalaris',
  work_hour_supplement: 'Werkurentoeslag',
  base_monthly_gross: 'Bruto basissalaris per maand',
  selected_premium_gross: 'Geselecteerde bruto toeslag',
})

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      case "'": return '&#39;'
      default: return character
    }
  })
}

function grossAmounts(pack: CaoBench02ValidationPack): { lines: Array<{ label: string; amount: string }>; total: string } {
  const byKey = new Map(pack.result.components.map((component) => [component.key, component.amount]))
  const totalKey = byKey.has('gross_salary') ? 'gross_salary' : 'gross_pay'
  const total = byKey.get(totalKey)
  if (typeof total !== 'string') throw new ValidationPackError('VALIDATION_PACK_DATA_INVALID')

  const lineKeys = [...Object.keys(GROSS_LINE_LABELS), 'gross_salary', 'gross_pay']
  const lines = lineKeys
    .filter((key) => key !== totalKey && byKey.has(key))
    .map((key) => {
      const amount = byKey.get(key)
      if (typeof amount !== 'string') throw new ValidationPackError('VALIDATION_PACK_DATA_INVALID')
      return { label: GROSS_LINE_LABELS[key] ?? 'Bruto looncomponent', amount }
    })
  return { lines, total }
}

function sourceReferenceRows(pack: CaoBench02ValidationPack): string {
  return Object.entries(pack.provenance.sourceReferences).map(([key, value]) => {
    const label = escapeHtml(key)
    const content = escapeHtml(value)
    const url = /^https:\/\//i.test(value) ? ` <a href="${content}">${content}</a>` : ` ${content}`
    return `<tr><th>${label}</th><td>${url}</td></tr>`
  }).join('')
}

/** Creates a self-contained HTML document; the complete stable JSON pack is included as its appendix. */
export function renderCaoBench02ValidationPackHtml(pack: CaoBench02ValidationPack): string {
  const gross = grossAmounts(pack)
  const caseKey = escapeHtml(pack.case.caseKey)
  const runId = escapeHtml(pack.run.runId)
  const period = `${pack.case.period.year}-${String(pack.case.period.month).padStart(2, '0')}`
  const periodLabel = escapeHtml(period)
  const arrangement = escapeHtml(pack.case.arrangementName)
  const arrangementVersion = escapeHtml(pack.case.arrangementVersion)
  const lines = gross.lines.map(({ label, amount }) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(formatPayrollMoneyForDisplay(amount, 'nl-NL'))}</td></tr>`).join('')
  const total = escapeHtml(formatPayrollMoneyForDisplay(gross.total, 'nl-NL'))
  const roundingNote = pack.case.caseKey === 'CAO-BENCH02-K2'
    ? '<p class="rounding-note">Regelbedragen zijn afzonderlijk afgerond op eurocenten volgens HALF_UP. Het brutototaal is afgerond op basis van de exacte waarden en kan daardoor één cent afwijken van de som van de getoonde regels. De JSON-bijlage bewaart de exacte waarden.</p>'
    : ''
  const jsonAppendix = escapeHtml(JSON.stringify(pack, null, 2))
  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Proefstrook bruto - ${caseKey}</title>
  <style>
    @page { size: A4; margin: 17mm 16mm 18mm; }
    * { box-sizing: border-box; }
    body { color: #17212b; font: 10pt/1.48 'Work Sans', Arial, sans-serif; margin: 0; }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 21pt; line-height: 1.2; }
    h2 { font-size: 13pt; margin-bottom: 8pt; }
    p { margin-top: 5pt; }
    .banner { background: #fff4cf; border: 1px solid #9b6a00; border-radius: 5pt; color: #442f00; font-size: 10pt; font-weight: 700; margin-bottom: 17pt; padding: 9pt 11pt; }
    .subtle { color: #52606d; }
    .case { font-family: monospace; font-size: 8pt; overflow-wrap: anywhere; }
    .metadata { border-bottom: 1px solid #ccd3da; display: grid; gap: 11pt 18pt; grid-template-columns: 1fr 1fr; margin: 15pt 0; padding-bottom: 13pt; }
    .meta-label { color: #52606d; display: block; font-size: 8pt; }
    .meta-value { display: block; font-weight: 600; margin-top: 2pt; overflow-wrap: anywhere; }
    table { border-collapse: collapse; width: 100%; }
    .slip th, .slip td, .refs th, .refs td { border-bottom: 1px solid #d9dee3; padding: 7pt 5pt; text-align: left; vertical-align: top; }
    .slip th { font-weight: 500; }
    .slip td { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
    .gross-total th, .gross-total td { border-top: 2px solid #17212b; font-size: 12pt; font-weight: 700; }
    .rounding-note { background: #f3f5f7; border: 1px solid #d3d9df; border-radius: 5pt; margin-top: 9pt; padding: 8pt; }
    .limitations { background: #f3f5f7; border: 1px solid #d3d9df; border-radius: 5pt; margin-top: 17pt; padding: 11pt; }
    .limitations ul { margin: 6pt 0 0; padding-left: 17pt; }
    .limitations li { margin: 2pt 0; }
    .technical { break-before: page; page-break-before: always; }
    .technical p { font-size: 8pt; }
    .refs { font-size: 7.5pt; table-layout: fixed; }
    .refs th { font-family: monospace; font-weight: 500; overflow-wrap: anywhere; width: 36%; }
    .refs td { overflow-wrap: anywhere; }
    a { color: #174f78; overflow-wrap: anywhere; }
    pre { background: #f4f6f8; border: 1px solid #dce2e7; border-radius: 4pt; font: 6.6pt/1.36 monospace; margin: 8pt 0 0; overflow-wrap: anywhere; padding: 9pt; white-space: pre-wrap; word-break: break-word; }
    .mono { font-family: monospace; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <main>
    <div class="banner">${escapeHtml(pack.notice)}</div>
    <h1>Proefstrook bruto</h1>
    <p class="case">Testcase ${caseKey} · run ${runId}</p>
    <dl class="metadata">
      <div><dt class="meta-label">Synthetische administratie</dt><dd class="meta-value">CAO-BENCH02 (synthetisch)</dd></div>
      <div><dt class="meta-label">Synthetische werknemer</dt><dd class="meta-value">Synthetische werknemer ${caseKey}</dd></div>
      <div><dt class="meta-label">Loonperiode</dt><dd class="meta-value">${periodLabel}</dd></div>
      <div><dt class="meta-label">Regeling en versie</dt><dd class="meta-value">${arrangement} · ${arrangementVersion}</dd></div>
      <div><dt class="meta-label">Status</dt><dd class="meta-value">Geslaagd · concept</dd></div>
      <div><dt class="meta-label">Regelpakket</dt><dd class="meta-value mono">${escapeHtml(pack.provenance.packageId)}</dd></div>
    </dl>

    <section aria-labelledby="gross-heading">
      <h2 id="gross-heading">Berekende bruto-componenten</h2>
      <table class="slip"><tbody>
        ${lines}
        <tr class="gross-total"><th>Totaal bruto</th><td>${total}</td></tr>
      </tbody></table>
      ${roundingNote}
    </section>

    <section class="limitations">
      <h2>Niet berekend in deze conceptstrook</h2>
      <ul>
        <li>Loonheffing: NIET BEREKEND</li>
        <li>Werknemersinhoudingen: NIET BEREKEND</li>
        <li>Nettoloon: NIET BEREKEND</li>
        <li>Werkgeverskosten: NIET BEREKEND</li>
        <li>Deze proefberekening is niet geschikt voor loonbetaling.</li>
      </ul>
    </section>
    ${pack.provenance.scopeNotice ? `<section class="limitations"><h2>Begrenzing Retail-berekening</h2><p>${escapeHtml(pack.provenance.scopeNotice)}</p></section>` : ''}

    <section class="technical">
      <h1>Berekenings- en technische bijlage</h1>
      <p>Run-ID: <span class="mono">${runId}</span></p>
      <h2>Bronverwijzingen</h2>
      <table class="refs"><tbody>${sourceReferenceRows(pack)}</tbody></table>
      <h2 style="margin-top: 15pt">Volledig gestructureerd validatiepakket</h2>
      <p class="subtle">De JSON hieronder bevat de vastgelegde synthetische input, uitkomsten, bronmomentopname, regelversies, hashes, trace en controles.</p>
      <pre>${jsonAppendix}</pre>
    </section>
  </main>
</body>
</html>`
}

function resolveFont(fileName: string): string {
  const candidates = Array.from({ length: 5 }, (_, level) => {
    let base = process.cwd()
    for (let index = 0; index < level; index += 1) base = resolve(base, '..')
    return resolve(base, 'node_modules', '@fontsource', 'work-sans', 'files', fileName)
  })
  const path = candidates.find((candidate) => existsSync(candidate))
  if (!path) throw new Error('VALIDATION_PACK_FONT_UNAVAILABLE')
  return path
}

function fontFace(fileName: string, weight: number): string {
  const bytes = readFileSync(resolveFont(fileName)).toString('base64')
  return `@font-face{font-family:'Work Sans';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${bytes}) format('woff2');}`
}

function localChromePath(): string | null {
  const configured = process.env.DG1_CHROME_EXECUTABLE_PATH?.trim()
  const candidates = process.platform === 'win32'
    ? [configured, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe']
    : [configured, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  return candidates.find((candidate): candidate is string => Boolean(candidate && existsSync(candidate))) ?? null
}

async function launchBrowser(): Promise<Browser> {
  const chromePath = localChromePath()
  const useServerless = process.env.VERCEL === '1'
    || process.env.DG1_USE_SERVERLESS_CHROMIUM === 'true'
    || !chromePath
  if (!useServerless && chromePath) return playwrightChromium.launch({ executablePath: chromePath, headless: true })
  const executablePath = await serverlessChromium.executablePath()
  return playwrightChromium.launch({
    args: [...serverlessChromium.args, '--disable-dev-shm-usage', '--no-sandbox'],
    executablePath,
    headless: true,
  })
}

export async function renderPayrollLabHtmlToPdf(html: string): Promise<Uint8Array> {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } })
    await page.setContent(html, { waitUntil: 'load' })
    await page.addStyleTag({ content: `${fontFace('work-sans-latin-400-normal.woff2', 400)}${fontFace('work-sans-latin-700-normal.woff2', 700)}` })
    await page.emulateMedia({ media: 'print' })
    await page.evaluate(() => document.fonts.ready)
    return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
  } finally {
    await browser.close()
  }
}

export async function renderCaoBench02ValidationPackPdf(pack: CaoBench02ValidationPack): Promise<Uint8Array> {
  return await renderPayrollLabHtmlToPdf(renderCaoBench02ValidationPackHtml(pack))
}
