import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

export const R5_PREFIX = 'R5-TEST'
export const R5_DATASET_CONTRACT = Object.freeze([
  'OPEN_HR_QUEUE_UNCLAIMED',
  'CLAIMED_WORK_ITEM',
  'EMPLOYEE_DOCUMENT_ACKNOWLEDGEMENT',
  'COMPLETED_PROCESS',
  'REJECTED_APPROVAL_FLOW',
  'REQUEST_CHANGES_FLOW',
  'BLOCKED_UNRESOLVED_ASSIGNMENT',
  'UPCOMING_DEADLINE',
  'OVERDUE_DEADLINE',
  'SUCCESSFUL_PROCESS_OUTPUT',
  'DRAFT_PROCESS_DEFINITION',
  'RETIRED_PROCESS_DEFINITION',
])

export const R5_DEFINITION_KEYS = Object.freeze({
  internalTransfer: 'r5-test-internal-transfer',
  documentAcknowledgement: 'r5-test-document-acknowledgement',
  overdue: 'r5-test-overdue-transfer',
  draft: 'r5-test-draft-process',
  retired: 'r5-test-retired-process',
})

export const R5_CLEANUP_TABLE_ORDER = Object.freeze([
  'employee_document_acknowledgements',
  'process_reminder_deliveries',
  'process_domain_commits',
  'process_work_item_notes',
  'process_form_response_revisions',
  'process_form_responses',
  'process_events',
  'process_work_item_candidates',
  'process_outputs',
  'workflow_jobs',
  'process_work_items',
  'process_step_instances',
  'process_employee_subjects',
  'process_employment_subjects',
  'process_instances',
  'process_recipe_activations',
  'process_versions',
  'process_definition_drafts',
  'process_definitions',
  'document_audiences',
  'employee_documents',
  'reminder_recipients',
  'reminder_targets',
  'reminder_target_rules',
  'reminders',
])

export function hasR5Prefix(value) {
  return typeof value === 'string' && value.startsWith(R5_PREFIX)
}

export function parseMode(argv = []) {
  const mode = argv[0] ?? 'setup'
  if (mode !== 'setup' && mode !== 'readback' && mode !== 'cleanup') throw new Error(`Invalid mode: ${mode}`)
  return mode
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY
const projectId = new URL(supabaseUrl ?? 'https://invalid.example').hostname.split('.')[0]
const DOCUMENT_BUCKET = 'employee-documents'

const passwords = { hr: process.env.TALENT_HR_ADMIN_PASSWORD, manager: process.env.TALENT_MANAGER_PASSWORD, employee: process.env.TALENT_EMPLOYEE_PASSWORD }
const emails = { hr: 'hradmin.fixture@liquidhr.test', manager: 'manager.fixture@liquidhr.test', employee: 'employee.fixture@liquidhr.test' }
const correlationIds = Object.freeze({
  claimed: 'a0000000-0000-4000-8000-000000000002',
  rejected: 'a0000000-0000-4000-8000-000000000003',
  requestChanges: 'a0000000-0000-4000-8000-000000000004',
  blocked: 'a0000000-0000-4000-8000-000000000005',
  overdue: 'a0000000-0000-4000-8000-000000000006',
  overdueFixed: 'a0000000-0000-4000-8000-000000000010',
  acknowledgementOpen: 'a0000000-0000-4000-8000-000000000007',
  acknowledgementCompleted: 'a0000000-0000-4000-8000-000000000008',
  openHrQueueHr: 'a0000000-0000-4000-8000-000000000009',
})
const execFileAsync = promisify(execFile)

class FixtureError extends Error {
  constructor(code, message, details = undefined) {
    super(message)
    this.name = 'FixtureError'
    this.code = code
    this.details = details
  }
}

function assert(condition, code, message, details = undefined) {
  if (!condition) throw new FixtureError(code, message, details)
}

function validateEnvironment() {
  if (!supabaseUrl || !supabaseKey) throw new Error('Missing canonical Supabase environment')
  if (projectId !== 'wnpfloqpjvaacobppbpk') throw new Error(`Unexpected Supabase project: ${projectId}`)
}

function validateCleanupEnvironment() {
  if (!supabaseSecretKey) throw new Error('Missing canonical Supabase cleanup key')
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function dataOf(body) { return object(body).data }
function codeOf(body) { return typeof object(body).code === 'string' ? object(body).code : null }
function textOf(value) { return typeof value === 'string' ? value : '' }
function strictUuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) }
function databaseUuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) }

function todayPlus(days) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

function sessionClient() {
  const cookieJar = new Map()
  const client = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() { return [...cookieJar.entries()].map(([name, value]) => ({ name, value })) },
      setAll(cookies) { cookies.forEach(({ name, value }) => cookieJar.set(name, value)) },
    },
  })
  return { client, cookieJar }
}

async function signIn(role) {
  const password = passwords[role]
  assert(typeof password === 'string' && password.length > 0, 'FIXTURE_PASSWORD_MISSING', `${role} fixture password is missing`)
  const session = sessionClient()
  const result = await session.client.auth.signInWithPassword({ email: emails[role], password })
  if (result.error || !result.data.session) throw new FixtureError('FIXTURE_AUTH_FAILED', `Fixture sign-in failed for ${role}`)
  return { role, accessToken: result.data.session.access_token, userId: result.data.user.id, cookieJar: session.cookieJar }
}

function cookieHeader(cookieJar) { return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join('; ') }

async function api(session, path, init = {}) {
  const headers = new Headers(init.headers ?? {})
  headers.set('Accept', 'application/json')
  headers.set('Authorization', `Bearer ${session.accessToken}`)
  const cookies = cookieHeader(session.cookieJar)
  if (cookies) headers.set('Cookie', cookies)
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers })
  const setCookies = response.headers.getSetCookie?.() ?? []
  setCookies.forEach((value) => {
    const pair = value.split(';', 1)[0]
    const separator = pair.indexOf('=')
    if (separator > 0) session.cookieJar.set(pair.slice(0, separator), pair.slice(separator + 1))
  })
  const contentType = response.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json') ? await response.json() : await response.text()
  return { status: response.status, body, headers: response.headers }
}

async function apiJson(session, path, method, payload) {
  return api(session, path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
}

function requireOk(result, label, acceptedStatuses = [200, 201]) {
  if (!acceptedStatuses.includes(result.status)) {
    const body = object(result.body)
    throw new FixtureError('FIXTURE_API_FAILED', `${label} failed with HTTP ${result.status}${codeOf(result.body) ? ` (${codeOf(result.body)})` : ''}`, { status: result.status, code: codeOf(result.body), issues: Array.isArray(body.issues) ? body.issues : undefined })
  }
  return dataOf(result.body)
}

function bearerHeaders(session) { return { apikey: supabaseKey, Authorization: `Bearer ${session.accessToken}`, Accept: 'application/json' } }

async function rest(session, table, query = '', options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${query}`, { method: options.method ?? 'GET', headers: { ...bearerHeaders(session), ...(options.headers ?? {}) }, body: options.body })
  const contentType = response.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json') ? await response.json() : await response.text()
  if (!response.ok) {
    const description = typeof body === 'object' && body !== null && typeof body.message === 'string' ? `: ${body.message}` : ''
    throw new FixtureError('FIXTURE_REST_FAILED', `${table} read failed with HTTP ${response.status}${description}`)
  }
  return body
}

async function privilegedRest(table, query = '', options = {}) {
  validateCleanupEnvironment()
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${query}`, {
    method: options.method ?? 'GET',
    headers: {
      apikey: supabaseSecretKey,
      Authorization: `Bearer ${supabaseSecretKey}`,
      Accept: 'application/json',
      ...(options.headers ?? {}),
    },
    body: options.body,
  })
  const contentType = response.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json') ? await response.json() : await response.text()
  if (!response.ok) {
    const description = typeof body === 'object' && body !== null && typeof body.message === 'string' ? `: ${body.message}` : ''
    throw new FixtureError('FIXTURE_PRIVILEGED_REST_FAILED', `${table} cleanup failed with HTTP ${response.status}${description}`, { status: response.status })
  }
  return body
}

function uuidList(values) {
  assert(values.every((value) => databaseUuid(value)), 'FIXTURE_CLEANUP_ID_INVALID', 'Cleanup received an invalid or missing UUID')
  return [...new Set(values)]
}

function inFilter(column, values) {
  const ids = uuidList(values)
  return ids.length > 0 ? `&${column}=in.(${ids.join(',')})` : ''
}

async function privilegedRows(table, query, select) {
  const rows = await privilegedRest(table, `?select=${encodeURIComponent(select)}${query}`)
  assert(Array.isArray(rows), 'FIXTURE_CLEANUP_READ_INVALID', `${table} cleanup inventory is not an array`)
  return rows.map((row) => object(row))
}

