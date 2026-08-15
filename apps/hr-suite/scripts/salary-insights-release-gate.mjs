import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const baseUrl = process.env.TALENT_RELEASE_BASE_URL ?? 'http://127.0.0.1:3000'
const asOfDate = '2026-08-15'
const targetTenantId = '07249eb9-545c-883b-b26b-d52f83b4f4a1'
const targetHrGroupId = '6ba6f1df-e376-40f2-abff-ffdf000172e1'
const emptyHrGroupId = '80975e8a-b0dd-4552-be20-cd3944da9b2b'
const otherTenantId = 'e6e33ac7-15d4-126d-ea0f-d3973eff82d5'
const otherTenantHrGroupId = '708d839c-110c-4b48-81a1-197b56b959d8'
const reportIds = [
  'salary-overview',
  'salary-band-position',
  'salary-band-status',
  'salary-scale-steps',
  'salary-structure-exceptions',
  'salary-internal-position',
]
const managerReportIds = reportIds.filter((report) => report !== 'salary-internal-position')
const peerMetricFields = ['peerMedian', 'peerAverage', 'medianDelta', 'medianDeltaPercentage', 'relativePosition']
const reportTitles = {
  'salary-overview': 'Salarisoverzicht',
  'salary-band-position': 'Positie in salarisband',
  'salary-band-status': 'Onder en boven de band',
  'salary-scale-steps': 'Schalen en treden',
  'salary-structure-exceptions': 'Structuuruizonderingen',
  'salary-internal-position': 'Interne salarispositie',
}
const roles = [
  { id: 'hr-admin', email: process.env.TALENT_HR_ADMIN_EMAIL ?? 'hradmin.fixture@liquidhr.test', password: process.env.TALENT_HR_ADMIN_PASSWORD },
  { id: 'manager', email: process.env.TALENT_MANAGER_EMAIL ?? 'manager.fixture@liquidhr.test', password: process.env.TALENT_MANAGER_PASSWORD },
  { id: 'employee', email: process.env.TALENT_EMPLOYEE_EMAIL ?? 'employee.fixture@liquidhr.test', password: process.env.TALENT_EMPLOYEE_PASSWORD },
]

if (roles.some((role) => !role.password)) {
  throw new Error('Salary Insights release gate vereist TALENT_HR_ADMIN_PASSWORD, TALENT_MANAGER_PASSWORD en TALENT_EMPLOYEE_PASSWORD.')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function apiUrl(report, format) {
  const url = new URL('/api/insights/salary', baseUrl)
  url.searchParams.set('report', report)
  url.searchParams.set('asOfDate', asOfDate)
  if (format) url.searchParams.set('format', format)
  return url.toString()
}

function parseJson(text, context) {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${context} gaf geen JSON-response.`)
  }
}

function reportData(response, context) {
  assert(response.status === 200, `${context} verwachtte HTTP 200, kreeg ${response.status}.`)
  const data = response.body?.data
  assert(data && typeof data === 'object', `${context} bevat geen reportdata.`)
  assert(data.asOfDate === asOfDate, `${context} gebruikte niet peildatum ${asOfDate}.`)
  return data
}

function nonNullPeerMetrics(value) {
  const found = []
  const visit = (candidate, path) => {
    if (!candidate || typeof candidate !== 'object') return
    if (Array.isArray(candidate)) {
      candidate.forEach((item, index) => visit(item, `${path}[${index}]`))
      return
    }
    for (const [key, child] of Object.entries(candidate)) {
      if (peerMetricFields.includes(key) && child !== null && child !== undefined) found.push({ path: `${path}.${key}`, value: child })
      visit(child, `${path}.${key}`)
    }
  }
  visit(value, '$')
  return found
}

function nonNullPeerMetricsInHtml(html) {
  return peerMetricFields.flatMap((field) => {
    const pattern = new RegExp(`"${field}"\\s*:\\s*(?!null(?:[,}]))(?:"[^"\\n]+"|-?[0-9])`)
    return pattern.test(html) ? [field] : []
  })
}

function routeValues(data) {
  return [...new Set((data.rows ?? []).map((row) => row.salaryRoute).filter(Boolean))].sort()
}

function statusValues(data) {
  return [...new Set((data.rows ?? []).map((row) => row.bandStatus).filter(Boolean))].sort()
}

function kpiValues(data) {
  return Object.fromEntries((data.kpis ?? []).map((kpi) => [kpi.id, kpi.value]))
}

async function login(page, role) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
  await page.getByLabel('E-mailadres', { exact: true }).fill(role.email)
  await page.getByLabel('Wachtwoord', { exact: true }).fill(role.password)
  await page.getByRole('button', { name: 'Inloggen', exact: true }).click()
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 })
}

