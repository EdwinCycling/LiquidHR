import 'server-only'

import { requireAuthContext, requireHrGroupId, type AuthContext } from '@/lib/auth/permissions'
import type { ActiveContext } from '@/lib/context/administration-context'
import { loadActiveContext } from '@/lib/context/server-context'
import { listMyReminders, type ReminderItem } from '@/lib/reminders/reminder-service'
import { listDirectTeamEmployeeIds } from '@/lib/organization/team-scope'
import { createClient } from '@/lib/supabase/server'
import { getContinuousAppraisalSummary, type ContinuousAppraisalSummary } from '@/lib/continuous-appraisal/service'
import type { ServerPerformanceTrace } from '@/lib/performance/server-trace'
import type { Locale } from '@/lib/i18n/config'
import { listProcessWork } from '@/lib/process-automation/work-service'
import { loadTeamAvailability, type StartPageTeamAvailability } from './team-availability-service'
import { getUpcomingCalendarItems, type CalendarHeaderItem } from '@/lib/company-activities/service'
import { listJourneyProjectionsForContext } from '@/lib/journeys/projection-service'
import type { JourneyProjectionList } from '@/lib/journeys/projection-domain'
import { resolveStoredImageUrl } from '@/lib/storage/image-url'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface StartPageDependencies {
  supabase: SupabaseServerClient
  auth: AuthContext
  activeContext: ActiveContext
  locale?: Locale
  performance?: ServerPerformanceTrace
  journeyOnly?: boolean
  journeys?: JourneyProjectionList
}

export interface StartPageData {
  employeeId: string | null
  firstName: string | null
  tenantName: string
  administrationName: string | null
  isEmployeeOnly: boolean
  companyDocuments: number | null
  reminders: ReminderItem[]
  leaveAbsences: StartPageLeaveAbsences
  activeAbsenceItems: StartPageAbsenceItem[]
  activeAbsenceTotal: number
  upcomingEvents: StartPageEvent[]
  employeeCount: number | null
  recurringAbsenceCount: number | null
  longTermSickCount: number | null
  nextLeaveInDays: number | null
  nextHolidayInDays: number | null
  nextCompanyActivity: CalendarHeaderItem | null
  continuousAppraisal: ContinuousAppraisalSummary | null
  processWork: StartPageProcessWork | null
  teamAvailability: StartPageTeamAvailability | null
  canReadWorkforce: boolean
  workforceLinks: StartPageWorkforceLink[]
  isManager: boolean
  isHrAdmin: boolean
  canSwitchScope: boolean
  scope: StartPageScope
  canReportAbsence: boolean
  journeys: JourneyProjectionList
  journeyOnly: boolean
}

export type StartPageScope = 'team' | 'company'

export type StartPageWorkforceLinkId = 'nineGrid' | 'continuousAppraisal' | 'talentProfiles' | 'starPerformers' | 'starPerformerTags'

export interface StartPageWorkforceLink {
  id: StartPageWorkforceLinkId
  href: string
}

export interface StartPageLeavePerson {
  employeeId: string
  employeeName: string
  avatarUrl: string | null
}

export interface StartPageLeaveAbsences {
  today: StartPageLeavePerson[]
  tomorrow: StartPageLeavePerson[]
}

export interface StartPageAbsenceItem {
  caseId: string
  employeeId: string
  employeeName: string
  avatarUrl: string | null
  firstAbsenceOn: string
  status: 'ACTIVE' | 'RECOVERY_WINDOW'
  absencePercentage: number | null
  days: number
}

export interface StartPageEvent {
  id: string
  type: 'BIRTHDAY' | 'ANNIVERSARY' | 'STARTER'
  date: string
  employeeId: string
  employeeName: string
  years: number | null
}

export interface StartPageProcessWorkItem {
  workItemId: string
  processTitle: string
  stepTitle: string
  subjectName: string | null
  deadlineAt: string | null
  isOverdue: boolean
  isBlocked: boolean
}

export interface StartPageProcessWork {
  total: number
  overdueCount: number
  dueTodayCount: number
  blockedCount: number
  items: StartPageProcessWorkItem[]
  blockers: StartPageProcessWorkItem[]
}

