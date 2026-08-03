import 'server-only'

import { requireAuthContext, type AuthContext } from '@/lib/auth/permissions'
import { loadActiveContext } from '@/lib/context/server-context'
import { listMyReminders, type ReminderItem } from '@/lib/reminders/reminder-service'
import { createClient } from '@/lib/supabase/server'
import { FALLBACK_WEATHER_LOCATION, getWorkWeather, type WorkWeather } from '@/lib/weather/open-meteo'
import { getContinuousAppraisalSummary, type ContinuousAppraisalSummary } from '@/lib/continuous-appraisal/service'

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
  workWeather: WorkWeather | null
  homeWeather: WorkWeather | null
  nextLeaveInDays: number | null
  nextHolidayInDays: number | null
  continuousAppraisal: ContinuousAppraisalSummary | null
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

interface StartPageCountdowns {
  nextLeaveInDays: number | null
  nextHolidayInDays: number | null
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

async function getStartPageCountdowns(auth: AuthContext): Promise<StartPageCountdowns> {
  const empty: StartPageCountdowns = { nextLeaveInDays: null, nextHolidayInDays: null }
  if (!auth.administrationId) return empty

  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const [leaveResult, holidayResult] = await Promise.all([
    auth.employeeId && auth.permissions.includes('leave:read')
      ? supabase.from('leave_requests').select('start_date').eq('tenant_id', auth.tenantId).eq('administration_id', auth.administrationId).eq('employee_id', auth.employeeId).eq('status', 'APPROVED').gte('start_date', today).order('start_date', { ascending: true }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    auth.permissions.includes('holidays:read')
      ? supabase.from('holidays').select('holiday_date').eq('tenant_id', auth.tenantId).eq('administration_id', auth.administrationId).eq('is_active', true).gte('holiday_date', today).order('holiday_date', { ascending: true }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  return {
    nextLeaveInDays: leaveResult.error || !leaveResult.data ? null : daysUntilDate(leaveResult.data.start_date, today),
    nextHolidayInDays: holidayResult.error || !holidayResult.data ? null : daysUntilDate(holidayResult.data.holiday_date, today),
  }
}

async function listLeaveAbsences(auth: AuthContext): Promise<StartPageLeaveAbsences> {
  const empty: StartPageLeaveAbsences = { today: [], tomorrow: [] }
  if (!auth.permissions.includes('leave:read')) return empty
  const supabase = await createClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const todayStr = today.toISOString().slice(0, 10)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  async function queryDay(dateStr: string): Promise<StartPageLeavePerson[]> {
    let query = supabase.from('leave_requests').select('employee_id').eq('tenant_id', auth.tenantId).eq('status', 'APPROVED').lte('start_date', dateStr).gte('end_date', dateStr)
    if (auth.administrationId) query = query.eq('administration_id', auth.administrationId)
    const { data, error } = await query.limit(200)
    if (error || !data?.length) return []
    const employeeIds = [...new Set(data.map((row) => row.employee_id))]
    const { data: employees, error: empError } = await supabase.from('employees').select('id, first_name, birth_name, avatar_url').eq('tenant_id', auth.tenantId).in('id', employeeIds).is('deleted_at', null)
    if (empError || !employees) return []
    return employees.map((employee) => ({ employeeId: employee.id, employeeName: [employee.first_name, employee.birth_name].filter((p): p is string => Boolean(p?.trim())).join(' ').trim() || 'Onbekend', avatarUrl: employee.avatar_url }))
  }

  const [todayResult, tomorrowResult] = await Promise.all([queryDay(todayStr), queryDay(tomorrowStr)])
  return { today: todayResult, tomorrow: tomorrowResult }
}

async function listActiveAbsences(auth: AuthContext): Promise<{ items: StartPageAbsenceItem[]; total: number }> {
  if (!auth.permissions.includes('absence:read')) return { items: [], total: 0 }
  const supabase = await createClient()
  let countQuery = supabase.from('absence_cases').select('id', { count: 'exact', head: true })
    .eq('tenant_id', auth.tenantId).in('status', ['ACTIVE', 'RECOVERY_WINDOW']).is('archived_at', null)
  if (auth.administrationId) countQuery = countQuery.eq('administration_id', auth.administrationId)
  const { count: total } = await countQuery

  let query = supabase.from('absence_cases')
    .select('id, employee_id, first_absence_on, status')
    .eq('tenant_id', auth.tenantId)
    .in('status', ['ACTIVE', 'RECOVERY_WINDOW'])
    .is('archived_at', null)
    .order('first_absence_on', { ascending: false })
    .limit(5)
  if (auth.administrationId) query = query.eq('administration_id', auth.administrationId)
  const { data: cases, error } = await query
  if (error || !cases?.length) return { items: [], total: total ?? 0 }
  const employeeIds = [...new Set(cases.map((item) => item.employee_id))]
  const { data: employees, error: employeeError } = await supabase.from('employees')
    .select('id, first_name, birth_name, avatar_url')
    .eq('tenant_id', auth.tenantId)
    .in('id', employeeIds)
  if (employeeError) return { items: [], total: total ?? 0 }
  const employeeMap = new Map((employees ?? []).map((employee) => [employee.id, employee]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const items = cases.flatMap((item) => {
    const employee = employeeMap.get(item.employee_id)
    if (!employee) return []
    const firstDate = new Date(`${item.first_absence_on}T00:00:00Z`)
    const days = Math.max(1, Math.floor((today.getTime() - firstDate.getTime()) / 86_400_000) + 1)
    const employeeName = [employee.first_name, employee.birth_name].filter((part): part is string => Boolean(part?.trim())).join(' ').trim()
    return [{ caseId: item.id, employeeId: item.employee_id, employeeName: employeeName || 'Onbekende medewerker', avatarUrl: employee.avatar_url, firstAbsenceOn: item.first_absence_on, status: item.status as 'ACTIVE' | 'RECOVERY_WINDOW', days }]
  })
  items.sort((a, b) => a.days - b.days)
  return { items, total: total ?? 0 }
}

async function countCompanyDocuments(auth: AuthContext): Promise<number | null> {
  const supabase = await createClient()
  let query = supabase.from('company_documents').select('id', { count: 'exact', head: true })
    .eq('tenant_id', auth.tenantId).is('deleted_at', null)
  if (auth.administrationId) query = query.eq('administration_id', auth.administrationId)
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

async function listUpcomingEvents(auth: AuthContext): Promise<StartPageEvent[]> {
  if (!auth.permissions.includes('employee:read') || !auth.administrationId) return []
  const supabase = await createClient()
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

  const { data: employments, error: empError } = await supabase.from('employments')
    .select('id, employee_id, starts_on, seniority_date, is_primary')
    .eq('tenant_id', auth.tenantId).eq('administration_id', auth.administrationId)
    .eq('record_status', 'CONFIRMED').is('deleted_at', null)
    .lte('starts_on', endDate).or(`ends_on.is.null,ends_on.gte.${startDate}`).limit(2000)
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

async function countEmployees(auth: AuthContext): Promise<number | null> {
  if (!auth.permissions.includes('employee:read')) return null
  const supabase = await createClient()
  let query = supabase.from('employees').select('id', { count: 'exact', head: true })
    .eq('tenant_id', auth.tenantId).eq('is_active', true).eq('is_archived', false).is('deleted_at', null)
  if (auth.administrationId) {
    const today = new Date().toISOString().slice(0, 10)
    const { data: assignments } = await supabase.from('employee_administration_assignments').select('employee_id')
      .eq('tenant_id', auth.tenantId).eq('administration_id', auth.administrationId)
      .lte('effective_from', today).or(`effective_to.is.null,effective_to.gte.${today}`).limit(10000)
    const employeeIds = [...new Set((assignments ?? []).map((a) => a.employee_id))]
    if (employeeIds.length === 0) return 0
    query = query.in('id', employeeIds)
  }
  const { count, error } = await query
  return error ? null : count ?? 0
}

async function countRecurringAbsence(auth: AuthContext): Promise<number | null> {
  if (!auth.permissions.includes('absence:read')) return null
  const supabase = await createClient()
  // Medewerkers met meer dan 1 verzuimcasus (recurring)
  let query = supabase.from('absence_cases').select('employee_id')
    .eq('tenant_id', auth.tenantId).is('archived_at', null)
  if (auth.administrationId) query = query.eq('administration_id', auth.administrationId)
  const { data, error } = await query.limit(10000)
  if (error || !data) return null
  const counts = new Map<string, number>()
  for (const row of data) counts.set(row.employee_id, (counts.get(row.employee_id) ?? 0) + 1)
  return [...counts.values()].filter((count) => count > 1).length
}

async function countLongTermSick(auth: AuthContext): Promise<number | null> {
  if (!auth.permissions.includes('absence:read')) return null
  const supabase = await createClient()
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  const cutoff = twoWeeksAgo.toISOString().slice(0, 10)
  let query = supabase.from('absence_cases').select('id', { count: 'exact', head: true })
    .eq('tenant_id', auth.tenantId).eq('status', 'ACTIVE').is('archived_at', null)
    .lte('first_absence_on', cutoff)
  if (auth.administrationId) query = query.eq('administration_id', auth.administrationId)
  const { count, error } = await query
  return error ? null : count ?? 0
}

async function getStartPageWorkWeather(auth: AuthContext): Promise<WorkWeather | null> {
  const fallbackWeather = () => getWorkWeather(FALLBACK_WEATHER_LOCATION)
  if (!auth.administrationId) return fallbackWeather()
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const [companyResult, assignmentResult] = await Promise.all([
    supabase.from('administration_company_data').select('city, country_code').eq('tenant_id', auth.tenantId).eq('administration_id', auth.administrationId).maybeSingle(),
    auth.employeeId
      ? supabase.from('employee_organizations').select('location_id').eq('tenant_id', auth.tenantId).eq('administration_id', auth.administrationId).eq('employee_id', auth.employeeId).lte('effective_from', today).or(`effective_to.is.null,effective_to.gte.${today}`).order('effective_from', { ascending: false }).limit(25)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (companyResult.error || assignmentResult.error) return fallbackWeather()

  const currentAssignment = assignmentResult.data?.[0]
  const locationId = currentAssignment?.location_id ?? null
  const locationResult = locationId
    ? await supabase.from('administration_locations').select('id, name, city, country_code').eq('tenant_id', auth.tenantId).eq('administration_id', auth.administrationId).eq('id', locationId).eq('is_active', true).maybeSingle()
    : { data: null, error: null }
  if (locationResult.error) return fallbackWeather()

  const location = locationResult.data
  const city = location?.city ?? companyResult.data?.city ?? null
  const countryCode = location?.country_code ?? companyResult.data?.country_code ?? 'NL'
  if (!city) return fallbackWeather()
  return getWorkWeather({
    name: location?.name ?? city,
    city,
    countryCode,
    latitude: 0,
    longitude: 0,
  })
}

async function getStartPageHomeWeather(auth: AuthContext): Promise<WorkWeather | null> {
  if (!auth.employeeId) return null
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase.from('employee_addresses')
    .select('city, country_code')
    .eq('tenant_id', auth.tenantId)
    .eq('employee_id', auth.employeeId)
    .eq('address_type', 'PRIMARY')
    .lte('valid_from', today)
    .or(`valid_until.is.null,valid_until.gte.${today}`)
    .is('deleted_at', null)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data?.city) return null
  return getWorkWeather({
    name: data.city,
    city: data.city,
    countryCode: data.country_code,
    latitude: 0,
    longitude: 0,
  })
}

async function getStartPageContinuousAppraisal(): Promise<ContinuousAppraisalSummary | null> {
  try {
    return await getContinuousAppraisalSummary()
  } catch {
    // De startpagina blijft beschikbaar zolang de optionele module nog niet is geactiveerd.
    return null
  }
}

export async function getStartPageData(): Promise<StartPageData> {
  const supabase = await createClient()
  const auth = await requireAuthContext(supabase)
  const context = await loadActiveContext(auth.userId, supabase)
  const managementRoles = new Set(['TENANT_ADMIN', 'HR_ADMIN', 'HR_ADVISOR', 'DIRECT_MANAGER', 'TEAM_LEAD'])
  const isEmployeeOnly = auth.activeRoles.every((role) => !managementRoles.has(role))

  const [employee, leaveAbsences, absenceResult, companyDocuments, reminders, upcomingEvents, employeeCount, recurringAbsenceCount, longTermSickCount, workWeather, homeWeather, countdowns, continuousAppraisal] = await Promise.all([
    auth.employeeId
      ? supabase.from('employees').select('first_name').eq('id', auth.employeeId).eq('tenant_id', auth.tenantId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    listLeaveAbsences(auth),
    listActiveAbsences(auth),
    countCompanyDocuments(auth),
    listMyReminders(8).catch(() => []),
    listUpcomingEvents(auth),
    countEmployees(auth),
    countRecurringAbsence(auth),
    countLongTermSick(auth),
    getStartPageWorkWeather(auth),
    getStartPageHomeWeather(auth),
    getStartPageCountdowns(auth),
    getStartPageContinuousAppraisal(),
  ])

  return {
    employeeId: auth.employeeId,
    firstName: employee.data?.first_name?.trim() || null,
    tenantName: context.tenant.name,
    administrationName: context.administration?.name ?? null,
    isEmployeeOnly,
    companyDocuments,
    reminders: reminders.filter((reminder) => reminder.recipientStatus === 'PENDING' && reminder.reminderStatus === 'PUBLISHED'),
    leaveAbsences,
    activeAbsenceItems: absenceResult.items,
    activeAbsenceTotal: absenceResult.total,
    upcomingEvents,
    employeeCount,
    recurringAbsenceCount,
    longTermSickCount,
    workWeather,
    homeWeather,
    nextLeaveInDays: countdowns.nextLeaveInDays,
    nextHolidayInDays: countdowns.nextHolidayInDays,
    continuousAppraisal,
  }
}
