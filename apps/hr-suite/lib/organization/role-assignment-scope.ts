export interface RoleAssignmentDepartment {
  id: string
  name: string
  code: string
}

export function scopeRoleAssignmentDepartments(
  departments: readonly RoleAssignmentDepartment[],
): RoleAssignmentDepartment[] {
  return [...departments]
}
