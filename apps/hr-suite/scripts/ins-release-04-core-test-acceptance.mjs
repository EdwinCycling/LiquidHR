#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'

const PROJECT_ID = 'prj_h3voMtzXGfqG6QTodR5d1VTcC1zP'
const PROJECT_REF = 'wnpfloqpjvaacobppbpk'
const PHASE_A = '20261030065603'
const PHASE_C = '20261030120901'
const PHASE_A_NAME = 'ins_release_02_manager_insights_unblock'
const PHASE_C_NAME = 'ins_release_04_manager_insights_activation'
const ACTIVE_ALIAS = 'liquid-hr-hr-suite.vercel.app'
const ACTIVE_BASE_URL = `https://${ACTIVE_ALIAS}`
const VERCEL_SCOPE = 'edwinitsolutions'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SHA = /^[0-9a-f]{40}$/i
const PAGE = 5000
const MAX_ROWS = 20000
const DAY_MS = 86_400_000

class AcceptanceError extends Error {
  constructor(code) { super(code); this.code = code }
}
function fail(code) { throw new AcceptanceError(code) }
function obj(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {} }
function validUuid(value) { return typeof value === 'string' && UUID.test(value) }
function uniq(values) { return [...new Set(values)] }
function usage() {
  return [
    'INS-RELEASE-04 read-only Core TEST acceptance runner',
    'Deployment check: --verify-deployment-only --expected-source-sha <40-char-sha>',
    'Migration check: --verify-migration-stage <none|a-only|complete>',
    'Full run: --manifest <private-json-path> --expected-source-sha <40-char-sha> --confirm-authorized-core-test',
    'The manifest contains persona expectations and existing Playwright storage-state paths; live platform evidence is read independently.',
    'Full run requires Vercel CLI authentication and SUPABASE_ACCESS_TOKEN with database_migrations_read scope.',
    'Only report GETs, PostgREST GETs, context-selection POSTs that set cookies, and browser reads are performed.',
    'The runner does not sign in, create sessions, mutate database rows, or save response data.',
  ].join('\n')
}
function argsFrom(argv) {
  const args = { help: false, manifest: null, sha: null, confirmed: false, verifyDeploymentOnly: false, migrationStage: null }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--help') args.help = true
    else if (argv[index] === '--verify-deployment-only') args.verifyDeploymentOnly = true
    else if (argv[index] === '--verify-migration-stage') args.migrationStage = argv[++index] ?? null
    else if (argv[index] === '--manifest') args.manifest = argv[++index] ?? null
    else if (argv[index] === '--expected-source-sha') args.sha = argv[++index] ?? null
    else if (argv[index] === '--confirm-authorized-core-test') args.confirmed = true
    else fail('UNKNOWN_ARGUMENT')
  }
  return args
}
async function readJson(file, code) {
  try { return JSON.parse(await readFile(file, 'utf8')) } catch { fail(code) }
}
function validate(manifest, expectedSha, supabaseUrl) {
  const sessions = obj(manifest.sessions)
  const expected = obj(manifest.expected)
  if (!SHA.test(expectedSha ?? '')) fail('EXPECTED_SOURCE_SHA_INVALID')
  const db = new URL(supabaseUrl)
  if (db.protocol !== 'https:' || db.hostname !== PROJECT_REF + '.supabase.co') fail('SUPABASE_PROJECT_MISMATCH')
  const adminThreshold = obj(expected.hrAdmin).frequentAbsenceThreshold
  if (!Number.isInteger(adminThreshold) || adminThreshold < 1 || adminThreshold > 20) fail('HR_ADMIN_THRESHOLD_EXPECTATION_MISSING')
  for (const name of ['hrAdmin', 'manager', 'employee', 'emptyManager']) {
    const state = obj(sessions[name])
    if (typeof state.nl !== 'string' || !state.nl) fail('PERSONA_SESSION_MISSING')
    const context = obj(expected[name])
    if (!validUuid(context.tenantId) || !validUuid(context.hrGroupId)) fail('EXPECTED_CONTEXT_INVALID')
  }
  for (const name of ['hrAdmin', 'manager']) if (typeof obj(sessions[name]).en !== 'string') fail('ENGLISH_SESSION_MISSING')
  const manager = obj(expected.manager)
  if (!Number.isInteger(manager.frequentAbsenceThreshold) || manager.frequentAbsenceThreshold < 1 || manager.frequentAbsenceThreshold > 20) fail('THRESHOLD_EXPECTATION_MISSING')
  if (!validUuid(manager.administrationId)) fail('MANAGER_CONTEXT_INVALID')
  for (const key of ['administrationId', 'secondAdministrationId']) if (!validUuid(obj(expected.hrAdmin)[key])) fail('HR_ADMIN_CONTEXT_INVALID')
  if (!validUuid(obj(expected.emptyManager).administrationId)) fail('EMPTY_MANAGER_CONTEXT_INVALID')
  for (const key of ['administrationId', 'forbiddenAdministrationId', 'forbiddenHrGroupId', 'forbiddenTenantId']) if (!validUuid(manager[key])) fail('MANAGER_NEGATIVE_FIXTURE_INVALID')
  if (!Array.isArray(manager.outsideTeamEmployeeIds) || manager.outsideTeamEmployeeIds.length === 0 || manager.outsideTeamEmployeeIds.some((id) => !validUuid(id))
    || new Set(manager.outsideTeamEmployeeIds).size !== manager.outsideTeamEmployeeIds.length) fail('OUTSIDE_TEAM_FIXTURE_INVALID')
  return { sessions, expected, baseUrl: ACTIVE_BASE_URL }
}

export function expectedRollingRange(today = new Date()) {
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  const start = new Date(end - 364 * DAY_MS)
  return { startDate: start.toISOString().slice(0, 10), endDate: new Date(end).toISOString().slice(0, 10) }
}

export function expectedCalendarYearRange(today = new Date()) {
  const year = today.getUTCFullYear()
  return { mode: 'year', year, startDate: `${year}-01-01`, endDate: `${year}-12-31` }
}

export function assertPeriodBounds(report, expectedRange, code = 'REPORT_PERIOD_MISMATCH') {
  const period = obj(obj(report).period)
  if (period.startDate !== expectedRange.startDate || period.endDate !== expectedRange.endDate) fail(code)
  if (expectedRange.mode && period.mode !== expectedRange.mode) fail(code)
  if (expectedRange.year && period.year !== expectedRange.year) fail(code)
  const dayCount = (Date.parse(`${period.endDate}T00:00:00Z`) - Date.parse(`${period.startDate}T00:00:00Z`)) / DAY_MS + 1
  if (!Number.isInteger(dayCount) || (expectedRange.mode !== 'year' && dayCount !== 365)) fail(code)
}

export function absenceReportSpecs(windows) {
  return [
    { report: 'absence', params: { period: 'year', year: windows.calendarYear.year }, range: windows.calendarYear },
    { report: 'absence-frequent', params: { period: '12-months' }, range: windows.rolling },
    { report: 'absence-bradford', params: { period: '52-weeks' }, range: windows.rolling },
  ]
}

export function assertDirectTeamBaseline(managerEmployeeIds, hrAdminEmployeeIds) {
  const managerIds = new Set(managerEmployeeIds)
  const referenceIds = new Set(hrAdminEmployeeIds)
  if (!managerIds.size || !referenceIds.size
    || managerIds.size !== managerEmployeeIds.length || referenceIds.size !== hrAdminEmployeeIds.length
    || managerIds.size !== referenceIds.size || [...referenceIds].some((id) => !managerIds.has(id))) fail('DIRECT_TEAM_BASELINE_MISMATCH')
  return referenceIds
}

