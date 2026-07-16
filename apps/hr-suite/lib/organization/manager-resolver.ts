export interface DepartmentReference {
  id: string
  parentId: string | null
}

export interface OrganizationPlacement {
  employeeId: string
  departmentId: string
  directManagerId: string | null
  directManagerDeputyId: string | null
}

export interface ManagementAssignment {
  departmentId: string
  roleCode: string
  employeeId: string
  effectiveFrom: string
  effectiveTo: string | null
}

export interface ResolveManagerInput {
  roleCode: string
  placement: OrganizationPlacement
  departments: readonly DepartmentReference[]
  assignments: readonly ManagementAssignment[]
  unavailableEmployeeIds: readonly string[]
  deputyRoleCodes?: Readonly<Record<string, string>>
  asOfDate?: string
}

export interface ResolvedManager {
  employeeId: string
  departmentId: string
  source: 'direct' | 'direct-deputy' | 'department' | 'department-deputy'
}

export class ManagerNotFoundError extends Error {}

export class AmbiguousManagerError extends Error {}

export class DepartmentCycleError extends Error {}

function isActiveOn(assignment: ManagementAssignment, date: string): boolean {
  return assignment.effectiveFrom <= date && (assignment.effectiveTo === null || assignment.effectiveTo >= date)
}

export function resolveManagerForEmployee(input: ResolveManagerInput): ResolvedManager {
  const unavailable = new Set(input.unavailableEmployeeIds)

  if (input.roleCode === 'DIRECT_MANAGER' && input.placement.directManagerId) {
    if (unavailable.has(input.placement.directManagerId) && input.placement.directManagerDeputyId) {
      return {
        employeeId: input.placement.directManagerDeputyId,
        departmentId: input.placement.departmentId,
        source: 'direct-deputy',
      }
    }

    return {
      employeeId: input.placement.directManagerId,
      departmentId: input.placement.departmentId,
      source: 'direct',
    }
  }

  const asOfDate = input.asOfDate ?? new Date().toISOString().slice(0, 10)
  const departments = new Map(input.departments.map((department) => [department.id, department]))
  const visited = new Set<string>()
  let departmentId: string | null = input.placement.departmentId

  while (departmentId) {
    if (visited.has(departmentId)) {
      throw new DepartmentCycleError(`Cyclus gevonden bij afdeling ${departmentId}.`)
    }
    visited.add(departmentId)

    const candidates = input.assignments.filter(
      (assignment) =>
        assignment.departmentId === departmentId &&
        assignment.roleCode === input.roleCode &&
        isActiveOn(assignment, asOfDate),
    )

    if (candidates.length > 1) {
      throw new AmbiguousManagerError(`Meerdere actieve rolhouders voor ${input.roleCode} op afdeling ${departmentId}.`)
    }

    const candidate = candidates[0]
    if (candidate) {
      const deputyRoleCode = input.deputyRoleCodes?.[input.roleCode]
      if (unavailable.has(candidate.employeeId) && deputyRoleCode) {
        const deputyCandidates = input.assignments.filter(
          (assignment) =>
            assignment.departmentId === departmentId &&
            assignment.roleCode === deputyRoleCode &&
            isActiveOn(assignment, asOfDate),
        )

        if (deputyCandidates.length > 1) {
          throw new AmbiguousManagerError(`Meerdere actieve rolhouders voor ${deputyRoleCode} op afdeling ${departmentId}.`)
        }

        const deputy = deputyCandidates[0]
        if (!deputy) {
          throw new ManagerNotFoundError(`Geen actieve deputy gevonden voor ${input.roleCode} op afdeling ${departmentId}.`)
        }

        return { employeeId: deputy.employeeId, departmentId, source: 'department-deputy' }
      }

      return { employeeId: candidate.employeeId, departmentId, source: 'department' }
    }

    departmentId = departments.get(departmentId)?.parentId ?? null
  }

  throw new ManagerNotFoundError(`Geen actieve rolhouder gevonden voor ${input.roleCode}.`)
}
