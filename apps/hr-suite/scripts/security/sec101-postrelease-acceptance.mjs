import { createServerClient } from '@supabase/ssr'
import { loadEnvConfig } from '@next/env'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDirectory, '../..')
const repoRoot = path.resolve(appRoot, '../..')
const projectRef = 'wnpfloqpjvaacobppbpk'
const appUrl = 'https://liquid-hr-hr-suite.vercel.app'
const catalog = JSON.parse(readFileSync(path.join(repoRoot, 'docs/quality/acceptance/PAYROLL-TEST-PERSONAS.json'), 'utf8'))
const tenantId = catalog.scope.tenant.id
const hrGroupId = catalog.scope.hrGroup.id
const administrationId = catalog.scope.administration.id
const lisaEmployeeId = catalog.personas.find((persona) => persona.key === 'lisa')?.employeeId

const checks = []

function record(name, passed, status, rows) {
  checks.push({ name, passed })
  const rowText = Number.isInteger(rows) ? ` rows=${rows}` : ''
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name} HTTP=${status}${rowText}`)
}

function notTested(name, reason) {
  checks.push({ name, passed: false, notTested: true })
  console.log(`NOT TESTED ${name} reason=${reason}`)
}

function countOf(result) {
  if (Number.isInteger(result.count)) return result.count
  return Array.isArray(result.data) ? result.data.length : 0
}

function rowCheck(name, result, expected) {
  const rows = countOf(result)
  const pass = !result.error && result.status === 200 && (expected === 'positive' ? rows > 0 : rows === 0)
  record(name, pass, result.status, rows)
  return pass
}

export function isColumnPermissionDenied(result) {
  return result.error?.code === '42501' && result.status >= 400 && result.status < 500
}

export function isOutOfScopeHttpStatus(status) {
  return status === 403 || status === 404
}

function columnCheck(name, result) {
  const pass = isColumnPermissionDenied(result)
  record(name, pass, result.status, 0)
  return pass
}

export function roleMatchesPersona(persona, roles) {
  const values = new Set(roles)
  if (persona === 'employee-only') {
    return values.has('EMPLOYEE') && !values.has('DIRECT_MANAGER') && !values.has('HR_ADMIN') && !values.has('TENANT_ADMIN')
  }
  if (persona === 'manager') return values.has('DIRECT_MANAGER') && !values.has('HR_ADMIN') && !values.has('TENANT_ADMIN')
  if (persona === 'tenant-admin') {
    return values.has('TENANT_ADMIN') && !values.has('DIRECT_MANAGER') && !values.has('HR_ADMIN')
  }
  return false
}

async function readStdinJson() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk))
  const bytes = Buffer.concat(chunks)
  try { return JSON.parse(bytes.toString('utf8')) } finally { bytes.fill(0) }
}

async function resolveRoles(client, userId) {
  const employeeResult = await client.from('employees')
    .select('id')
    .eq('auth_user_id', userId)
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .is('deleted_at', null)
    .limit(2)
  if (employeeResult.error || employeeResult.status !== 200) return { status: employeeResult.status, employeeId: null, roles: [] }
  const actorIds = [...new Set((employeeResult.data ?? []).map((row) => row.id).filter(Boolean))]
  if (actorIds.length !== 1) return { status: employeeResult.status, employeeId: null, roles: [] }
  const employeeId = actorIds[0]

  const [access, assignment] = await Promise.all([
    client.from('user_hr_group_access').select('management_role_id')
      .eq('user_id', userId).eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).limit(100),
    client.from('department_management').select('management_role_id')
      .eq('employee_id', employeeId).eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId)
      .lte('effective_from', new Date().toISOString().slice(0, 10))
      .or(`effective_to.is.null,effective_to.gte.${new Date().toISOString().slice(0, 10)}`).limit(100),
  ])
  if (access.error || assignment.error || access.status !== 200 || assignment.status !== 200) {
    return { status: access.error ? access.status : assignment.status, employeeId, roles: [] }
  }
  const roleIds = [...new Set([
    ...(access.data ?? []).map((row) => row.management_role_id),
    ...(assignment.data ?? []).map((row) => row.management_role_id),
  ].filter(Boolean))]
  if (roleIds.length === 0) return { status: 200, employeeId, roles: [] }
  const roleResult = await client.from('management_roles').select('code')
    .in('id', roleIds).eq('is_active', true).is('deleted_at', null)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`).limit(100)
  return {
    status: roleResult.status,
    employeeId,
    roles: roleResult.error ? [] : [...new Set((roleResult.data ?? []).map((row) => row.code))],
  }
}