interface StartPageCountdowns {
  nextLeaveInDays: number | null
  nextHolidayInDays: number | null
  nextCompanyActivity: CalendarHeaderItem | null
}

type StartPageEmployeeScope = string[] | null

function listStartPageWorkforceLinks(permissions: string[], personalOnly: boolean): StartPageWorkforceLink[] {
  const links: StartPageWorkforceLink[] = []
  if (personalOnly) {
    if (permissions.includes('self:continuous-appraisal:read')) links.push({ id: 'continuousAppraisal', href: '/my-appraisal' })
    if (permissions.includes('self:talent:read')) links.push({ id: 'talentProfiles', href: '/my-talent' })
    return links
  }
  if (permissions.includes('talent-review:read')) links.push({ id: 'nineGrid', href: '/workforce/9-grid' })
  if (permissions.includes('continuous-appraisal:read')) links.push({ id: 'continuousAppraisal', href: '/workforce/continuous-appraisal' })
  if (permissions.includes('talent:manager-read')) links.push({ id: 'talentProfiles', href: '/workforce/talent' })
  if (permissions.includes('star-performer:read')) {
    links.push({ id: 'starPerformers', href: '/workforce/star-performers' })
    links.push({ id: 'starPerformerTags', href: '/workforce/star-performer-tags' })
  }
  return links
}

function daysUntilDate(targetDate: string, baseDate: string): number | null {
  const [targetYear, targetMonth, targetDay] = targetDate.split('-').map(Number)
  const [baseYear, baseMonth, baseDay] = baseDate.split('-').map(Number)
  if (![targetYear, targetMonth, targetDay, baseYear, baseMonth, baseDay].every(Number.isFinite)) return null
  const target = Date.UTC(targetYear, targetMonth - 1, targetDay)
  const base = Date.UTC(baseYear, baseMonth - 1, baseDay)
  if (!Number.isFinite(target) || !Number.isFinite(base)) return null
  return Math.max(0, Math.round((target - base) / 86_400_000))
}