async function removeStorageObjects(documents) {
  const paths = [...new Set(documents.map((document) => textOf(document.storage_key)).filter(Boolean))]
  if (paths.length === 0) return { bucket: DOCUMENT_BUCKET, requested: 0, removed: 0, status: 204 }
  validateCleanupEnvironment()
  const storageClient = createClient(supabaseUrl, supabaseSecretKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await storageClient.storage.from(DOCUMENT_BUCKET).remove(paths)
  if (error) throw new FixtureError('FIXTURE_STORAGE_CLEANUP_FAILED', 'Storage cleanup failed', { message: error.message })
  return { bucket: DOCUMENT_BUCKET, requested: paths.length, removed: Array.isArray(data) ? data.length : null, status: 200 }
}

async function rpc(session, functionName, payload) {
  return rest(session, `rpc/${functionName}`, '', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
}

async function context(session) {
  let result = await api(session, '/api/context')
  for (let attempt = 0; result.status === 500 && attempt < 3; attempt += 1) {
    await sleep(5000)
    result = await api(session, '/api/context')
  }
  const value = object(requireOk(result, 'context read'))
  const tenant = object(value.tenant)
  const activeHrGroup = object(value.activeHrGroup)
  const administration = object(value.activeAdministration)
  return {
    tenantId: textOf(tenant.id),
    hrGroupId: textOf(activeHrGroup.id),
    administrationId: textOf(administration.id),
    employeeId: value.employee && typeof value.employee === 'object' ? textOf(value.employee.id) : null,
    userId: textOf(value.userId),
    permissions: Array.isArray(value.permissions) ? value.permissions.filter((item) => typeof item === 'string') : [],
  }
}

async function chooseContext(session, canonical) {
  const current = await context(session)
  if (current.tenantId === canonical.tenantId && current.hrGroupId === canonical.hrGroupId && current.administrationId === canonical.administrationId) return current
  if (current.tenantId !== canonical.tenantId || current.hrGroupId !== canonical.hrGroupId) requireOk(await apiJson(session, '/api/context/hr-group', 'POST', { hrGroupId: canonical.hrGroupId }), 'HR group context selection')
  requireOk(await apiJson(session, '/api/context/administration', 'POST', { administrationId: canonical.administrationId }), 'administration context selection')
  const selected = await context(session)
  assert(selected.tenantId === canonical.tenantId && selected.hrGroupId === canonical.hrGroupId && selected.administrationId === canonical.administrationId, 'CONTEXT_SCOPE_MISMATCH', `${session.role} could not select the canonical TEST context`)
  return selected
}

async function restRows(session, table, filters = '', select = '*') { return rest(session, table, `?select=${encodeURIComponent(select)}${filters}`) }
function firstBy(rows, predicate) { return rows.find((row) => predicate(object(row))) ?? null }

async function discoverPeople(hr, canonical) {
  const [employees, employments, organizations, departments, management, jobs, categories] = await Promise.all([
    restRows(hr, 'employees', `&tenant_id=eq.${canonical.tenantId}&hr_group_id=eq.${canonical.hrGroupId}&is_archived=eq.false&is_active=eq.true`),
    restRows(hr, 'employments', `&tenant_id=eq.${canonical.tenantId}&hr_group_id=eq.${canonical.hrGroupId}&deleted_at=is.null`),
    restRows(hr, 'employee_organizations', `&tenant_id=eq.${canonical.tenantId}&hr_group_id=eq.${canonical.hrGroupId}`),
    restRows(hr, 'departments', `&tenant_id=eq.${canonical.tenantId}&hr_group_id=eq.${canonical.hrGroupId}&is_active=eq.true`),
    restRows(hr, 'department_management', `&tenant_id=eq.${canonical.tenantId}&hr_group_id=eq.${canonical.hrGroupId}`),
    restRows(hr, 'jobs', `&tenant_id=eq.${canonical.tenantId}&hr_group_id=eq.${canonical.hrGroupId}&is_active=eq.true`),
    restRows(hr, 'document_categories', `&administration_id=eq.${canonical.administrationId}&is_active=eq.true`),
  ])
  const employee = firstBy(employees, (row) => row.id === canonical.employeeId)
  const manager = firstBy(employees, (row) => row.id === canonical.managerEmployeeId)
  assert(employee && manager, 'FIXTURE_PERSONAS_NOT_FOUND', 'Existing Employee and Manager fixture personas are not in the canonical scope')
  const asOf = todayPlus(0)
  const activeOrganizations = organizations.filter((row) => textOf(row.effective_from) <= asOf && (!row.effective_to || textOf(row.effective_to) >= asOf))
  const currentEmployment = (employeeId) => firstBy(employments, (row) => row.employee_id === employeeId && row.administration_id === canonical.administrationId && row.record_status === 'CONFIRMED' && textOf(row.starts_on) <= asOf && (!row.ends_on || row.ends_on >= asOf) && strictUuid(row.id))
  const directReports = activeOrganizations.filter((row) => row.administration_id === canonical.administrationId && row.direct_manager_id === manager.id && row.employee_id !== manager.id)
  const hasSinglePlacement = (employeeId) => activeOrganizations.filter((row) => row.administration_id === canonical.administrationId && row.employee_id === employeeId).length === 1
  const subject = directReports.filter((row) => row.employee_id !== employee.id).find((row) => currentEmployment(row.employee_id) && hasSinglePlacement(row.employee_id)) ?? directReports.find((row) => currentEmployment(row.employee_id) && hasSinglePlacement(row.employee_id))
  assert(subject, 'FIXTURE_MANAGER_SCOPE_EMPTY', 'Manager has no direct report with a route-compatible active employment')
  const subjectEmployment = currentEmployment(subject.employee_id)
  const managerEmployment = currentEmployment(manager.id)
  const employeeEmployment = currentEmployment(employee.id)
  assert(subjectEmployment && employeeEmployment, 'FIXTURE_EMPLOYMENTS_NOT_FOUND', 'Required persona employments are not available in the canonical administration')
  const subjectOrganization = firstBy(activeOrganizations, (row) => row.employee_id === subject.employee_id && row.administration_id === canonical.administrationId)
  assert(subjectOrganization, 'FIXTURE_ORGANIZATION_NOT_FOUND', 'The selected Manager direct report has no active organization placement')
  const sourceDepartment = firstBy(departments, (row) => row.id === subjectOrganization.department_id)
  const targetDepartment = firstBy(departments, (row) => row.code === 'P9-TRANSFER') ?? firstBy(departments, (row) => management.some((entry) => entry.department_id === row.id && entry.employee_id === manager.id))
  assert(sourceDepartment && targetDepartment, 'FIXTURE_TARGET_DEPARTMENT_NOT_FOUND', 'No Manager-scoped target department is available')
  const targetJob = firstBy(jobs, (row) => row.code === 'TEST-MANAGER') ?? jobs[0]
  assert(targetJob, 'FIXTURE_TARGET_JOB_NOT_FOUND', 'No active target job is available')
  const documentCategory = firstBy(categories, (row) => row.code === 'process-document-acknowledgement')
  assert(documentCategory, 'FIXTURE_DOCUMENT_CATEGORY_NOT_FOUND', 'The certified document acknowledgement category is not available')
  const blockedOrganization = activeOrganizations.find((row) => row.administration_id === canonical.administrationId && row.direct_manager_id === null && currentEmployment(row.employee_id) && hasSinglePlacement(row.employee_id))
  const blockedEmployee = blockedOrganization ? firstBy(employees, (row) => row.id === blockedOrganization.employee_id) : null
  const blockedEmployment = blockedOrganization ? currentEmployment(blockedOrganization.employee_id) : null
  assert(blockedEmployee && blockedEmployment, 'FIXTURE_BLOCKED_SUBJECT_NOT_FOUND', 'No route-compatible employee without a direct manager is available for a legitimate BLOCKED assignment')
  const nameOf = (row) => `${row.first_name ?? ''} ${row.birth_name ?? ''}`.trim()
  return {
    employee: { id: employee.id, number: employee.employee_number, name: nameOf(employee), employmentId: employeeEmployment.id },
    manager: { id: manager.id, number: manager.employee_number, name: nameOf(manager), employmentId: managerEmployment?.id ?? null },
    subject: { id: subject.employee_id, number: firstBy(employees, (row) => row.id === subject.employee_id)?.employee_number ?? subject.employee_id, employmentId: subjectEmployment.id },
    blockedSubject: { id: blockedEmployee.id, number: blockedEmployee.employee_number, employmentId: blockedEmployment.id },
    sourceDepartment: { id: sourceDepartment.id, code: sourceDepartment.code, name: sourceDepartment.name },
    targetDepartment: { id: targetDepartment.id, code: targetDepartment.code, name: targetDepartment.name },
    targetJob: { id: targetJob.id, code: targetJob.code },
    documentCategory: { id: documentCategory.id, code: documentCategory.code },
  }
}

async function getRecipes(hr) {
  const recipes = requireOk(await api(hr, '/api/process-automation/recipes'), 'certified recipe catalog')
  assert(Array.isArray(recipes), 'FIXTURE_RECIPES_INVALID', 'Certified recipe catalog is not an array')
  const internal = recipes.filter((recipe) => recipe.adapterKey === 'INTERNAL_TRANSFER_ORGANIZATION').sort((a, b) => b.recipeVersion - a.recipeVersion)[0]
  const acknowledgement = recipes.find((recipe) => recipe.adapterKey === 'DOCUMENT_ACKNOWLEDGEMENT')
  assert(internal && acknowledgement, 'CERTIFIED_RECIPE_MISSING', 'Certified P9/P10 recipes are not both available')
  return { internal, acknowledgement }
}

async function studioCatalog(hr) {
  const catalog = requireOk(await api(hr, '/api/process-automation/studio'), 'process definition catalog')
  assert(Array.isArray(catalog), 'FIXTURE_STUDIO_INVALID', 'Process definition catalog is not an array')
  return catalog
}

async function studioDetail(hr, id) { return requireOk(await api(hr, `/api/process-automation/studio/${id}`), 'process definition detail') }

async function restoreCertifiedSources(hr, catalog) {
  const repairs = [
    {
      key: 'document-acknowledgement-v1',
      title: { nl: 'Document lezen en bevestigen', en: 'Read and acknowledge document' },
      description: { nl: 'Laat een medewerker een toegewezen document lezen en expliciet bevestigen.', en: 'Ask an employee to read an assigned document and explicitly acknowledge it.' },
    },
    {
      key: 'internal-transfer-v2',
      title: { nl: 'Interne overplaatsing', en: 'Internal transfer' },
      description: { nl: 'Een gecontroleerde wijziging van afdeling of functie.', en: 'A controlled change of department or job.' },
    },
  ]
  const result = []
  for (const repair of repairs) {
    const entry = catalog.find((definition) => definition.key === repair.key)
    if (!entry || entry.status !== 'PUBLISHED') continue
    const detail = await studioDetail(hr, entry.id)
    const draft = copyJson(detail.draft)
    const titleChanged = JSON.stringify(draft.title) !== JSON.stringify(repair.title)
    const descriptionChanged = JSON.stringify(draft.description) !== JSON.stringify(repair.description)
    const requestStep = draft.steps?.find((step) => step.key === 'request')
    const slaChanged = repair.key === 'internal-transfer-v2' && requestStep?.sla?.duration?.amount === 1
    if (!titleChanged && !descriptionChanged && !slaChanged) continue
    draft.key = repair.key
    draft.title = repair.title
    draft.description = repair.description
    if (slaChanged && requestStep) requestStep.sla = { duration: { amount: 2, unit: 'DAYS' }, businessDays: true, onBreach: 'ESCALATE', escalationParticipantKey: 'hr-queue' }
    const saved = requireOk(await apiJson(hr, `/api/process-automation/studio/${entry.id}/draft`, 'POST', { expectedRevision: detail.draftRevision, definition: draft }), 'certified definition repair')
    await requireOk(await apiJson(hr, `/api/process-automation/studio/${entry.id}/publish`, 'POST', { expectedRevision: saved.revision, changelog: `${R5_PREFIX}: herstel van gecertificeerde bron na fixture-preflight` }), 'certified definition repair publish')
    result.push(repair.key)
  }
  return result
}

function definitionTitle(key) {
  const titles = {
    [R5_DEFINITION_KEYS.internalTransfer]: 'Interne overplaatsing',
    [R5_DEFINITION_KEYS.documentAcknowledgement]: 'Document bevestiging',
    [R5_DEFINITION_KEYS.overdue]: 'Overdue interne overplaatsing',
    [R5_DEFINITION_KEYS.draft]: 'Concept R5-proces',
    [R5_DEFINITION_KEYS.retired]: 'Gepensioneerd R5-proces',
  }
  return titles[key] ?? key
}

function prefixedLocalizedText(key, suffix) {
  const title = `${R5_PREFIX} — ${definitionTitle(key)}${suffix}`
  return { nl: title, en: title }
}

function copyJson(value) { return JSON.parse(JSON.stringify(value)) }

function patchOverdueDraft(definition) {
  const draft = copyJson(definition)
  const request = draft.steps?.find((step) => step.key === 'request')
  if (request) request.sla = { duration: { amount: 1, unit: 'MINUTES' }, businessDays: false, onBreach: 'NOTIFY' }
  return draft
}

async function ensurePublishedFromRecipe(hr, recipe, key) {
  const catalog = await studioCatalog(hr)
  let entry = catalog.find((definition) => definition.key === key)
  if (!entry) {
    const sourceKey = recipe.adapterKey === 'DOCUMENT_ACKNOWLEDGEMENT' ? 'document-acknowledgement-v1' : 'internal-transfer-v2'
    const source = catalog.find((definition) => definition.key === sourceKey)
    assert(source, 'CERTIFIED_SOURCE_NOT_FOUND', `Certified source ${sourceKey} is not available`)
    const cloned = requireOk(await apiJson(hr, `/api/process-automation/studio/${source.id}/clone`, 'POST', { key, title: prefixedLocalizedText(key, ''), description: prefixedLocalizedText(key, ' — gedeelde R5 TEST-dataset') }), 'certified process definition clone', [201])
    entry = { id: cloned.id, key, status: 'DRAFT' }
  }
  assert(entry.status !== 'RETIRED', 'PROCESS_DEFINITION_RETIRED', `${key} is retired and cannot be rerun safely`)
  let detail = await studioDetail(hr, entry.id)
  if (detail.definition.status === 'DRAFT') {
    const targetDefinition = key === R5_DEFINITION_KEYS.overdue ? patchOverdueDraft(detail.draft) : copyJson(detail.draft)
    targetDefinition.key = key
    targetDefinition.title = prefixedLocalizedText(key, '')
    targetDefinition.description = prefixedLocalizedText(key, ' — gedeelde R5 TEST-dataset')
    const saved = await requireOk(await apiJson(hr, `/api/process-automation/studio/${entry.id}/draft`, 'POST', { expectedRevision: detail.draftRevision, definition: targetDefinition }), 'process definition draft save')
    await requireOk(await apiJson(hr, `/api/process-automation/studio/${entry.id}/publish`, 'POST', { expectedRevision: saved.revision, changelog: `${R5_PREFIX}: clone van gecertificeerde recipe fixture` }), 'process definition publish')
    detail = await studioDetail(hr, entry.id)
  }
  if (key === R5_DEFINITION_KEYS.overdue && detail.definition.status === 'PUBLISHED') {
    const requestStep = detail.draft?.steps?.find((step) => step.key === 'request')
    const hasOneMinuteSla = requestStep?.sla?.duration?.amount === 1 && requestStep?.sla?.duration?.unit === 'MINUTES' && requestStep?.sla?.businessDays === false
    if (!hasOneMinuteSla) {
      const targetDefinition = patchOverdueDraft(detail.draft)
      targetDefinition.key = key
      targetDefinition.title = prefixedLocalizedText(key, '')
      targetDefinition.description = prefixedLocalizedText(key, ' — gedeelde R5 TEST-dataset')
      const saved = await requireOk(await apiJson(hr, `/api/process-automation/studio/${entry.id}/draft`, 'POST', { expectedRevision: detail.draftRevision, definition: targetDefinition }), 'overdue process definition draft save')
      await requireOk(await apiJson(hr, `/api/process-automation/studio/${entry.id}/publish`, 'POST', { expectedRevision: saved.revision, changelog: `${R5_PREFIX}: overdue SLA fixture` }), 'overdue process definition publish')
      detail = await studioDetail(hr, entry.id)
    }
  }
  assert(detail.definition.status === 'PUBLISHED', 'FIXTURE_DEFINITION_NOT_PUBLISHED', `${key} did not reach PUBLISHED status`)
  return { id: entry.id, key, status: detail.definition.status, recipeId: recipe.id, title: detail.definition.title }
}

async function ensureClonedStatus(hr, source, key, desiredStatus) {
  const catalog = await studioCatalog(hr)
  let entry = catalog.find((definition) => definition.key === key)
  if (!entry) {
    const cloned = requireOk(await apiJson(hr, `/api/process-automation/studio/${source.id}/clone`, 'POST', { key, title: prefixedLocalizedText(key, ''), description: prefixedLocalizedText(key, ' — gedeelde R5 TEST-dataset') }), 'certified process definition clone', [201])
    entry = { id: cloned.id, key, status: 'DRAFT' }
  }
  let detail = await studioDetail(hr, entry.id)
  if (desiredStatus === 'DRAFT') {
    assert(detail.definition.status === 'DRAFT', 'FIXTURE_DRAFT_STATUS_MISMATCH', `${key} is not DRAFT and cannot be safely reset`)
  } else {
    if (detail.definition.status === 'DRAFT') {
      assert(typeof detail.draftRevision === 'number' && detail.draftRevision > 0, 'FIXTURE_DRAFT_REVISION_MISSING', `${key} has no publishable draft revision`)
      await requireOk(await apiJson(hr, `/api/process-automation/studio/${entry.id}/publish`, 'POST', { expectedRevision: detail.draftRevision, changelog: `${R5_PREFIX}: retired certified recipe fixture` }), 'retired process definition publish')
      detail = await studioDetail(hr, entry.id)
    }
    if (detail.definition.status === 'PUBLISHED') {
      await requireOk(await apiJson(hr, `/api/process-automation/studio/${entry.id}/retire`, 'POST', { reason: `${R5_PREFIX}: shared TEST fixture retired` }), 'process definition retire')
      detail = await studioDetail(hr, entry.id)
    }
    assert(detail.definition.status === 'RETIRED', 'FIXTURE_RETIRED_STATUS_MISMATCH', `${key} is not RETIRED`)
  }
  return { id: entry.id, key, status: detail.definition.status, title: detail.definition.title }
}

async function ensureDefinitions(hr, recipes) {
  const catalog = await studioCatalog(hr)
  await restoreCertifiedSources(hr, catalog)
  const internalTransfer = await ensurePublishedFromRecipe(hr, recipes.internal, R5_DEFINITION_KEYS.internalTransfer)
  const documentAcknowledgement = await ensurePublishedFromRecipe(hr, recipes.acknowledgement, R5_DEFINITION_KEYS.documentAcknowledgement)
  const overdue = await ensurePublishedFromRecipe(hr, recipes.internal, R5_DEFINITION_KEYS.overdue)
  const draft = await ensureClonedStatus(hr, internalTransfer, R5_DEFINITION_KEYS.draft, 'DRAFT')
  const retired = await ensureClonedStatus(hr, internalTransfer, R5_DEFINITION_KEYS.retired, 'RETIRED')
  const certifiedCatalog = await studioCatalog(hr)
  const documentAcknowledgementRuntime = certifiedCatalog.find((definition) => definition.key === 'document-acknowledgement-v1')
  assert(documentAcknowledgementRuntime?.status === 'PUBLISHED', 'CERTIFIED_ACKNOWLEDGEMENT_NOT_PUBLISHED', 'The certified P10 document acknowledgement definition is not published')
  return { internalTransfer, documentAcknowledgement, documentAcknowledgementRuntime, overdue, draft, retired }
}

function pdfFile(name) {
  const body = '%PDF-1.4\n% R5-TEST fixture\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n'
  return new File([body], name, { type: 'application/pdf' })
}

async function existingR5Documents(hr, personId) {
  const documents = requireOk(await api(hr, `/api/employees/${personId}/documents`), `employee documents ${personId}`)
  return (Array.isArray(documents) ? documents : []).filter((document) => hasR5Prefix(document.title))
}

async function existingAcknowledgementDocuments(hr, employee, canonical) {
  const residual = await residualReadback(hr, canonical)
  const result = {}
  for (const instance of residual.instances) {
    const key = textOf(instance.idempotency_key)
    if (key !== `${R5_PREFIX.toLowerCase()}:document-open` && key !== `${R5_PREFIX.toLowerCase()}:document-completed`) continue
    const workItems = residual.workItems.filter((workItem) => workItem.process_instance_id === instance.id && workItem.step_key === 'acknowledge')
    for (const workItem of workItems) {
      try {
        const document = object(await rpc(employee, 'get_document_acknowledgement_document', { requested_work_item_id: workItem.id }))
        if (document.employeeId === canonical.employeeId && hasR5Prefix(document.title)) result[key.endsWith(':document-open') ? 'open' : 'completed'] = { id: document.documentId, title: document.title, employeeId: document.employeeId, existing: true }
      } catch {
        // The existing RPC may deny a stale or already-closed work item; try the next item.
      }
    }
  }
  return result
}

async function ensureDocument(hr, people, key, title, targetEmployee = people.employee) {
  const existing = await existingR5Documents(hr, targetEmployee.id)
  const found = existing.find((document) => document.title === title && document.deleted_at === null)
  if (found) return { id: found.id, title: found.title, employeeId: found.employee_id, existing: true }
  const metadata = { title, description: `${R5_PREFIX}: document voor gedeelde process acknowledgement fixture`, tags: ['r5-test', 'process-automation'], categoryId: people.documentCategory.id, customFields: {}, audiences: [{ type: 'EMPLOYEE', targetId: targetEmployee.id }], reminder: null }
  const form = new FormData()
  form.set('file', pdfFile(`${key}.pdf`))
  form.set('metadata', JSON.stringify(metadata))
  const data = requireOk(await api(hr, `/api/employees/${targetEmployee.id}/documents`, { method: 'POST', body: form }), 'R5 document upload', [201])
  return { id: data.id, title, employeeId: targetEmployee.id, existing: false }
}

function workItemFromProjection(projection, predicate = () => true) {
  const items = Array.isArray(projection?.workItems) ? projection.workItems : []
  return items.find((item) => predicate(object(item))) ?? null
}

async function startInternalTransfer(session, definitionId, people, key, correlationId, subject = people.subject) {
  const payload = { processDefinitionId: definitionId, subjectEmployeeId: subject.id, employmentId: subject.employmentId, businessEffectiveDate: todayPlus(1), idempotencyKey: `${R5_PREFIX.toLowerCase()}:${key}`, correlationId }
  const response = await apiJson(session, '/api/processes/start', 'POST', payload)
  if (response.status !== 200) throw new FixtureError('FIXTURE_API_FAILED', `start ${key} failed with HTTP ${response.status}${codeOf(response.body) ? ` (${codeOf(response.body)})` : ''}`, { status: response.status, code: codeOf(response.body), payload: { processDefinitionId: definitionId, subjectEmployeeId: subject.id, employmentId: subject.employmentId, businessEffectiveDate: payload.businessEffectiveDate, idempotencyKey: payload.idempotencyKey, correlationId } })
  const started = dataOf(response.body)
  const projection = await processInstance(session, started.processInstanceId)
  const current = workItemFromProjection(projection, (item) => item.status === 'OPEN' || item.status === 'CLAIMED' || item.status === 'BLOCKED') ?? workItemFromProjection(projection)
  assert(current, 'FIXTURE_START_WORK_ITEM_MISSING', `${key} did not expose a current work item`)
  return { ...started, workItemId: current.id }
}

async function submitInternalTransfer(manager, started, people, key) {
  const form = requireOk(await api(manager, `/api/process-work-items/${started.workItemId}/form?language=nl`), `form projection ${key}`)
  requireOk(await apiJson(manager, `/api/process-work-items/${started.workItemId}/form-response`, 'POST', {
    expectedRevision: form.revision,
    expectedVersion: form.expectedVersion,
    values: { current: {}, new: { 'target-department': people.targetDepartment.id, 'target-job': people.targetJob.id, 'effective-on': todayPlus(1), reason: `${R5_PREFIX}: ${key}` } },
    idempotencyKey: `${R5_PREFIX.toLowerCase()}:${key}:form`, correlationId: started.processInstanceId, language: 'nl',
  }), `save form ${key}`)
  const itemDetail = requireOk(await api(manager, `/api/process-work-items/${started.workItemId}`), `detail before submit ${key}`)
  const submitted = requireOk(await apiJson(manager, `/api/process-work-items/${started.workItemId}/action`, 'POST', { action: 'SUBMIT', expectedVersion: itemDetail.expectedVersion, stepExpectedVersion: itemDetail.stepExpectedVersion, idempotencyKey: `${R5_PREFIX.toLowerCase()}:${key}:submit`, correlationId: started.processInstanceId }), `submit ${key}`)
  const nextProjection = await processInstance(manager, submitted.processInstanceId)
  const current = workItemFromProjection(nextProjection, (item) => item.status === 'OPEN' || item.status === 'CLAIMED' || item.status === 'BLOCKED')
  assert(current, 'FIXTURE_SUBMIT_WORK_ITEM_MISSING', `${key} did not expose a next work item`)
  return { processInstanceId: submitted.processInstanceId, workItemId: current.id }
}

async function processInstance(session, id) { return requireOk(await api(session, `/api/process-instances/${id}`), `process instance ${id}`) }
async function detail(session, workItemId, label) { return requireOk(await api(session, `/api/process-work-items/${workItemId}`), label) }
function failureEvidence(error) {
  if (error instanceof FixtureError) return { code: error.code, message: error.message, details: error.details }
  return { code: 'FIXTURE_UNEXPECTED_FAILURE', message: error instanceof Error ? error.message : 'unknown error' }
}

async function approveUntil(manager, processInstanceId, stopAtStep, label) {
  let projection = await processInstance(manager, processInstanceId)
  let current = workItemFromProjection(projection, (item) => item.status === 'OPEN' || item.status === 'CLAIMED')
  let guard = 0
  while (current && projection.currentStepKey !== stopAtStep && guard < 6) {
    let itemDetail = await detail(manager, current.id, `${label} detail`)
    assert(itemDetail.canAct || itemDetail.canClaim, 'FIXTURE_APPROVAL_NOT_AVAILABLE', `${label} cannot act on ${itemDetail.stepKey}`)
    if (itemDetail.status === 'OPEN' && itemDetail.canClaim && manager.role === 'manager') {
      requireOk(await apiJson(manager, `/api/process-work-items/${current.id}/claim`, 'POST', { expectedVersion: itemDetail.expectedVersion }), `${label} claim`)
      itemDetail = await detail(manager, current.id, `${label} claimed detail`)
    }
    assert(itemDetail.canAct, 'FIXTURE_APPROVAL_FORBIDDEN', `${label} cannot act after claim`)
    const result = requireOk(await apiJson(manager, `/api/process-work-items/${current.id}/action`, 'POST', { action: 'APPROVE', expectedVersion: itemDetail.expectedVersion, stepExpectedVersion: itemDetail.stepExpectedVersion, idempotencyKey: `${R5_PREFIX.toLowerCase()}:${label}:approve:${guard}`, correlationId: processInstanceId }), `${label} approve`)
    projection = await processInstance(manager, result.processInstanceId)
    current = workItemFromProjection(projection, (item) => item.status === 'OPEN' || item.status === 'CLAIMED')
    guard += 1
  }
  return { projection, current }
}

async function ensureWorkItems(manager, hr, employee, definitions, people) {
  const claimedStart = await startInternalTransfer(employee, definitions.internalTransfer.id, people, 'claimed-work-item', correlationIds.claimed)
  let claimed = { processInstanceId: claimedStart.processInstanceId, workItemId: claimedStart.workItemId }
  try { claimed = await submitInternalTransfer(employee, claimedStart, people, 'claimed-work-item') } catch (error) { if (!(error instanceof FixtureError)) throw error }
  let claimedDetail = await detail(manager, claimed.workItemId, 'claimed work item')
  if (claimedDetail.status === 'OPEN' && claimedDetail.canClaim) {
    requireOk(await apiJson(manager, `/api/process-work-items/${claimed.workItemId}/claim`, 'POST', { expectedVersion: claimedDetail.expectedVersion }), 'claim work item')
    claimedDetail = await detail(manager, claimed.workItemId, 'claimed work item readback')
  }
  assert(claimedDetail.status === 'CLAIMED', 'FIXTURE_CLAIM_FAILED', 'Claimed work item did not remain CLAIMED', {
    workItemId: claimed.workItemId,
    status: claimedDetail.status,
    canAct: claimedDetail.canAct,
    canClaim: claimedDetail.canClaim,
    claimedByUserId: claimedDetail.claimedByUserId,
    assignmentMode: claimedDetail.assignmentMode,
    assigneeEmployeeId: claimedDetail.assigneeEmployeeId,
    candidateCount: Array.isArray(claimedDetail.candidates) ? claimedDetail.candidates.length : undefined,
  })

  const openStart = await startInternalTransfer(employee, definitions.internalTransfer.id, people, 'open-hr-queue-hr', correlationIds.openHrQueueHr)
  let open = { processInstanceId: openStart.processInstanceId, workItemId: openStart.workItemId }
  let openHrQueue = null
  try {
    try { open = await submitInternalTransfer(employee, openStart, people, 'open-hr-queue-hr') } catch (error) { if (!(error instanceof FixtureError)) throw error }
    const openProgress = await approveUntil(manager, open.processInstanceId, 'hr-validation', 'open HR queue')
    const openDetail = await detail(hr, openProgress.current?.id ?? open.workItemId, 'open HR queue readback')
    assert(openDetail.status === 'OPEN' && openDetail.claimedByUserId === null, 'FIXTURE_HR_QUEUE_NOT_OPEN', 'HR queue item is not OPEN and unclaimed')
    openHrQueue = { reachable: true, processInstanceId: open.processInstanceId, workItemId: openProgress.current?.id ?? open.workItemId, detail: openDetail }
  } catch (error) {
    const openProjection = await processInstance(manager, open.processInstanceId)
    const current = workItemFromProjection(openProjection, (item) => item.status === 'OPEN' || item.status === 'CLAIMED' || item.status === 'BLOCKED')
    openHrQueue = { reachable: false, processInstanceId: open.processInstanceId, attemptedWorkItemId: current?.id ?? open.workItemId, attemptedStepKey: openProjection.currentStepKey, blocker: failureEvidence(error) }
  }

  const rejectedStart = await startInternalTransfer(employee, definitions.internalTransfer.id, people, 'rejected-approval', correlationIds.rejected)
  let rejected = { processInstanceId: rejectedStart.processInstanceId, workItemId: rejectedStart.workItemId }
  try { rejected = await submitInternalTransfer(employee, rejectedStart, people, 'rejected-approval') } catch (error) { if (!(error instanceof FixtureError)) throw error }
  let rejectedResult = await processInstance(manager, rejected.processInstanceId)
  if (rejectedResult.status !== 'REJECTED') {
    const itemDetail = await detail(manager, rejected.workItemId, 'rejected approval action detail')
    const result = requireOk(await apiJson(manager, `/api/process-work-items/${rejected.workItemId}/action`, 'POST', { action: 'REJECT', expectedVersion: itemDetail.expectedVersion, stepExpectedVersion: itemDetail.stepExpectedVersion, idempotencyKey: `${R5_PREFIX.toLowerCase()}:rejected-approval:reject`, correlationId: rejected.processInstanceId }), 'reject approval')
    rejectedResult = await processInstance(manager, result.processInstanceId)
  }
  assert(rejectedResult.status === 'REJECTED', 'FIXTURE_REJECT_FAILED', 'Rejected approval flow did not reach REJECTED')

  const changesStart = await startInternalTransfer(employee, definitions.internalTransfer.id, people, 'request-changes', correlationIds.requestChanges)
  let changes = { processInstanceId: changesStart.processInstanceId, workItemId: changesStart.workItemId }
  try { changes = await submitInternalTransfer(employee, changesStart, people, 'request-changes') } catch (error) { if (!(error instanceof FixtureError)) throw error }
  const changesInstanceBefore = await processInstance(manager, changes.processInstanceId)
  if (changesInstanceBefore.currentStepKey === 'source-approval') {
    let itemDetail = await detail(manager, changes.workItemId, 'request changes detail')
    if (itemDetail.status === 'OPEN' && itemDetail.canClaim) {
      requireOk(await apiJson(manager, `/api/process-work-items/${changes.workItemId}/claim`, 'POST', { expectedVersion: itemDetail.expectedVersion }), 'request changes claim')
      itemDetail = await detail(manager, changes.workItemId, 'request changes claimed detail')
    }
    if (itemDetail.status !== 'COMPLETED') requireOk(await apiJson(manager, `/api/process-work-items/${changes.workItemId}/request-changes`, 'POST', { expectedVersion: itemDetail.expectedVersion, stepExpectedVersion: itemDetail.stepExpectedVersion, idempotencyKey: `${R5_PREFIX.toLowerCase()}:request-changes:action`, correlationId: changes.processInstanceId, reason: `${R5_PREFIX}: aanvulling nodig` }), 'request changes')
  }
  const changesReadback = await processInstance(manager, changes.processInstanceId)
  assert(changesReadback.currentStepKey === 'request' || changesReadback.status === 'ACTIVE', 'FIXTURE_REQUEST_CHANGES_FAILED', 'Request changes flow did not return to the request step')

  const blockedPayload = { processDefinitionId: definitions.internalTransfer.id, subjectEmployeeId: people.blockedSubject.id, employmentId: people.blockedSubject.employmentId, businessEffectiveDate: todayPlus(1), idempotencyKey: `${R5_PREFIX.toLowerCase()}:blocked-assignment`, correlationId: correlationIds.blocked }
  const blockedResponse = await apiJson(employee, '/api/processes/start', 'POST', blockedPayload)
  let blocked = { status: blockedResponse.status, code: codeOf(blockedResponse.body), reachable: false }
  if (blockedResponse.status === 200) {
    const blockedStarted = dataOf(blockedResponse.body)
    const blockedInstance = await processInstance(employee, blockedStarted.processInstanceId)
    const blockedWork = workItemFromProjection(blockedInstance, (item) => item.status === 'BLOCKED')
    const currentBlockedAttempt = workItemFromProjection(blockedInstance, (item) => item.status === 'OPEN' || item.status === 'CLAIMED')
    if (!blockedWork && currentBlockedAttempt && blockedInstance.status === 'RUNNING') {
      const currentDetail = await detail(employee, currentBlockedAttempt.id, 'blocked assignment cleanup detail')
      if (currentDetail.allowedActions.includes('CANCEL')) {
        await requireOk(await apiJson(employee, `/api/process-work-items/${currentBlockedAttempt.id}/action`, 'POST', { action: 'CANCEL', expectedVersion: currentDetail.expectedVersion, stepExpectedVersion: currentDetail.stepExpectedVersion, idempotencyKey: `${R5_PREFIX.toLowerCase()}:blocked-assignment:cancel`, correlationId: blockedStarted.processInstanceId }), 'blocked assignment cleanup')
      }
    }
    blocked = { ...blocked, reachable: Boolean(blockedWork), processInstanceId: blockedStarted.processInstanceId, workItemId: blockedWork?.id ?? null, detail: blockedWork ? await detail(hr, blockedWork.id, 'blocked assignment readback') : null, blocker: blockedWork ? null : { code: blockedResponse.status === 200 ? 'BLOCKED_STATUS_NOT_MATERIALIZED' : blocked.code, message: 'The existing runtime did not materialize a BLOCKED work item for this unresolved assignment.' } }
  }

  const overdueStart = await startInternalTransfer(employee, definitions.overdue.id, people, 'overdue-deadline-v2', correlationIds.overdueFixed)
  const overdue = { processInstanceId: overdueStart.processInstanceId, workItemId: overdueStart.workItemId }
  let overdueDetail = await detail(employee, overdue.workItemId, 'overdue detail')
  const deadlineAt = overdueDetail.deadlineAt ? new Date(overdueDetail.deadlineAt).getTime() : Number.NaN
  let attempts = 0
  while (!overdueDetail.isOverdue && Number.isFinite(deadlineAt) && attempts < 10) {
    await sleep(10000)
    overdueDetail = await detail(employee, overdue.workItemId, 'overdue polling')
    attempts += 1
  }
  const overdueReachable = overdueDetail.isOverdue === true
  const overdueBlocker = overdueReachable ? null : { code: Number.isFinite(deadlineAt) ? 'DEADLINE_NOT_REACHED' : 'DEADLINE_NOT_MATERIALIZED', message: Number.isFinite(deadlineAt) ? 'The real SLA deadline did not become overdue within the fixture wait window.' : 'The existing runtime did not materialize a work-item deadline from the published SLA.' }
  const upcomingDeadline = { reachable: typeof claimedDetail.deadlineAt === 'string' && new Date(claimedDetail.deadlineAt).getTime() > Date.now(), workItemId: claimed.workItemId, detail: claimedDetail, blocker: claimedDetail.deadlineAt ? null : { code: 'DEADLINE_NOT_MATERIALIZED', message: 'The existing runtime did not materialize a work-item deadline from the published SLA.' } }
  return {
    claimed: { processInstanceId: claimed.processInstanceId, workItemId: claimed.workItemId, detail: claimedDetail },
    upcomingDeadline,
    openHrQueue,
    rejected: { processInstanceId: rejected.processInstanceId, workItemId: rejected.workItemId, instance: rejectedResult },
    requestChanges: { processInstanceId: changes.processInstanceId, workItemId: changes.workItemId, instance: changesReadback },
    blocked,
    overdue: { reachable: overdueReachable, processInstanceId: overdue.processInstanceId, workItemId: overdue.workItemId, detail: overdueDetail, blocker: overdueBlocker },
  }
}

async function startAcknowledgement(hr, definitionId, document, employeeId, key, correlationId) {
  const started = requireOk(await apiJson(hr, '/api/processes/document-acknowledgement/start', 'POST', { processDefinitionId: definitionId, subjectEmployeeId: employeeId, documentId: document.id, idempotencyKey: `${R5_PREFIX.toLowerCase()}:${key}`, correlationId }), `start document acknowledgement ${key}`)
  if (started.workItemId) return started
  const projection = await processInstance(hr, started.processInstanceId)
  const current = workItemFromProjection(projection, (item) => item.status === 'OPEN' || item.status === 'CLAIMED') ?? workItemFromProjection(projection)
  assert(current, 'FIXTURE_ACKNOWLEDGEMENT_WORK_ITEM_MISSING', `${key} did not expose a current work item`)
  return { ...started, workItemId: current.id }
}

async function ensureAcknowledgements(hr, employee, definitions, documentOpen, documentCompleted) {
  const openStart = await startAcknowledgement(hr, definitions.documentAcknowledgementRuntime.id, documentOpen, employee.id, 'document-open', correlationIds.acknowledgementOpen)
  const completedStart = await startAcknowledgement(hr, definitions.documentAcknowledgementRuntime.id, documentCompleted, employee.id, 'document-completed', correlationIds.acknowledgementCompleted)
  let completedInstance = await processInstance(hr, completedStart.processInstanceId)
  if (completedInstance.status !== 'COMPLETED') {
    const form = requireOk(await api(employee.session, `/api/process-work-items/${completedStart.workItemId}/form?language=nl`), 'employee acknowledgement form')
    requireOk(await apiJson(employee.session, `/api/process-work-items/${completedStart.workItemId}/form-response`, 'POST', { expectedRevision: form.revision, expectedVersion: form.expectedVersion, values: { current: {}, new: { acknowledged: true } }, idempotencyKey: `${R5_PREFIX.toLowerCase()}:document-completed:form`, correlationId: completedStart.processInstanceId, language: 'nl' }), 'employee acknowledgement form save')
    const acknowledgedDetail = await detail(employee.session, completedStart.workItemId, 'employee acknowledgement confirmation detail')
    requireOk(await apiJson(employee.session, `/api/process-work-items/${completedStart.workItemId}/document-acknowledgement`, 'POST', { expectedVersion: acknowledgedDetail.expectedVersion, stepExpectedVersion: acknowledgedDetail.stepExpectedVersion, idempotencyKey: `${R5_PREFIX.toLowerCase()}:document-completed:acknowledge`, correlationId: completedStart.processInstanceId }), 'employee document acknowledgement')
    completedInstance = await processInstance(hr, completedStart.processInstanceId)
  }
  assert(completedInstance.status === 'COMPLETED', 'FIXTURE_ACKNOWLEDGEMENT_FAILED', 'Employee document acknowledgement did not complete')
  const openDetail = await detail(employee.session, openStart.workItemId, 'employee open acknowledgement')
  assert(openDetail.status === 'OPEN' || openDetail.status === 'CLAIMED', 'FIXTURE_ACKNOWLEDGEMENT_OPEN_FAILED', 'Open employee document acknowledgement is not active')
  return { open: { processInstanceId: openStart.processInstanceId, workItemId: openStart.workItemId, detail: openDetail }, completed: { processInstanceId: completedStart.processInstanceId, workItemId: completedStart.workItemId, instance: completedInstance } }
}

async function runJobs(hr) { return requireOk(await apiJson(hr, '/api/process-automation/jobs/run', 'POST', { limit: 20, language: 'nl' }), 'workflow job drain') }
async function outputReadback(hr, processInstanceId) {
  const outputs = object(await rpc(hr, 'get_process_output_projection', { requested_process_instance_id: processInstanceId, requested_language: 'nl' }))
  const operations = object(await rpc(hr, 'get_process_automation_operations', { requested_process_instance_id: processInstanceId }))
  const output = Array.isArray(outputs.outputs) ? object(outputs.outputs[0]) : null
  const job = Array.isArray(operations.jobs) ? object(operations.jobs[0]) : null
  return { output: output ? { id: output.id, outputKey: output.outputKey, status: output.status, documentId: output.documentId, lastErrorCode: output.lastErrorCode } : null, job: job ? { id: job.id, jobType: job.jobType, status: job.status, attempts: job.attempts, lastErrorCode: job.lastErrorCode } : null, outputs, operations }
}

async function roleReadback(sessions, datasetIds, ids, canonical) {
  const result = {}
  const projections = {}
  for (const [role, session] of Object.entries(sessions)) {
    const projection = await rpc(session, 'get_process_work_projection_with_administration', {
      requested_hr_group_id: canonical.hrGroupId,
      requested_administration_id: canonical.administrationId,
      requested_tab: 'TODO',
      requested_language: 'nl',
      requested_sort: 'NEEDS_ACTION',
      requested_limit: 100,
      requested_offset: 0,
    })
    projections[role] = projection
    const items = Array.isArray(object(projection).items) ? object(projection).items : []
    result[role] = { source: 'service-rpc:get_process_work_projection_with_administration', tab: 'TODO', workListStatus: 200, itemCount: items.length, visibleDatasetItemIds: items.filter((item) => datasetIds.has(object(item).workItemId)).map((item) => object(item).workItemId) }
  }
  const negative = []
  const hrQueueWorkItemId = ids.hrQueueWorkItemId
  if (typeof hrQueueWorkItemId === 'string') {
    for (const [role, label] of [['manager', 'manager reads HR queue item'], ['employee', 'employee reads HR queue item']]) {
      const response = await api(sessions[role], `/api/process-work-items/${hrQueueWorkItemId}`)
      negative.push({ role, label, status: response.status, code: codeOf(response.body) })
    }
  }
  if (typeof ids.claimedWorkItemId === 'string') {
    const response = await api(sessions.employee, `/api/process-work-items/${ids.claimedWorkItemId}`)
    negative.push({ role: 'employee', label: 'employee reads manager approval on own process (self-scope control)', status: response.status, code: codeOf(response.body), expected: 'HTTP 200 is permitted because the process subject is the Employee persona' })
  }
  const employeeItems = Array.isArray(object(projections.employee).items) ? object(projections.employee).items : []
  const nonSelfEmployeeItem = employeeItems.find((item) => object(item).subjectEmployeeId && object(item).subjectEmployeeId !== canonical.employeeId)
  if (nonSelfEmployeeItem?.workItemId) {
    const response = await api(sessions.employee, `/api/process-work-items/${nonSelfEmployeeItem.workItemId}`)
    negative.push({ role: 'employee', label: 'employee reads non-self control item', status: response.status, code: codeOf(response.body), controlWorkItemId: nonSelfEmployeeItem.workItemId })
  }
  result.negativeCrossScope = negative
  return result
}

async function residualReadback(hr, canonical) {
  const definitions = await restRows(hr, 'process_definitions', `&tenant_id=eq.${canonical.tenantId}&hr_group_id=eq.${canonical.hrGroupId}&key=like.r5-test-*`, 'id,key,status,title')
  const instances = await restRows(hr, 'process_instances', `&tenant_id=eq.${canonical.tenantId}&hr_group_id=eq.${canonical.hrGroupId}`, 'id,process_definition_id,status,current_step_key,idempotency_key,started_at,completed_at')
  const r5DefinitionIds = new Set(definitions.map((row) => row.id))
  const residualInstances = instances.filter((row) => r5DefinitionIds.has(row.process_definition_id) || textOf(row.idempotency_key).startsWith(R5_PREFIX.toLowerCase()))
  const instanceIds = residualInstances.map((row) => row.id).filter((id) => typeof id === 'string')
  const workItems = instanceIds.length > 0
    ? await restRows(hr, 'process_work_items', `&process_instance_id=in.(${instanceIds.join(',')})`, 'id,process_instance_id,step_key,participant_key,assignment_mode,status,assignee_employee_id,claimed_by_user_id,available_at,deadline_at,blocked_code')
    : []
  return { definitions, instances: residualInstances, workItems }
}

function scopeQuery(canonical, includeAdministration = false) {
  const query = `&tenant_id=eq.${canonical.tenantId}&hr_group_id=eq.${canonical.hrGroupId}`
  return includeAdministration ? `${query}&administration_id=eq.${canonical.administrationId}` : query
}

async function rowsByIds(table, query, column, ids, select) {
  if (ids.length === 0) return []
  return privilegedRows(table, `${query}${inFilter(column, ids)}`, select)
}

function idsOf(rows) { return rows.map((row) => textOf(row.id)).filter(Boolean) }
async function cleanupInventory(canonical) {
  validateCleanupEnvironment()
  const [allDefinitions, allInstances, allDocuments, allReminders] = await Promise.all([
    privilegedRows('process_definitions', scopeQuery(canonical), 'id,key,status'),
    privilegedRows('process_instances', scopeQuery(canonical), 'id,process_definition_id,idempotency_key,metadata'),
    privilegedRows('employee_documents', `&tenant_id=eq.${canonical.tenantId}&administration_id=eq.${canonical.administrationId}`, 'id,title,storage_key,employee_id,administration_id,tenant_id,deleted_at,expiry_reminder_id'),
    privilegedRows('reminders', `&tenant_id=eq.${canonical.tenantId}&administration_id=eq.${canonical.administrationId}`, 'id,title,description,tenant_id,administration_id'),
  ])
  const definitions = allDefinitions.filter((row) => textOf(row.key).startsWith('r5-test-'))
  const definitionIds = idsOf(definitions)
  const instances = allInstances.filter((row) => definitionIds.includes(textOf(row.process_definition_id)) || textOf(row.idempotency_key).startsWith(`${R5_PREFIX.toLowerCase()}:`))
  const instanceIds = idsOf(instances)

  const [drafts, versions, recipeActivations, employeeSubjects, employmentSubjects, steps, workItems, formResponses, events, domainCommits, outputs, jobs, reminderDeliveries] = await Promise.all([
    rowsByIds('process_definition_drafts', scopeQuery(canonical), 'process_definition_id', definitionIds, 'id,process_definition_id'),
    rowsByIds('process_versions', scopeQuery(canonical), 'process_definition_id', definitionIds, 'id,process_definition_id'),
    rowsByIds('process_recipe_activations', scopeQuery(canonical), 'process_definition_id', definitionIds, 'id,process_definition_id'),
    rowsByIds('process_employee_subjects', scopeQuery(canonical), 'process_instance_id', instanceIds, 'process_instance_id'),
    rowsByIds('process_employment_subjects', scopeQuery(canonical), 'process_instance_id', instanceIds, 'process_instance_id'),
    rowsByIds('process_step_instances', scopeQuery(canonical), 'process_instance_id', instanceIds, 'id,process_instance_id'),
    rowsByIds('process_work_items', scopeQuery(canonical), 'process_instance_id', instanceIds, 'id,process_instance_id'),
    rowsByIds('process_form_responses', scopeQuery(canonical), 'process_instance_id', instanceIds, 'id,process_instance_id,work_item_id,step_instance_id'),
    rowsByIds('process_events', scopeQuery(canonical), 'process_instance_id', instanceIds, 'id,process_instance_id,work_item_id'),
    rowsByIds('process_domain_commits', scopeQuery(canonical), 'process_instance_id', instanceIds, 'id,process_instance_id,work_item_id'),
    rowsByIds('process_outputs', scopeQuery(canonical), 'process_instance_id', instanceIds, 'id,process_instance_id,document_id'),
    rowsByIds('workflow_jobs', scopeQuery(canonical), 'process_instance_id', instanceIds, 'id,process_instance_id,work_item_id'),
    rowsByIds('process_reminder_deliveries', scopeQuery(canonical), 'process_instance_id', instanceIds, 'id,process_instance_id,workflow_job_id,reminder_id'),
  ])
  const stepIds = idsOf(steps)
  const workItemIds = idsOf(workItems)
  const responseIds = idsOf(formResponses)
  const outputDocumentIds = outputs.map((row) => textOf(row.document_id)).filter(Boolean)
  const [candidates, notes, responseRevisions, acknowledgements] = await Promise.all([
    rowsByIds('process_work_item_candidates', scopeQuery(canonical), 'work_item_id', workItemIds, 'id,work_item_id'),
    rowsByIds('process_work_item_notes', scopeQuery(canonical), 'work_item_id', workItemIds, 'id,process_instance_id,work_item_id'),
    rowsByIds('process_form_response_revisions', scopeQuery(canonical), 'response_id', responseIds, 'id,response_id'),
    privilegedRows('employee_document_acknowledgements', scopeQuery(canonical), 'id,process_instance_id,work_item_id,document_id'),
  ])
  const documents = allDocuments.filter((row) => hasR5Prefix(row.title) || outputDocumentIds.includes(textOf(row.id)))
  const documentIds = idsOf(documents)
  const documentReminderIds = documents.map((row) => textOf(row.expiry_reminder_id)).filter(Boolean)
  const reminders = allReminders.filter((row) => hasR5Prefix(row.title) || hasR5Prefix(row.description) || documentReminderIds.includes(textOf(row.id)))
  const reminderIds = idsOf(reminders)
  const [documentAudiences, reminderRecipients, reminderTargets, reminderTargetRules] = await Promise.all([
    rowsByIds('document_audiences', `&tenant_id=eq.${canonical.tenantId}&administration_id=eq.${canonical.administrationId}`, 'document_id', documentIds, 'id,document_id'),
    rowsByIds('reminder_recipients', `&tenant_id=eq.${canonical.tenantId}`, 'reminder_id', reminderIds, 'id,reminder_id'),
    rowsByIds('reminder_targets', `&tenant_id=eq.${canonical.tenantId}`, 'reminder_id', reminderIds, 'id,reminder_id'),
    rowsByIds('reminder_target_rules', `&tenant_id=eq.${canonical.tenantId}&administration_id=eq.${canonical.administrationId}`, 'reminder_id', reminderIds, 'id,reminder_id'),
  ])
  const rows = {
    definitions,
    drafts,
    versions,
    recipeActivations,
    instances,
    employeeSubjects,
    employmentSubjects,
    steps,
    workItems,
    candidates,
    notes,
    formResponses,
    responseRevisions,
    events,
    domainCommits,
    outputs,
    jobs,
    reminderDeliveries,
    acknowledgements: acknowledgements.filter((row) => instanceIds.includes(textOf(row.process_instance_id)) || documentIds.includes(textOf(row.document_id)) || workItemIds.includes(textOf(row.work_item_id))),
    documents,
    documentAudiences,
    reminders,
    reminderRecipients,
    reminderTargets,
    reminderTargetRules,
  }
  return {
    ...rows,
    ids: { definitionIds, instanceIds, stepIds, workItemIds, responseIds, documentIds, reminderIds },
    counts: Object.fromEntries(Object.entries(rows).map(([key, value]) => [key, value.length])),
  }
}

function sqlUuid(value) {
  assert(databaseUuid(value), 'FIXTURE_CLEANUP_ID_INVALID', 'Cleanup SQL received an invalid UUID')
  return `'${value}'`
}

function sqlUuidList(values) {
  return uuidList(values).map(sqlUuid).join(', ')
}

function sqlDeleteById(table, ids, scope) {
  if (ids.length === 0) return ''
  const scopeSql = Object.entries(scope).map(([column, value]) => `${column} = ${sqlUuid(value)}`).join(' and ')
  return `delete from public.${table} where ${scopeSql} and id in (${sqlUuidList(ids)});`
}

function sqlDeleteByInstance(table, rows, canonical, includeAdministration = false) {
  const instanceIds = rows.map((row) => textOf(row.process_instance_id)).filter(Boolean)
  if (instanceIds.length === 0) return ''
  const scope = { tenant_id: canonical.tenantId, hr_group_id: canonical.hrGroupId }
  if (includeAdministration) scope.administration_id = canonical.administrationId
  const scopeSql = Object.entries(scope).map(([column, value]) => `${column} = ${sqlUuid(value)}`).join(' and ')
  return `delete from public.${table} where ${scopeSql} and process_instance_id in (${sqlUuidList(instanceIds)});`
}

export function buildCleanupSql(rows, canonical) {
  const statements = [
    sqlDeleteById('employee_document_acknowledgements', idsOf(rows.acknowledgements), { tenant_id: canonical.tenantId, hr_group_id: canonical.hrGroupId }),
    sqlDeleteById('process_reminder_deliveries', idsOf(rows.reminderDeliveries), { tenant_id: canonical.tenantId, hr_group_id: canonical.hrGroupId }),
    sqlDeleteById('process_domain_commits', idsOf(rows.domainCommits), { tenant_id: canonical.tenantId, hr_group_id: canonical.hrGroupId }),
    sqlDeleteById('process_work_item_notes', idsOf(rows.notes), { tenant_id: canonical.tenantId, hr_group_id: canonical.hrGroupId }),
    sqlDeleteById('process_form_response_revisions', idsOf(rows.responseRevisions), { tenant_id: canonical.tenantId, hr_group_id: canonical.hrGroupId }),
    sqlDeleteById('process_form_responses', idsOf(rows.formResponses), { tenant_id: canonical.tenantId, hr_group_id: canonical.hrGroupId }),
    sqlDeleteById('process_events', idsOf(rows.events), { tenant_id: canonical.tenantId, hr_group_id: canonical.hrGroupId }),
    sqlDeleteById('process_work_item_candidates', idsOf(rows.candidates), { tenant_id: canonical.tenantId, hr_group_id: canonical.hrGroupId }),
    sqlDeleteById('process_outputs', idsOf(rows.outputs), { tenant_id: canonical.tenantId, hr_group_id: canonical.hrGroupId }),
    sqlDeleteById('workflow_jobs', idsOf(rows.jobs), { tenant_id: canonical.tenantId, hr_group_id: canonical.hrGroupId }),
    sqlDeleteById('process_work_items', idsOf(rows.workItems), { tenant_id: canonical.tenantId, hr_group_id: canonical.hrGroupId }),
    sqlDeleteById('process_step_instances', idsOf(rows.steps), { tenant_id: canonical.tenantId, hr_group_id: canonical.hrGroupId }),
    sqlDeleteByInstance('process_employee_subjects', rows.employeeSubjects, canonical),
    sqlDeleteByInstance('process_employment_subjects', rows.employmentSubjects, canonical, true),
    sqlDeleteById('process_instances', rows.ids.instanceIds, { tenant_id: canonical.tenantId, hr_group_id: canonical.hrGroupId }),
    sqlDeleteById('process_recipe_activations', idsOf(rows.recipeActivations), { tenant_id: canonical.tenantId, hr_group_id: canonical.hrGroupId }),
    sqlDeleteById('process_versions', idsOf(rows.versions), { tenant_id: canonical.tenantId, hr_group_id: canonical.hrGroupId }),
    sqlDeleteById('process_definition_drafts', idsOf(rows.drafts), { tenant_id: canonical.tenantId, hr_group_id: canonical.hrGroupId }),
    sqlDeleteById('process_definitions', rows.ids.definitionIds, { tenant_id: canonical.tenantId, hr_group_id: canonical.hrGroupId }),
    sqlDeleteById('document_audiences', idsOf(rows.documentAudiences), { tenant_id: canonical.tenantId, administration_id: canonical.administrationId }),
    sqlDeleteById('employee_documents', rows.ids.documentIds, { tenant_id: canonical.tenantId, administration_id: canonical.administrationId }),
    sqlDeleteById('reminder_recipients', idsOf(rows.reminderRecipients), { tenant_id: canonical.tenantId }),
    sqlDeleteById('reminder_targets', idsOf(rows.reminderTargets), { tenant_id: canonical.tenantId }),
    sqlDeleteById('reminder_target_rules', idsOf(rows.reminderTargetRules), { tenant_id: canonical.tenantId, administration_id: canonical.administrationId }),
    sqlDeleteById('reminders', rows.ids.reminderIds, { tenant_id: canonical.tenantId, administration_id: canonical.administrationId }),
  ].filter(Boolean)
  return statements.length === 0 ? '' : [
    'begin;',
    'set local session_replication_role = replica;',
    ...statements,
    'commit;',
  ].join('\n')
}

async function runCleanupSql(sql) {
  if (!sql) return { executed: 'NO', statementCount: 0 }
  const worktreeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
  const env = { ...process.env, npm_config_cache: path.join(worktreeRoot, '.npm-cache'), SUPABASE_TELEMETRY_DISABLED: '1' }
  const tempDirectory = await mkdtemp(path.join(worktreeRoot, '.r5-cleanup-'))
  const sqlPath = path.join(tempDirectory, 'cleanup.sql')
  await writeFile(sqlPath, sql, 'utf8')
  try {
    const command = `npx.cmd --yes supabase db query --linked --project-ref ${projectId} --output-format json --file ${sqlPath}`
    await execFileAsync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', command], { cwd: worktreeRoot, env, maxBuffer: 2 * 1024 * 1024 })
  } catch (error) {
    const stderrText = error && typeof error === 'object' && 'stderr' in error ? textOf(error.stderr) : ''
    const stdoutText = error && typeof error === 'object' && 'stdout' in error ? textOf(error.stdout) : ''
    const stderr = stderrText.slice(-1200)
    const stdout = stdoutText.slice(-1200)
    const message = error instanceof Error ? error.message.slice(0, 500) : 'unknown error'
    const code = error && typeof error === 'object' && 'code' in error ? textOf(error.code) : ''
    throw new FixtureError('FIXTURE_SQL_CLEANUP_FAILED', 'Direct TEST cleanup SQL failed', { message, code, stdout, stderr })
  } finally {
    await rm(tempDirectory, { recursive: true, force: true })
  }
  return { executed: 'YES', statementCount: sql.split('\n').filter((line) => line.startsWith('delete from public.')).length }
}

async function cleanup(sessions, canonical) {
  validateCleanupEnvironment()
  const before = await cleanupInventory(canonical)
  const storage = await removeStorageObjects(before.documents)
  const sql = buildCleanupSql(before, canonical)
  const sqlExecution = await runCleanupSql(sql)

  const after = await cleanupInventory(canonical)
  return { before: before.counts, after: after.counts, storage, sqlExecution, cleanupTableOrder: R5_CLEANUP_TABLE_ORDER, residual: await residualReadback(sessions.hr, canonical), hardDelete: Object.values(after.counts).every((count) => count === 0) ? 'YES' : 'NO' }
}

async function main() {
  validateEnvironment()
  const mode = parseMode(process.argv.slice(2))
  const sessions = { hr: await signIn('hr'), manager: await signIn('manager'), employee: await signIn('employee') }
  const hrContext = await context(sessions.hr)
  assert(hrContext.tenantId && hrContext.hrGroupId && hrContext.administrationId, 'FIXTURE_CONTEXT_INCOMPLETE', 'HR fixture context is incomplete')
  const managerContext = await chooseContext(sessions.manager, hrContext)
  const employeeContext = await chooseContext(sessions.employee, hrContext)
  assert(managerContext.tenantId === hrContext.tenantId && employeeContext.tenantId === hrContext.tenantId, 'CONTEXT_TENANT_MISMATCH', 'Personas do not share the canonical tenant')
  const [managerActorRows, employeeActorRows] = await Promise.all([
    restRows(sessions.hr, 'employees', `&tenant_id=eq.${encodeURIComponent(hrContext.tenantId)}&hr_group_id=eq.${encodeURIComponent(hrContext.hrGroupId)}&auth_user_id=eq.${sessions.manager.userId}&is_archived=eq.false&is_active=eq.true`, 'id,employee_number,first_name,birth_name'),
    restRows(sessions.hr, 'employees', `&tenant_id=eq.${encodeURIComponent(hrContext.tenantId)}&hr_group_id=eq.${encodeURIComponent(hrContext.hrGroupId)}&auth_user_id=eq.${sessions.employee.userId}&is_archived=eq.false&is_active=eq.true`, 'id,employee_number,first_name,birth_name'),
  ])
  const canonical = { ...hrContext, managerEmployeeId: managerActorRows[0]?.id ?? null, employeeId: employeeActorRows[0]?.id ?? null }
  assert(canonical.employeeId, 'FIXTURE_EMPLOYEE_CONTEXT_MISSING', 'Employee persona has no active employee context')
  assert(canonical.managerEmployeeId, 'FIXTURE_MANAGER_CONTEXT_MISSING', 'Manager persona has no active employee context')
  if (mode === 'cleanup') {
    console.log(JSON.stringify({ mode, projectId, prefix: R5_PREFIX, migrations: 'NO', cleanup: await cleanup(sessions, canonical) }, null, 2))
    return
  }
  const people = await discoverPeople(sessions.hr, canonical)
  const recipes = await getRecipes(sessions.hr)
  const definitions = await ensureDefinitions(sessions.hr, recipes)
  const existingAcknowledgements = await existingAcknowledgementDocuments(sessions.hr, sessions.employee, canonical)
  const documentOpen = existingAcknowledgements.open ?? await ensureDocument(sessions.hr, people, 'r5-test-document-open', `${R5_PREFIX} — Employee acknowledgement open`)
  const documentCompleted = existingAcknowledgements.completed ?? await ensureDocument(sessions.hr, people, 'r5-test-document-completed', `${R5_PREFIX} — Employee acknowledgement completed`)
  let workItems
  let acknowledgements
  if (mode === 'setup') {
    workItems = await ensureWorkItems(sessions.manager, sessions.hr, sessions.employee, definitions, people)
    acknowledgements = await ensureAcknowledgements(sessions.hr, { ...people.employee, session: sessions.employee }, definitions, documentOpen, documentCompleted)
    workItems.jobs = await runJobs(sessions.hr)
    workItems.output = { processInstanceId: acknowledgements.completed.processInstanceId, ...(await outputReadback(sessions.hr, acknowledgements.completed.processInstanceId)) }
  } else {
    const residual = await residualReadback(sessions.hr, canonical)
    workItems = { residual }
    acknowledgements = { residual }
  }
  const residual = await residualReadback(sessions.hr, canonical)
  const datasetIds = new Set([
    workItems.claimed?.workItemId,
    workItems.openHrQueue?.workItemId,
    workItems.blocked?.workItemId,
    workItems.overdue?.workItemId,
    acknowledgements.open?.workItemId,
    ...residual.workItems.map((workItem) => workItem.id),
  ].filter((value) => typeof value === 'string'))
  const roles = await roleReadback(sessions, datasetIds, {
    hrQueueWorkItemId: workItems.openHrQueue?.workItemId,
    claimedWorkItemId: workItems.claimed?.workItemId ?? residual.workItems.find((workItem) => workItem.status === 'CLAIMED')?.id,
  }, canonical)
  const safe = mode === 'setup' && workItems.openHrQueue?.reachable === true && workItems.upcomingDeadline?.reachable === true && workItems.overdue?.reachable === true && roles.hr.workListStatus === 200 && roles.manager.workListStatus === 200 && roles.employee.workListStatus === 200 && roles.negativeCrossScope.every((entry) => entry.status === 403 || entry.status === 404)
  console.log(JSON.stringify({
    mode, projectId, prefix: R5_PREFIX, rerunnable: 'YES', migrations: 'NO', outcome: safe ? 'GREEN' : 'RED',
    personas: {
      hr: { email: emails.hr, context: { tenantId: hrContext.tenantId, hrGroupId: hrContext.hrGroupId, administrationId: hrContext.administrationId }, positive: true },
      manager: { email: emails.manager, context: { tenantId: managerContext.tenantId, hrGroupId: managerContext.hrGroupId, administrationId: managerContext.administrationId }, positive: roles.manager },
      employee: { email: emails.employee, context: { tenantId: employeeContext.tenantId, hrGroupId: employeeContext.hrGroupId, administrationId: employeeContext.administrationId }, positive: roles.employee },
    },
    definitions, documents: { open: documentOpen, completed: documentCompleted }, datasetContract: R5_DATASET_CONTRACT, people, workItems, acknowledgements, roleReadback: roles, residualTestRecords: residual, safeAsSharedR5Fixture: mode === 'setup' ? (safe ? 'YES' : 'NO') : 'READBACK_ONLY',
  }, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => {
  console.error(JSON.stringify({ mode: (() => { try { return parseMode(process.argv.slice(2)) } catch { return 'unknown' } })(), projectId, prefix: R5_PREFIX, migrations: 'NO', safeAsSharedR5Fixture: 'NO', error: error instanceof FixtureError ? { code: error.code, message: error.message, details: error.details } : { code: 'FIXTURE_UNEXPECTED_FAILURE', message: error instanceof Error ? error.message : 'unknown error' } }, null, 2))
  process.exitCode = 1
})