async function createSession(persona, credential, url, key) {
  const cookieValues = new Map()
  const client = createServerClient(url, key, {
    cookieOptions: { secure: true, sameSite: 'lax' },
    cookies: {
      getAll: () => [...cookieValues.entries()].map(([name, value]) => ({ name, value })),
      setAll: (items) => items.forEach(({ name, value }) => cookieValues.set(name, value)),
    },
  })
  const signedIn = await client.auth.signInWithPassword({ email: credential.email, password: credential.password })
  if (signedIn.error || !signedIn.data.user || !signedIn.data.session) {
    record(`auth.${persona}`, false, signedIn.error?.status ?? 0)
    return null
  }
  const roles = await resolveRoles(client, signedIn.data.user.id)
  const rolePass = roles.status === 200 && roleMatchesPersona(persona, roles.roles)
  record(`persona.${persona}`, rolePass, roles.status)
  if (!rolePass) {
    await client.auth.signOut().catch(() => undefined)
    return null
  }

  cookieValues.set('liquid-hr-tenant', tenantId)
  cookieValues.set('liquid-hr-hr-group', hrGroupId)
  cookieValues.set('liquid-hr-administration', administrationId)
  const cookie = [...cookieValues.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
  record(`app-session.${persona}`, cookie.length > 0, 200)
  return { client, cookieValues, userId: signedIn.data.user.id, employeeId: roles.employeeId, roles: roles.roles, cookie }
}

function scopedRecords(client, table, projection) {
  return client.from(table).select(projection, { count: 'exact' })
    .eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).limit(1000)
}

async function filteredRows(client, table, projection, employeeId) {
  return client.from(table).select(projection, { count: 'exact' })
    .eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('employee_id', employeeId).limit(5)
}

async function listManagerTeam(cookie) {
  const response = await fetch(`${appUrl}/api/employees?status=active-future-external&scope=team`, {
    headers: { cookie }, cache: 'no-store', redirect: 'manual',
  })
  if (!response.ok) return { status: response.status, ids: [] }
  const payload = await response.json().catch(() => null)
  const rows = Array.isArray(payload?.data) ? payload.data : []
  const ids = rows.map((row) => row?.id ?? row?.employeeId).filter((id) => typeof id === 'string')
  return { status: response.status, ids }
}

async function targetApiStatus(cookie, employeeId) {
  try {
    const response = await fetch(`${appUrl}/api/employees/${encodeURIComponent(employeeId)}`, {
      headers: { cookie }, cache: 'no-store', redirect: 'manual',
    })
    await response.body?.cancel()
    return response.status
  } catch {
    return 0
  }
}

async function protectedColumn(client, table, column, employeeId) {
  const projection = table === 'employment_payroll_tax_profiles' ? `employee_id,${column}` : `employee_id,${column}`
  return client.from(table).select(projection)
    .eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('employee_id', employeeId).limit(1)
}

function choose(rows, predicate) {
  return rows.find((row) => predicate(row)) ?? null
}

