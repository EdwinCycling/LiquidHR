export type HeadcountFtePopulation = 'HR_ADMIN' | 'DIRECT_MANAGER'

export function headcountFtePopulationForRoles(activeRoles: readonly string[]): HeadcountFtePopulation | null {
  if (activeRoles.includes('TENANT_ADMIN') || activeRoles.includes('HR_ADMIN')) return 'HR_ADMIN'
  if (activeRoles.includes('DIRECT_MANAGER')) return 'DIRECT_MANAGER'
  return null
}

export function canReadHeadcountFte(activeRoles: readonly string[], permissions: readonly string[]): boolean {
  const population = headcountFtePopulationForRoles(activeRoles)
  if (!permissions.includes('employee:read')) return false
  return population === 'DIRECT_MANAGER'
    || (population === 'HR_ADMIN' && permissions.includes('report-employee-department:read'))
}

export function canReadJoinersLeavers(activeRoles: readonly string[], permissions: readonly string[]): boolean {
  return canReadHeadcountFte(activeRoles, permissions)
}

export function headcountFteSelectionWithinScope(selectedIds: readonly string[], allowedIds: readonly string[]): boolean {
  const allowed = new Set(allowedIds)
  return selectedIds.every((id) => allowed.has(id))
}

export function headcountFteEmployeeWithinScope(population: HeadcountFtePopulation, employeeId: string, managerEmployeeIds: ReadonlySet<string> | null): boolean {
  return population === 'HR_ADMIN' || (managerEmployeeIds !== null && managerEmployeeIds.has(employeeId))
}
