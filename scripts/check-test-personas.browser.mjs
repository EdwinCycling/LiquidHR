import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../apps/hr-suite/package.json', import.meta.url))
const { chromium } = require('playwright-core')

const [catalogPath, baseUrl = 'http://localhost:3010', credentialPath = '', credentialConfigReady = 'false'] = process.argv.slice(2)
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
const origin = new URL(baseUrl)
const personas = catalog.personas
const scope = catalog.scope
const results = new Map(personas.map((persona) => [persona.key, { personaKey: persona.key, status: 'BLOCKED', reasons: [], expectedGaps: [] }]))
let browser

function addReason(personaKey, reason) {
  const result = results.get(personaKey)
  if (result && !result.reasons.includes(reason)) result.reasons.push(reason)
}

function addExpectedGap(personaKey, reason) {
  const result = results.get(personaKey)
  if (result && !result.expectedGaps.includes(reason)) result.expectedGaps.push(reason)
}

const credentialNames = personas.flatMap((persona) => [
  `PAYROLL_TEST_${persona.key.toUpperCase()}_EMAIL`,
  `PAYROLL_TEST_${persona.key.toUpperCase()}_PASSWORD`,
])

function loadPersonaCredentials() {
  for (const name of credentialNames) delete process.env[name]
  if (credentialConfigReady !== 'true' || !credentialPath || typeof process.loadEnvFile !== 'function') return null
  try {
    process.loadEnvFile(credentialPath)
  } catch {
    return null
  }

  const credentials = new Map()
  for (const persona of personas) {
    const prefix = `PAYROLL_TEST_${persona.key.toUpperCase()}`
    const email = process.env[`${prefix}_EMAIL`]
    const password = process.env[`${prefix}_PASSWORD`]
    if (email?.trim().toLowerCase() !== persona.email || !password || password.length < 24) return null
    credentials.set(persona.key, { email, password })
  }
  const passwords = [...credentials.values()].map(({ password }) => password)
  return new Set(passwords).size === passwords.length ? credentials : null
}

const credentials = loadPersonaCredentials()

async function activeContext(page) {
  const response = await page.context().request.get(new URL('/api/context', origin).toString())
  if (response.status() !== 200) return null
  const body = await response.json()
  const context = body?.data
  return context ? {
    tenantId: context.tenant?.id ?? null,
    hrGroupId: context.activeHrGroup?.id ?? null,
    administrationId: context.activeAdministration?.id ?? null,
  } : null
}

async function chooseDropdownOption(page, triggerSelector, labelText = null) {
  const trigger = page.locator(triggerSelector)
  if (!(await trigger.count())) return { ok: false, cause: 'trigger-missing' }
  await trigger.click()
  const options = page.getByRole('option')
  const option = labelText ? options.filter({ hasText: labelText }).first() : options.nth(1)
  const visible = await option.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)
  if (!visible) return { ok: false, cause: 'option-missing' }
  await option.click()
  return { ok: true, cause: null }
}

async function contextMatches(page, expectedAdministrationId) {
  let context = await activeContext(page).catch(() => null)
  if (context?.administrationId !== expectedAdministrationId) {
    const administration = page.locator('#administration-switcher')
    if (await administration.count()) {
      const selected = await administration.selectOption({ label: scope.administration.name }).catch(() => [])
      if (selected.length > 0) {
        const form = administration.locator('xpath=ancestor::form')
        await Promise.all([
          page.waitForResponse((response) => {
            try {
              return response.request().method() === 'POST'
                && new URL(response.url()).pathname === '/api/context/administration'
            } catch {
              return false
            }
          }, { timeout: 15000 }),
          form.locator('button[type="submit"]').click(),
        ]).catch(() => undefined)
        await page.waitForFunction(async (ids) => {
          const response = await fetch('/api/context', { cache: 'no-store' })
          if (!response.ok) return false
          const body = await response.json()
          return body?.data?.tenant?.id === ids.tenantId
            && body?.data?.activeHrGroup?.id === ids.hrGroupId
            && body?.data?.activeAdministration?.id === ids.administrationId
        }, {
          tenantId: scope.tenant.id,
          hrGroupId: scope.hrGroup.id,
          administrationId: expectedAdministrationId,
        }, { timeout: 15000 }).catch(() => undefined)
        context = await activeContext(page).catch(() => null)
      }
    }
  }
  return context?.tenantId === scope.tenant.id
    && context?.hrGroupId === scope.hrGroup.id
    && context?.administrationId === expectedAdministrationId
}