async function getStartPageCountdowns(auth: AuthContext, supabase: SupabaseServerClient): Promise<StartPageCountdowns> {
  const empty: StartPageCountdowns = { nextLeaveInDays: null, nextHolidayInDays: null, nextCompanyActivity: null }
  if (!auth.administrationId && !auth.hrGroupId) return empty

  const today = new Date().toISOString().slice(0, 10)
  const [leaveResult, calendarItems] = await Promise.all([
    auth.employeeId && auth.administrationId && auth.permissions.includes('leave:read')
      ? supabase.from('leave_requests').select('start_date').eq('tenant_id', auth.tenantId).eq('administration_id', auth.administrationId).eq('employee_id', auth.employeeId).eq('status', 'APPROVED').gte('start_date', today).order('start_date', { ascending: true }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    getUpcomingCalendarItems(auth, supabase),
  ])

  return {
    nextLeaveInDays: leaveResult.error || !leaveResult.data ? null : daysUntilDate(leaveResult.data.start_date, today),
    nextHolidayInDays: calendarItems.holiday ? daysUntilDate(calendarItems.holiday.date, today) : null,
    nextCompanyActivity: calendarItems.companyActivity,
  }
}

async function listLeaveAbsences(auth: AuthContext, employeeScope: StartPageEmployeeScope, supabase: SupabaseServerClient): Promise<StartPageLeaveAbsences> {
  const empty: StartPageLeaveAbsences = { today: [], tomorrow: [] }
  if (!auth.permissions.includes('leave:read')) return empty
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const todayStr = today.toISOString().slice(0, 10)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  async function queryDay(dateStr: string): Promise<StartPageLeavePerson[]> {
    let query = supabase.from('leave_requests').select('employee_id').eq('tenant_id', auth.tenantId).eq('status', 'APPROVED').lte('start_date', dateStr).gte('end_date', dateStr)
    if (auth.administrationId) query = query.eq('administration_id', auth.administrationId)
    if (employeeScope !== null) {
      if (employeeScope.length === 0) return []
      query = query.in('employee_id', employeeScope)
    }
    const { data, error } = await query.limit(200)
    if (error || !data?.length) return []
    const employeeIds = [...new Set(data.map((row) => row.employee_id))]
    const { data: employees, error: empError } = await supabase.from('employees').select('id, first_name, birth_name, avatar_url').eq('tenant_id', auth.tenantId).in('id', employeeIds).is('deleted_at', null)
    if (empError || !employees) return []
    return employees.map((employee) => ({ employeeId: employee.id, employeeName: [employee.first_name, employee.birth_name].filter((p): p is string => Boolean(p?.trim())).join(' ').trim() || 'Onbekend', avatarUrl: resolveStoredImageUrl(employee.avatar_url, { kind: 'employee-avatar', employeeId: employee.id }) }))
  }

  const [todayResult, tomorrowResult] = await Promise.all([queryDay(todayStr), queryDay(tomorrowStr)])
  return { today: todayResult, tomorrow: tomorrowResult }
}

function absenceDaysSince(firstAbsenceOn: string, today: Date): number {
  const firstDate = new Date(`${firstAbsenceOn}T00:00:00Z`)
  return Math.max(1, Math.floor((today.getTime() - firstDate.getTime()) / 86_400_000) + 1)
}

async function listActiveAbsences(auth: AuthContext, employeeScope: StartPageEmployeeScope, supabase: SupabaseServerClient): Promise<{ items: StartPageAbsenceItem[]; total: number; longTermCount: number }> {
  if (!auth.permissions.includes('absence:read')) return { items: [], total: 0, longTermCount: 0 }
  const hrGroupId = requireHrGroupId(auth)
  let query = supabase.from('absence_cases')
    .select('id, employee_id, first_absence_on, status', { count: 'exact' })
    .eq('tenant_id', auth.tenantId)
    .eq('hr_group_id', hrGroupId)
    .in('status', ['ACTIVE', 'RECOVERY_WINDOW'])
    .is('archived_at', null)
    .order('first_absence_on', { ascending: false })
    .limit(10000)
  if (employeeScope !== null) {
    if (employeeScope.length === 0) return { items: [], total: 0, longTermCount: 0 }
    query = query.in('employee_id', employeeScope)
  }
  const { data: cases, count: total, error } = await query
  if (error || !cases?.length) return { items: [], total: total ?? 0, longTermCount: 0 }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const longTermCount = cases.filter((item) => absenceDaysSince(item.first_absence_on, today) >= 14).length
  const displayCases = cases.slice(0, 5)
  const displayCaseIds = displayCases.map((item) => item.id)
  const employeeIds = [...new Set(displayCases.map((item) => item.employee_id))]
  const { data: employees, error: employeeError } = await supabase.from('employees')
    .select('id, first_name, birth_name, avatar_url')
    .eq('tenant_id', auth.tenantId)
    .in('id', employeeIds)
  if (employeeError) return { items: [], total: total ?? 0, longTermCount }
  const { data: spells, error: spellError } = await supabase.from('absence_spells')
    .select('id, case_id, started_on, recovered_on')
    .eq('tenant_id', auth.tenantId)
    .eq('hr_group_id', hrGroupId)
    .in('case_id', displayCaseIds)
    .order('started_on', { ascending: false })
    .limit(10000)
  if (spellError) return { items: [], total: total ?? 0, longTermCount }
  const spellIds = (spells ?? []).map((spell) => spell.id)
  const todayString = today.toISOString().slice(0, 10)
  const { data: capacities, error: capacityError } = spellIds.length
    ? await supabase.from('absence_capacity_changes')
      .select('spell_id, effective_on, absence_percentage')
      .eq('tenant_id', auth.tenantId)
      .eq('hr_group_id', hrGroupId)
      .in('spell_id', spellIds)
      .lte('effective_on', todayString)
      .order('effective_on', { ascending: false })
      .limit(10000)
    : { data: [], error: null }
  if (capacityError) return { items: [], total: total ?? 0, longTermCount }
  const employeeMap = new Map((employees ?? []).map((employee) => [employee.id, employee]))
  const spellByCase = new Map<string, (typeof spells)[number]>()
  for (const spell of spells ?? []) if (!spellByCase.has(spell.case_id)) spellByCase.set(spell.case_id, spell)
  const capacityBySpell = new Map<string, number>()
  for (const capacity of capacities ?? []) if (!capacityBySpell.has(capacity.spell_id)) capacityBySpell.set(capacity.spell_id, capacity.absence_percentage)
  const items = displayCases.flatMap((item) => {
    const employee = employeeMap.get(item.employee_id)
    if (!employee) return []
    const employeeName = [employee.first_name, employee.birth_name].filter((part): part is string => Boolean(part?.trim())).join(' ').trim()
    const spell = spellByCase.get(item.id)
    return [{ caseId: item.id, employeeId: item.employee_id, employeeName: employeeName || 'Onbekende medewerker', avatarUrl: resolveStoredImageUrl(employee.avatar_url, { kind: 'employee-avatar', employeeId: employee.id }), firstAbsenceOn: item.first_absence_on, status: item.status as 'ACTIVE' | 'RECOVERY_WINDOW', absencePercentage: spell ? capacityBySpell.get(spell.id) ?? null : null, days: absenceDaysSince(item.first_absence_on, today) }]
  })
  items.sort((a, b) => a.days - b.days)
  return { items, total: total ?? 0, longTermCount }
}

async function countCompanyDocuments(auth: AuthContext, supabase: SupabaseServerClient): Promise<number | null> {
  const query = supabase.from('company_documents').select('id', { count: 'exact', head: true })
    .eq('tenant_id', auth.tenantId).eq('hr_group_id', auth.hrGroupId ?? '').is('deleted_at', null)
  const { count, error } = await query
  return error ? null : count ?? 0
}

function nextAnnualDate(source: string, startDate: string, endDate: string): string | null {
  const [, month, day] = source.split('-').map(Number)
  if (!month || !day) return null
  const startYear = Number(startDate.slice(0, 4))
  for (const year of [startYear, startYear + 1]) {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const candidate = `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
    if (candidate >= startDate && candidate <= endDate) return candidate
  }
  return null
}

async function listUpcomingEvents(auth: AuthContext, employeeScope: StartPageEmployeeScope, supabase: SupabaseServerClient): Promise<StartPageEvent[]> {
  if (!auth.permissions.includes('employee:read') || !auth.administrationId) return []
  if (employeeScope !== null && employeeScope.length === 0) return []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  // Als morgen weekend is, toon dan maandag
  const endDay = new Date(tomorrow)
  if (endDay.getDay() === 6) endDay.setDate(endDay.getDate() + 2)
  else if (endDay.getDay() === 0) endDay.setDate(endDay.getDate() + 1)
  const startDate = today.toISOString().slice(0, 10)
  const endDate = endDay.toISOString().slice(0, 10)

  let employmentsQuery = supabase.from('employments')
    .select('id, employee_id, starts_on, seniority_date, is_primary')
    .eq('tenant_id', auth.tenantId).eq('administration_id', auth.administrationId)
    .eq('record_status', 'CONFIRMED').is('deleted_at', null)
    .lte('starts_on', endDate).or(`ends_on.is.null,ends_on.gte.${startDate}`)
  if (employeeScope !== null) employmentsQuery = employmentsQuery.in('employee_id', employeeScope)
  const { data: employments, error: empError } = await employmentsQuery.limit(2000)
  if (empError || !employments?.length) return []

  const employeeIds = [...new Set(employments.map((e) => e.employee_id))]
  const { data: employees, error: employeesError } = await supabase.from('employees')
    .select('id, first_name, birth_name_prefix, birth_name, birth_date')
    .eq('tenant_id', auth.tenantId).in('id', employeeIds).is('deleted_at', null).limit(2000)
  if (employeesError || !employees) return []
  const employeeById = new Map(employees.map((e) => [e.id, e]))

  const { data: anniversaryRules } = await supabase.from('tenant_anniversary_rules')
    .select('years').eq('tenant_id', auth.tenantId).eq('is_active', true).order('years').limit(100)

  const selectedEmploymentByEmployee = new Map<string, typeof employments[number]>()
  for (const employment of employments) {
    const current = selectedEmploymentByEmployee.get(employment.employee_id)
    if (!current || (employment.is_primary && !current.is_primary) || employment.starts_on > current.starts_on) selectedEmploymentByEmployee.set(employment.employee_id, employment)
  }

  const events: StartPageEvent[] = []
  for (const employment of selectedEmploymentByEmployee.values()) {
    const employee = employeeById.get(employment.employee_id)
    if (!employee) continue
    const employeeName = [employee.first_name, employee.birth_name_prefix, employee.birth_name].filter(Boolean).join(' ')
    if (employee.birth_date) {
      const date = nextAnnualDate(employee.birth_date, startDate, endDate)
      if (date) events.push({ id: `birthday-${employment.id}-${date}`, type: 'BIRTHDAY', date, employeeId: employee.id, employeeName, years: Number(date.slice(0, 4)) - Number(employee.birth_date.slice(0, 4)) })
    }
    if (anniversaryRules) {
      for (const rule of anniversaryRules) {
        const anniversaryYear = Number(employment.seniority_date.slice(0, 4)) + rule.years
        const [, month, day] = employment.seniority_date.split('-').map(Number)
        if (!month || !day) continue
        const lastDay = new Date(Date.UTC(anniversaryYear, month, 0)).getUTCDate()
        const date = `${anniversaryYear}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
        if (date >= startDate && date <= endDate) events.push({ id: `anniversary-${employment.id}-${rule.years}`, type: 'ANNIVERSARY', date, employeeId: employee.id, employeeName, years: rule.years })
      }
    }
    if (employment.starts_on >= startDate && employment.starts_on <= endDate) events.push({ id: `starter-${employment.id}`, type: 'STARTER', date: employment.starts_on, employeeId: employee.id, employeeName, years: null })
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.employeeName.localeCompare(b.employeeName, 'nl'))
}