function employeeDisplayName(employee) {
  return [employee.first_name, employee.birth_name_prefix, employee.birth_name]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ')
}

function overlaps(spell, range) {
  return spell.started_on <= range.endDate && (spell.recovered_on === null || spell.recovered_on >= range.startDate)
}

export function assertNegativeFixtureReference(employeeIds, employeeRows, cases, spells, directTeamIds, ranges, expectedScope) {
  const expectedIds = new Set(employeeIds)
  if (!expectedIds.size || expectedIds.size !== employeeIds.length) fail('OUTSIDE_TEAM_FIXTURE_INVALID')
  const employeesById = new Map(employeeRows.map((row) => [row.id, row]))
  if (employeesById.size !== employeeRows.length || employeesById.size !== expectedIds.size
    || [...expectedIds].some((id) => !employeesById.has(id))
    || employeeRows.some((row) => row.tenant_id !== expectedScope.tenantId || row.hr_group_id !== expectedScope.hrGroupId)) fail('OUTSIDE_TEAM_EMPLOYEE_REFERENCE_MISSING')
  if ([...expectedIds].some((id) => directTeamIds.has(id))) fail('OUTSIDE_TEAM_FIXTURE_IN_ALLOWLIST')

  const names = new Set([...expectedIds].map((id) => employeeDisplayName(employeesById.get(id))))
  if (names.size !== expectedIds.size || [...names].some((name) => !name)) fail('OUTSIDE_TEAM_EMPLOYEE_NAME_MISSING')
  const casesByEmployee = new Map([...expectedIds].map((id) => [id, []]))
  const caseById = new Map()
  for (const item of cases) {
    if (!expectedIds.has(item.employee_id)) continue
    if (typeof item.id !== 'string' || caseById.has(item.id)
      || item.tenant_id !== expectedScope.tenantId || item.hr_group_id !== expectedScope.hrGroupId
      || item.administration_id !== expectedScope.administrationId) fail('OUTSIDE_TEAM_CASE_REFERENCE_INVALID')
    caseById.set(item.id, item)
    casesByEmployee.get(item.employee_id).push(item)
  }
  const spellsByEmployee = new Map([...expectedIds].map((id) => [id, []]))
  const spellIds = new Set()
  for (const spell of spells) {
    const parent = caseById.get(spell.case_id)
    if (!parent) continue
    if (typeof spell.id !== 'string' || spellIds.has(spell.id)) fail('OUTSIDE_TEAM_SPELL_REFERENCE_INVALID')
    spellIds.add(spell.id)
    spellsByEmployee.get(parent.employee_id).push(spell)
  }

  let yearCases = 0
  let rollingFrequencyCases = 0
  let rollingBradfordSpells = 0
  for (const id of expectedIds) {
    const employeeCases = casesByEmployee.get(id)
    const employeeSpells = spellsByEmployee.get(id)
    if (!employeeCases.length) fail('OUTSIDE_TEAM_CASE_REFERENCE_MISSING')
    const yearOverlapCases = new Set(employeeSpells.filter((spell) => overlaps(spell, ranges.calendarYear)).map((spell) => spell.case_id))
    const frequencyCases = employeeCases.filter((item) => item.first_absence_on >= ranges.rolling.startDate && item.first_absence_on <= ranges.rolling.endDate)
    const bradfordSpells = employeeSpells.filter((spell) => overlaps(spell, ranges.rolling))
    if (!yearOverlapCases.size || !frequencyCases.length || !bradfordSpells.length) fail('OUTSIDE_TEAM_RELEVANT_CASE_MISSING')
    yearCases += yearOverlapCases.size
    rollingFrequencyCases += frequencyCases.length
    rollingBradfordSpells += bradfordSpells.length
  }
  return {
    employeeIds: expectedIds,
    employeeNames: names,
    employeeCount: expectedIds.size,
    caseCount: caseById.size,
    relevant: { absenceCases: yearCases, frequentCases: rollingFrequencyCases, bradfordSpells: rollingBradfordSpells },
  }
}

export function assertNoNegativeFixtureRows(rows, employeeIds) {
  if (rows.some((row) => employeeIds.has(row.employeeId))) fail('OUTSIDE_TEAM_EMPLOYEE_IN_REPORT')
}

export function assertNoNegativeFixtureNames(names, employeeNames) {
  if (names.some((name) => employeeNames.has(name))) fail('OUTSIDE_TEAM_EMPLOYEE_IN_EXCEL')
}

export function assertDeploymentEvidence(runtime, expectedSha, alias, deployment, expectedDatabaseRef = PROJECT_REF) {
  const platformSha = deployment?.gitSource?.sha ?? deployment?.meta?.githubCommitSha ?? deployment?.meta?.gitCommitSha ?? null
  const runtimePlatformSha = runtime?.platformSourceSha || null
  const deploymentId = deployment?.id ?? deployment?.uid
  if (alias?.alias !== ACTIVE_ALIAS || alias?.projectId !== PROJECT_ID || typeof alias?.deploymentId !== 'string') fail('ACTIVE_ALIAS_READBACK_MISMATCH')
  if (deploymentId !== alias.deploymentId || deployment?.projectId !== PROJECT_ID || deployment?.readyState !== 'READY' || deployment?.target !== 'production') fail('ACTIVE_DEPLOYMENT_READBACK_MISMATCH')
  if (runtime?.deploymentId !== deploymentId || runtime?.projectId !== PROJECT_ID || runtime?.deploymentUrl !== deployment?.url
    || runtime?.targetEnvironment !== 'production' || runtime?.supabaseProjectRef !== PROJECT_REF || expectedDatabaseRef !== PROJECT_REF) fail('RUNTIME_TARGET_READBACK_MISMATCH')
  if (!SHA.test(runtime?.sourceSha ?? '') || runtime.sourceSha.toLowerCase() !== expectedSha.toLowerCase()) fail('SOURCE_SHA_NOT_VERIFIED')
  for (const sourceSha of [platformSha, runtimePlatformSha]) {
    if (sourceSha !== null && (!SHA.test(sourceSha) || sourceSha.toLowerCase() !== expectedSha.toLowerCase())) fail('PLATFORM_SOURCE_SHA_MISMATCH')
  }
  if (typeof deployment?.url !== 'string' || !deployment.url) fail('ACTIVE_DEPLOYMENT_READBACK_MISMATCH')
  return {
    alias: ACTIVE_ALIAS,
    deploymentId,
    deploymentUrl: deployment.url,
    projectId: PROJECT_ID,
    sourceSha: runtime.sourceSha,
    platformSourceSha: platformSha ?? runtimePlatformSha,
    supabaseProjectRef: PROJECT_REF,
  }
}

