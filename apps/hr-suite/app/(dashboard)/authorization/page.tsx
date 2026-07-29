import { AuthorizationManager, type AuthorizationLabels } from '@/components/organization/authorization-manager'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listAuthorizationMatrix } from '@/lib/organization/management-service'

export default async function AuthorizationPage() {
  await requirePermission('authorization:read')
  const [matrix, t, settings] = await Promise.all([listAuthorizationMatrix(), getTranslator('organization'), getTranslator('settings')])
  const labelKeys: (keyof AuthorizationLabels)[] = [
    'roles', 'newRole', 'roleCode', 'roleName', 'roleDescription', 'createRole', 'systemRole', 'tenantRole',
    'roleOrganizationScoped', 'permissions', 'selectRole', 'savePermissions', 'placements', 'managementAssignments', 'employee', 'department',
    'role', 'jobTitle', 'effectiveFrom', 'addPlacement', 'addManagement', 'saved', 'failed', 'tabPermissions',
    'tabOverview', 'tabAssignments', 'roleSearch', 'permissionSearch', 'totalRoles', 'activeTenantRoles',
    'assignedPermissions', 'coveredCategories', 'selectedCount', 'selectAll', 'clearAll', 'unsavedChanges',
    'resetChanges', 'readOnlyRole', 'inactiveRole', 'activeRole', 'coverage', 'coverageExplanation', 'overviewTitle',
    'overviewSubtitle', 'scopeNoticeTitle', 'scopeNotice', 'assignmentTitle', 'assignmentSubtitle', 'noSearchResults',
    'permissionCode', 'selfAuthorizationLockout',
  ]
  const labels = Object.fromEntries(labelKeys.map((key) => [key, t(key)])) as unknown as AuthorizationLabels
  return <section className="mx-auto w-full max-w-[96rem] px-5 py-8 sm:px-8 sm:py-10 lg:px-10"><AdminSettingsPageHeader backLabel={settings('admin.backToOverview')} eyebrow={t('eyebrow')} subtitle={t('subtitle')} title={t('title')} /><AuthorizationManager {...matrix} labels={labels} /></section>
}
