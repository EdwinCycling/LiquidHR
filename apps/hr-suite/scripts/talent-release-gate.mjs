import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const baseUrl = process.env.TALENT_RELEASE_BASE_URL ?? 'http://127.0.0.1:3000'
const crossTenantCapabilityId = process.env.TALENT_CROSS_TENANT_CAPABILITY_ID
const otherEmployeeId = process.env.TALENT_OTHER_EMPLOYEE_ID
const outOfScopeJobCode = process.env.TALENT_OUT_OF_SCOPE_JOB_CODE

const roles = [
  {
    id: 'hr-admin',
    email: process.env.TALENT_HR_ADMIN_EMAIL,
    password: process.env.TALENT_HR_ADMIN_PASSWORD,
    allowedRoutes: ['/settings/talent', '/workforce/talent', '/workforce/9-grid'],
    deniedRoutes: ['/my-talent'],
  },
  {
    id: 'manager',
    email: process.env.TALENT_MANAGER_EMAIL,
    password: process.env.TALENT_MANAGER_PASSWORD,
    allowedRoutes: ['/workforce/talent', '/workforce/9-grid'],
    deniedRoutes: ['/settings/talent', '/my-talent'],
  },
  {
    id: 'employee',
    email: process.env.TALENT_EMPLOYEE_EMAIL,
    password: process.env.TALENT_EMPLOYEE_PASSWORD,
    allowedRoutes: ['/my-talent'],
    deniedRoutes: ['/settings/talent', '/workforce/talent', '/workforce/9-grid'],
  },
]

const missingCredentials = roles
  .filter((role) => !role.email || !role.password)
  .map((role) => role.id)

if (missingCredentials.length > 0) {
  throw new Error(`Ontbrekende Talent-release-fixturecredentials voor: ${missingCredentials.join(', ')}. Gebruik TALENT_<ROL>_EMAIL en TALENT_<ROL>_PASSWORD.`)
}

if (!crossTenantCapabilityId) {
  throw new Error('TALENT_CROSS_TENANT_CAPABILITY_ID is vereist voor de cross-tenant negatieve test.')
}

if (!otherEmployeeId) {
  throw new Error('TALENT_OTHER_EMPLOYEE_ID is vereist voor de Mijn Talent IDOR-test.')
}

if (!outOfScopeJobCode) {
  throw new Error('TALENT_OUT_OF_SCOPE_JOB_CODE is vereist voor de manager-scope-test.')
}

const routeReadyText = {
  '/settings/talent': 'Talent Management',
  '/workforce/talent': 'Talentprofielen',
  '/workforce/9-grid': 'Vlootschouw 9-grid',
  '/my-talent': 'Mijn talentprofiel',
}

function pathOf(url) {
  return new URL(url).pathname
}

async function login(page, role) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
  await page.getByLabel('E-mailadres', { exact: true }).fill(role.email)
  await page.getByLabel('Wachtwoord', { exact: true }).fill(role.password)
  await page.getByRole('button', { name: 'Inloggen', exact: true }).click()
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 })
}

async function visitAllowed(page, roleId, route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' })
  const readyText = await page.getByText(routeReadyText[route], { exact: false }).first().waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false)
  const currentPath = pathOf(page.url())
  const ready = currentPath === route && readyText
  if (!ready) throw new Error(`${roleId} kan ${route} niet openen: ${page.url()}`)

  await page.keyboard.press('Tab')
  const keyboardFocus = await page.evaluate(() => document.activeElement !== document.body)
  if (!keyboardFocus) throw new Error(`${roleId} heeft geen zichtbare keyboard focus op ${route}`)

  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  return {
    route,
    ready,
    keyboardFocus,
    violations: scan.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => node.target),
    })),
    incomplete: scan.incomplete.map((check) => ({
      id: check.id,
      impact: check.impact,
      help: check.help,
      nodes: check.nodes.map((node) => node.target),
    })),
  }
}

