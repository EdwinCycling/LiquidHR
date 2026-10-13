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
      const administrationOptionChosen = await chooseDropdownOption(page, '#administration-switcher', scope.administration.name)
      if (administrationOptionChosen.ok) {
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
    const tenantChosen = await chooseDropdownOption(page, '#context-tenant', usePayrollScope ? scope.tenant.name : null)
    if (!tenantChosen.ok) return { ok: false, cause: `tenant-${tenantChosen.cause}` }
    const groupChosen = await chooseDropdownOption(page, '#context-hr-group', usePayrollScope ? scope.hrGroup.name : null)
    if (!groupChosen.ok) return { ok: false, cause: `hr-group-${groupChosen.cause}` }
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
  const trigger = page.getByTestId('test-role-switch-trigger')
  if (!(await trigger.count())) return { ok: false, unavailable: false, cause: 'switcher-missing' }
  await trigger.click()
  const target = page.getByTestId('test-role-switch-target')
  const targetVisible = await target.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)
  if (!targetVisible) {
    const expanded = await trigger.getAttribute('aria-expanded').catch(() => null)
    return { ok: false, unavailable: false, cause: expanded === 'true' ? 'menu-not-visible' : 'trigger-not-responsive' }
  }
  const values = await target.locator('option').evaluateAll((options) => options.map((option) => option.value))
  if (!values.includes(key)) {
    await page.keyboard.press('Escape')
    return { ok: false, unavailable: false, cause: 'key-missing' }
  }

  const navigation = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null)
  await target.selectOption(key)
  const response = await navigation
  if (response?.status() === 503 || new URL(page.url()).pathname === '/api/auth/test-role-switch') {
    return { ok: false, unavailable: true, cause: 'handoff-unavailable' }
  }
  const personaMarker = page.getByTestId('test-role-current-persona')
  if (new URL(page.url()).pathname === '/context/select') return { ok: true, unavailable: false, cause: null }
  await page.waitForFunction((expected) => document.querySelector('[data-testid="test-role-current-persona"]')?.getAttribute('data-persona') === expected, key, { timeout: 20000 }).catch(() => undefined)
  const ok = (await personaMarker.getAttribute('data-persona').catch(() => null)) === key
  return { ok, unavailable: false, cause: ok ? null : 'persona-marker-missing' }
}

async function returnToAdmin(page) {
  const button = page.getByTestId('test-role-return-to-admin')
  if (!(await button.count())) return false
  const navigation = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null)
  await button.click()
  await navigation
  if (new URL(page.url()).pathname === '/context/select') await chooseContext(page, null, false).catch(() => ({ ok: false, cause: 'context-selection-failed' }))
  await page.waitForFunction(() => document.querySelector('[data-testid="test-role-current-persona"]')?.getAttribute('data-persona') === 'hr-admin', undefined, { timeout: 20000 }).catch(() => undefined)
  return (await page.getByTestId('test-role-current-persona').getAttribute('data-persona').catch(() => null)) === 'hr-admin'
}

async function testRoleSwitch(page, persona) {
  if (new URL(page.url()).pathname === '/api/auth/test-role-switch') {
    await page.goto(new URL('/dashboard/start', origin).toString(), { waitUntil: 'domcontentloaded' })
    const scopeResult = await chooseContext(page, scope.administration.id, true).catch(() => ({ ok: false, cause: 'context-check-failed' }))
    if (!scopeResult.ok) {
      addReason(persona.key, 'De bestaande Edwin-sessie kon niet naar de gecontroleerde Jupiter-context worden hersteld.')
      return false
    }
  }
  const activePersona = await page.getByTestId('test-role-current-persona').getAttribute('data-persona').catch(() => null)
  if (!activePersona) {
    addReason(persona.key, 'De lokale Test HR Admin-login of de normale context is niet actief; de role-switch is niet uitgevoerd.')
    return false
  }
  if (activePersona !== 'hr-admin' && activePersona !== 'edwin') {
    addReason(persona.key, 'De role-switch is niet gestart vanuit de toegestane Test HR Admin- of Edwin-beheersessie.')
    return false
  }
  if (activePersona === 'hr-admin') {
    const intoEdwin = await submitRoleSwitch(page, 'edwin')
    if (!intoEdwin.ok) {
      const reason = intoEdwin.cause === 'switcher-missing'
        ? 'De lokale role-switcher is niet beschikbaar in de Test HR Admin-sessie.'
        : intoEdwin.cause === 'trigger-not-responsive'
          ? 'De Test HR Admin-role-switchknop reageerde niet; de lokale clienthydratie moet worden gecontroleerd.'
          : intoEdwin.cause === 'menu-not-visible'
            ? 'De role-switcher meldde een geopend menu maar toonde de keuzelijst niet.'
        : intoEdwin.cause === 'key-missing'
          ? 'De bestaande Edwin-target ontbreekt in de vaste role-switchallowlist.'
          : intoEdwin.cause === 'handoff-unavailable'
            ? 'De lokale Auth-handoff naar de bestaande Edwin-testidentiteit is niet beschikbaar.'
            : 'De lokale role-switch eindigde niet bij de bestaande Edwin-testidentiteit.'
      addReason(persona.key, reason)
      return false
    }
    const scopeResult = await chooseContext(page, scope.administration.id, true).catch(() => ({ ok: false, cause: 'context-check-failed' }))
    if (!scopeResult.ok) {
      addReason(persona.key, `Edwin heeft binnen zijn bestaande rechten geen bevestigde Jupiter-context (${scopeResult.cause}).`)
      return false
    }
  }

  const switched = await submitRoleSwitch(page, persona.roleSwitchKey)
  if (!switched.ok) {
    const reason = switched.cause === 'switcher-missing'
      ? 'De lokale role-switcher is niet beschikbaar voor de bevoegde Jupiter-beheersessie.'
      : switched.cause === 'trigger-not-responsive'
        ? 'De Jupiter-role-switchknop reageerde niet; de lokale clienthydratie moet worden gecontroleerd.'
        : switched.cause === 'menu-not-visible'
          ? 'De role-switcher meldde een geopend menu maar toonde de keuzelijst niet.'
      : switched.cause === 'key-missing'
        ? `De vaste role-switchkey ontbreekt: ${persona.roleSwitchKey}.`
        : switched.unavailable
          ? 'De vaste Payroll-Auth-identiteit ontbreekt of is niet aan de geverifieerde medewerker gekoppeld.'
          : 'De lokale Auth-handoff eindigde niet bij de vaste Payroll-persona.'
    addReason(persona.key, reason)
    return false
  }

  const scopeResult = await chooseContext(page, scope.administration.id, true).catch(() => ({ ok: false, cause: 'context-check-failed' }))
  if (!scopeResult.ok) addReason(persona.key, `De persona heeft geen actieve, geverifieerde Jupiter-administratiecontext (${scopeResult.cause}).`)
  if (await page.getByTestId('test-role-current-persona').getAttribute('data-persona').catch(() => null) !== persona.roleSwitchKey) {
    addReason(persona.key, 'De handoff eindigde niet bij de vaste persona-key.')
  }
  return scopeResult.ok
}

