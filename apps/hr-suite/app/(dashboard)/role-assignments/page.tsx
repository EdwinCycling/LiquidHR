import { RoleAssignmentManager, type RoleAssignmentManagerLabels } from '@/components/organization/role-assignment-manager'
import { getTranslator } from '@/lib/i18n/server'
import { listRoleAssignments } from '@/lib/organization/management-service'

export default async function RoleAssignmentsPage() {
  const [data, t] = await Promise.all([listRoleAssignments(), getTranslator('organization')])
  const keys: (keyof RoleAssignmentManagerLabels)[] = ['title', 'subtitle', 'employee', 'role', 'department', 'effectiveFrom', 'effectiveTo', 'allRoles', 'searchEmployees', 'searchDepartments', 'addAssignment', 'save', 'delete', 'export', 'noDepartment', 'scopeRequired', 'tenantWide', 'empty', 'saved', 'failed', 'assignmentType', 'departmentManager', 'departmentManagerPlus', 'fromEmployee', 'fromDepartment', 'withoutManager', 'currentAssignments', 'selectDepartments', 'assignManager', 'details', 'cancel', 'job', 'employeeNumber', 'noCurrentAssignments', 'noMissingDepartments', 'openSection', 'writeRequired']
  const sharedKeys: Partial<Record<keyof RoleAssignmentManagerLabels, string>> = {
    employee: 'employee', role: 'role', department: 'department', effectiveFrom: 'effectiveFrom', effectiveTo: 'effectiveTo',
  }
  const labels = Object.fromEntries(keys.map((key) => [key, t(sharedKeys[key] ?? `roleAssignments${key.slice(0, 1).toUpperCase()}${key.slice(1)}`)])) as unknown as RoleAssignmentManagerLabels
  return <RoleAssignmentManager {...data} labels={labels} />
}