async function pinSalaryContext(context) {
  await context.addCookies([
    { name: 'liquid-hr-tenant', value: targetTenantId, url: baseUrl },
    { name: 'liquid-hr-hr-group', value: targetHrGroupId, url: baseUrl },
  ])
}

async function requestSalary(context, report, format) {
  const response = await context.request.get(apiUrl(report, format))
  const text = await response.text()
  return {
    status: response.status(),
    body: format ? text : parseJson(text, `${report} API`),
  }
}

async function assertBrowserReport(page, roleId, report, viewportLabel) {
  const title = reportTitles[report]
  const responseBodies = []
  const responseListener = async (response) => {
    if (!response.url().includes('/api/insights/salary')) return
    try {
      responseBodies.push(parseJson(await response.text(), `${roleId}/${report} network`))
    } catch {
      // Een route zonder API-call is toegestaan bij de server-rendered eerste weergave.
    }
  }
  page.on('response', responseListener)
  try {
    await page.goto(`${baseUrl}/insights?report=${encodeURIComponent(report)}&asOfDate=${asOfDate}`, { waitUntil: 'domcontentloaded' })
    if (roleId === 'manager' && report === 'salary-internal-position' && viewportLabel === 'manager-internal-direct') {
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined)
      const bodyText = await page.locator('body').innerText()
      const html = await page.content()
      const browserFetch = await page.evaluate(async (url) => {
        const response = await fetch(url, { headers: { accept: 'application/json' } })
        return { status: response.status, text: await response.text() }
      }, apiUrl(report))
      const browserFetchBody = parseJson(browserFetch.text, `${roleId}/${report} browser network`)
      assert(browserFetch.status === 403, `Manager direct internal-position network-call verwachtte 403, kreeg ${browserFetch.status}.`)
      assert(!bodyText.includes(reportTitles[report]), 'Manager ziet Interne salarispositie via directe URL.')
      assert(nonNullPeerMetrics(browserFetchBody).length === 0, 'Manager direct internal-position network-response bevat peer-statistieken.')
      const screenshotPath = resolve('output/playwright', `salary-insights-${roleId}-${viewportLabel}-${report}.png`)
      mkdirSync(resolve('output/playwright'), { recursive: true })
      await page.screenshot({ path: screenshotPath, fullPage: true })
      return {
        report,
        viewport: viewportLabel,
        currentUrl: page.url(),
        titleVisible: false,
        panelHasTable: false,
        panelTextLength: 0,
        bodyHasPeerMetrics: nonNullPeerMetricsInHtml(html),
        networkResponses: [{ hasData: false, peerMetrics: nonNullPeerMetrics(browserFetchBody), status: browserFetch.status }],
        screenshotPath,
      }
    }
    const card = page.locator(`#report-card-${report}`)
    await card.waitFor({ state: 'visible', timeout: 15000 })
    const trigger = card.getByRole('button').first()
    if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click()
    const reportPanel = page.locator(`#report-${report}`)
    await reportPanel.waitFor({ state: 'visible', timeout: 15000 })
    await reportPanel.scrollIntoViewIfNeeded()
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined)
    const bodyText = await page.locator('body').innerText()
    const html = await page.content()
    const panelText = await reportPanel.innerText()
    const panelHasTable = await reportPanel.locator('table').count() > 0
    const browserFetch = await page.evaluate(async (url) => {
      const response = await fetch(url, { headers: { accept: 'application/json' } })
      return { status: response.status, text: await response.text() }
    }, apiUrl(report))
    const browserFetchBody = parseJson(browserFetch.text, `${roleId}/${report} browser network`)
    if (roleId === 'manager') assert(nonNullPeerMetrics(browserFetchBody).length === 0, `Manager ${report} network-response bevat peer-statistieken.`)
    assert(!bodyText.includes('Application error'), `${roleId}/${report}/${viewportLabel} toont een applicatiefout.`)
    const screenshotPath = resolve('output/playwright', `salary-insights-${roleId}-${viewportLabel}-${report}.png`)
    mkdirSync(resolve('output/playwright'), { recursive: true })
    await page.screenshot({ path: screenshotPath, fullPage: true })
    return {
      report,
      viewport: viewportLabel,
      currentUrl: page.url(),
      titleVisible: bodyText.includes(title),
      panelHasTable,
      panelTextLength: panelText.length,
      bodyHasPeerMetrics: nonNullPeerMetricsInHtml(html),
      networkResponses: [...responseBodies, browserFetchBody].map((body) => ({
        hasData: Boolean(body.data),
        peerMetrics: nonNullPeerMetrics(body),
      })),
      screenshotPath,
    }
  } finally {
    page.off('response', responseListener)
  }
}

