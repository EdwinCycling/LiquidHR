import { AuthorizationManager, type AuthorizationLabels } from '@/components/organization/authorization-manager'
import { requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listAuthorizationMatrix } from '@/lib/organization/management-service'
import { createClient } from '@/lib/supabase/server'

export default async function AuthorizationPage() {
  const context = await requirePermission('authorization:read')
  if (!context.administrationId) throw new Error('ADMINISTRATION_REQUIRED')
  const supabase = await createClient()
  const [matrix, t, employeeResult, departmentResult] = await Promise.all([
    listAuthorizationMatrix(), getTranslator('organization'),
    supabase.from('employees').select('id, employee_number, first_name, birth_name').eq('tenant_id', context.tenantId).eq('is_archived', false).is('deleted_at', null).order('birth_name').limit(500),
    supabase.from('departments').select('id, code, name').eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId).eq('is_active', true).order('name').limit(500),
  ])
  if (employeeResult.error || departmentResult.error) throw new Error('ORGANIZATION_OPTIONS_FAILED')
  const labelKeys: (keyof AuthorizationLabels)[] = [
    'roles', 'newRole', 'roleCode', 'roleName', 'roleDescription', 'createRole', 'systemRole', 'tenantRole',
    'permissions', 'selectRole', 'savePermissions', 'placements', 'managementAssignments', 'employee', 'department',
    'role', 'jobTitle', 'effectiveFrom', 'addPlacement', 'addManagement', 'saved', 'failed', 'tabPermissions',
    'tabOverview', 'tabAssignments', 'roleSearch', 'permissionSearch', 'totalRoles', 'activeTenantRoles',
    'assignedPermissions', 'coveredCategories', 'selectedCount', 'selectAll', 'clearAll', 'unsavedChanges',
    'resetChanges', 'readOnlyRole', 'inactiveRole', 'activeRole', 'coverage', 'coverageExplanation', 'overviewTitle',
    'overviewSubtitle', 'scopeNoticeTitle', 'scopeNotice', 'assignmentTitle', 'assignmentSubtitle', 'noSearchResults',
    'permissionCode',
  ]
  const labels = Object.fromEntries(labelKeys.map((key) => [key, t(key)])) as unknown as AuthorizationLabels
  return <section className="mx-auto w-full max-w-[96rem] px-5 py-8 sm:px-8 sm:py-10 lg:px-10"><header className="mb-7 border-b pb-7"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-foreground">{t('eyebrow')}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">{t('title')}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{t('subtitle')}</p></header><AuthorizationManager {...matrix} employees={employeeResult.data.map((employee) => ({ id: employee.id, name: `${employee.employee_number} · ${employee.first_name} ${employee.birth_name}` }))} departments={departmentResult.data.map((department) => ({ id: department.id, name: `${department.code} · ${department.name}` }))} labels={labels} /></section>
}