async function visitDenied(page, roleId, route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' })
  const currentPath = pathOf(page.url())
  const noAccessPage = await page.getByText('Nog geen toegang', { exact: true }).waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false)
  const featureHeadingVisible = route === '/workforce/9-grid'
    ? await page.getByRole('heading', { name: routeReadyText[route], exact: true }).isVisible().catch(() => false)
    : false
  const denied = currentPath === '/geen-toegang' || currentPath === '/login' || noAccessPage || (route === '/workforce/9-grid' && currentPath === route && !featureHeadingVisible)
  if (!denied) throw new Error(`${roleId} kreeg onverwacht toegang tot ${route}: ${page.url()}`)
  return { route, denied, finalPath: noAccessPage ? '/geen-toegang' : currentPath, featureHeadingVisible }
}

async function assertDeniedMutation(context, roleId) {
  const response = await context.request.post(`${baseUrl}/api/talent/capabilities`, {
    data: {
      capabilityType: 'COMPETENCY',
      code: 'RELEASE_GATE_NEGATIVE',
      name: 'Release gate negative test',
      description: null,
      categoryId: null,
      languageCode: null,
      languageCefr: null,
      languageIsNative: false,
      certificateIssuingBody: null,
      certificateValidityMonths: null,
      certificateIsPermanent: false,
      certificateCode: null,
      certificateRenewalRequired: false,
    },
  })
  if (![401, 403].includes(response.status())) {
    throw new Error(`${roleId} mutation denial verwacht, kreeg HTTP ${response.status()}`)
  }
  return { endpoint: '/api/talent/capabilities', status: response.status(), denied: true }
}

async function assertCrossTenantRead(context) {
  const response = await context.request.get(`${baseUrl}/api/talent/capabilities/${crossTenantCapabilityId}`)
  if (![403, 404].includes(response.status())) {
    throw new Error(`Cross-tenant capability read verwacht 403/404, kreeg HTTP ${response.status()}`)
  }
  return { endpoint: '/api/talent/capabilities/:crossTenantId', status: response.status(), denied: true }
}

async function assertSelfBoundRead(context) {
  const plain = await context.request.get(`${baseUrl}/api/talent/my`)
  const withForeignSelector = await context.request.get(`${baseUrl}/api/talent/my?employeeId=${encodeURIComponent(otherEmployeeId)}`)
  if (plain.status() !== withForeignSelector.status()) {
    throw new Error(`Mijn Talent reageert verschillend op een foreign employeeId: ${plain.status()} versus ${withForeignSelector.status()}`)
  }
  const [plainBody, selectorBody] = await Promise.all([plain.text(), withForeignSelector.text()])
  if (plainBody !== selectorBody) throw new Error('Mijn Talent is niet self-bound: employeeId beïnvloedt het antwoord.')
  return { endpoint: '/api/talent/my', selectorIgnored: true, status: plain.status() }
}

const browser = await chromium.launch({ headless: true })
const results = []

try {
  for (const role of roles) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
    const page = await context.newPage()
    try {
      await login(page, role)
      const allowed = []
      let outOfScope = null
      for (const route of role.allowedRoutes) {
        allowed.push(await visitAllowed(page, role.id, route))
        if (role.id === 'manager' && route === '/workforce/talent') {
          outOfScope = { absent: !(await page.getByText(outOfScopeJobCode, { exact: false }).isVisible().catch(() => false)), jobCode: outOfScopeJobCode }
          if (!outOfScope.absent) throw new Error(`Manager ziet een buiten-scope functie: ${outOfScopeJobCode}`)
        }
      }
      const deniedRoutes = []
      for (const route of role.deniedRoutes) deniedRoutes.push(await visitDenied(page, role.id, route))
      const negativeMutation = role.id === 'manager' || role.id === 'employee'
        ? await assertDeniedMutation(context, role.id)
        : null
      const crossTenant = await assertCrossTenantRead(context)
      const selfBound = role.id === 'employee' ? await assertSelfBoundRead(context) : null
      results.push({ role: role.id, allowed, deniedRoutes, negativeMutation, crossTenant, selfBound, outOfScope })
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}

const summary = results.reduce((accumulator, result) => {
  const scans = result.allowed
  return {
    roles: accumulator.roles + 1,
    routes: accumulator.routes + scans.length,
    violations: accumulator.violations + scans.reduce((count, scan) => count + scan.violations.length, 0),
    incomplete: accumulator.incomplete + scans.reduce((count, scan) => count + scan.incomplete.length, 0),
  }
}, { roles: 0, routes: 0, violations: 0, incomplete: 0 })

console.log(JSON.stringify({ summary, results }, null, 2))
if (summary.violations > 0) process.exitCode = 1