async function countEmployees(auth: AuthContext, employeeScope: StartPageEmployeeScope, supabase: SupabaseServerClient): Promise<number | null> {
  if (!auth.permissions.includes('employee:read')) return null
  if (employeeScope !== null && employeeScope.length === 0) return 0
  if (!auth.hrGroupId) return 0
  const today = new Date().toISOString().slice(0, 10)
  let employeeQuery = supabase.from('employees').select('id')
    .eq('tenant_id', auth.tenantId)
    .eq('hr_group_id', auth.hrGroupId)
    .eq('is_archived', false)
    .is('deleted_at', null)
  let employmentQuery = supabase.from('employments').select('employee_id')
    .eq('tenant_id', auth.tenantId)
    .eq('hr_group_id', auth.hrGroupId)
    .neq('record_status', 'CANCELLED')
    .lte('starts_on', today)
    .or(`ends_on.is.null,ends_on.gte.${today}`)
    .is('deleted_at', null)
  if (employeeScope !== null) {
    employeeQuery = employeeQuery.in('id', employeeScope)
    employmentQuery = employmentQuery.in('employee_id', employeeScope)
  }
  const [employeesResult, employmentsResult] = await Promise.all([
    employeeQuery.limit(10000),
    employmentQuery.limit(10000),
  ])
  if (employeesResult.error || employmentsResult.error) return null
  const activeEmployeeIds = new Set((employeesResult.data ?? []).map((employee) => employee.id))
  const employeesWithActiveEmployment = new Set<string>()
  for (const employment of employmentsResult.data ?? []) {
    if (activeEmployeeIds.has(employment.employee_id)) employeesWithActiveEmployment.add(employment.employee_id)
  }
  return employeesWithActiveEmployment.size
}