export function assertMigrationStage(appliedRecords, stage = 'complete') {
  if (!Array.isArray(appliedRecords) || !['none', 'a-only', 'complete'].includes(stage)) fail('MIGRATION_STAGE_MISMATCH')
  const versions = appliedRecords.map((record) => record.version)
  if (new Set(versions).size !== versions.length || versions.some((version) => ![PHASE_A, PHASE_C].includes(version))) fail('MIGRATION_READBACK_INVALID')
  for (const record of appliedRecords) {
    const expectedName = record.version === PHASE_A ? PHASE_A_NAME : PHASE_C_NAME
    if (record.name !== expectedName) fail('MIGRATION_NAME_MISMATCH')
  }
  const hasA = versions.includes(PHASE_A)
  const hasC = versions.includes(PHASE_C)
  if ((stage === 'none' && (hasA || hasC))
    || (stage === 'a-only' && (!hasA || hasC))
    || (stage === 'complete' && (!hasA || !hasC))) fail('MIGRATION_STAGE_MISMATCH')
  return { stage, appliedVersions: [hasA ? PHASE_A : null, hasC ? PHASE_C : null].filter(Boolean) }
}

function vercelApi(endpoint) {
  let output
  try {
    output = execFileSync('vercel', ['api', endpoint, '--method', 'GET', '--scope', VERCEL_SCOPE, '--non-interactive'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000, shell: process.platform === 'win32',
    })
  } catch {
    fail('VERCEL_PLATFORM_READBACK_UNAVAILABLE')
  }
  try { return obj(JSON.parse(output)) } catch { fail('VERCEL_PLATFORM_READBACK_INVALID') }
}

async function runtimeJson() {
  const response = await fetch(new URL('/api/runtime/build-provenance', ACTIVE_BASE_URL), {
    method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', redirect: 'error',
  }).catch(() => fail('RUNTIME_PROVENANCE_UNAVAILABLE'))
  if (response.status !== 200) fail('RUNTIME_PROVENANCE_UNAVAILABLE')
  return obj(await response.json().catch(() => fail('RUNTIME_PROVENANCE_INVALID')))
}

async function readDeploymentEvidence(expectedSha) {
  const alias = vercelApi(`/v4/aliases/${ACTIVE_ALIAS}`)
  const deploymentId = alias.deploymentId
  if (typeof deploymentId !== 'string' || !/^dpl_[A-Za-z0-9]+$/.test(deploymentId)) fail('ACTIVE_ALIAS_READBACK_MISMATCH')
  const deployment = vercelApi(`/v13/deployments/${deploymentId}`)
  const runtime = await runtimeJson()
  return assertDeploymentEvidence(runtime, expectedSha, alias, deployment)
}