async function chooseContext(page, expectedAdministrationId, usePayrollScope) {
  if (new URL(page.url()).pathname === '/context/select') {
    const combinedContext = page.locator('#context-selection')
    if (await combinedContext.count()) {
      const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
      await page.setViewportSize({ width: 390, height: 852 })
      const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
      if (desktopOverflow || mobileOverflow) return { ok: false, cause: 'context-viewport-overflow' }

      const options = combinedContext.locator('option')
      const target = usePayrollScope
        ? options.filter({ hasText: `${scope.tenant.name} · ${scope.hrGroup.name}` }).first()
        : options.nth(1)
      const value = await target.getAttribute('value').catch(() => null)
      if (!value) return { ok: false, cause: 'context-option-missing' }
      try {
        await combinedContext.selectOption(value)
      } catch {
        return { ok: false, cause: 'context-selection-failed' }
      }
    } else {
      const tenantChosen = await chooseDropdownOption(page, '#context-tenant', usePayrollScope ? scope.tenant.name : null)
      if (!tenantChosen.ok) return { ok: false, cause: `tenant-${tenantChosen.cause}` }
      const groupChosen = await chooseDropdownOption(page, '#context-hr-group', usePayrollScope ? scope.hrGroup.name : null)
      if (!groupChosen.ok) return { ok: false, cause: `hr-group-${groupChosen.cause}` }
    }
    try {
      await Promise.all([
        page.waitForURL((url) => url.pathname !== '/context/select', { timeout: 15000 }),
        page.locator('form button[type="submit"]').click(),
      ])
    } catch {
      return { ok: false, cause: 'context-submit-or-navigation-failed' }
    }
  }
  if (usePayrollScope) {
    const matches = await contextMatches(page, expectedAdministrationId)
    return { ok: matches, cause: matches ? null : 'active-scope-mismatch' }
  }
  const context = await activeContext(page).catch(() => null)
  return { ok: Boolean(context), cause: context ? null : 'active-context-unavailable' }
}

async function submitRoleSwitch(page, key) {
  const target = page.locator('#local-persona-target')
  if (!(await target.count())) return { ok: false, unavailable: false, cause: 'switcher-missing' }
  const available = await target.locator('option').evaluateAll((options, expected) => {
    const match = options.find((item) => item.value === expected)
    return Boolean(match && !match.disabled)
  }, key)
  if (!available) {
    const exists = await target.locator('option').evaluateAll((options, expected) => options.some((item) => item.value === expected), key)
    return { ok: false, unavailable: true, cause: exists ? 'target-disabled' : 'key-missing' }
  }
  try {
    await target.selectOption(key)
    const form = target.locator('xpath=ancestor::form')
    const response = await Promise.all([
      page.waitForResponse((candidate) => {
        try {
          return candidate.request().method() === 'POST'
            && new URL(candidate.url()).pathname === '/api/auth/test-role-switch'
        } catch {
          return false
        }
      }, { timeout: 20000 }),
      form.locator('button[type="submit"]').click(),
    ]).then(([result]) => result)
    if (response.status() !== 303) return { ok: false, unavailable: response.status() === 503, cause: `handoff-http-${response.status()}` }
    await page.waitForURL((url) => ['/context/select', '/dashboard/start'].includes(url.pathname), { timeout: 20000 })
    return { ok: true, unavailable: false, cause: null }
  } catch {
    return { ok: false, unavailable: false, cause: 'handoff-submit-failed' }
  }
}

