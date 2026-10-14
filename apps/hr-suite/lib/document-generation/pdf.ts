import 'server-only'
import { existsSync, readFileSync as readFile } from 'node:fs'
import { resolve } from 'node:path'
import serverlessChromium from '@sparticuz/chromium'
import { chromium as playwrightChromium, type Browser } from 'playwright-core'
import { renderResolvedSnapshotToHtml, type HtmlRenderOptions } from './html'
import type { ResolvedGenerationSnapshot } from './domain'
export { DG1_RENDERER_VERSION, pdfHash } from './pdf-contract'

function resolveWorkSansFont(fileName: string): string {
  const candidates = Array.from({ length: 5 }, (_, level) => {
    let base = process.cwd()
    for (let index = 0; index < level; index += 1) base = resolve(base, '..')
    return resolve(base, 'node_modules', '@fontsource', 'work-sans', 'files', fileName)
  })
  const path = candidates.find((candidate) => existsSync(candidate))
  if (!path) throw new Error(`DG1_WORK_SANS_FONT_NOT_FOUND:${fileName}`)
  return path
}

function workSansFontData(): { weight: number; style: 'normal' | 'italic'; data: string }[] {
  return [
    { fileName: 'work-sans-latin-400-normal.woff2', weight: 400, style: 'normal' as const },
    { fileName: 'work-sans-latin-400-italic.woff2', weight: 400, style: 'italic' as const },
    { fileName: 'work-sans-latin-700-normal.woff2', weight: 700, style: 'normal' as const },
  ].map(({ fileName, weight, style }) => ({
    weight,
    style,
    data: readFile(resolveWorkSansFont(fileName)).toString('base64'),
  }))
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
    await page.setContent(renderResolvedSnapshotToHtml(snapshot, options), { waitUntil: 'load' })
    await page.emulateMedia({ media: 'print' })
    const fontStatuses = await page.evaluate(async (fonts) => {
      const loadResults = await Promise.all(fonts.map(async ({ weight, style, data }) => {
        const binary = atob(data)
        const bytes = new Uint8Array(binary.length)
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
        const face = new FontFace('Work Sans', bytes.buffer, { weight: String(weight), style })
        document.fonts.add(face)
        try {
          await face.load()
          return face.status
        } catch {
          return 'error'
        }
      }))
      await document.fonts.ready
      return loadResults
    }, workSansFontData())
    if (fontStatuses.length !== 3 || fontStatuses.some((status) => status !== 'loaded')) {
      throw new Error('DG1_WORK_SANS_FONT_LOAD_FAILED')
    }
    const bytes = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
    return normalizePdfMetadata(bytes)
  } finally {
    await browser.close()
  }
}