async function readMigrationEvidence(stage = 'complete') {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) fail('SUPABASE_MIGRATION_READBACK_UNAVAILABLE')
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/migrations`
  const response = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, redirect: 'error', cache: 'no-store' })
    .catch(() => fail('SUPABASE_MIGRATION_READBACK_UNAVAILABLE'))
  if (response.status !== 200) fail('SUPABASE_MIGRATION_READBACK_UNAVAILABLE')
  const body = await response.json().catch(() => fail('SUPABASE_MIGRATION_READBACK_INVALID'))
  if (!Array.isArray(body) || body.some((entry) => typeof obj(entry).version !== 'string' || typeof obj(entry).name !== 'string')) fail('SUPABASE_MIGRATION_READBACK_INVALID')
  const records = body.filter((entry) => [PHASE_A, PHASE_C].includes(obj(entry).version))
    .map((entry) => ({ version: obj(entry).version, name: obj(entry).name }))
  return assertMigrationStage(records, stage)
}

function decodeStored(value) {
  let decoded
  try { decoded = decodeURIComponent(value) } catch { fail('AUTH_STATE_UNREADABLE') }
  if (decoded.startsWith('base64-')) {
    try { decoded = Buffer.from(decoded.slice(7), 'base64url').toString('utf8') } catch { fail('AUTH_STATE_UNREADABLE') }
  }
  try { return JSON.parse(decoded) } catch { return null }
}
function tokenFrom(value, depth = 0) {
  if (depth > 8 || value == null) return null
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : null
  if (typeof value === 'string') return value.split('.').length === 3 ? value : tokenFrom(decodeStored(value), depth + 1)
  const item = obj(value)
  if (typeof item.access_token === 'string') return item.access_token
  for (const child of Object.values(item)) {
    const token = tokenFrom(child, depth + 1)
    if (token) return token
  }
  return null
}
function sessionToken(state) {
  const groups = new Map()
  for (const cookie of Array.isArray(state.cookies) ? state.cookies : []) {
    const match = typeof cookie.name === 'string' ? cookie.name.match(/^(.*-auth-token)(?:\.(\d+))?$/) : null
    if (!match || !match[1].startsWith('sb-')) continue
    const list = groups.get(match[1]) ?? []
    list.push({ index: match[2] === undefined ? -1 : Number(match[2]), value: cookie.value })
    groups.set(match[1], list)
  }
  for (const list of groups.values()) {
    const value = [...list].sort((a, b) => a.index - b.index).map((part) => part.value).join('')
    const token = tokenFrom(value)
    if (token) return token
  }
  for (const origin of Array.isArray(state.origins) ? state.origins : []) {
    for (const item of Array.isArray(origin.localStorage) ? origin.localStorage : []) {
      if (typeof item.name === 'string' && item.name.startsWith('sb-') && item.name.includes('-auth-token')) {
        const token = tokenFrom(item.value)
        if (token) return token
      }
    }
  }
  fail('AUTH_STATE_MISSING_SESSION')
}
function userIdFrom(token) {
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    if (!validUuid(claims.sub) || claims.role !== 'authenticated' || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now() + 120000) fail('AUTH_STATE_EXPIRED_OR_INVALID')
    return claims.sub
  } catch (error) {
    if (error instanceof AcceptanceError) throw error
    fail('AUTH_STATE_UNREADABLE')
  }
}
function urlForDb(base, table, params) {
  const url = new URL('/rest/v1/' + table, base)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  url.searchParams.set('order', 'id.asc')
  return url
}
async function dbRows(session, base, table, params, key) {
  const rows = []
  let total = null
  for (let offset = 0; offset <= MAX_ROWS; offset += PAGE) {
    const response = await fetch(urlForDb(base, table, params), {
      method: 'GET',
      headers: { apikey: key, Authorization: 'Bearer ' + session.token, Accept: 'application/json', Prefer: 'count=exact', 'Range-Unit': 'items', Range: offset + '-' + (offset + PAGE - 1) },
      redirect: 'error',
    }).catch(() => fail('RLS_READ_UNAVAILABLE'))
    if (response.status !== 200 && response.status !== 206) fail('RLS_READ_DENIED_OR_FAILED')
    const match = (response.headers.get('content-range') ?? '').match(/(?:\d+-\d+|\*)\/(\d+|\*)$/)
    if (!match || match[1] === '*') fail('RLS_EXACT_COUNT_UNAVAILABLE')
    total = Number(match[1])
    if (!Number.isSafeInteger(total) || total > MAX_ROWS) fail('RLS_SOURCE_LIMIT_REACHED')
    const page = await response.json().catch(() => fail('RLS_RESPONSE_INVALID'))
    if (!Array.isArray(page)) fail('RLS_RESPONSE_INVALID')
    rows.push(...page)
    if (rows.length >= total) break
    if (!page.length || offset + PAGE > MAX_ROWS) fail('RLS_RESPONSE_TRUNCATED')
  }
  if (total === null || rows.length !== total) fail('RLS_RESPONSE_TRUNCATED')
  return rows
}
function currentPopulationParams(context) {
  const today = new Date().toISOString().slice(0, 10)
  return {
    select: 'id,employee_id,employment_id',
    tenant_id: 'eq.' + context.tenantId,
    hr_group_id: 'eq.' + context.hrGroupId,
    administration_id: 'eq.' + context.administrationId,
    record_status: 'eq.CONFIRMED',
    deleted_at: 'is.null',
    starts_on: 'lte.' + today,
    or: '(ends_on.is.null,ends_on.gte.' + today + ')',
  }
}
function rollingPopulationParams(context) {
  const today = new Date().toISOString().slice(0, 10)
  const start = new Date(Date.now())
  start.setUTCDate(start.getUTCDate() - 364)
  return {
    ...currentPopulationParams(context),
    starts_on: 'lte.' + today,
    or: '(ends_on.is.null,ends_on.gte.' + start.toISOString().slice(0, 10) + ')',
  }
}
function reportRows(report) {
  if (!Array.isArray(obj(report).rows)) fail('REPORT_ROWS_MISSING')
  return report.rows
}
function assertReport(report, allowedIds, type, referenceCaseKpis = null) {
  const rows = reportRows(report)
  if (rows.some((row) => typeof row.employeeId !== 'string' || !allowedIds.has(row.employeeId))) fail('REPORT_SCOPE_LEAK')
  for (const row of rows) {
    if (Object.keys(obj(row)).some((key) => /diagnos|medical|free.?text|case.?manager|default_case_manager/i.test(key))) fail('MEDICAL_OR_SETTINGS_FIELD_EXPOSED')
  }
  if (type === 'absence') {
    if (rows.reduce((sum, row) => sum + (Number(row.caseCount) || 0), 0) !== report.absenceCases) fail('ABSENCE_KPI_DETAIL_MISMATCH')
    if (referenceCaseKpis && (report.absenceCases !== referenceCaseKpis.absenceCases || report.activeCases !== referenceCaseKpis.activeCases)) fail('ABSENCE_KPI_REFERENCE_MISMATCH')
    for (const key of ['sickHours', 'sickDays']) {
      const total = report[key]
      if (total === null) continue
      const rowValues = rows.map((row) => row[key])
      if (rowValues.some((value) => typeof value !== 'number')) fail('ABSENCE_SICKNESS_KPI_DETAIL_MISMATCH')
      const detailTotal = rowValues.reduce((sum, value) => sum + value, 0)
      const tolerance = key === 'sickHours' ? 0.005 * (rows.length + 1) + 1e-9 : 1e-7
      if (Math.abs(detailTotal - total) > tolerance) fail('ABSENCE_SICKNESS_KPI_DETAIL_MISMATCH')
    }
  }
  if (type === 'absence-frequent') {
    if (rows.reduce((sum, row) => sum + (Number(row.reportCount) || 0), 0) !== report.totalReports) fail('FREQUENCY_KPI_DETAIL_MISMATCH')
    if (rows.filter((row) => row.isFrequent).length !== report.frequentCount || new Set(rows.map((row) => row.employeeId)).size !== report.totalEmployees) fail('FREQUENCY_KPI_DETAIL_MISMATCH')
  }
  if (type === 'absence-bradford') {
    if (rows.reduce((sum, row) => sum + (Number(row.absenceOccurrences) || 0), 0) !== report.totalOccurrences) fail('BRADFORD_KPI_DETAIL_MISMATCH')
    if (rows.some((row) => (row.score === null) !== (row.band === 'UNKNOWN'))) fail('UNKNOWN_BRADFORD_NOT_PRESERVED')
    const expectedDays = rows.some((row) => row.sickDays === null)
      ? null
      : Math.round(rows.reduce((sum, row) => sum + row.sickDays, 0) * 10) / 10
    if (report.totalSickDays !== expectedDays) fail('BRADFORD_KPI_DETAIL_MISMATCH')
  }
  return rows
}
function xmlNames(xml, type) {
  const sheet = xml.match(/<Worksheet\b[\s\S]*?<\/Worksheet>/i)?.[0]
  if (!sheet) fail('EXCEL_WORKSHEET_MISSING')
  const rows = [...sheet.matchAll(/<Row>([\s\S]*?)<\/Row>/gi)].map((match) => match[1])
  const first = type === 'absence' ? 1 : 7
  return rows.slice(first).map((row) => {
    const cell = row.match(/<Data\b[^>]*>([\s\S]*?)<\/Data>/i)
    return cell ? cell[1].replace(/<[^>]*>/g, '').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&amp;', '&') : ''
  })
}
function exactNames(left, right) {
  return left.length === right.length && [...left].sort().every((name, index) => name === [...right].sort()[index])
}
function csvRecords(csv) {
  const text = csv.replace(/^\uFEFF/, '').replace(/^sep=;\r?\n/, '')
  const records = []
  let record = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1 }
      else quoted = !quoted
    } else if (text[index] === ';' && !quoted) {
      record.push(field)
      field = ''
    } else if ((text[index] === '\n' || text[index] === '\r') && !quoted) {
      if (text[index] === '\r' && text[index + 1] === '\n') index += 1
      record.push(field)
      records.push(record)
      record = []
      field = ''
    } else field += text[index]
  }
  if (field.length || record.length) {
    record.push(field)
    records.push(record)
  }
  return records
}
function assertCsvPopulation(csv, jsonRows, employeeNumberIndex, employeeNameIndex) {
  const exported = csvRecords(csv).slice(1).map((row) => JSON.stringify([row[employeeNumberIndex], row[employeeNameIndex]]))
  const expected = jsonRows.map((row) => JSON.stringify([row.employeeNumber, row.employeeName]))
  if (!exactNames(exported, expected)) fail('CSV_POPULATION_MISMATCH')
}
async function appJson(context, base, route, params, status = 200) {
  const url = new URL(route, base)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const response = await context.request.get(url.toString(), { timeout: 30000 }).catch(() => fail('APP_REQUEST_FAILED'))
  if (response.status() !== status) {
    const body = await response.json().catch(() => ({}))
    const error = obj(body).error
    const code = typeof error === 'string' && /^[A-Z0-9_]{1,80}$/.test(error) ? '_' + error : ''
    fail('APP_STATUS_' + response.status() + code)
  }
  return response.json().catch(() => fail('APP_JSON_INVALID'))
}
async function appText(context, base, route, params) {
  const url = new URL(route, base)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const response = await context.request.get(url.toString(), { timeout: 30000 }).catch(() => fail('APP_REQUEST_FAILED'))
  if (response.status() !== 200) fail('APP_EXPORT_STATUS_' + response.status())
  return response.text()
}
async function readContext(context, base) {
  const body = await appJson(context, base, '/api/context', {})
  const data = obj(body.data)
  if (!obj(data.tenant).id || !obj(data.activeHrGroup).id) fail('ACTIVE_CONTEXT_INVALID')
  return {
    tenantId: data.tenant.id,
    hrGroupId: data.activeHrGroup.id,
    administrationId: obj(data.activeAdministration).id ?? null,
    administrations: Array.isArray(data.administrationsInActiveHrGroup) ? data.administrationsInActiveHrGroup.map((item) => item.id) : [],
  }
}
function assertContext(actual, expected, requireAdmin = true) {
  if (actual.tenantId !== expected.tenantId || actual.hrGroupId !== expected.hrGroupId || (requireAdmin && actual.administrationId !== expected.administrationId)) fail('ACTIVE_CONTEXT_MISMATCH')
}
async function makeContext(browser, stateFile, base) {
  const state = await readJson(stateFile, 'AUTH_STATE_UNREADABLE')
  const token = sessionToken(state)
  const session = { token, userId: userIdFrom(token) }
  const context = await browser.newContext({ storageState: path.resolve(stateFile), viewport: { width: 1440, height: 900 } })
  context.session = session
  await readContext(context, base).catch(async () => {
    await context.close().catch(() => {})
    fail('AUTHENTICATED_CONTEXT_UNAVAILABLE')
  })
  return context
}
async function actorEmployeeId(session, db, groupId, key) {
  const rows = await dbRows(session, db, 'employees', { select: 'id', auth_user_id: 'eq.' + session.userId, hr_group_id: 'eq.' + groupId, deleted_at: 'is.null' }, key)
  if (rows.length !== 1) fail('ACTOR_EMPLOYEE_LINK_NOT_UNIQUE')
  return rows[0].id
}
async function teamIds(session, db, context, actorId, key) {
  const today = new Date().toISOString().slice(0, 10)
  const rows = await dbRows(session, db, 'employee_organizations', {
    select: 'employee_id,employment_id,effective_from,effective_to',
    tenant_id: 'eq.' + context.tenantId, hr_group_id: 'eq.' + context.hrGroupId, administration_id: 'eq.' + context.administrationId,
    direct_manager_id: 'eq.' + actorId, employee_id: 'neq.' + actorId, effective_from: 'lte.' + today,
    or: '(effective_to.is.null,effective_to.gte.' + today + ')',
  }, key)
  return uniq(rows.map((row) => row.employee_id))
}
async function managerFixtureReference(admin, base, db, managerContext, actorId, managerTeamIds, employeeIds, key, ranges) {
  let adminContext = await readContext(admin, base)
  if (adminContext.tenantId !== managerContext.tenantId || adminContext.hrGroupId !== managerContext.hrGroupId) fail('NEGATIVE_REFERENCE_SCOPE_MISMATCH')
  if (adminContext.administrationId !== managerContext.administrationId) {
    if (!adminContext.administrations.includes(managerContext.administrationId)) fail('NEGATIVE_REFERENCE_ADMIN_NOT_AUTHORIZED')
    const changed = await admin.request.post(new URL('/api/context/administration', base).toString(), {
      data: { administrationId: managerContext.administrationId },
      headers: { 'content-type': 'application/json' }, timeout: 30000,
    }).catch(() => fail('NEGATIVE_REFERENCE_CONTEXT_SWITCH_FAILED'))
    if (changed.status() !== 200) fail('NEGATIVE_REFERENCE_CONTEXT_SWITCH_FAILED')
    adminContext = await readContext(admin, base)
  }
  assertContext(adminContext, managerContext)

  const referenceTeamIds = await teamIds(admin.session, db, managerContext, actorId, key)
  const directTeamIds = assertDirectTeamBaseline(managerTeamIds, referenceTeamIds)
  const employeeRows = await dbRows(admin.session, db, 'employees', {
    select: 'id,first_name,birth_name_prefix,birth_name,tenant_id,hr_group_id',
    tenant_id: 'eq.' + managerContext.tenantId, hr_group_id: 'eq.' + managerContext.hrGroupId,
    id: 'in.(' + employeeIds.join(',') + ')', deleted_at: 'is.null',
  }, key)
  const cases = await dbRows(admin.session, db, 'absence_cases', {
    select: 'id,employee_id,first_absence_on,tenant_id,hr_group_id,administration_id', tenant_id: 'eq.' + managerContext.tenantId,
    hr_group_id: 'eq.' + managerContext.hrGroupId, administration_id: 'eq.' + managerContext.administrationId,
    employee_id: 'in.(' + employeeIds.join(',') + ')', pending_confirmation: 'eq.false', archived_at: 'is.null',
    first_absence_on: 'lte.' + ranges.rolling.endDate,
  }, key)
  const caseIds = uniq(cases.map((item) => item.id))
  const spells = []
  for (let index = 0; index < caseIds.length; index += 50) {
    const ids = caseIds.slice(index, index + 50)
    const rows = await dbRows(admin.session, db, 'absence_spells', {
      select: 'id,case_id,started_on,recovered_on', tenant_id: 'eq.' + managerContext.tenantId,
      hr_group_id: 'eq.' + managerContext.hrGroupId, case_id: 'in.(' + ids.join(',') + ')',
      started_on: 'lte.' + ranges.calendarYear.endDate,
      or: '(recovered_on.is.null,recovered_on.gte.' + ranges.rolling.startDate + ')',
    }, key)
    spells.push(...rows)
  }
  return {
    directTeamIds,
    proof: assertNegativeFixtureReference(employeeIds, employeeRows, cases, spells, directTeamIds, ranges, managerContext),
  }
}
async function directTeamCaseKpiReference(admin, db, context, directTeamIds, range, key) {
  const employeeIds = [...directTeamIds]
  const employments = []
  for (let index = 0; index < employeeIds.length; index += 50) {
    const rows = await dbRows(admin.session, db, 'employments', {
      select: 'id,employee_id', tenant_id: 'eq.' + context.tenantId, hr_group_id: 'eq.' + context.hrGroupId,
      administration_id: 'eq.' + context.administrationId, employee_id: 'in.(' + employeeIds.slice(index, index + 50).join(',') + ')',
      record_status: 'eq.CONFIRMED', deleted_at: 'is.null', starts_on: 'lte.' + range.endDate,
      or: '(ends_on.is.null,ends_on.gte.' + range.startDate + ')',
    }, key)
    employments.push(...rows)
  }
  const employmentIds = uniq(employments.map((row) => row.id))
  const cases = []
  for (let index = 0; index < employmentIds.length; index += 50) {
    const rows = await dbRows(admin.session, db, 'absence_cases', {
      select: 'id,employment_id,status', tenant_id: 'eq.' + context.tenantId, hr_group_id: 'eq.' + context.hrGroupId,
      administration_id: 'eq.' + context.administrationId, employment_id: 'in.(' + employmentIds.slice(index, index + 50).join(',') + ')',
      pending_confirmation: 'eq.false', archived_at: 'is.null', first_absence_on: 'lte.' + range.endDate,
    }, key)
    cases.push(...rows)
  }
  const caseIds = uniq(cases.map((row) => row.id))
  if (caseIds.length !== cases.length) fail('ABSENCE_REFERENCE_CASE_DUPLICATE')
  const spells = []
  for (let index = 0; index < caseIds.length; index += 50) {
    const rows = await dbRows(admin.session, db, 'absence_spells', {
      select: 'id,case_id,started_on,recovered_on', tenant_id: 'eq.' + context.tenantId, hr_group_id: 'eq.' + context.hrGroupId,
      case_id: 'in.(' + caseIds.slice(index, index + 50).join(',') + ')', started_on: 'lte.' + range.endDate,
      or: '(recovered_on.is.null,recovered_on.gte.' + range.startDate + ')',
    }, key)
    spells.push(...rows)
  }
  const overlappingCaseIds = new Set(spells.filter((spell) => overlaps(spell, range)).map((spell) => spell.case_id))
  const includedCases = cases.filter((item) => overlappingCaseIds.has(item.id))
  return {
    absenceCases: includedCases.length,
    activeCases: includedCases.filter((item) => item.status === 'ACTIVE' || item.status === 'RECOVERY_WINDOW').length,
  }
}
async function readOperationalAbsence(session, db, context, team, key) {
  const today = new Date().toISOString().slice(0, 10)
  const cases = await dbRows(session, db, 'absence_cases', {
    select: 'id,employee_id,employment_id', tenant_id: 'eq.' + context.tenantId, hr_group_id: 'eq.' + context.hrGroupId,
    administration_id: 'eq.' + context.administrationId, pending_confirmation: 'eq.false', archived_at: 'is.null',
    first_absence_on: 'lte.' + today,
  }, key)
  let spells = 0
  let capacities = 0
  const caseIds = uniq(cases.map((item) => item.id))
  for (let start = 0; start < caseIds.length; start += 50) {
    const currentCaseIds = caseIds.slice(start, start + 50)
    const spellRows = await dbRows(session, db, 'absence_spells', {
      select: 'id,case_id,started_on,recovered_on', tenant_id: 'eq.' + context.tenantId, hr_group_id: 'eq.' + context.hrGroupId,
      case_id: 'in.(' + currentCaseIds.join(',') + ')', started_on: 'lte.' + today,
    }, key)
    spells += spellRows.length
    const spellIds = uniq(spellRows.map((row) => row.id))
    for (let offset = 0; offset < spellIds.length; offset += 50) {
      const ids = spellIds.slice(offset, offset + 50)
      const capacityRows = await dbRows(session, db, 'absence_capacity_changes', {
        select: 'id,spell_id,effective_on', tenant_id: 'eq.' + context.tenantId, hr_group_id: 'eq.' + context.hrGroupId,
        spell_id: 'in.(' + ids.join(',') + ')', effective_on: 'lte.' + today,
      }, key)
      capacities += capacityRows.length
    }
  }
  const allowed = new Set(team)
  return {
    cases: cases.length,
    spells,
    capacityChanges: capacities,
    operationalCaseRowsOutsideDirectTeam: cases.filter((item) => !allowed.has(item.employee_id)).length,
  }
}
async function absenceReports(context, base, db, expectedContext, allowed, key, expectedThreshold, windows, negativeFixtures = null, referenceCaseKpis = null) {
  const actual = await readContext(context, base)
  assertContext(actual, expectedContext)
  const population = await dbRows(context.session, db, 'employments', rollingPopulationParams(actual), key)
  const allowedIds = allowed ?? new Set(population.map((row) => row.employee_id))
  const specs = absenceReportSpecs(windows)
  const result = {}
  for (const spec of specs) {
    const params = { report: spec.report, ...spec.params }
    const body = await appJson(context, base, '/api/insights/absence', params)
    const report = obj(body.data)
    const rows = assertReport(report, allowedIds, spec.report, spec.report === 'absence' ? referenceCaseKpis : null)
    assertPeriodBounds(report, spec.range)
    if (negativeFixtures) assertNoNegativeFixtureRows(rows, negativeFixtures.employeeIds)
    if (spec.report === 'absence-frequent' && expectedThreshold !== undefined && report.threshold !== expectedThreshold) fail('THRESHOLD_VALUE_MISMATCH')
    const workbook = await appText(context, base, '/api/insights/absence', { ...params, format: 'excel' })
    const exported = xmlNames(workbook, spec.report)
    if (!exactNames(rows.map((row) => row.employeeName), exported)) fail('EXCEL_POPULATION_MISMATCH')
    if (negativeFixtures) assertNoNegativeFixtureNames(exported, negativeFixtures.employeeNames)
    result[spec.report] = rows.length
  }
  return { reports: result, employmentRows: population.length }
}
function monthRange() {
  const now = new Date()
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1))
  return { from: start.toISOString().slice(0, 7), to: end.toISOString().slice(0, 7) }
}
function monthEnd(month) {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10)
}
async function workforceReports(context, base, db, active, key) {
  const period = monthRange()
  const rangeStart = period.from + '-01'
  const rangeEnd = monthEnd(period.to)
  const employments = await dbRows(context.session, db, 'employments', {
    select: 'id,employee_id', tenant_id: 'eq.' + active.tenantId, hr_group_id: 'eq.' + active.hrGroupId,
    administration_id: 'eq.' + active.administrationId, record_status: 'eq.CONFIRMED', deleted_at: 'is.null',
    starts_on: 'lte.' + rangeEnd, or: '(ends_on.is.null,ends_on.gte.' + rangeStart + ')',
  }, key)
  const allow = new Set(employments.map((row) => row.employee_id))
  const hcParams = { report: 'headcount-fte', fromMonth: period.from, toMonth: period.to, administrations: active.administrationId }
  const headcount = await appJson(context, base, '/api/insights/headcount-fte', hcParams)
  const hcRows = assertReport(headcount.data, allow, 'HEADCOUNT_SCOPE_LEAK')
  const hcCsv = await appText(context, base, '/api/insights/headcount-fte', { ...hcParams, format: 'csv', locale: 'nl' })
  assertCsvPopulation(hcCsv, hcRows, 0, 1)

  const historical = await dbRows(context.session, db, 'employments', {
    select: 'id,employee_id', tenant_id: 'eq.' + active.tenantId, hr_group_id: 'eq.' + active.hrGroupId,
    administration_id: 'eq.' + active.administrationId, record_status: 'eq.CONFIRMED', starts_on: 'lte.' + rangeEnd,
  }, key)
  const historicalAllowed = new Set(historical.map((row) => row.employee_id))
  const terminations = await dbRows(context.session, db, 'employment_terminations', {
    select: 'employee_id', tenant_id: 'eq.' + active.tenantId, hr_group_id: 'eq.' + active.hrGroupId,
    administration_id: 'eq.' + active.administrationId, workflow_status: 'in.(CONFIRMED,PAYROLL_READY,REPORTED)',
    last_working_day: 'lte.' + rangeEnd,
  }, key)
  for (const row of terminations) historicalAllowed.add(row.employee_id)
  const jlParams = { report: 'joiners-leavers', fromMonth: period.from, toMonth: period.to, administrations: active.administrationId }
  const joiners = await appJson(context, base, '/api/insights/joiners-leavers', jlParams)
  const jlRows = assertReport(joiners.data, historicalAllowed, 'JOINERS_SCOPE_LEAK')
  const jlCsv = await appText(context, base, '/api/insights/joiners-leavers', { ...jlParams, format: 'csv', locale: 'nl' })
  assertCsvPopulation(jlCsv, jlRows, 2, 3)
  return { headcountRows: hcRows.length, joinersLeaversRows: jlRows.length }
}
async function deniedSwitch(context, base, route, body) {
  const before = await readContext(context, base)
  const response = await context.request.post(new URL(route, base).toString(), { data: body, headers: { 'content-type': 'application/json' }, timeout: 30000 }).catch(() => fail('CONTEXT_PROBE_FAILED'))
  if (response.status() < 400 || response.status() >= 500) fail('UNAUTHORIZED_CONTEXT_SWITCH_ACCEPTED')
  const after = await readContext(context, base)
  if (before.tenantId !== after.tenantId || before.hrGroupId !== after.hrGroupId || before.administrationId !== after.administrationId) fail('FAILED_SWITCH_CHANGED_CONTEXT')
  return response.status()
}
async function employeeDenied(context, base) {
  const tests = [
    ['/api/insights/absence', { report: 'absence', period: 'year' }],
    ['/api/insights/absence', { report: 'absence', period: 'year', format: 'excel' }],
    ['/api/insights/absence', { report: 'absence-frequent', period: '12-months' }],
    ['/api/insights/absence', { report: 'absence-frequent', period: '12-months', format: 'excel' }],
    ['/api/insights/absence', { report: 'absence-bradford', period: '52-weeks' }],
    ['/api/insights/absence', { report: 'absence-bradford', period: '52-weeks', format: 'excel' }],
    ['/api/insights/headcount-fte', { report: 'headcount-fte' }],
    ['/api/insights/headcount-fte', { report: 'headcount-fte', format: 'csv' }],
    ['/api/insights/joiners-leavers', { report: 'joiners-leavers' }],
    ['/api/insights/joiners-leavers', { report: 'joiners-leavers', format: 'csv' }],
  ]
  for (const [route, params] of tests) {
    const url = new URL(route, base)
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
    const response = await context.request.get(url.toString(), { timeout: 30000 }).catch(() => fail('EMPLOYEE_DENIAL_PROBE_FAILED'))
    if (response.status() !== 403) fail('EMPLOYEE_INSIGHTS_NOT_DENIED')
  }
  const self = await context.request.get(new URL('/personal-settings', base).toString(), { timeout: 30000 }).catch(() => fail('EMPLOYEE_SELF_SERVICE_FAILED'))
  if (self.status() !== 200) fail('EMPLOYEE_SELF_SERVICE_UNAVAILABLE')
}
async function browserRead(browser, base, stateFile, locale, report, viewport) {
  const context = await browser.newContext({ storageState: path.resolve(stateFile), viewport })
  const page = await context.newPage()
  try {
    const period = report === 'absence' ? 'year' : report === 'absence-frequent' ? '12-months' : '52-weeks'
    const response = await page.goto(new URL('/insights?report=' + report + '&period=' + period, base).toString(), { waitUntil: 'domcontentloaded', timeout: 45000 })
    if (!response || response.status() >= 400) fail('BROWSER_PAGE_FAILED')
    const labels = await readJson(new URL('../messages/' + locale + '/insights.json', import.meta.url), 'LOCAL_LABELS_UNAVAILABLE')
    const titleKey = report === 'absence' ? 'absenceTitle' : report === 'absence-frequent' ? 'absenceFrequentTitle' : 'absenceBradfordTitle'
    if (!await page.getByText(labels[titleKey], { exact: true }).first().isVisible().catch(() => false)) fail('BROWSER_LOCALE_TITLE_MISMATCH')
    if (report !== 'absence') {
      const periodSelect = page.getByRole('combobox', { name: labels.period })
      if (!await periodSelect.isVisible().catch(() => false)) fail('BROWSER_PERIOD_CONTROL_MISSING')
      await periodSelect.selectOption('this-year')
      await page.getByRole('button', { name: labels.applyFilters }).click()
      await page.waitForURL((url) => url.searchParams.get('period') === 'this-year', { timeout: 15000 }).catch(() => fail('BROWSER_PERIOD_FILTER_FAILED'))
      await periodSelect.selectOption('previous-year')
      await page.getByRole('button', { name: labels.applyFilters }).click()
      await page.waitForURL((url) => url.searchParams.get('period') === 'previous-year', { timeout: 15000 }).catch(() => fail('BROWSER_PREVIOUS_YEAR_FILTER_FAILED'))
      const rolling = report === 'absence-frequent' ? '12-months' : '52-weeks'
      await periodSelect.selectOption(rolling)
      await page.getByRole('button', { name: labels.applyFilters }).click()
      await page.waitForURL((url) => url.searchParams.get('period') === rolling, { timeout: 15000 }).catch(() => fail('BROWSER_ROLLING_PERIOD_FAILED'))
      const rollingReport = await appJson(context, base, '/api/insights/absence', { report, period: rolling })
      assertPeriodBounds(obj(rollingReport.data), expectedRollingRange())
      const search = page.getByRole('searchbox', { name: labels.search })
      if (await search.count()) {
        const noMatch = 'ins-release-04-no-match'
        await search.fill(noMatch)
        await page.getByRole('button', { name: labels.applyFilters }).click()
        await page.waitForURL((url) => url.searchParams.get('search') === noMatch, { timeout: 15000 }).catch(() => fail('BROWSER_SEARCH_FILTER_FAILED'))
        const empty = await appJson(context, base, '/api/insights/absence', { report, period: rolling, search: noMatch }, 200)
        if (reportRows(empty.data).length !== 0) fail('BROWSER_EMPTY_FILTER_NOT_EMPTY')
      }
    }
    const layout = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, hasTable: !!document.querySelector('table') }))
    if (layout.documentWidth > layout.width + 2) fail('BROWSER_HORIZONTAL_OVERFLOW')
    if (!layout.hasTable) fail('BROWSER_REPORT_TABLE_MISSING')
    return { locale, width: viewport.width, noPageOverflow: true }
  } finally {
    await context.close().catch(() => {})
  }
}
async function run() {
  const args = argsFrom(process.argv.slice(2))
  if (args.help) { console.log(usage()); return }
  if (args.migrationStage) {
    if (args.manifest || args.sha || args.confirmed || args.verifyDeploymentOnly) fail('MIGRATION_VERIFY_ARGUMENTS_INVALID')
    const migrations = await readMigrationEvidence(args.migrationStage)
    console.log(JSON.stringify({ schemaVersion: 1, result: 'PASS', verifiedAt: new Date().toISOString(), migrations }, null, 2))
    return
  }
  if (!args.sha || !SHA.test(args.sha)) fail('EXPECTED_SOURCE_SHA_INVALID')
  if (args.verifyDeploymentOnly) {
    if (args.manifest || args.confirmed) fail('VERIFY_ONLY_ARGUMENTS_INVALID')
    const platform = await readDeploymentEvidence(args.sha)
    console.log(JSON.stringify({ schemaVersion: 1, result: 'PASS', platform }, null, 2))
    return
  }
  if (!args.confirmed) fail('CORE_TEST_AUTHORIZATION_REQUIRED')
  if (!args.manifest) fail('RUN_CONFIGURATION_MISSING')
  const db = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!db || !key) fail('SUPABASE_PUBLIC_CONFIGURATION_MISSING')
  const checked = validate(await readJson(args.manifest, 'RUN_MANIFEST_UNREADABLE'), args.sha, db)
  const { sessions, expected, baseUrl } = checked
  const platform = await readDeploymentEvidence(args.sha)
  const appliedMigrationVersions = await readMigrationEvidence('complete')
  const windows = { calendarYear: expectedCalendarYearRange(), rolling: expectedRollingRange() }
  let browser
  try { browser = await chromium.launch({ headless: true }) } catch { fail('PLAYWRIGHT_BROWSER_UNAVAILABLE') }
  const contexts = []
  const evidence = {
    schemaVersion: 2, result: 'PASS', platform: { ...platform, appliedMigrationVersions: appliedMigrationVersions.appliedVersions },
    api: {}, rls: {}, browser: {},
  }
  try {
    const admin = await makeContext(browser, sessions.hrAdmin.nl, baseUrl); contexts.push(admin)
    const adminContext = await readContext(admin, baseUrl); assertContext(adminContext, expected.hrAdmin)
    if (!adminContext.administrations.includes(expected.hrAdmin.secondAdministrationId)) fail('HR_ADMIN_SECOND_ADMIN_NOT_AUTHORIZED')
    const adminPop = await dbRows(admin.session, db, 'employments', rollingPopulationParams(adminContext), key)
    const adminAbsence = await absenceReports(admin, baseUrl, db, expected.hrAdmin, null, key, expected.hrAdmin.frequentAbsenceThreshold, windows)
    const adminWorkforce = await workforceReports(admin, baseUrl, db, adminContext, key)
    evidence.api.hrAdmin = { absence: adminAbsence.reports, workforce: adminWorkforce }
    evidence.rls.hrAdmin = await readOperationalAbsence(admin.session, db, adminContext, new Set(adminPop.map((row) => row.employee_id)), key)

    const changed = await admin.request.post(new URL('/api/context/administration', baseUrl).toString(), { data: { administrationId: expected.hrAdmin.secondAdministrationId }, headers: { 'content-type': 'application/json' }, timeout: 30000 }).catch(() => fail('HR_ADMIN_CONTEXT_SWITCH_FAILED'))
    if (changed.status() !== 200) fail('HR_ADMIN_CONTEXT_SWITCH_FAILED')
    const second = await readContext(admin, baseUrl)
    if (second.administrationId !== expected.hrAdmin.secondAdministrationId) fail('HR_ADMIN_CONTEXT_SWITCH_NOT_APPLIED')
    const secondReports = await absenceReports(admin, baseUrl, db, { ...expected.hrAdmin, administrationId: expected.hrAdmin.secondAdministrationId }, null, key, undefined, windows)
    evidence.api.hrAdmin.secondAdministration = secondReports.reports

    const manager = await makeContext(browser, sessions.manager.nl, baseUrl); contexts.push(manager)
    const managerContext = await readContext(manager, baseUrl); assertContext(managerContext, expected.manager)
    const actorId = await actorEmployeeId(manager.session, db, managerContext.hrGroupId, key)
    const managerTeamIds = await teamIds(manager.session, db, managerContext, actorId, key)
    if (!managerTeamIds.length) fail('MANAGER_TEAM_EMPTY_USE_EMPTY_MANAGER_SESSION')
    const negativeReference = await managerFixtureReference(
      admin, baseUrl, db, managerContext, actorId, managerTeamIds,
      expected.manager.outsideTeamEmployeeIds, key, windows,
    )
    const team = negativeReference.directTeamIds
    const caseKpiReference = await directTeamCaseKpiReference(admin, db, managerContext, team, windows.calendarYear, key)
    const managerAbsence = await absenceReports(manager, baseUrl, db, expected.manager, team, key,
      expected.manager.frequentAbsenceThreshold, windows, negativeReference.proof, caseKpiReference)
    evidence.api.manager = managerAbsence.reports
    evidence.rls.manager = await readOperationalAbsence(manager.session, db, managerContext, team, key)
    evidence.rls.manager.negativeFixtureProof = {
      directTeamBaselineMatched: true,
      outsideTeamEmployeesVerified: negativeReference.proof.employeeCount,
      outsideTeamCasesVerified: negativeReference.proof.caseCount,
      relevantRecords: negativeReference.proof.relevant,
      excludedFromKpiDetailsAndExcel: true,
    }
    const otherGroup = await dbRows(manager.session, db, 'employee_organizations', { select: 'employee_id', tenant_id: 'eq.' + managerContext.tenantId, hr_group_id: 'eq.' + expected.manager.forbiddenHrGroupId }, key)
    const otherTenant = await dbRows(manager.session, db, 'employee_organizations', { select: 'employee_id', tenant_id: 'eq.' + expected.manager.forbiddenTenantId }, key)
    if (otherGroup.length || otherTenant.length) fail('MANAGER_CROSS_SCOPE_RLS_READ')
    evidence.rls.manager.otherHrGroupRows = otherGroup.length
    evidence.rls.manager.otherTenantRows = otherTenant.length
    evidence.contextSwitches = {
      administration: await deniedSwitch(manager, baseUrl, '/api/context/administration', { administrationId: expected.manager.forbiddenAdministrationId }),
      hrGroup: await deniedSwitch(manager, baseUrl, '/api/context/hr-group', { hrGroupId: expected.manager.forbiddenHrGroupId }),
      tenant: await deniedSwitch(manager, baseUrl, '/api/context/select', { tenantId: expected.manager.forbiddenTenantId, hrGroupId: expected.manager.forbiddenHrGroupId }),
    }

    const empty = await makeContext(browser, sessions.emptyManager.nl, baseUrl); contexts.push(empty)
    const emptyContext = await readContext(empty, baseUrl); assertContext(emptyContext, expected.emptyManager)
    const emptyActor = await actorEmployeeId(empty.session, db, emptyContext.hrGroupId, key)
    if ((await teamIds(empty.session, db, emptyContext, emptyActor, key)).length) fail('EMPTY_MANAGER_FIXTURE_HAS_TEAM')
    const emptyReports = await absenceReports(empty, baseUrl, db, expected.emptyManager, new Set(), key, undefined, windows)
    if (Object.values(emptyReports.reports).some((count) => count !== 0)) fail('EMPTY_MANAGER_REPORT_NOT_EMPTY')
    evidence.api.emptyManager = emptyReports.reports

    const employee = await makeContext(browser, sessions.employee.nl, baseUrl); contexts.push(employee)
    assertContext(await readContext(employee, baseUrl), expected.employee, false)
    await employeeDenied(employee, baseUrl)
    evidence.api.employee = { deniedReportAndExportEndpoints: 10, personalSettings: 200 }

    evidence.browser.hrAdminDesktopNl = await browserRead(browser, baseUrl, sessions.hrAdmin.nl, 'nl', 'absence', { width: 1440, height: 900 })
    evidence.browser.managerDesktopEn = await browserRead(browser, baseUrl, sessions.manager.en, 'en', 'absence-frequent', { width: 1440, height: 900 })
    evidence.browser.hrAdminMobile = await browserRead(browser, baseUrl, sessions.hrAdmin.nl, 'nl', 'absence-bradford', { width: 390, height: 844 })
    evidence.browser.managerMobile = await browserRead(browser, baseUrl, sessions.manager.en, 'en', 'absence-bradford', { width: 390, height: 844 })
    evidence.browser.localePairs = {
      hrAdminNl: await browserRead(browser, baseUrl, sessions.hrAdmin.nl, 'nl', 'absence-frequent', { width: 1440, height: 900 }),
      hrAdminEn: await browserRead(browser, baseUrl, sessions.hrAdmin.en, 'en', 'absence-frequent', { width: 1440, height: 900 }),
      managerNl: await browserRead(browser, baseUrl, sessions.manager.nl, 'nl', 'absence-bradford', { width: 1440, height: 900 }),
      managerEn: await browserRead(browser, baseUrl, sessions.manager.en, 'en', 'absence-bradford', { width: 1440, height: 900 }),
    }
    console.log(JSON.stringify(evidence, null, 2))
  } finally {
    for (const context of contexts) await context.close().catch(() => {})
    await browser.close().catch(() => {})
  }
}
export { assertReport, validate }

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  run().catch((error) => {
    const code = error instanceof AcceptanceError ? error.code : 'UNEXPECTED_ACCEPTANCE_FAILURE'
    console.error(JSON.stringify({ schemaVersion: 2, result: 'HOLD', code }))
    process.exitCode = 1
  })
}
