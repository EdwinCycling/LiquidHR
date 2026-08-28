import { redirect } from 'next/navigation'
import { BusinessStructureManager } from '@/components/settings/business-structure-manager'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { loadActiveContext } from '@/lib/context/server-context'
import { getTranslator } from '@/lib/i18n/server'
import { PageShell } from '@/components/layout/page-shell'

export default async function BusinessStructurePage() {
  let auth
  try { auth = await requirePermission('hr-group:read') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const [context, t] = await Promise.all([loadActiveContext(auth.userId), getTranslator('settings')])
  return <main><PageShell className="py-8 lg:py-10" width="wide"><AdminSettingsPageHeader backLabel={t('admin.backToOverview')} eyebrow={t('businessStructure.title')} subtitle={t('businessStructure.subtitle')} title={t('businessStructure.title')} /><BusinessStructureManager canWrite={auth.permissions.includes('hr-group:manage')} groups={context.hrGroups} labels={{ title: t('businessStructure.title'), subtitle: t('businessStructure.subtitle'), groups: t('businessStructure.groups'), administrations: t('businessStructure.administrations'), add: t('businessStructure.add'), edit: t('businessStructure.edit'), save: t('businessStructure.save'), cancel: t('businessStructure.cancel'), name: t('businessStructure.name'), description: t('businessStructure.description'), code: t('businessStructure.code'), number: t('businessStructure.number'), coc: t('businessStructure.coc'), vat: t('businessStructure.vat'), parent: t('businessStructure.parent'), active: t('businessStructure.active'), group: t('businessStructure.group'), failed: t('businessStructure.failed'), saved: t('businessStructure.saved'), empty: t('businessStructure.empty') }} /></PageShell></main>
}
