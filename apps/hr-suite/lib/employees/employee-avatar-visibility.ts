interface EmployeeAvatarReference {
  id: string
  avatarUrl: string | null
}

export function getEmployeeListAvatarUrl(
  employee: EmployeeAvatarReference,
  directoryMode: boolean,
  currentEmployeeId: string | null,
): string | null {
  if (!employee.avatarUrl) return null
  if (!directoryMode || employee.id === currentEmployeeId) return employee.avatarUrl
  return employee.avatarUrl === `/api/employees/${employee.id}/avatar` ? null : employee.avatarUrl
}
