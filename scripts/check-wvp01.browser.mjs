import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
const require = createRequire(new URL('../apps/hr-suite/package.json', import.meta.url))
const { chromium } = require('playwright-core')
const base = process.argv[2] ?? 'http://localhost:3010'
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('LOCAL_RUNTIME_REQUIRED')
const output = path.resolve('output/wvp01')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const result = { date: new Date().toISOString(), gate: 'OPEN', checks: [], browserErrors: 0, errorKinds: [] }
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  page.on('pageerror', error => {
    result.browserErrors++
    result.errorKinds.push({ route: new URL(page.url()).pathname, kind: /Kies een HR-groep|context|destination stream/i.test(error.message) ? 'CONTEXT_NAVIGATION' : 'BROWSER_EXCEPTION' })
  })
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' })
  const button = page.getByTestId('test-login-hr-admin')
  if (await button.count()) {
    result.persona = 'HR_ADMIN'
    await Promise.all([page.waitForURL(url => url.pathname !== '/login'), button.click()])
  } else {
    // Canonieke directe persona-login; geen nieuwe authenticatie of rolbypass.
    process.loadEnvFile(path.join(process.env.LOCALAPPDATA, 'LiquidHR/TestRuntime/payroll-test-personas.env'))
    if (!process.env.PAYROLL_TEST_LISA_EMAIL || !process.env.PAYROLL_TEST_LISA_PASSWORD) throw new Error('PAYROLL_TEST_LISA_CREDENTIALS_REQUIRED')
    result.persona = 'EMPLOYEE_LISA'
    await page.locator('input[name="email"]').fill(process.env.PAYROLL_TEST_LISA_EMAIL)
    await page.locator('input[name="password"]').fill(process.env.PAYROLL_TEST_LISA_PASSWORD)
    await Promise.all([page.waitForURL(url => url.pathname !== '/login'), page.locator('form button[type="submit"]').first().click()])
  }
  await page.goto(`${base}/context/select`, { waitUntil: 'networkidle' })
  if (new URL(page.url()).pathname === '/context/select') {
    const selection = page.locator('#context-selection')
    if (!(await selection.count())) throw new Error('CANONICAL_CONTEXT_SELECTION_UNAVAILABLE')
    const value = await selection.locator('option').nth(1).getAttribute('value')
    await selection.selectOption(value)
    await Promise.all([page.waitForURL(url => url.pathname !== '/context/select'), page.locator('form button[type="submit"]').click()])
  }
  // Alleen reads. Geen trajectstart, fixtures, e-mail of schemawrite.
  const response = await context.request.get(`${base}/api/absence/wvp`)
  const body = await response.json()
  result.apiStatus = response.status()
  result.schemaRequired = body.error === 'WVP_SCHEMA_REQUIRED'
  if (response.status() !== 503 || !result.schemaRequired) throw new Error('EXPECTED_SCHEMA_GATE_NOT_OBSERVED')
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const navigation = await page.goto(`${base}/absence/guidance`, { waitUntil: 'networkidle' })
    if (navigation.status() !== 200) throw new Error('GUIDANCE_ROUTE_FAILED')
    const status = page.getByRole('status').filter({ hasText: 'Verzuimbegeleiding is nog niet beschikbaar' })
    await status.waitFor()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    if (overflow) throw new Error(`HORIZONTAL_OVERFLOW_${width}`)
    result.checks.push({ width, route: '/absence/guidance', status: 'PASS', overflow: false })
    await page.screenshot({ path: path.join(output, `guidance-${width}.png`), fullPage: true })
  }
  const unauth = await browser.newContext()
  const denied = await unauth.request.get(`${base}/api/absence/wvp`)
  result.unauthenticatedStatus = denied.status()
  if (![401, 403].includes(denied.status())) throw new Error('UNAUTHENTICATED_ACCESS_NOT_DENIED')
  await unauth.close()
  result.gate = 'PARTIAL_SCHEMA_GATE_CONFIRMED'
  if (result.errorKinds.some(error => error.route.startsWith('/absence/guidance'))) throw new Error('WVP_BROWSER_EXCEPTION')
  await context.close()
} finally {
  await browser.close()
  await writeFile(path.join(output, 'browser-result.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
}