async function assertReportCatalog(page, roleId) {
  await page.goto(`${baseUrl}/insights`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined)
  const bodyText = await page.locator('body').innerText()
  const visibleTitles = reportIds.filter((report) => bodyText.includes(reportTitles[report]))
  const expectedTitles = roleId === 'hr-admin' ? reportIds : roleId === 'manager' ? managerReportIds : []
  assert(visibleTitles.length === expectedTitles.length, `${roleId} toont ${visibleTitles.length} Salary Insights-reportcards, verwacht ${expectedTitles.length}.`)
  for (const report of expectedTitles) assert(visibleTitles.includes(report), `${roleId} mist reportcard ${report}.`)
  for (const report of reportIds.filter((report) => !expectedTitles.includes(report))) assert(!visibleTitles.includes(report), `${roleId} toont onverwacht reportcard ${report}.`)
  return { visibleTitles }
}

async function assertEmployeeBrowser(page, viewportLabel) {
  await page.goto(`${baseUrl}/insights`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined)
  const bodyText = await page.locator('body').innerText()
  const visibleTitles = reportIds.filter((report) => bodyText.includes(reportTitles[report]))
  assert(visibleTitles.length === 0, `Employee ziet Salary Insights-data op ${viewportLabel}.`)
  const screenshotPath = resolve('output/playwright', `salary-insights-employee-${viewportLabel}-index.png`)
  mkdirSync(resolve('output/playwright'), { recursive: true })
  await page.screenshot({ path: screenshotPath, fullPage: true })
  return { viewport: viewportLabel, currentUrl: page.url(), visibleTitles, screenshotPath }
}

async function authenticatedRpc(role) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
  )
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: role.email, password: role.password })
  if (signInError) throw new Error(`${role.id} Supabase-authenticatie mislukt.`)
  const call = async (tenantId, hrGroupId) => {
    const { data, error } = await supabase.rpc('get_salary_insights_projection', {
      requested_tenant_id: tenantId,
      requested_hr_group_id: hrGroupId,
      requested_as_of: asOfDate,
    })
    return { rowCount: Array.isArray(data) ? data.length : 0, error: error?.message ?? null }
  }
  const target = await call(targetTenantId, targetHrGroupId)
  const emptyGroup = await call(targetTenantId, emptyHrGroupId)
  const crossTenant = await call(otherTenantId, otherTenantHrGroupId)
  await supabase.auth.signOut()
  return { target, emptyGroup, crossTenant }
}

