import { redirect } from 'next/navigation'
import { HrGroupManager } from '@/components/settings/hr-group-manager'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { PageShell } from '@/components/layout/page-shell'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { loadActiveContext } from '@/lib/context/server-context'
import { getTranslator } from '@/lib/i18n/server'

export default async function HrGroupsSettingsPage() {
  let authContext
  try {
    authContext = await requirePermission('hr-group:read')
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }

  const [context, messages] = await Promise.all([
    loadActiveContext(authContext.userId),
    getTranslator('settings'),
  ])

  return <PageShell className="py-8 lg:py-10"><AdminSettingsPageHeader backLabel={messages('admin.backToOverview')} eyebrow={messages('hrGroups.title')} subtitle={messages('hrGroups.subtitle')} title={messages('hrGroups.title')} /><HrGroupManager
    activeGroup={context.activeHrGroup}
    canWrite={authContext.permissions.includes('hr-group:manage')}
    labels={{
      title: messages('hrGroups.title'),
      subtitle: messages('hrGroups.subtitle'),
      groupCode: messages('hrGroups.groupCode'),
      groupName: messages('hrGroups.groupName'),
      groupDescription: messages('hrGroups.groupDescription'),
      saveGroup: messages('hrGroups.saveGroup'),
      saved: messages('hrGroups.saved'),
      addAdministration: messages('hrGroups.addAdministration'),
      editAdministration: messages('hrGroups.editAdministration'),
      administrations: messages('hrGroups.administrations'),
      administrationCode: messages('hrGroups.administrationCode'),
      administrationName: messages('hrGroups.administrationName'),
      administrationNumber: messages('hrGroups.administrationNumber'),
      administrationCocNumber: messages('hrGroups.administrationCocNumber'),
      administrationVatNumber: messages('hrGroups.administrationVatNumber'),
      administrationParent: messages('hrGroups.administrationParent'),
      administrationActive: messages('hrGroups.administrationActive'),
      saveAdministration: messages('hrGroups.saveAdministration'),
      cancel: messages('hrGroups.cancel'),
      close: messages('hrGroups.close'),
      search: messages('hrGroups.search'),
      searchPlaceholder: messages('hrGroups.searchPlaceholder'),
      empty: messages('hrGroups.empty'),
      failed: messages('hrGroups.failed'),
      invalid: messages('hrGroups.invalid'),
      duplicate: messages('hrGroups.duplicate'),
    }}
  /></PageShell>
}