async function returnToAdmin(page) {
  const personasPage = await page.goto(new URL('/local/personas', origin).toString(), { waitUntil: 'domcontentloaded' }).catch(() => null)
  if (personasPage?.status() !== 200) return false
  const form = page.locator('form[action="/api/auth/test-role-switch"]').filter({ has: page.locator('input[name="target"][value="hr-admin"]') })
  if (!(await form.count())) return false
  try {
    const [response] = await Promise.all([
      page.waitForResponse((candidate) => {
        try {
          return candidate.request().method() === 'POST'
            && new URL(candidate.url()).pathname === '/api/auth/test-role-switch'
        } catch {
          return false
        }
      }, { timeout: 20000 }),
      form.locator('button[type="submit"]').click(),
    ])
    if (response.status() !== 303) return false
    await page.waitForURL((url) => url.pathname === '/context/select', { timeout: 20000 })
  } catch {
    return false
  }
  const contextResult = await chooseContext(page, scope.administration.id, true).catch(() => ({ ok: false, cause: 'context-selection-failed' }))
  return contextResult.ok
}

async function testRoleSwitch(page, persona) {
  const switched = await submitRoleSwitch(page, persona.roleSwitchKey)
  if (!switched.ok) {
    const reason = switched.cause === 'switcher-missing'
      ? 'De lokale Test HR Admin-personawisselaar is niet beschikbaar.'
      : switched.cause === 'key-missing'
        ? `De vaste Payroll-role-switchkey ontbreekt: ${persona.roleSwitchKey}.`
        : switched.cause === 'target-disabled' || switched.unavailable
          ? 'De vaste Payroll-persona is niet beschikbaar voor de bestaande lokale handoff.'
          : 'De bestaande lokale handoff kon niet worden bevestigd.'
    addReason(persona.key, reason)
    return false
  }

  const scopeResult = await chooseContext(page, scope.administration.id, true).catch(() => ({ ok: false, cause: 'context-check-failed' }))
  if (!scopeResult.ok) addReason(persona.key, `De persona heeft geen actieve, geverifieerde Jupiter-administratiecontext (${scopeResult.cause}).`)
  if (!scopeResult.ok) return false
  await checkEss(page, persona)
  return true
}
async function expectCrossEmployeeDenied(page, personaKey, routeName, url) {
  const response = await page.context().request.get(new URL(url, origin).toString()).catch(() => null)
  if (!response) {
    addReason(personaKey, 'De negatieve ' + routeName + '-scopeprobe kon niet worden uitgevoerd.')
    return
  }
  if ([401, 403, 404].includes(response.status())) return
  if (response.status() === 200) {
    const body = await response.json().catch(() => null)
    const data = body && typeof body === 'object' && 'data' in body ? body.data : undefined
    if (data === null || (Array.isArray(data) && data.length === 0)) return
  }
  addReason(personaKey, 'De cross-employee ' + routeName + '-scopeprobe gaf HTTP ' + response.status() + ' met niet-lege of onbekende data in plaats van weigering.')
}
async function checkEss(page, persona) {
  const result = results.get(persona.key)
  const salaryResponse = await page.goto(new URL('/my-salary', origin).toString(), { waitUntil: 'domcontentloaded' }).catch(() => null)
  if (!salaryResponse || salaryResponse.status() !== 200) {
    addReason(persona.key, 'De eigen ESS-route /my-salary is niet beschikbaar.')
    return
  }

  const salaryText = (await page.locator('main').innerText().catch(() => '')).toLocaleLowerCase('nl-NL')
  if (persona.key === 'lisa') {
    if (!salaryText.includes('2026-10') || !/(definitieve salarisstrook|definitive salary statement)/i.test(salaryText)) {
      addReason(persona.key, 'Lisa’s eigen 2026-10 FINALIZED-salarisstrook werd niet bevestigd op /my-salary.')
    }
    const pdfControls = await page.locator('a[download], a[href*="/payslips/"], a[href*="payslip" i], button[aria-label*="pdf" i]').count()
    if (pdfControls === 0) addExpectedGap(persona.key, 'Geen PDF- of downloadcontrol zichtbaar op /my-salary; artifact/download blijft OPEN.')
  } else if (persona.key === 'jaap') {
    if (/(definitieve salarisstrook|definitive salary statement)/i.test(salaryText)
      && !/(geen|niet|no|not)\s+(?:een\s+)?(?:definitieve salarisstrook|definitive salary statement)/i.test(salaryText)) {
      addReason(persona.key, 'Jaaps CONCEPT-run werd onjuist als definitieve salarisstrook getoond.')
    }
    addExpectedGap(persona.key, 'De bestaande 2026-10-run is CONCEPT en blijft bewust niet-definitief.')
  } else if (persona.key === 'frits') {
    if (!salaryText.includes('pfzw') || !/(niet definitief|non-definitive|not definitive)/i.test(salaryText)) {
      addReason(persona.key, 'Frits’ PFZW-onzekerheid en niet-definitieve netto-status werden niet bevestigd.')
    }
    const pdfControls = await page.locator('a[download], a[href*="/payslips/"], a[href*="payslip" i], button[aria-label*="pdf" i]').count()
    if (pdfControls === 0) addExpectedGap(persona.key, 'Geen PDF- of downloadcontrol zichtbaar op /my-salary; artifact/download blijft OPEN.')
    addExpectedGap(persona.key, 'Frits’ drie historische traces sluiten met bron-, input- en resultaatprovenance aan op Frits, maar dragen het bronlabel Jan; de afwijking blijft open en historische uitkomsten zijn ongewijzigd.')
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  await page.setViewportSize({ width: 390, height: 852 })
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  if (desktopOverflow || mobileOverflow) addReason(persona.key, 'De salarisroute heeft horizontale overflow op desktop of 390 px mobiel.')

  const ownSalary = await page.context().request.get(new URL(`/api/employees/${persona.employeeId}/salary?employmentId=${persona.employmentId}`, origin).toString()).catch(() => null)
  if (!ownSalary || ownSalary.status() !== 200) addReason(persona.key, 'De eigen employee-salary-API gaf geen toegestane response.')
  const ownDocuments = await page.context().request.get(new URL(`/api/employees/${persona.employeeId}/documents`, origin).toString()).catch(() => null)
  if (!ownDocuments || ownDocuments.status() !== 200) addReason(persona.key, 'De eigen dossierroute /api/employees/{id}/documents is niet beschikbaar.')

  for (const otherPersona of personas.filter((candidate) => candidate.key !== persona.key)) {
    await expectCrossEmployeeDenied(page, persona.key, 'salaris-API', `/api/employees/${otherPersona.employeeId}/salary?employmentId=${otherPersona.employmentId}`)
    await expectCrossEmployeeDenied(page, persona.key, 'dossierroute', `/api/employees/${otherPersona.employeeId}/documents`)
  }

  if (result.expectedGaps.length === 0 && persona.knownGaps?.length) {
    for (const gap of persona.knownGaps) addExpectedGap(persona.key, gap)
  }
}

async function directLogin(persona) {
  if (persona.accountState !== 'EXISTING_LINK_CONFIRMED') {
    addReason(persona.key, 'Directe aanmelding is overgeslagen omdat een bestaande Auth-koppeling niet is bevestigd.')
    return
  }
  if (!credentials) {
    addReason(persona.key, 'De ACL-beveiligde credentialconfiguratie ontbreekt of is ongeldig; directe persona-login is niet bewezen.')
    return
  }
  const credential = credentials.get(persona.key)
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  try {
    await page.goto(new URL('/login', origin).toString(), { waitUntil: 'domcontentloaded' })
    await page.locator('input[name="email"]').fill(credential.email)
    await page.locator('input[name="password"]').fill(credential.password)
    await page.locator('form button[type="submit"]').first().click()
    await page.waitForURL((url) => url.pathname !== '/login', { timeout: 20000 }).catch(() => undefined)
    if (new URL(page.url()).pathname === '/login') {
      addReason(persona.key, 'De vaste persona-login kon niet met de beveiligde credentialbron worden bevestigd.')
      return
    }
    const scopeResult = await chooseContext(page, scope.administration.id, true).catch(() => ({ ok: false, cause: 'context-check-failed' }))
    if (!scopeResult.ok) {
      addReason(persona.key, `De directe login heeft geen toegang tot de catalogus-Jupiter-context (${scopeResult.cause}).`)
      return
    }
    await checkEss(page, persona)
  } finally {
    await context.close().catch(() => undefined)
  }
}

async function testAdminHandoff(persona) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  let consoleErrorCount = 0
  const browserErrorKinds = new Set()
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    consoleErrorCount += 1
    const safeCategory = message.text().toLocaleLowerCase('en-US')
    if (safeCategory.includes('hydration') || safeCategory.includes('server html')) browserErrorKinds.add('hydration')
    else if (safeCategory.includes('uncaught') || safeCategory.includes('typeerror') || safeCategory.includes('referenceerror')) browserErrorKinds.add('runtime')
    else browserErrorKinds.add('other')
  })
  page.on('pageerror', (error) => {
    consoleErrorCount += 1
    browserErrorKinds.add(error.name === 'TypeError' || error.name === 'ReferenceError' ? 'runtime' : 'pageerror')
  })
  let handoffConfirmed = false
  try {
    await page.goto(new URL('/local/sign-in', origin).toString(), { waitUntil: 'domcontentloaded' })
    const adminLoginButton = page.getByTestId('test-login-hr-admin')
    const adminLoginAvailable = await adminLoginButton.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)
    if (!adminLoginAvailable) {
      addReason(persona.key, 'Lokale Test HR Admin-login is niet beschikbaar op de opgegeven loopback-server.')
      return
    }
    const [adminResponse] = await Promise.all([
      page.waitForResponse((response) => {
        try {
          return response.request().method() === 'POST'
            && new URL(response.url()).pathname === '/api/local/sign-in'
        } catch {
          return false
        }
      }, { timeout: 20000 }),
      adminLoginButton.click(),
    ])
    if (adminResponse.status() !== 303) {
      addReason(persona.key, 'Lokale Test HR Admin-authenticatie of het normale contextladen faalde.')
      return
    }
    await page.waitForURL((url) => url.pathname === '/context/select', { timeout: 20000 }).catch(() => undefined)
    const contextResult = await chooseContext(page, scope.administration.id, true).catch(() => ({ ok: false, cause: 'context-selection-failed' }))
    if (!contextResult.ok) {
      addReason(persona.key, `Lokale Test HR Admin heeft geen geverifieerde Jupiter-administratiecontext (${contextResult.cause}).`)
      return
    }
    const personaPage = await page.goto(new URL('/local/personas', origin).toString(), { waitUntil: 'domcontentloaded' })
    if (personaPage?.status() !== 200 || !(await page.locator('#local-persona-target').count())) {
      addReason(persona.key, 'De lokale Test HR Admin-personawisselaar is niet toegankelijk binnen de geverifieerde administratie.')
      return
    }
    const wasSwitched = await testRoleSwitch(page, persona)
    if (wasSwitched) {
      const returned = await returnToAdmin(page)
      if (!returned) addReason(persona.key, 'Terugkeer via de bestaande lokale Test HR Admin-login is niet bevestigd.')
      handoffConfirmed = returned
    }
  } catch {
    addReason(persona.key, 'De lokale Test HR Admin- en role-switchbrowsercheck kon niet veilig worden voltooid.')
  } finally {
    if (consoleErrorCount > 0) {
      const reason = browserErrorKinds.has('hydration')
        ? 'De browser meldde een React/Next-hydrationfout tijdens de lokale Test HR Admin-sessie.'
        : browserErrorKinds.has('runtime')
          ? 'De browser meldde een client-side JavaScript-runtimefout tijdens de lokale Test HR Admin-sessie.'
          : 'De browserconsole bevatte ten minste één foutmelding.'
      addReason(persona.key, reason)
    }
    await context.close().catch(() => undefined)
  }
  return handoffConfirmed
}

try {
  if (origin.hostname !== 'localhost') throw new Error('LOOPBACK_HOST_REQUIRED')
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  for (const persona of personas) {
    const handoffConfirmed = await testAdminHandoff(persona)
    if (!handoffConfirmed) await directLogin(persona)
  }
} catch (error) {
  const safeReason = error instanceof Error && error.message === 'LOOPBACK_HOST_REQUIRED'
    ? 'De browserpreflight vereist localhost, niet een ander hostalias.'
    : 'De lokale browserpreflight kon niet veilig worden voltooid.'
  for (const persona of personas) addReason(persona.key, safeReason)
} finally {
  if (browser) await browser.close().catch(() => undefined)
}

for (const result of results.values()) {
  if (result.reasons.length === 0) result.status = result.expectedGaps.length === 0 ? 'READY' : 'READY_WITH_EXPECTED_GAP'
  console.log(`PAYTEST_PERSONA_RESULT ${JSON.stringify(result)}`)
}

if ([...results.values()].some((result) => result.status === 'BLOCKED')) process.exitCode = 2