async function runDataApiTests(sessions) {
  const employee = sessions['employee-only']
  const manager = sessions.manager
  const admin = sessions['tenant-admin']
  const profileList = await scopedRecords(admin.client, 'employment_payroll_tax_profiles', 'employee_id,administration_id')
  const auditList = await scopedRecords(admin.client, 'employment_payroll_tax_profile_audit', 'employee_id,administration_id')
  const listsPass = !profileList.error && !auditList.error && profileList.status === 200 && auditList.status === 200
  record('fixture-discovery.tenant-scope', listsPass, profileList.error ? profileList.status : auditList.status,
    (profileList.data?.length ?? 0) + (auditList.data?.length ?? 0))
  if (!listsPass) return

  const profiles = profileList.data ?? []
  const audits = auditList.data ?? []
  const employeeSelf = employee.employeeId
  const managerSelf = manager.employeeId
  const team = await listManagerTeam(manager.cookie)
  record('manager-team-scope', team.status === 200, team.status, team.ids.length)
  const teamIds = new Set(team.ids)
  const directProfile = choose(profiles, (row) => row.employee_id !== managerSelf && teamIds.has(row.employee_id))
  const directAudit = choose(audits, (row) => row.employee_id !== managerSelf && teamIds.has(row.employee_id))
  const peerProfile = choose(profiles, (row) => row.employee_id !== managerSelf && !teamIds.has(row.employee_id) && row.administration_id === administrationId)
  const peerAudit = choose(audits, (row) => row.employee_id !== managerSelf && !teamIds.has(row.employee_id) && row.administration_id === administrationId)
  const otherAdminProfile = choose(profiles, (row) => row.employee_id !== managerSelf && !teamIds.has(row.employee_id) && row.administration_id !== administrationId)
  const otherAdminAudit = choose(audits, (row) => row.employee_id !== managerSelf && !teamIds.has(row.employee_id) && row.administration_id !== administrationId)
  const employeeOtherProfile = choose(profiles, (row) => row.employee_id !== employeeSelf)
  const employeeOtherAudit = choose(audits, (row) => row.employee_id !== employeeSelf)

  if (employeeSelf) {
    rowCheck('employee.profile.self', await filteredRows(employee.client, 'employment_payroll_tax_profiles', 'employee_id,source_classification', employeeSelf), 'positive')
    const ownAudit = audits.some((row) => row.employee_id === employeeSelf)
    if (ownAudit) rowCheck('employee.audit.self', await filteredRows(employee.client, 'employment_payroll_tax_profile_audit', 'employee_id,action', employeeSelf), 'negative')
    else notTested('employee.audit.self', 'NO_EXISTING_AUDIT_FIXTURE')
  } else notTested('employee.profile.self', 'SELF_EMPLOYEE_LINK_UNAVAILABLE')
  if (employeeOtherProfile) rowCheck('employee.profile.other', await filteredRows(employee.client, 'employment_payroll_tax_profiles', 'employee_id', employeeOtherProfile.employee_id), 'negative')
  else notTested('employee.profile.other', 'NO_OTHER_PROFILE_FIXTURE')
  if (employeeOtherAudit) rowCheck('employee.audit.other-existing-row', await filteredRows(employee.client, 'employment_payroll_tax_profile_audit', 'employee_id,action', employeeOtherAudit.employee_id), 'negative')
  else notTested('employee.audit.other-existing-row', 'NO_OTHER_AUDIT_FIXTURE')

  const ownManagerProfile = profiles.some((row) => row.employee_id === managerSelf)
  if (ownManagerProfile) rowCheck('manager.profile.self-employee-right', await filteredRows(manager.client, 'employment_payroll_tax_profiles', 'employee_id,source_classification', managerSelf), 'positive')
  else notTested('manager.profile.self-employee-right', 'NO_MANAGER_SELF_PROFILE')
  if (audits.some((row) => row.employee_id === managerSelf)) rowCheck('manager.audit.self', await filteredRows(manager.client, 'employment_payroll_tax_profile_audit', 'employee_id,action', managerSelf), 'negative')
  else notTested('manager.audit.self', 'NO_MANAGER_SELF_AUDIT_FIXTURE')
  for (const [label, target] of [['direct-team', directProfile], ['peer', peerProfile], ['other-administration', otherAdminProfile]]) {
    if (target) rowCheck(`manager.profile.${label}`, await filteredRows(manager.client, 'employment_payroll_tax_profiles', 'employee_id', target.employee_id), 'negative')
    else notTested(`manager.profile.${label}`, 'NO_EXISTING_MATCHING_PROFILE_FIXTURE')
  }
  for (const [label, target] of [['direct-team', directAudit], ['peer', peerAudit], ['other-administration', otherAdminAudit]]) {
    if (target) rowCheck(`manager.audit.${label}`, await filteredRows(manager.client, 'employment_payroll_tax_profile_audit', 'employee_id,action', target.employee_id), 'negative')
    else notTested(`manager.audit.${label}`, 'NO_EXISTING_MATCHING_AUDIT_FIXTURE')
  }
  for (const [label, target] of [['peer', peerProfile], ['other-administration', otherAdminProfile]]) {
    if (target) {
      const status = await targetApiStatus(manager.cookie, target.employee_id)
      record(`manager.employee-scope.${label}`, isOutOfScopeHttpStatus(status), status)
    } else notTested(`manager.employee-scope.${label}`, 'NO_EXISTING_MATCHING_PROFILE_FIXTURE')
  }

  const adminProfile = choose(profiles, (row) => row.administration_id === administrationId)
  const adminAudit = choose(audits, (row) => row.administration_id === administrationId)
  if (adminProfile) rowCheck('tenant-admin.profile.in-scope', await filteredRows(admin.client, 'employment_payroll_tax_profiles', 'employee_id,source_classification', adminProfile.employee_id), 'positive')
  else notTested('tenant-admin.profile.in-scope', 'NO_EXISTING_IN-SCOPE_PROFILE')
  if (adminAudit) rowCheck('tenant-admin.audit.in-scope', await filteredRows(admin.client, 'employment_payroll_tax_profile_audit', 'employee_id,action', adminAudit.employee_id), 'positive')
  else notTested('tenant-admin.audit.in-scope', 'NO_EXISTING_IN-SCOPE_AUDIT')
  const adminOtherAdministration = choose(profiles, (row) => row.administration_id !== administrationId)
  if (adminOtherAdministration) rowCheck('tenant-admin.profile.other-administration-in-tenant', await filteredRows(admin.client, 'employment_payroll_tax_profiles', 'employee_id,source_classification', adminOtherAdministration.employee_id), 'positive')
  else notTested('tenant-admin.profile.other-administration-in-tenant', 'NO_EXISTING_IN-TENANT_OTHER-ADMIN_PROFILE')
  const adminOtherAdministrationAudit = choose(audits, (row) => row.administration_id !== administrationId)
  if (adminOtherAdministrationAudit) rowCheck('tenant-admin.audit.other-administration-in-tenant', await filteredRows(admin.client, 'employment_payroll_tax_profile_audit', 'employee_id,action', adminOtherAdministrationAudit.employee_id), 'positive')
  else notTested('tenant-admin.audit.other-administration-in-tenant', 'NO_EXISTING_IN-TENANT_OTHER-ADMIN_AUDIT')
  notTested('tenant-admin.other-tenant', 'NO_AUTHORIZED_OTHER-TENANT_FIXTURE')

  const columnTarget = employeeSelf ?? managerSelf ?? profiles[0]?.employee_id
  if (columnTarget) {
    for (const [label, session] of [['employee-only', employee], ['manager', manager], ['tenant-admin', admin]]) {
      for (const [table, column] of [
        ['employment_payroll_tax_profiles', 'source_reference'],
        ['employment_payroll_tax_profiles', 'idempotency_key'],
        ['employment_payroll_tax_profiles', 'confirmed_by_user_id'],
        ['employment_payroll_tax_profile_audit', 'actor_user_id'],
        ['employment_payroll_tax_profile_audit', 'request_key'],
      ]) {
        columnCheck(`${label}.column-denied.${table.endsWith('_audit') ? 'audit' : 'profile'}.${column}`,
          await protectedColumn(session.client, table, column, columnTarget))
      }
    }
  } else notTested('protected-column-matrix', 'NO_EXISTING_PROFILE_FIXTURE')
}