async function expectCrossEmployeeDenied(page, ownEmployeeId, otherEmployeeId, routeName, url) {
  const response = await page.context().request.get(new URL(url, origin).toString()).catch(() => null)
  if (!response) {
    addReason(ownEmployeeId, `De negatieve ${routeName}-scopeprobe kon niet worden uitgevoerd.`)
    return
  }
  if (![401, 403, 404].includes(response.status())) {
    addReason(ownEmployeeId, `De cross-employee ${routeName}-scopeprobe gaf HTTP ${response.status()} in plaats van weigering.`)
  }
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
    addReason(persona.key, 'Frits’ berekeningstrace bevat de onopgeloste bronlabel-afwijking Jan; juiste historische runbron is niet bevestigd.')
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

  const otherPersona = personas.find((candidate) => candidate.key !== persona.key)
  if (otherPersona) {
    await expectCrossEmployeeDenied(page, persona.key, otherPersona.employeeId, 'salaris-API', `/api/employees/${otherPersona.employeeId}/salary?employmentId=${otherPersona.employmentId}`)
    await expectCrossEmployeeDenied(page, persona.key, otherPersona.employeeId, 'dossierroute', `/api/employees/${otherPersona.employeeId}/documents`)
  }

  if (result.expectedGaps.length === 0 && persona.knownGaps?.length) {
    for (const gap of persona.knownGaps) addExpectedGap(persona.key, gap)
  }
}

async function directLogin(persona) {
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
  try {
    await page.goto(new URL('/login', origin).toString(), { waitUntil: 'domcontentloaded' })
    const adminLoginButton = page.getByTestId('test-login-hr-admin')
    if (!(await adminLoginButton.count())) {
      addReason(persona.key, 'Lokale Test HR Admin-login is niet beschikbaar op de opgegeven loopback-server.')
      return
    }
    const adminNavigation = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null)
    await adminLoginButton.click()
    const adminResponse = await adminNavigation
    if (adminResponse && adminResponse.status() >= 500) {
      addReason(persona.key, 'Lokale Test HR Admin-authenticatie of het normale contextladen faalde.')
      return
    }
    if (new URL(page.url()).pathname === '/context/select') await chooseContext(page, null, false).catch(() => false)
    const activeAdminPersona = await page.getByTestId('test-role-current-persona').getAttribute('data-persona').catch(() => null)
    if (activeAdminPersona !== 'hr-admin') {
      addReason(persona.key, 'Lokale Test HR Admin-authenticatie of het normale contextladen faalde.')
      return
    }

    await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => undefined)
    await page.waitForTimeout(250)
    const wasSwitched = await testRoleSwitch(page, persona)
    const returnButton = page.getByTestId('test-role-return-to-admin')
    if (wasSwitched && await returnButton.count()) {
      const returned = await returnToAdmin(page)
      if (!returned) addReason(persona.key, 'Terugkeer via de bestaande lokale Test HR Admin-login is niet bevestigd.')
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
}

try {
  if (origin.hostname !== 'localhost') throw new Error('LOOPBACK_HOST_REQUIRED')
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  for (const persona of personas) {
    await testAdminHandoff(persona)
    await directLogin(persona)
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