async function countRecurringAbsence(auth: AuthContext, employeeScope: StartPageEmployeeScope, supabase: SupabaseServerClient): Promise<number | null> {
  if (!auth.permissions.includes('absence:read')) return null
  if (employeeScope !== null && employeeScope.length === 0) return 0
  const hrGroupId = requireHrGroupId(auth)
  // Medewerkers met meer dan 1 verzuimcasus (recurring)
  let query = supabase.from('absence_cases').select('employee_id')
    .eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).is('archived_at', null)
  if (employeeScope !== null) query = query.in('employee_id', employeeScope)
  const { data, error } = await query.limit(10000)
  if (error || !data) return null
  const counts = new Map<string, number>()
  for (const row of data) counts.set(row.employee_id, (counts.get(row.employee_id) ?? 0) + 1)
  return [...counts.values()].filter((count) => count > 1).length
}

async function getStartPageContinuousAppraisal(dependencies: { context: AuthContext; supabase: SupabaseServerClient }): Promise<ContinuousAppraisalSummary | null> {
  try {
    return await getContinuousAppraisalSummary(dependencies)
  } catch {
    // De startpagina blijft beschikbaar zolang de optionele module nog niet is geactiveerd.
    return null
  }
}

async function getStartPageProcessWork(auth: AuthContext, supabase: SupabaseServerClient, locale: Locale): Promise<StartPageProcessWork | null> {
  if (!auth.hrGroupId || !auth.permissions.some((permission) => ['process-task:read', 'self:process-task:read', 'process-instance:read', 'self:process-instance:read'].includes(permission))) return null
  try {
    const request = { administrationId: auth.administrationId ?? undefined, language: locale, limit: 100, sort: 'DEADLINE' as const }
    const [work, blockedWork] = await Promise.all([
      listProcessWork({ ...request, tab: 'TODO' }, { context: auth, supabase }),
      listProcessWork({ ...request, tab: 'ALL', status: 'BLOCKED' }, { context: auth, supabase }),
    ])
    const today = new Date().toISOString().slice(0, 10)
    const mapItem = (item: Awaited<ReturnType<typeof listProcessWork>>['items'][number], isBlocked: boolean): StartPageProcessWorkItem => ({
      workItemId: item.workItemId,
      processTitle: item.processTitle,
      stepTitle: item.stepTitle,
      subjectName: item.subjectName,
      deadlineAt: item.deadlineAt,
      isOverdue: item.isOverdue,
      isBlocked,
    })
    return {
      total: work.total,
      overdueCount: work.items.filter((item) => item.isOverdue).length,
      dueTodayCount: work.items.filter((item) => item.deadlineAt?.slice(0, 10) === today && !item.isOverdue).length,
      blockedCount: blockedWork.total,
      items: work.items.slice(0, 4).map((item) => mapItem(item, false)),
      blockers: blockedWork.items.slice(0, 4).map((item) => mapItem(item, true)),
    }
  } catch {
    // Een ontbrekende procesrechten- of bronconfiguratie mag de startpagina niet breken.
    return null
  }
}