async function runHrAdminPayrollTests(admin) {
  const scenarios = [
    { type: 'EXTRA_PAID_HOURS', hours: '2' },
    { type: 'SALARY_INCREASE', percentage: '5' },
    { type: 'CONTRACT_HOURS', hoursPerWeek: '32' },
  ]
  for (const scenario of scenarios) {
    let response
    try {
      response = await fetch(`${appUrl}/api/hr-admin/employees/${encodeURIComponent(lisaEmployeeId)}/pro-forma`, {
        method: 'POST',
        headers: {
          cookie: admin.cookie,
          origin: appUrl,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(scenario),
        cache: 'no-store',
        redirect: 'manual',
      })
    } catch {
      record(`hr-admin.payroll.${scenario.type}`, false, 0)
      continue
    }
    const body = await response.json().catch(() => null)
    const calculated = response.ok && body?.status === 'CALCULATED' && body?.sourceStatus === 'READY'
    record(`hr-admin.payroll.${scenario.type}`, calculated, response.status)
  }
}

async function main() {
  const sessions = {}
  let credentials = null
  try {
    loadEnvConfig(appRoot)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!url || !key) {
      console.log(`BLOCKED config: ${!url ? 'NEXT_PUBLIC_SUPABASE_URL ' : ''}${!key ? 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY' : ''}`.trim())
      process.exitCode = 2
      return
    }
    let parsedUrl
    try { parsedUrl = new URL(url) } catch { parsedUrl = null }
    if (parsedUrl?.hostname !== `${projectRef}.supabase.co`) {
      console.log('BLOCKED config: Supabase URL is not the approved HR/Core TEST project')
      process.exitCode = 2
      return
    }

    credentials = await readStdinJson()
    const expected = ['employee-only', 'manager', 'tenant-admin']
    for (const persona of expected) {
      const credential = credentials?.[persona]
      if (!credential || typeof credential.email !== 'string' || typeof credential.password !== 'string' || !credential.password) {
        console.log(`BLOCKED credentials.${persona}`)
        process.exitCode = 2
        return
      }
      const session = await createSession(persona, credential, url, key)
      if (session) sessions[persona] = session
    }
    if (expected.some((persona) => !sessions[persona])) {
      console.log('OVERALL=BLOCKED; persona authentication or role verification failed')
      process.exitCode = 2
      return
    }
    await runDataApiTests(sessions)
    await runHrAdminPayrollTests(sessions['tenant-admin'])
    const failed = checks.filter((check) => !check.passed && !check.notTested).length
    const missing = checks.filter((check) => check.notTested).length
    console.log(`SUMMARY pass=${checks.length - failed - missing} fail=${failed} not_tested=${missing}`)
    console.log(`OVERALL=${failed === 0 && missing === 0 ? 'PASS' : failed === 0 ? 'PARTIAL' : 'FAIL'}`)
    process.exitCode = failed > 0 ? 1 : missing > 0 ? 2 : 0
  } finally {
    for (const session of Object.values(sessions)) {
      await session.client.auth.signOut().catch(() => undefined)
      session.cookieValues.clear()
      session.cookie = ''
      session.userId = ''
      session.employeeId = ''
      session.roles.length = 0
    }
    if (credentials && typeof credentials === 'object') {
      for (const credential of Object.values(credentials)) {
        if (credential && typeof credential === 'object') credential.password = ''
      }
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(() => {
    console.log('OVERALL=FAIL; runner encountered an unexpected error; no raw error details were emitted')
    process.exitCode = 1
  })
}