async function run() {
  assert(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL ontbreekt.')
  assert(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ontbreekt.')
  const browser = await chromium.launch({ headless: true })
  const evidence = {}
  let hrAdminRows = new Map()
  try {
    for (const role of roles) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await context.newPage()
      try {
        await login(page, role)
        await pinSalaryContext(context)
        await page.reload({ waitUntil: 'domcontentloaded' })
        const catalog = await assertReportCatalog(page, role.id)
        const api = {}
        for (const report of reportIds) api[report] = await requestSalary(context, report)
        const csv = {}
        for (const report of reportIds) csv[report] = await requestSalary(context, report, 'csv')
        const rpc = await authenticatedRpc(role)
        const browserDesktop = []
        const browserMobile = []
        const reportsForRole = role.id === 'manager' ? managerReportIds : role.id === 'employee' ? [] : reportIds
        for (const report of reportsForRole) browserDesktop.push(await assertBrowserReport(page, role.id, report, 'desktop'))
        await page.setViewportSize({ width: 390, height: 844 })
        for (const report of reportsForRole) browserMobile.push(await assertBrowserReport(page, role.id, report, 'mobile'))
        const employeeDesktop = role.id === 'employee' ? [await assertEmployeeBrowser(page, 'desktop')] : []
        if (role.id === 'employee') {
          await page.setViewportSize({ width: 390, height: 844 })
          employeeDesktop.push(await assertEmployeeBrowser(page, 'mobile'))
        }

        if (role.id === 'hr-admin') {
          for (const report of reportIds) reportData(api[report], `HR Admin ${report}`)
          const overview = reportData(api['salary-overview'], 'HR Admin salary overview')
          const bandPosition = reportData(api['salary-band-position'], 'HR Admin salary band position')
          const bandStatus = reportData(api['salary-band-status'], 'HR Admin salary band status')
          assert(overview.total > 0, 'HR Admin salary overview is leeg.')
          assert(bandPosition.total > 0, 'HR Admin salary band position is leeg.')
          assert(bandStatus.total > 0, 'HR Admin salary band status is leeg.')
          assert(routeValues(overview).includes('MINIMUM_WAGE'), 'MINIMUM_WAGE ontbreekt in HR Admin salary overview.')
          assert(routeValues(overview).includes('SALARY_BAND'), 'SALARY_BAND ontbreekt in HR Admin salary overview.')
          assert(statusValues(bandPosition).includes('UNDER_MINIMUM'), 'UNDER_MINIMUM ontbreekt in HR Admin band position.')
          assert(statusValues(bandPosition).includes('WITHIN_RANGE'), 'WITHIN_RANGE ontbreekt in HR Admin band position.')
          assert(statusValues(bandPosition).includes('ABOVE_MAXIMUM'), 'ABOVE_MAXIMUM ontbreekt in HR Admin band position.')
          const minimumRows = overview.rows.filter((row) => row.salaryRoute === 'MINIMUM_WAGE')
          assert(minimumRows.length >= 2, 'HR Admin minimumloon-fixtures zijn niet zichtbaar.')
          assert(minimumRows.every((row) => row.fulltimeSalary === null && row.actualSalary === null), 'Een minimumloonrij bevat een lokaal salarisbedrag.')
          assert(!Object.values(kpiValues(overview)).some((value) => value === '€0,00' || value === '€ 0,00'), 'Minimumloon is als €0 opgenomen in Salary Overview-KPIs.')
          assert((reportData(api['salary-internal-position'], 'HR Admin internal salary position').total ?? 0) > 0, 'HR Admin internal salary position is leeg.')
          for (const browserResult of [...browserDesktop, ...browserMobile]) {
            if (['salary-overview', 'salary-band-position', 'salary-band-status'].includes(browserResult.report)) assert(browserResult.panelHasTable, `HR Admin ${browserResult.report} toont geen resultaat-tabel op ${browserResult.viewport}.`)
          }
          hrAdminRows = new Map(overview.rows.map((row) => [`${row.employeeId}:${row.employmentId}`, row]))
        } else if (role.id === 'manager') {
          for (const report of managerReportIds) {
            const data = reportData(api[report], `Manager ${report}`)
            assert(nonNullPeerMetrics(data).length === 0, `Manager ${report} bevat peer-statistieken.`)
            for (const row of data.rows ?? []) assert(hrAdminRows.has(`${row.employeeId}:${row.employmentId}`), `Manager ${report} bevat een rij buiten HR Admin-scope.`)
          }
          assert(api['salary-internal-position'].status === 403, `Manager internal salary position verwachtte 403, kreeg ${api['salary-internal-position'].status}.`)
          assert(api['salary-internal-position'].body?.error === 'SALARY_INSIGHTS_INTERNAL_POSITION_FORBIDDEN', 'Manager internal salary position gaf een onverwachte foutcode.')
          const internalPage = await assertBrowserReport(page, role.id, 'salary-internal-position', 'manager-internal-direct')
          assert(!internalPage.titleVisible, 'Manager ziet Interne salarispositie via directe URL.')
          assert(internalPage.bodyHasPeerMetrics.length === 0, 'Manager HTML bevatte peer-statistieken.')
        } else {
          for (const report of reportIds) {
            const response = api[report]
            assert([401, 403].includes(response.status) || (response.status === 200 && response.body?.data?.total === 0 && response.body?.data?.rows?.length === 0), `Employee salary API contract is niet denied/empty voor ${report}.`)
          }
        }
        for (const report of reportIds) {
          const csvResponse = csv[report]
          if (role.id === 'manager' && report === 'salary-internal-position') assert(csvResponse.status === 403, 'Manager kreeg een internal-position CSV.')
          else if (role.id === 'employee') assert([401, 403].includes(csvResponse.status) || csvResponse.body.length === 0, `Employee kreeg salary CSV voor ${report}.`)
          else assert(csvResponse.status === 200 && csvResponse.body.length > 0, `${role.id} export ontbreekt voor ${report}.`)
        }
        evidence[role.id] = {
          api: Object.fromEntries(reportIds.map((report) => {
            const response = api[report]
            const data = response.body?.data
            return [report, { status: response.status, total: data?.total ?? null, authorizedPopulation: data?.authorizedPopulation ?? null, routes: data ? routeValues(data) : [], statuses: data ? statusValues(data) : [], kpis: data ? kpiValues(data) : {}, peerMetrics: data ? nonNullPeerMetrics(data) : [] }]
          })),
          catalog,
          rpc,
          browserDesktop,
          browserMobile,
          employeeBrowser: employeeDesktop,
        }
      } finally {
        await context.close()
      }
    }
  } finally {
    await browser.close()
  }
  console.log(JSON.stringify({ asOfDate, targetTenantId, targetHrGroupId, evidence }, null, 2))
}

await run()