export async function getStartPageData(requestedScope?: StartPageScope, dependencies?: StartPageDependencies): Promise<StartPageData> {
  const supabase = dependencies?.supabase ?? await createClient()
  const auth = dependencies?.auth ?? await requireAuthContext(supabase)
  const context = dependencies?.activeContext ?? await loadActiveContext(auth.userId, supabase)
  if (dependencies?.journeyOnly) {
    const employee = auth.employeeId
      ? await supabase.from('employees').select('first_name').eq('id', auth.employeeId).eq('tenant_id', auth.tenantId).maybeSingle()
      : { data: null }
    return {
      employeeId: auth.employeeId,
      firstName: employee.data?.first_name?.trim() || null,
      tenantName: context.tenant.name,
      administrationName: context.activeAdministration?.name ?? null,
      isEmployeeOnly: true,
      companyDocuments: null,
      reminders: [],
      leaveAbsences: { today: [], tomorrow: [] },
      activeAbsenceItems: [],
      activeAbsenceTotal: 0,
      upcomingEvents: [],
      employeeCount: null,
      recurringAbsenceCount: null,
      longTermSickCount: null,
      nextLeaveInDays: null,
      nextHolidayInDays: null,
      nextCompanyActivity: null,
      continuousAppraisal: null,
      processWork: null,
      teamAvailability: null,
      canReadWorkforce: false,
      workforceLinks: [],
      isManager: false,
      isHrAdmin: false,
      canSwitchScope: false,
      scope: 'company',
      canReportAbsence: false,
      journeys: dependencies.journeys ?? [],
      journeyOnly: true,
    }
  }
  const performanceTrace = dependencies?.performance
  const measure = <T>(label: string, operation: () => Promise<T>): Promise<T> => performanceTrace ? performanceTrace.measure(label, operation) : operation()
  const isEmployeeOnly = !auth.permissions.includes('start-page:read')
  const personalOnly = auth.employeeId !== null && !auth.permissions.includes('workforce:read')
  const isManager = auth.activeRoles.includes('DIRECT_MANAGER')
  const isHrAdmin = auth.activeRoles.includes('TENANT_ADMIN')
  const canSwitchScope = isManager && isHrAdmin
  const scope: StartPageScope = isManager ? (isHrAdmin && requestedScope === 'company' ? 'company' : 'team') : 'company'
  // Start the team-scope lookup together with the independent startpage reads.
  // Scope-dependent reads await this shared promise without creating a separate
  // auth/client waterfall for every branch.
  const employeeScopePromise: Promise<StartPageEmployeeScope> = scope === 'team'
    ? measure('scope.team', () => listDirectTeamEmployeeIds(auth, supabase))
    : Promise.resolve(null)
  const managerTeamEmployeeIdsPromise = isManager && scope === 'team'
    ? employeeScopePromise.then((employeeScope) => employeeScope ?? [])
    : Promise.resolve([])
  const workforceLinks = listStartPageWorkforceLinks(auth.permissions, personalOnly)
  const employeePromise = auth.employeeId
    ? Promise.resolve(supabase.from('employees').select('first_name').eq('id', auth.employeeId).eq('tenant_id', auth.tenantId).maybeSingle())
    : Promise.resolve(null)

  const [employee, leaveAbsences, absenceResult, companyDocuments, reminders, upcomingEvents, employeeCount, recurringAbsenceCount, countdowns, continuousAppraisal, processWork, teamAvailability, journeys] = await measure('data.parallel', () => Promise.all([
    measure('employee', () => employeePromise),
    employeeScopePromise.then((employeeScope) => measure('leave', () => listLeaveAbsences(auth, employeeScope, supabase))),
    employeeScopePromise.then((employeeScope) => measure('absence', () => listActiveAbsences(auth, employeeScope, supabase))),
    measure('companyDocuments', () => countCompanyDocuments(auth, supabase)),
    measure('reminders', () => listMyReminders(8, { context: auth, supabase }).catch(() => [])),
    employeeScopePromise.then((employeeScope) => measure('events', () => listUpcomingEvents(auth, employeeScope, supabase))),
    employeeScopePromise.then((employeeScope) => measure('employeeCount', () => countEmployees(auth, employeeScope, supabase))),
    employeeScopePromise.then((employeeScope) => measure('recurringAbsence', () => countRecurringAbsence(auth, employeeScope, supabase))),
    measure('countdowns', () => getStartPageCountdowns(auth, supabase)),
    measure('continuousAppraisal', () => getStartPageContinuousAppraisal({ context: auth, supabase })),
    measure('processWork', () => getStartPageProcessWork(auth, supabase, dependencies?.locale ?? 'nl')),
    isManager && scope === 'team'
      ? managerTeamEmployeeIdsPromise.then((managerTeamEmployeeIds) => measure('teamAvailability', () => loadTeamAvailability(auth, managerTeamEmployeeIds, supabase)))
      : Promise.resolve(null),
    measure('journeys', () => auth.hrGroupId
      ? listJourneyProjectionsForContext(supabase, auth).catch((): JourneyProjectionList => [])
      : Promise.resolve<JourneyProjectionList>([])),
  ]))

  return {
    employeeId: auth.employeeId,
    firstName: employee?.data?.first_name?.trim() || null,
    tenantName: context.tenant.name,
    administrationName: context.activeAdministration?.name ?? null,
    isEmployeeOnly,
    companyDocuments,
    reminders: reminders.filter((reminder) => reminder.recipientStatus === 'PENDING' && reminder.reminderStatus === 'PUBLISHED'),
    leaveAbsences,
    activeAbsenceItems: absenceResult.items,
    activeAbsenceTotal: absenceResult.total,
    upcomingEvents,
    employeeCount,
    recurringAbsenceCount,
    longTermSickCount: absenceResult.longTermCount,
    nextLeaveInDays: countdowns.nextLeaveInDays,
    nextHolidayInDays: countdowns.nextHolidayInDays,
    nextCompanyActivity: countdowns.nextCompanyActivity,
    continuousAppraisal,
    processWork,
    teamAvailability,
    canReadWorkforce: auth.permissions.includes('workforce:read') || workforceLinks.length > 0,
    workforceLinks,
    isManager,
    isHrAdmin,
    canSwitchScope,
    scope,
    canReportAbsence: auth.permissions.includes('absence:write'),
    journeys,
    journeyOnly: false,
  }
}
