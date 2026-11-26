import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'
import { chromium } from '@playwright/test'
import { ensureContext, loginWithTestAuth, navigateToRoute, parseArguments, switchFromHrAdmin } from './local-test-acceptance.mjs'

const appRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
nextEnv.loadEnvConfig(appRoot, true)
const config = parseArguments(process.argv.slice(2))
const dossierId = '85c2fdd9-9a82-438f-abc9-729feafad0f0'
const browser = await chromium.launch({ headless: true, ...(process.env.PERF_MVP_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PERF_MVP_CHROMIUM_EXECUTABLE_PATH } : {}) })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })

try {
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(Math.max(config.timeoutMs, 120000))
  await loginWithTestAuth(page, config, '/dashboard/start', { allowContextSelection: true })
  await ensureContext(context, config)
  await navigateToRoute(page, config, '/dashboard/start')
  await switchFromHrAdmin(page, config, 'manager', { label: 'desktop', width: 1440, height: 900 })
  await ensureContext(context, config)
  const response = await context.request.get(new URL(`/api/performance-reviews/dossiers/${dossierId}`, config.baseUrl).toString(), {
    headers: { origin: new URL(config.baseUrl).origin },
    failOnStatusCode: false,
  })
  const denied = [403, 404].includes(response.status())
  console.log(JSON.stringify({ actor: 'manager', probe: 'cross-administration dossier GET', status: response.status(), denied, responseBodyRecorded: false }, null, 2))
  if (!denied) process.exitCode = 1
} catch (error) {
  console.log(JSON.stringify({ actor: 'manager', probe: 'cross-administration dossier GET', status: 'NOT_RUN', errorCode: error instanceof Error && /^[A-Z0-9_]+$/u.test(error.message) ? error.message : 'PROBE_SETUP_FAILED', responseBodyRecorded: false }, null, 2))
  process.exitCode = 1
} finally {
  await context.close()
  await browser.close()
}
