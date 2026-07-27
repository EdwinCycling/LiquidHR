import 'server-only'

import { requireAuthContext, type AuthContext } from '@/lib/auth/permissions'
import { loadActiveContext } from '@/lib/context/server-context'
import { listMyReminders, type ReminderItem } from '@/lib/reminders/reminder-service'
import { createClient } from '@/lib/supabase/server'

export interface StartPageData {
  employeeId: string | null
  firstName: string | null
  tenantName: string
  administrationName: string | null
  isEmployeeOnly: boolean
  employees: number | null
  departments: number | null
  activeAbsences: number | null
  activeAbsenceItems: StartPageAbsenceItem[]
  companyDocuments: number | null
  reminders: ReminderItem[]
}

export interface StartPageAbsenceItem {
  caseId: string
  employeeId: string
  employeeName: string
  firstAbsenceOn: string
  status: 'ACTIVE' | 'RECOVERY_WINDOW'
  days: number
}

async function countEmployees(auth: AuthContext): Promise<number | null> {
  if (!auth.permissions.includes('employee:read')) return null
  const supabase = await createClient()

  if (auth.administrationId) {
    const today = new Date().toISOString().slice(0, 10)
    const { data: assignments, error: assignmentsError } = await supabase
      .from('employee_administration_assignments')
      .select('employee_id')
      .eq('tenant_id', auth.tenantId)
      .eq('administration_id', auth.administrationId)
      .lte('effective_from', today)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
      .limit(10000)

    if (assignmentsError) return null

    const employeeIds = [...new Set(assignments.map((assignment) => assignment.employee_id))]
    if (employeeIds.length === 0) return 0

    const { count, error } = await supabase.from('employees').select('id', { count: 'exact', head: true })
      .in('id', employeeIds)
      .eq('tenant_id', auth.tenantId).eq('is_active', true).eq('is_archived', false).is('deleted_at', null)
    return error ? null : count ?? 0
  }

  const { count, error } = await supabase.from('employees').select('id', { count: 'exact', head: true })
    .eq('tenant_id', auth.tenantId).eq('is_active', true).eq('is_archived', false).is('deleted_at', null)
  return error ? null : count ?? 0
}

async function countDepartments(auth: AuthContext): Promise<number | null> {
  if (!auth.permissions.includes('department:read')) return null
  const supabase = await createClient()
  let query = supabase.from('departments').select('id', { count: 'exact', head: true })
    .eq('tenant_id', auth.tenantId).eq('is_active', true)
  if (auth.administrationId) query = query.eq('administration_id', auth.administrationId)
  const { count, error } = await query
  return error ? null : count ?? 0
}

async function countAbsences(auth: AuthContext): Promise<number | null> {
  if (!auth.permissions.includes('absence:read')) return null
  const supabase = await createClient()
  let query = supabase.from('absence_cases').select('id', { count: 'exact', head: true })
    .eq('tenant_id', auth.tenantId).in('status', ['ACTIVE', 'RECOVERY_WINDOW']).is('archived_at', null)
  if (auth.administrationId) query = query.eq('administration_id', auth.administrationId)
  const { count, error } = await query
  return error ? null : count ?? 0
}

async function listActiveAbsences(auth: AuthContext): Promise<StartPageAbsenceItem[]> {
  if (!auth.permissions.includes('absence:read')) return []
  const supabase = await createClient()
  let query = supabase.from('absence_cases')
    .select('id, employee_id, first_absence_on, status')
    .eq('tenant_id', auth.tenantId)
    .in('status', ['ACTIVE', 'RECOVERY_WINDOW'])
    .is('archived_at', null)
    .order('first_absence_on', { ascending: true })
    .limit(6)
  if (auth.administrationId) query = query.eq('administration_id', auth.administrationId)
  const { data: cases, error } = await query
  if (error || !cases?.length) return []
  const employeeIds = [...new Set(cases.map((item) => item.employee_id))]
  const { data: employees, error: employeeError } = await supabase.from('employees')
    .select('id, first_name, birth_name')
    .eq('tenant_id', auth.tenantId)
    .in('id', employeeIds)
  if (employeeError) return []
  const employeeMap = new Map((employees ?? []).map((employee) => [employee.id, employee]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return cases.flatMap((item) => {
    const employee = employeeMap.get(item.employee_id)
    if (!employee) return []
    const firstDate = new Date(`${item.first_absence_on}T00:00:00Z`)
    const days = Math.max(1, Math.floor((today.getTime() - firstDate.getTime()) / 86_400_000) + 1)
    const employeeName = [employee.first_name, employee.birth_name].filter((part): part is string => Boolean(part?.trim())).join(' ').trim()
    return [{ caseId: item.id, employeeId: item.employee_id, employeeName: employeeName || 'Onbekende medewerker', firstAbsenceOn: item.first_absence_on, status: item.status as 'ACTIVE' | 'RECOVERY_WINDOW', days }]
  })
}

async function countCompanyDocuments(auth: AuthContext): Promise<number | null> {
  const supabase = await createClient()
  let query = supabase.from('company_documents').select('id', { count: 'exact', head: true })
    .eq('tenant_id', auth.tenantId).is('deleted_at', null)
  if (auth.administrationId) query = query.eq('administration_id', auth.administrationId)
  const { count, error } = await query
  return error ? null : count ?? 0
}

export async function getStartPageData(): Promise<StartPageData> {
  const supabase = await createClient()
  const auth = await requireAuthContext(supabase)
  const context = await loadActiveContext(auth.userId, supabase)
  const managementRoles = new Set(['TENANT_ADMIN', 'HR_ADMIN', 'HR_ADVISOR', 'DIRECT_MANAGER', 'TEAM_LEAD'])
  const isEmployeeOnly = auth.activeRoles.every((role) => !managementRoles.has(role))

  const [employee, employees, departments, activeAbsences, activeAbsenceItems, companyDocuments, reminders] = await Promise.all([
    auth.employeeId
      ? supabase.from('employees').select('first_name').eq('id', auth.employeeId).eq('tenant_id', auth.tenantId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    countEmployees(auth),
    countDepartments(auth),
    countAbsences(auth),
    listActiveAbsences(auth),
    countCompanyDocuments(auth),
    listMyReminders(8).catch(() => []),
  ])

  return {
    employeeId: auth.employeeId,
    firstName: employee.data?.first_name?.trim() || null,
    tenantName: context.tenant.name,
    administrationName: context.administration?.name ?? null,
    isEmployeeOnly,
    employees,
    departments,
    activeAbsences,
    activeAbsenceItems,
    companyDocuments,
    reminders: reminders.filter((reminder) => reminder.recipientStatus === 'PENDING' && reminder.reminderStatus === 'PUBLISHED'),
  }
}
