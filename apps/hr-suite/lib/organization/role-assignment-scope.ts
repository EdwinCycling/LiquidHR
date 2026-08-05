export interface RoleAssignmentDepartment {
  id: string
  name: string
  code: string
}

export interface RoleAssignmentDepartmentReference {
  department_id: string | null
}

export function scopeRoleAssignmentDepartments(
  departments: readonly RoleAssignmentDepartment[],
  placements: readonly RoleAssignmentDepartmentReference[],
  assignments: readonly RoleAssignmentDepartmentReference[],
): RoleAssignmentDepartment[] {
  const departmentIds = new Set<string>()
  for (const reference of [...placements, ...assignments]) {
    if (reference.department_id) departmentIds.add(reference.department_id)
  }
  return departments.filter((department) => departmentIds.has(department.id))
}
