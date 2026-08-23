import type { TalentWorkforceEmployee, TalentWorkforceProfile } from './service'

export function talentWorkforceProfileKey(item: TalentWorkforceProfile): string {
  return item.profile.job_profile_id ?? item.profile.job_id ?? item.profile.job_code ?? item.profile.tenant_id ?? ''
}

export function uniqueTalentWorkforceEmployees(initial: TalentWorkforceProfile[]): TalentWorkforceEmployee[] {
  const byId = new Map<string, TalentWorkforceEmployee>()
  for (const item of initial) for (const employee of item.employees) byId.set(employee.id, employee)
  return [...byId.values()].sort((left, right) => left.label.localeCompare(right.label, 'nl-NL'))
}

export function filterTalentWorkforceProfiles(initial: TalentWorkforceProfile[], query: string, employeeId: string): TalentWorkforceProfile[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('nl-NL')
  return initial.filter((item) => {
    if (employeeId && !item.employees.some((employee) => employee.id === employeeId)) return false
    if (!normalizedQuery) return true
    const values = [
      item.profile.job_code,
      item.profile.job_group_name,
      item.profile.job_family_name,
      item.profile.seniority_name,
      item.profile.summary,
      ...item.employees.flatMap((employee) => [employee.label, employee.employeeNumber]),
    ]
    return values.some((value) => value?.toLocaleLowerCase('nl-NL').includes(normalizedQuery))
  })
}

export function talentNotificationActionHref(eventType: string): string | null {
  if (eventType === 'GOAL_OPEN' || eventType === 'CHECKIN_DUE') return '/workforce/talent/goals'
  if (eventType === 'ASSESSMENT_PENDING') return '/workforce/talent/assessments'
  if (eventType === 'QUALIFICATION_EXPIRING') return '/workforce/talent/role-explorer'
  if (eventType === 'IMPORT_COMPLETED') return '/workforce/talent/reports'
  return null
}
