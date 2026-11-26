import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'
import { chromium } from '@playwright/test'
import { ensureContext, loginWithTestAuth, navigateToRoute, parseArguments, switchFromHrAdmin } from './local-test-acceptance.mjs'

const appRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
nextEnv.loadEnvConfig(appRoot, true)
const config = parseArguments(process.argv.slice(2))
const screenshotDir = resolve(appRoot, '../../docs/quality/acceptance/runs/PERF-MVP-01-20261126/screenshots')
await mkdir(screenshotDir, { recursive: true })
const views = [
  { actor: 'hr-admin', route: '/workforce/conversations', headings: { nl: 'Gespreksrondes', en: 'Conversation rounds' } },
  { actor: 'manager', route: '/workforce/conversations', headings: { nl: 'Mijn team', en: 'My team' } },
  { actor: 'employee', route: '/my-conversations', headings: { nl: 'Mijn gesprekken', en: 'My conversations' } },
]
const results = []
const browser = await chromium.launch({ headless: true, ...(process.env.PERF_MVP_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PERF_MVP_CHROMIUM_EXECUTABLE_PATH } : {}) })

async function openByKeyboard(page, route) {
  await page.keyboard.press('Tab')
  for (let index = 0; index < 80; index += 1) {
    const active = await page.evaluate(() => {
      const element = document.activeElement
      return {
        href: element instanceof HTMLAnchorElement ? new URL(element.href).pathname : null,
        visible: Boolean(element?.getClientRects().length),
        focusVisible: element?.matches(':focus-visible') ?? false,
      }
    })
    if (active.href === route) {
      if (!active.visible || !active.focusVisible) throw new Error('FOCUS_INDICATOR_NOT_VISIBLE')
      await page.keyboard.press('Enter')
      await page.waitForURL((url) => url.pathname === route, { timeout: config.timeoutMs })
      return true
    }
    await page.keyboard.press('Tab')
  }
  return false
}

try {
  for (const view of views) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    page.setDefaultNavigationTimeout(Math.max(config.timeoutMs, 120000))
    await loginWithTestAuth(page, config, '/dashboard/start', { allowContextSelection: true })
    const actorConfig = view.actor === 'employee' ? { ...config, administrationId: null, requireServerAuthorizedAdministration: true } : config
    await ensureContext(context, actorConfig)
    await navigateToRoute(page, config, '/dashboard/start')
    if (view.actor !== 'hr-admin') {
      await switchFromHrAdmin(page, config, view.actor, { label: 'desktop', width: 1440, height: 900 })
      await ensureContext(context, actorConfig)
      await navigateToRoute(page, config, '/dashboard/start')
    }
    const locale = await page.locator('html').getAttribute('lang')
    if (locale !== 'nl' && locale !== 'en') throw new Error('DOCUMENT_LOCALE_INVALID')
    const keyboard = await openByKeyboard(page, view.route)
    if (!keyboard) throw new Error('KEYBOARD_ROUTE_UNREACHABLE')
    const heading = (await page.locator('h1').first().innerText()).trim()
    if (heading !== view.headings[locale]) throw new Error('ROLE_HEADING_LOCALE_MISMATCH')
    const screenshot = resolve(screenshotDir, `${view.actor}-keyboard-c3.png`)
    await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' })
    results.push({ actor: view.actor, status: 'PASS', locale, keyboardRoute: true, focusVisible: true, heading, screenshot })
    await context.close()
  }
  console.log(JSON.stringify({ mode: 'local-existing-personas-read-only', codeSha: process.env.PERF_MVP_CODE_SHA ?? null, results }, null, 2))
} catch (error) {
  const message = error instanceof Error && /^[A-Z0-9_]+$/u.test(error.message) ? error.message : 'KEYBOARD_CLOSEOUT_FAILED'
  console.log(JSON.stringify({ mode: 'local-existing-personas-read-only', codeSha: process.env.PERF_MVP_CODE_SHA ?? null, results, status: 'FAIL', code: message }, null, 2))
  process.exitCode = 1
} finally {
  await browser.close()
}
