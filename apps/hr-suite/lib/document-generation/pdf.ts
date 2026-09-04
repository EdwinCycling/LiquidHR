import 'server-only'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync as readFile } from 'node:fs'
import serverlessChromium from '@sparticuz/chromium'
import { chromium as playwrightChromium, type Browser } from 'playwright-core'
import { renderResolvedSnapshotToHtml, type HtmlRenderOptions } from './html'
import type { ResolvedGenerationSnapshot } from './domain'

export const DG1_RENDERER_VERSION = 'dg1-html-css-chromium-a4-work-sans-1'

const nodeRequire = createRequire(import.meta.url)

function fontFace(fontPath: string, weight: number, style: 'normal' | 'italic'): string {
  const encoded = readFile(fontPath).toString('base64')
  return `@font-face{font-family:'Work Sans';font-style:${style};font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${encoded}) format('woff2');}`
}

function workSansFontCss(): string {
  return [
    fontFace(nodeRequire.resolve('@fontsource/work-sans/files/work-sans-latin-400-normal.woff2'), 400, 'normal'),
    fontFace(nodeRequire.resolve('@fontsource/work-sans/files/work-sans-latin-400-italic.woff2'), 400, 'italic'),
    fontFace(nodeRequire.resolve('@fontsource/work-sans/files/work-sans-latin-700-normal.woff2'), 700, 'normal'),
  ].join('')
}

function localExecutablePath(): string | null {
  const configured = process.env.DG1_CHROME_EXECUTABLE_PATH?.trim()
  const candidates = process.platform === 'win32'
    ? [
        configured,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ]
    : [configured, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  for (const candidate of candidates) {
    if (candidate && existsSync(/* turbopackIgnore: true */ candidate)) return candidate
  }
  return null
}

async function launchBrowser(): Promise<Browser> {
  const localPath = localExecutablePath()
  const useServerlessChromium = process.env.VERCEL === '1' || process.env.DG1_USE_SERVERLESS_CHROMIUM === 'true' || !localPath
  if (!useServerlessChromium && localPath) {
    return playwrightChromium.launch({ executablePath: localPath, headless: true })
  }
  const executablePath = await serverlessChromium.executablePath()
  return playwrightChromium.launch({
    args: [...serverlessChromium.args, '--disable-dev-shm-usage', '--no-sandbox'],
    executablePath,
    headless: true,
  })
}

function normalizePdfMetadata(bytes: Uint8Array): Uint8Array {
  const source = Buffer.from(bytes).toString('latin1')
  const stable = source.replace(/\(D:\d{14}[+-]\d{2}'\d{2}'\)/g, "(D:20000101000000+00'00')")
  return new Uint8Array(Buffer.from(stable, 'latin1'))
}

export async function renderResolvedSnapshotToPdf(snapshot: ResolvedGenerationSnapshot, options: HtmlRenderOptions = {}): Promise<Uint8Array> {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } })
    await page.setContent(renderResolvedSnapshotToHtml(snapshot, { ...options, fontFaceCss: workSansFontCss() }), { waitUntil: 'load' })
    await page.emulateMedia({ media: 'print' })
    await page.evaluate(() => document.fonts.ready)
    const bytes = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
    return normalizePdfMetadata(bytes)
  } finally {
    await browser.close()
  }
}

export function pdfHash(pdf: Uint8Array): string {
  return createHash('sha256').update(pdf).digest('hex')
}
