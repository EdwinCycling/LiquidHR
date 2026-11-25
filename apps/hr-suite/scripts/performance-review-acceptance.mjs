import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArguments, loginWithTestAuth, ensureContext, switchFromHrAdmin, navigateToRoute } from './local-test-acceptance.mjs'

const config = parseArguments(process.argv.slice(2))
const employeeId = 'c6b1c7a9-c250-3d19-b1a0-87e317e80b13'
const reviewerEmployeeId = '9048f02b-4fdc-3c4c-e1aa-fd339660029c'
const results = []
const sessions = new Map()
const pages = new Map()
const runLabel = new Intl.DateTimeFormat('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date())
const screenshotDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../docs/quality/acceptance/runs/PERF-MVP-01-20261125/screenshots')
await mkdir(screenshotDir, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PERF_MVP_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PERF_MVP_CHROMIUM_EXECUTABLE_PATH } : {}),
})
let step = 'login'
function check(condition, code) { if (!condition) throw new Error(code) }
async function waitForUi(locator, code, timeout) {
  try { await locator.waitFor({ state: 'visible', timeout }) } catch { throw new Error(code) }
}
async function fillWizardField(page, label, value, code) {
  try { await page.getByLabel(label).fill(value) } catch { throw new Error(code) }
}
async function screenshot(page, fileName) {
  const path = resolve(screenshotDir, fileName)
  await page.screenshot({ path, fullPage: true, animations: 'disabled' })
  return path
}
async function request(persona, method, path, body, statuses = [200], idempotencyKey = null) {
  const headers = { origin: new URL(config.baseUrl).origin }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  const response = await sessions.get(persona).request.fetch(new URL(path, config.baseUrl).toString(), { method, data: body, headers })
  if (!statuses.includes(response.status())) {
    const payload = await response.json().catch(() => null)
    const errorCode = typeof payload?.error === 'string' && /^[A-Z0-9_]+$/.test(payload.error) ? payload.error : null
    const safePath = path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/giu, 'id').split('?')[0].replace(/[^a-z0-9]+/giu, '_').toUpperCase()
    check(false, `HTTP_${persona}_${method}_${response.status()}_${errorCode ?? 'API_ERROR'}_${safePath}`)
  }
  const contentType = response.headers()['content-type'] ?? ''
  return response.status() === 204 || !contentType.includes('application/json') ? null : response.json()
}
try {
  for (const persona of ['hr-admin', 'employee', 'manager']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    sessions.set(persona, context)
    const page = await context.newPage()
    page.setDefaultNavigationTimeout(config.timeoutMs)
    pages.set(persona, page)
    await loginWithTestAuth(page, config, '/dashboard/start', { allowContextSelection: true })
    await ensureContext(context, config)
    await navigateToRoute(page, config, '/dashboard/start')
    if (persona !== 'hr-admin') {
      await switchFromHrAdmin(page, config, persona, { label: 'desktop', width: 1440, height: 900 })
      await ensureContext(context, persona === 'employee' ? { ...config, administrationId: null, requireServerAuthorizedAdministration: true } : config)
      await navigateToRoute(page, config, '/dashboard/start')
    }
  }
  results.push({ step: 'existing-persona-login', status: 'PASS' })
  step = 'role-navigation-scope'
  for (const [persona, route] of [['hr-admin', '/workforce/conversations'], ['manager', '/workforce/conversations'], ['employee', '/my-conversations']]) {
    const page = pages.get(persona)
    const matchingRoutes = await page.locator(`a[href="${route}"]`).count()
    const forbiddenRoute = persona === 'employee' ? '/workforce/conversations' : '/my-conversations'
    const forbiddenRoutes = await page.locator(`a[href="${forbiddenRoute}"]`).count()
    check(matchingRoutes > 0, `ROLE_NAVIGATION_MISSING_${persona.toUpperCase()}`)
    check(forbiddenRoutes === 0, `ROLE_NAVIGATION_LEAK_${persona.toUpperCase()}`)
  }
  results.push({ step, status: 'PASS' })

  step = 'role-dashboards-responsive-accessibility'
  const dashboardViews = [
    ['hr-admin', '/workforce/conversations', 'hr', 'Gespreksrondes'],
    ['manager', '/workforce/conversations', 'manager', 'Mijn team'],
    ['employee', '/my-conversations', 'employee', 'Mijn gesprekken'],
  ]
  const dashboardScreenshots = []
  const accessibilityResults = []
  for (const [persona, route, role, headingName] of dashboardViews) {
    const page = pages.get(persona)
    const dataResponse = page.waitForResponse((response) => {
      try { const url = new URL(response.url()); return url.pathname === '/api/performance-reviews/dashboard' && url.searchParams.get('role') === role } catch { return false }
    }, { timeout: config.timeoutMs }).catch(() => null)
    await page.goto(new URL(route, config.baseUrl).toString())
    const dashboardResponse = await dataResponse
    check(Boolean(dashboardResponse?.ok()), `DASHBOARD_DATA_FAILED_${persona.toUpperCase()}`)
    const dashboardHeading = page.locator('h1').first()
    await waitForUi(dashboardHeading, `DASHBOARD_HEADING_MISSING_${persona.toUpperCase()}`, config.timeoutMs)
    check((await dashboardHeading.innerText()).trim() === headingName, `DASHBOARD_HEADING_MISMATCH_${persona.toUpperCase()}`)
    dashboardScreenshots.push(await screenshot(page, `${persona}-dashboard-desktop.png`))
    const desktopAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    accessibilityResults.push({ persona, viewport: 'desktop', violations: desktopAxe.violations.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map((node) => ({ target: node.target, htmlOpeningTag: node.html.match(/^<[^>]+>/u)?.[0] ?? null, contrastChecks: node.any.filter((checkResult) => checkResult.id === 'color-contrast').map((checkResult) => checkResult.data) })) })) })
    await page.setViewportSize({ width: 390, height: 852 })
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `DASHBOARD_MOBILE_OVERFLOW_${persona.toUpperCase()}`)
    dashboardScreenshots.push(await screenshot(page, `${persona}-dashboard-mobile.png`))
    const mobileAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    accessibilityResults.push({ persona, viewport: 'mobile', violations: mobileAxe.violations.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map((node) => ({ target: node.target, htmlOpeningTag: node.html.match(/^<[^>]+>/u)?.[0] ?? null, contrastChecks: node.any.filter((checkResult) => checkResult.id === 'color-contrast').map((checkResult) => checkResult.data) })) })) })
    await page.setViewportSize({ width: 1440, height: 900 })
  }
  results.push({ step, status: 'PASS', screenshots: dashboardScreenshots })
  const accessibilityPassed = accessibilityResults.every((item) => item.violations.length === 0)
  results.push({ step: 'accessibility-axe', status: accessibilityPassed ? 'PASS' : 'FAIL', checks: accessibilityResults })
  if (!accessibilityPassed) process.exitCode = 1

  step = 'hr-round-wizard-draft'
  const hrWizardPage = pages.get('hr-admin')
  await hrWizardPage.goto(new URL('/workforce/conversations/new', config.baseUrl).toString())
  await waitForUi(hrWizardPage.getByRole('heading', { name: 'Nieuwe gespreksronde', exact: true }), 'HR_WIZARD_SCREEN_TIMEOUT', config.timeoutMs)
  const wizardTitle = `Ontwikkelcyclus proef 2026 · ${runLabel}`
  await fillWizardField(hrWizardPage, 'Titel', wizardTitle, 'HR_WIZARD_TITLE_FIELD_UNAVAILABLE')
  await fillWizardField(hrWizardPage, 'Aanhef en uitleg', 'Een rustige terugblik op resultaten, samenwerking en passende ontwikkeling voor het komende jaar.', 'HR_WIZARD_INTRODUCTION_FIELD_UNAVAILABLE')
  await fillWizardField(hrWizardPage, 'Periode van', '2026-01-01', 'HR_WIZARD_PERIOD_START_FIELD_UNAVAILABLE')
  await fillWizardField(hrWizardPage, 'Periode tot', '2026-12-31', 'HR_WIZARD_PERIOD_END_FIELD_UNAVAILABLE')
  await fillWizardField(hrWizardPage, 'Startdatum', '2026-11-30', 'HR_WIZARD_START_DATE_FIELD_UNAVAILABLE')
  await fillWizardField(hrWizardPage, 'Streefdatum', '2026-12-18', 'HR_WIZARD_DUE_DATE_FIELD_UNAVAILABLE')
  check(!await hrWizardPage.getByLabel('Beoordeling toevoegen').isChecked(), 'HR_WIZARD_RATING_NOT_OPTIONAL')
  const draftSaveResponse = hrWizardPage.waitForResponse((response) => {
    const request = response.request()
    return new URL(response.url()).pathname === '/api/performance-reviews' && request.method() === 'POST'
  }, { timeout: config.timeoutMs })
  await hrWizardPage.getByRole('button', { name: 'Concept bewaren', exact: true }).click()
  check((await draftSaveResponse).status() === 201, 'HR_WIZARD_DRAFT_SAVE_FAILED')
  const draftFeedbackVisible = await hrWizardPage.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].some((element) => element.textContent?.includes('Concept opgeslagen.') && element.getClientRects().length > 0), undefined, { timeout: config.timeoutMs }).then(() => true).catch(() => false)
  check(draftFeedbackVisible, 'HR_WIZARD_DRAFT_FEEDBACK_MISSING')
  const savedRounds = await request('hr-admin', 'GET', '/api/performance-reviews/rounds')
  const wizardDraftRound = savedRounds.find((round) => round.title === wizardTitle && round.status === 'DRAFT')
  check(Boolean(wizardDraftRound?.id), 'HR_WIZARD_DRAFT_NOT_PERSISTED')
  const wizardFeedback = await hrWizardPage.locator('[role="status"]').allTextContents().catch(() => [])
  results.push({ step, status: 'PASS', persisted: true, successFeedback: wizardFeedback.map((value) => value.trim()).filter(Boolean) })

  step = 'hr-wizard-participant-selection-and-scheduled-publish'
  const candidateReadback = await request('hr-admin', 'GET', '/api/performance-reviews/employees?search=Noah')
  const candidate = candidateReadback.items?.find((employee) => employee.id === employeeId)
  check(candidate?.assignmentStatus === 'READY' && candidate?.reviewerEmployeeId === reviewerEmployeeId, 'HR_CANDIDATE_SCOPE_OR_ASSIGNMENT_UNAVAILABLE')
  const candidateFilters = [
    ['hrGroupId', candidate.hr_group_id, 'hr_group_id'],
    ['administrationId', candidate.administration_id, 'administration_id'],
    ['departmentId', candidate.department_id, 'department_id'],
    ['jobId', candidate.job_id, 'job_id'],
    ['locationId', candidate.location_id, 'location_id'],
    ['managerId', candidate.direct_manager_id, 'direct_manager_id'],
    ['employmentStatus', candidate.employment_status, 'employment_status'],
  ]
  const testedCandidateFilters = []
  for (const [filterName, filterValue, resultField] of candidateFilters) {
    if (!filterValue) continue
    const filtered = await request('hr-admin', 'GET', `/api/performance-reviews/employees?${filterName}=${encodeURIComponent(filterValue)}`)
    check(filtered.items?.some((employee) => employee.id === employeeId && employee[resultField] === filterValue), `HR_CANDIDATE_FILTER_MISMATCH_${filterName.toUpperCase()}`)
    testedCandidateFilters.push(filterName)
  }
  await hrWizardPage.getByRole('button', { name: 'Volgende stap', exact: true }).click()
  await waitForUi(hrWizardPage.getByRole('heading', { name: 'Deelnemers', exact: true }), 'HR_WIZARD_PARTICIPANT_STEP_TIMEOUT', config.timeoutMs)
  const participantSearch = hrWizardPage.locator('label').filter({ hasText: 'Zoek medewerker' }).locator('input').first()
  await waitForUi(participantSearch, 'HR_WIZARD_PARTICIPANT_SEARCH_TIMEOUT', config.timeoutMs)
  const participantApiResponse = hrWizardPage.waitForResponse((response) => {
    try {
      const url = new URL(response.url())
      return url.pathname === '/api/performance-reviews/employees' && url.searchParams.get('search') === candidate.first_name
    } catch { return false }
  }, { timeout: config.timeoutMs })
  await participantSearch.fill(candidate.first_name)
  const participantApi = await participantApiResponse
  const participantApiPayload = await participantApi.json().catch(() => null)
  check(participantApi.status() === 200 && participantApiPayload?.items?.some((employee) => employee.id === employeeId), 'HR_WIZARD_EMPLOYEE_SEARCH_API_FAILED')
  const participantPreviewImage = await screenshot(hrWizardPage, 'hr-admin-wizard-participant-preview.png')
  const participantRow = hrWizardPage.locator('[aria-live="polite"] label').filter({ hasText: candidate.employee_number })
  await waitForUi(participantRow, 'HR_WIZARD_PARTICIPANT_PREVIEW_TIMEOUT', config.timeoutMs)
  check((await participantRow.innerText()).includes(candidate.reviewerName), 'HR_WIZARD_REVIEWER_PREVIEW_MISSING')
  await participantRow.locator('input[type="checkbox"]').check()
  check((await hrWizardPage.getByText('1 geselecteerd', { exact: false }).count()) > 0, 'HR_WIZARD_SELECTION_COUNT_MISSING')
  await hrWizardPage.getByRole('button', { name: 'Volgende stap', exact: true }).click()
  await waitForUi(hrWizardPage.getByRole('heading', { name: 'Controleren en starten', exact: true }), 'HR_WIZARD_REVIEW_STEP_TIMEOUT', config.timeoutMs)
  check(await hrWizardPage.getByText(wizardTitle, { exact: true }).count() === 1, 'HR_WIZARD_REVIEW_TITLE_MISSING')
  const publishResponse = hrWizardPage.waitForResponse((response) => {
    const request = response.request()
    return new URL(response.url()).pathname.endsWith('/publish') && request.method() === 'POST'
  }, { timeout: config.timeoutMs })
  await hrWizardPage.getByRole('button', { name: 'Publiceren', exact: true }).click()
  check((await publishResponse).ok(), 'HR_WIZARD_PUBLISH_FAILED')
  const scheduledRounds = await request('hr-admin', 'GET', '/api/performance-reviews/rounds')
  const scheduledRound = scheduledRounds.find((round) => round.title === wizardTitle && round.status === 'SCHEDULED')
  check(Boolean(scheduledRound) && scheduledRound.id === wizardDraftRound.id, 'HR_DRAFT_NOT_PUBLISHED_IN_PLACE')
  check(!scheduledRounds.some((round) => round.title === wizardTitle && round.status === 'DRAFT'), 'HR_DRAFT_REMAINS_AFTER_PUBLISH')
  const scheduledReadback = await request('hr-admin', 'GET', `/api/performance-reviews/rounds/${scheduledRound.id}`)
  check(scheduledReadback.participants?.length === 1 && scheduledReadback.participants[0].employee_id === employeeId && scheduledReadback.participants[0].reviewer_employee_id === reviewerEmployeeId, 'HR_WIZARD_PARTICIPANT_OR_REVIEWER_MISMATCH')
  const managerScheduledDashboard = await request('manager', 'GET', '/api/performance-reviews/dashboard?role=manager')
  check(!managerScheduledDashboard.nextActions?.some((action) => action.title === wizardTitle), 'HR_FUTURE_ROUND_CREATED_EARLY_TASK')
  results.push({ step, status: 'PASS', selectedCount: scheduledReadback.participants.length, testedFilters: testedCandidateFilters, participantPreviewScreenshot: participantPreviewImage, statusReadback: scheduledRound.status, futureTaskCreated: false })

  step = 'negative-role-matrix'
  const deniedRoundBody = {
    title: 'Onbevoegde rondepoging', introduction: 'De server moet deze wijziging blokkeren.', roundType: 'DEVELOPMENT',
    periodStart: '2026-01-01', periodEnd: '2026-12-31', startDate: '2026-11-23', dueDate: null, rating: null,
  }
  await request('manager', 'POST', '/api/performance-reviews/rounds', deniedRoundBody, [403], randomUUID())
  await request('employee', 'POST', '/api/performance-reviews/rounds', deniedRoundBody, [403], randomUUID())
  await request('manager', 'GET', '/api/performance-reviews/rounds', undefined, [401, 403])
  await request('hr-admin', 'GET', `/api/performance-reviews/employees?hrGroupId=${randomUUID()}`, undefined, [403])
  const roster = await request('hr-admin', 'GET', '/api/performance-reviews/employees?limit=100')
  const outsideTeamCandidate = roster.items?.find((employee) => employee.id !== employeeId && employee.reviewerEmployeeId !== reviewerEmployeeId && employee.assignmentStatus === 'READY' && employee.administrationId)
  check(Boolean(outsideTeamCandidate?.id), 'CROSS_SCOPE_TEST_FIXTURE_MISSING')
  const scopeRound = await request('hr-admin', 'POST', '/api/performance-reviews/rounds', {
    title: `Afgeschermd teamdossier · ${runLabel}`, introduction: 'Synthetisch dossier om personeels- en teamgrenzen te controleren.',
    roundType: 'DEVELOPMENT', periodStart: '2026-01-01', periodEnd: '2026-12-31', startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10), dueDate: null, rating: null,
  }, [201], randomUUID())
  await request('hr-admin', 'POST', `/api/performance-reviews/rounds/${scopeRound.id}/publish`, { version: scopeRound.version }, [200], randomUUID())
  const scopeDossier = await request('hr-admin', 'POST', `/api/performance-reviews/rounds/${scopeRound.id}/dossiers`, {
    employeeId: outsideTeamCandidate.id, reviewerEmployeeId: outsideTeamCandidate.reviewerEmployeeId,
    administrationId: outsideTeamCandidate.administrationId,
  }, [201], randomUUID())
  const hrScopeReadback = await request('hr-admin', 'GET', `/api/performance-reviews/dossiers/${scopeDossier.id}`)
  check(hrScopeReadback.id === scopeDossier.id, 'CROSS_SCOPE_TEST_DOSSIER_NOT_PERSISTED')
  const historyScopeStatuses = []
  for (const persona of ['employee', 'manager']) {
    const historyResponse = await sessions.get(persona).request.fetch(new URL(`/api/performance-reviews/employees/${outsideTeamCandidate.id}`, config.baseUrl).toString())
    const historyStatus = historyResponse.status()
    check([200, 401, 403, 404].includes(historyStatus), `CROSS_SCOPE_HISTORY_STATUS_${persona.toUpperCase()}_${historyStatus}`)
    if (historyStatus === 200) {
      const historyPayload = await historyResponse.json().catch(() => null)
      check(Array.isArray(historyPayload?.items) && historyPayload.items.length === 0, `CROSS_SCOPE_HISTORY_LEAK_${persona.toUpperCase()}`)
    }
    const dossierResponse = await sessions.get(persona).request.fetch(new URL(`/api/performance-reviews/dossiers/${scopeDossier.id}`, config.baseUrl).toString())
    check([401, 403, 404].includes(dossierResponse.status()), `CROSS_SCOPE_DOSSIER_ACCESS_${persona.toUpperCase()}_${dossierResponse.status()}`)
    historyScopeStatuses.push({ persona, status: historyStatus, dossierDenied: true })
  }
  const scopeRoundReadback = await request('hr-admin', 'GET', `/api/performance-reviews/rounds/${scopeRound.id}`)
  await request('hr-admin', 'POST', `/api/performance-reviews/rounds/${scopeRound.id}/close`, { version: scopeRoundReadback.version, reason: 'De scopecontrole is afgerond; het dossier blijft alleen als historie bestaan.' }, [200], randomUUID())
  results.push({ step, status: 'PASS', historyScopeStatuses, testDossierClosed: true })

  for (const rated of [false, true]) {
    step = rated ? 'rated-round' : 'unrated-round'
    const round = await request('hr-admin', 'POST', '/api/performance-reviews/rounds', {
      title: rated ? `Ontwikkelgesprek najaar 2026 · ${runLabel}` : `Terugblik samenwerking 2026 · ${runLabel}`,
      introduction: 'We bespreken de resultaten, samenwerking en ontwikkeling van het afgelopen jaar en maken afspraken voor de komende periode.',
      roundType: rated ? 'DEVELOPMENT' : 'LOOKBACK', periodStart: '2026-01-01', periodEnd: '2026-12-31', startDate: '2026-11-23', dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      rating: rated ? { options: [1, 2, 3, 4, 5].map(score => ({ score, label: ['Aandacht nodig', 'In ontwikkeling', 'Volgens verwachting', 'Sterk', 'Uitstekend'][score - 1], description: `Niveau ${score} op basis van resultaten en samenwerking.` })) } : null,
    }, [201], randomUUID())
    check(round.id, 'ROUND_ID_MISSING')
    await request('hr-admin', 'POST', `/api/performance-reviews/rounds/${round.id}/publish`, { version: round.version }, [200], randomUUID())
    let dossier = await request('hr-admin', 'POST', `/api/performance-reviews/rounds/${round.id}/dossiers`, { employeeId, reviewerEmployeeId, administrationId: config.administrationId }, [201], randomUUID())
    const duplicateDossier = await request('hr-admin', 'POST', `/api/performance-reviews/rounds/${round.id}/dossiers`, { employeeId, reviewerEmployeeId, administrationId: config.administrationId }, [201], randomUUID())
    check(duplicateDossier.id === dossier.id && duplicateDossier.version === dossier.version, 'DUPLICATE_DOSSIER_CREATED_OR_CHANGED')
    const path = `/api/performance-reviews/dossiers/${dossier.id}`
    await request('manager', 'POST', `${path}/manager`, { version: dossier.version, body: 'Reactie vóór medewerkerindiening', submit: true }, [409])
    step = 'round-detail-ui'
    await pages.get('hr-admin').goto(new URL(`/workforce/conversations/rounds/${round.id}`, config.baseUrl).toString())
    await waitForUi(pages.get('hr-admin').getByRole('heading', { name: round.title, exact: true }), 'HR_ROUND_HEADING_TIMEOUT', config.timeoutMs)
    check((await pages.get('hr-admin').locator('h1').textContent())?.includes(round.title), 'HR_ROUND_DETAIL_NOT_VISIBLE')
    step = 'employee-self-ui'
    await pages.get('employee').goto(new URL(`/my-conversations?dossierId=${dossier.id}`, config.baseUrl).toString())
    await waitForUi(pages.get('employee').locator('textarea').first(), 'EMPLOYEE_SELF_FORM_TIMEOUT', config.timeoutMs)
    check((await pages.get('employee').locator('textarea').count()) > 0, 'EMPLOYEE_SELF_FORM_NOT_VISIBLE')
    if (!rated) {
      const overdueBadge = pages.get('employee').getByText('Streefdatum verstreken', { exact: true }).first()
      await waitForUi(overdueBadge, 'SOFT_DEADLINE_BADGE_MISSING', config.timeoutMs)
      check(await pages.get('employee').locator('textarea').first().isEnabled(), 'SOFT_DEADLINE_BLOCKED_EMPLOYEE')
      results.push({ step: 'soft-deadline-warning-remains-editable', status: 'PASS', badgeVisible: true, employeeFormEnabled: true, screenshot: await screenshot(pages.get('employee'), 'employee-overdue-soft-deadline.png') })
    }
    await pages.get('employee').setViewportSize({ width: 390, height: 852 })
    check(await pages.get('employee').evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'EMPLOYEE_MOBILE_OVERFLOW')
    dossier = await request('employee', 'POST', `${path}/self`, { version: dossier.version, body: 'Ik heb de overdracht verbeterd en wil volgend jaar mijn vakkennis verder verdiepen.', submit: false })
    const managerDraftRead = await request('manager', 'GET', path)
    check(!JSON.stringify(managerDraftRead).includes('Ik heb de overdracht verbeterd'), 'SELF_DRAFT_LEAK')
    dossier = await request('employee', 'POST', `${path}/self`, { version: dossier.version, body: 'Ik heb de overdracht verbeterd en wil volgend jaar mijn vakkennis verder verdiepen.', submit: true })
    await request('employee', 'POST', `${path}/self`, { version: dossier.version, body: 'Wijziging na definitieve indiening', submit: false }, [409])
    await request('manager', 'POST', `${path}/private-note`, { version: dossier.version, body: 'Bespreek welke begeleiding aansluit bij de gewenste ontwikkeling.' })
    await request('employee', 'GET', `${path}/private-note`, undefined, [403, 404])
    const appraisalTitle = `Werkafspraak ontwikkeling · ${runLabel}`
    const appraisalBody = 'De medewerker reserveert maandelijks tijd voor vakontwikkeling en bespreekt de voortgang tijdens het volgende overleg.'
    const appraisalItem = await request('manager', 'POST', '/api/continuous-appraisal', {
      employeeId, itemType: 'AGREEMENT', title: appraisalTitle, body: appraisalBody,
      occurredOn: new Date().toISOString().slice(0, 10), itemStatus: 'OPEN',
    }, [201])
    await request('manager', 'POST', `${path}/appraisal-links`, { appraisalItemId: appraisalItem.id }, [201])
    const linkedDossier = await request('employee', 'GET', path)
    check(linkedDossier.performance_review_appraisal_links?.some((link) => link.appraisal_item_id === appraisalItem.id), 'APPRAISAL_LINK_NOT_VISIBLE')
    check(!JSON.stringify(linkedDossier).includes(appraisalTitle) && !JSON.stringify(linkedDossier).includes(appraisalBody), 'APPRAISAL_CONTENT_COPIED_INTO_DOSSIER')
    await request('employee', 'POST', `${path}/appraisal-links`, { appraisalItemId: appraisalItem.id }, [403])
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF\n', 'utf8')
    const attachmentKey = randomUUID()
    const uploadAttachment = (key) => sessions.get('manager').request.fetch(new URL(`${path}/attachments`, config.baseUrl).toString(), { method: 'POST', headers: { origin: new URL(config.baseUrl).origin, 'Idempotency-Key': key }, multipart: { file: { name: 'Gespreksafspraken 2026.pdf', mimeType: 'application/pdf', buffer: pdf } } })
    const attachmentRequest = await uploadAttachment(attachmentKey)
    check(attachmentRequest.status() === 201, `HTTP_MANAGER_ATTACHMENT_${attachmentRequest.status()}`)
    const attachment = await attachmentRequest.json()
    const attachmentRetry = await uploadAttachment(attachmentKey)
    check(attachmentRetry.status() === 201 && (await attachmentRetry.json()).id === attachment.id, 'ATTACHMENT_IDEMPOTENCY_FAILED')
    const employeeUpload = await sessions.get('employee').request.fetch(new URL(`${path}/attachments`, config.baseUrl).toString(), { method: 'POST', headers: { origin: new URL(config.baseUrl).origin, 'Idempotency-Key': randomUUID() }, multipart: { file: { name: 'Onbevoegde upload.pdf', mimeType: 'application/pdf', buffer: pdf } } })
    check(employeeUpload.status() === 403, `EMPLOYEE_ATTACHMENT_UPLOAD_STATUS_${employeeUpload.status()}`)
    await request('employee', 'DELETE', `${path}/attachments/${attachment.id}`, undefined, [403, 404])
    await request('manager', 'DELETE', `${path}/attachments/${attachment.id}`, undefined, [200])
    const replacementRequest = await uploadAttachment(randomUUID())
    check(replacementRequest.status() === 201, `HTTP_MANAGER_ATTACHMENT_REPLACEMENT_${replacementRequest.status()}`)
    const replacementAttachment = await replacementRequest.json()
    check(replacementAttachment.id !== attachment.id, 'ATTACHMENT_REPLACEMENT_FAILED')
    await request('employee', 'GET', `${path}/attachments/${replacementAttachment.id}`, undefined, [403, 404])
    await request('employee', 'POST', `${path}/manager`, { version: dossier.version, body: 'Onbevoegde managerreactie' }, [403])
    step = 'manager-form-ui'
    await pages.get('manager').goto(new URL(`/workforce/conversations?dossierId=${dossier.id}`, config.baseUrl).toString())
    await waitForUi(pages.get('manager').locator('textarea').first(), 'MANAGER_FORM_TIMEOUT', config.timeoutMs)
    check((await pages.get('manager').locator('textarea').count()) > 0, 'MANAGER_FORM_NOT_VISIBLE')
    await pages.get('manager').setViewportSize({ width: 390, height: 852 })
    check(await pages.get('manager').evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'MANAGER_MOBILE_OVERFLOW')
    step = 'manager-form-submit'
    if (rated) await request('manager', 'POST', `${path}/manager`, { version: dossier.version, body: 'Beoordeling zonder onderbouwing', submit: true, score: 4 }, [400])
    const expectedManagerVersion = dossier.version
    const concurrentDrafts = await Promise.all([
      request('manager', 'POST', `${path}/manager`, { version: expectedManagerVersion, body: 'Conceptreactie A voor concurrencycontrole.', submit: false }, [200, 409]),
      request('manager', 'POST', `${path}/manager`, { version: expectedManagerVersion, body: 'Conceptreactie B voor concurrencycontrole.', submit: false }, [200, 409]),
    ])
    const winningDrafts = concurrentDrafts.filter((value) => value?.version === expectedManagerVersion + 1)
    check(winningDrafts.length === 1, 'OPTIMISTIC_LOCK_DID_NOT_REJECT_STALE_WRITE')
    dossier = winningDrafts[0]
    dossier = await request('manager', 'POST', `${path}/manager`, { version: dossier.version, body: 'De samenwerking en overdracht zijn merkbaar verbeterd. We plannen ruimte voor verdere vakontwikkeling.', submit: true, ...(rated ? { score: 4, ratingExplanation: 'De resultaten zijn sterk en de samenwerking heeft aantoonbaar bijgedragen aan het team.' } : {}) })
    const employeeRead = await request('employee', 'GET', path)
    check(!JSON.stringify(employeeRead).includes('Bespreek welke begeleiding'), 'PRIVATE_NOTE_LEAK')
    const finalManagerSubmission = employeeRead.performance_review_submissions?.find((submission) => submission.kind === 'MANAGER' && submission.submitted_at)
    check(finalManagerSubmission?.body.includes('merkbaar verbeterd'), 'EMPLOYEE_FINAL_MANAGER_RESPONSE_MISSING')
    if (rated) check(finalManagerSubmission?.score === 4 && finalManagerSubmission?.rating_explanation.includes('aantoonbaar'), 'EMPLOYEE_FINAL_SCORE_OR_EXPLANATION_MISSING')
    await request('employee', 'GET', `${path}/attachments/${replacementAttachment.id}`, undefined, [200, 302])
    if (rated) await request('employee', 'POST', `${path}/acknowledge`, { version: dossier.version, decision: 'DISAGREE', reason: '' }, [400])
    const completedDossier = await request('employee', 'POST', `${path}/acknowledge`, { version: dossier.version, decision: rated ? 'DISAGREE' : 'AGREE', ...(rated ? { reason: 'Ik herken de positieve ontwikkeling, maar wil de beoordeling van mijn extra inzet nog bespreken.' } : {}) })
    await request('employee', 'POST', `${path}/acknowledge`, { version: dossier.version, decision: rated ? 'DISAGREE' : 'AGREE', ...(rated ? { reason: 'Herhaalde ontvangstactie' } : {}) }, [403, 409])
    if (rated) {
      const dashboard = await request('manager', 'GET', '/api/performance-reviews/dashboard?role=manager')
      check((dashboard.phaseCounts?.COMPLETED_DISAGREED ?? 0) > 0, 'MANAGER_DASHBOARD_MISSING_COMPLETED_DOSSIER')
    }
    step = 'employee-history-api'
    const employeeHistory = await request('employee', 'GET', '/api/performance-reviews?role=employee')
    check(employeeHistory.items?.some((item) => item.id === dossier.id), 'EMPLOYEE_HISTORY_API_MISSING')
    check(employeeHistory.items?.some((item) => item.id === dossier.id && item.phase === completedDossier.phase), 'EMPLOYEE_HISTORY_PHASE_MISMATCH')
    const [hrDashboard, managerDashboard, employeeDashboard] = await Promise.all([
      request('hr-admin', 'GET', '/api/performance-reviews/dashboard?role=hr'),
      request('manager', 'GET', '/api/performance-reviews/dashboard?role=manager'),
      request('employee', 'GET', '/api/performance-reviews/dashboard?role=employee'),
    ])
    check([hrDashboard, managerDashboard, employeeDashboard].every((dashboard) => typeof dashboard?.phaseCounts === 'object' && Array.isArray(dashboard?.nextActions)), 'ROLE_DASHBOARD_CONTRACT_FAILED')
    step = 'employee-history-ui'
    await pages.get('employee').goto(new URL(`/my-conversations?dossierId=${dossier.id}`, config.baseUrl).toString())
    await waitForUi(pages.get('employee').getByRole('heading', { name: round.title, exact: true }), 'EMPLOYEE_HISTORY_NOT_AVAILABLE', config.timeoutMs)
    check((await pages.get('employee').getByRole('heading', { name: round.title, exact: true }).count()) > 0, 'EMPLOYEE_HISTORY_NOT_AVAILABLE')
    await pages.get('employee').goto(new URL(`/employees/${employeeId}?tab=conversations`, config.baseUrl).toString())
    const employeeCardTab = pages.get('employee').getByRole('tablist').getByRole('link', { name: /^(Gesprekken|Conversations)$/u })
    await waitForUi(employeeCardTab, 'EMPLOYEE_DETAIL_CONVERSATIONS_TAB_MISSING', config.timeoutMs)
    check(await employeeCardTab.getAttribute('aria-current') === 'page', 'EMPLOYEE_DETAIL_CONVERSATIONS_TAB_NOT_SELECTED')
    const employeeCardHistoryTitle = pages.get('employee').getByText(round.title, { exact: true })
    await waitForUi(employeeCardHistoryTitle, 'EMPLOYEE_DETAIL_CONVERSATIONS_HISTORY_MISSING', config.timeoutMs)
    const employeeCardDesktop = await screenshot(pages.get('employee'), 'employee-card-conversations-desktop.png')
    await pages.get('employee').setViewportSize({ width: 390, height: 852 })
    check(await pages.get('employee').evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'EMPLOYEE_CARD_MOBILE_OVERFLOW')
    const employeeCardMobile = await screenshot(pages.get('employee'), 'employee-card-conversations-mobile.png')
    await pages.get('employee').setViewportSize({ width: 1440, height: 900 })
    check(await employeeCardHistoryTitle.count() > 0, 'EMPLOYEE_DETAIL_CONVERSATIONS_HISTORY_MISSING')
    results.push({ step: 'employee-detail-conversations-tab', status: 'PASS', talentPassportRequired: false, screenshots: [employeeCardDesktop, employeeCardMobile] })
    await pages.get('employee').goto(new URL(`/my-conversations?dossierId=${dossier.id}`, config.baseUrl).toString())
    if (rated) {
      const hrPage = pages.get('hr-admin')
      const managerPage = pages.get('manager')
      const employeePage = pages.get('employee')
      const hrRoundReadback = await request('hr-admin', 'GET', `/api/performance-reviews/rounds/${round.id}`)
      check(hrRoundReadback?.id === round.id && hrRoundReadback?.title === round.title, 'HR_ROUND_API_READBACK_FAILED')
      const hrRoundHeading = hrPage.getByRole('heading', { name: round.title, exact: true })
      await waitForUi(hrRoundHeading, 'HR_ROUND_SCREEN_NOT_READY_FOR_SCREENSHOT', config.timeoutMs)
      const hrDetailDesktop = await screenshot(hrPage, 'hr-admin-round-detail-desktop.png')
      await hrPage.setViewportSize({ width: 390, height: 852 })
      check(await hrPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'HR_ADMIN_MOBILE_OVERFLOW')
      check(await hrRoundHeading.count() === 1 && await hrPage.getByText('Opslaan is niet gelukt.', { exact: true }).count() === 0, 'HR_ADMIN_ROUND_DETAIL_MOBILE_FAILED')
      const hrDetailMobile = await screenshot(hrPage, 'hr-admin-round-detail-mobile.png')
      await hrPage.setViewportSize({ width: 1440, height: 900 })
      await managerPage.setViewportSize({ width: 1440, height: 900 })
      await managerPage.goto(new URL(`/workforce/conversations?dossierId=${dossier.id}`, config.baseUrl).toString())
      const managerHeading = managerPage.getByRole('heading', { name: round.title, exact: true })
      await waitForUi(managerHeading, 'MANAGER_DOSSIER_SCREEN_TIMEOUT', config.timeoutMs)
      const managerAttachmentRow = managerPage.locator('li').filter({ hasText: 'Gespreksafspraken 2026.pdf' }).last()
      await waitForUi(managerAttachmentRow, 'MANAGER_RELEASED_ATTACHMENT_MISSING', config.timeoutMs)
      const pdfResponse = sessions.get('manager').waitForEvent('response', (response) => response.status() === 200 && (response.headers()['content-type'] ?? '').includes('application/pdf'), { timeout: config.timeoutMs })
      const attachmentPopup = managerPage.waitForEvent('popup', { timeout: config.timeoutMs })
      await managerAttachmentRow.getByRole('button', { name: 'Volgende actie', exact: true }).click()
      const [attachmentPage, attachmentResponse] = await Promise.all([attachmentPopup, pdfResponse])
      check(attachmentResponse.ok() && (attachmentResponse.headers()['content-type'] ?? '').includes('application/pdf'), 'MANAGER_RELEASED_ATTACHMENT_DOWNLOAD_FAILED')
      await attachmentPage.close()
      results.push({ step: 'manager-released-document-download', status: 'PASS' })
      await managerHeading.scrollIntoViewIfNeeded()
      const managerDesktop = await screenshot(managerPage, 'manager-dossier-desktop.png')
      await managerPage.setViewportSize({ width: 390, height: 852 })
      check(await managerPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'MANAGER_SCREENSHOT_MOBILE_OVERFLOW')
      await managerHeading.scrollIntoViewIfNeeded()
      const managerMobile = await screenshot(managerPage, 'manager-dossier-mobile.png')
      await managerPage.setViewportSize({ width: 1440, height: 900 })
      await employeePage.setViewportSize({ width: 1440, height: 900 })
      const employeeHeading = employeePage.getByRole('heading', { name: round.title, exact: true })
      await waitForUi(employeeHeading, 'EMPLOYEE_DOSSIER_SCREEN_TIMEOUT', config.timeoutMs)
      await employeeHeading.scrollIntoViewIfNeeded()
      const employeeDesktop = await screenshot(employeePage, 'employee-dossier-desktop.png')
      await employeePage.setViewportSize({ width: 390, height: 852 })
      await employeeHeading.scrollIntoViewIfNeeded()
      const employeeMobile = await screenshot(employeePage, 'employee-dossier-mobile.png')
      results.push({ step: 'role-screenshots', status: 'PASS', files: [hrDetailDesktop, hrDetailMobile, managerDesktop, managerMobile, employeeDesktop, employeeMobile] })
    }
    results.push({ step, status: 'PASS', roundId: round.id, dossierId: dossier.id })
  }

  step = 'round-close-race-and-open-dossier-history'
  const closeRound = await request('hr-admin', 'POST', '/api/performance-reviews/rounds', {
    title: `Afgesloten ronde met open dossier · ${runLabel}`, introduction: 'Deze ronde wordt gesloten terwijl het dossier nog openstaat.',
    roundType: 'DEVELOPMENT', periodStart: '2026-01-01', periodEnd: '2026-12-31', startDate: new Date().toISOString().slice(0, 10), dueDate: null, rating: null,
  }, [201], randomUUID())
  await request('hr-admin', 'POST', `/api/performance-reviews/rounds/${closeRound.id}/publish`, { version: closeRound.version }, [200], randomUUID())
  const closeDossier = await request('hr-admin', 'POST', `/api/performance-reviews/rounds/${closeRound.id}/dossiers`, { employeeId, reviewerEmployeeId, administrationId: config.administrationId }, [201], randomUUID())
  const preCloseRound = await request('hr-admin', 'GET', `/api/performance-reviews/rounds/${closeRound.id}`)
  const originalOpenPhase = preCloseRound.participants?.find((item) => item.id === closeDossier.id)?.phase
  check(Boolean(originalOpenPhase), 'ROUND_CLOSE_OPEN_DOSSIER_MISSING')
  const closeResponse = await Promise.all([randomUUID(), randomUUID()].map(async (key) => {
    const response = await sessions.get('hr-admin').request.fetch(new URL(`/api/performance-reviews/rounds/${closeRound.id}/close`, config.baseUrl).toString(), {
      method: 'POST', headers: { origin: new URL(config.baseUrl).origin, 'Idempotency-Key': key },
      data: { version: preCloseRound.version, reason: 'De testcyclus is afgerond; resterende acties worden beëindigd.' },
    })
    return { status: response.status(), body: await response.json().catch(() => null) }
  }))
  check(closeResponse.filter((response) => response.status === 200).length === 1 && closeResponse.filter((response) => response.status === 409).length === 1, 'ROUND_CLOSE_RACE_NOT_SERIALIZED')
  const closedRound = await request('hr-admin', 'GET', `/api/performance-reviews/rounds/${closeRound.id}`)
  const closedDossier = await request('employee', 'GET', `/api/performance-reviews/dossiers/${closeDossier.id}`)
  check(closedRound.status === 'CLOSED' && closedDossier.phase === originalOpenPhase, 'ROUND_CLOSE_CHANGED_DOSSIER_HISTORY')
  const managerWorkspace = await request('manager', 'GET', '/api/performance-reviews?role=manager')
  check(managerWorkspace.items?.some((item) => item.id === closeDossier.id && item.roundStatus === 'CLOSED'), 'CLOSED_OPEN_DOSSIER_HISTORY_MISSING')
  results.push({ step, status: 'PASS', closeResponses: closeResponse.map((response) => response.status), openDossierPhasePreserved: true })
} catch (error) {
  const message = error instanceof Error ? error.message.split('\n')[0] : ''
  const sanitizedMessage = message.replace(/https?:\/\/[^\s)]+/gu, '[url]').replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gu, '[email]').slice(0, 180)
  results.push({ step, status: 'FAIL', code: /^[A-Z0-9_]+$/.test(message) ? message : 'ACCEPTANCE_OPERATION_FAILED', ...(sanitizedMessage ? { diagnostic: sanitizedMessage } : {}) })
  process.exitCode = 1
} finally {
  await browser.close()
  console.log(JSON.stringify({ mode: 'local-real-persona', screenshots: screenshotDir, results }, null, 2))
}
