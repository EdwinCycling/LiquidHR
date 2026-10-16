import { redirect } from 'next/navigation'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { ModuleSettingsForm } from '@/components/settings/module-settings-form'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { getTranslator } from '@/lib/i18n/server'
import { listTenantModules } from '@/lib/modules/module-service'
import { PageShell } from '@/components/layout/page-shell'

export default async function ModulesSettingsPage() {
  try { await requirePermission('modules:read') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const [modules, messages, common] = await Promise.all([listTenantModules(), getTranslator('settings'), getTranslator('common')])
  const availableModules = modules.filter((module) => module.status === 'AVAILABLE' && module.toggleable)
  return <PageShell className="py-8 lg:py-10"><AdminSettingsPageHeader backLabel={messages('admin.backToOverview')} eyebrow={messages('admin.title')} subtitle={messages('modules.subtitle')} title={messages('modules.title')} /><ModuleSettingsForm labels={{ save: common('save'), cancel: common('cancel'), saving: messages('saving'), saved: messages('modules.saved'), failed: messages('modules.failed'), names: Object.fromEntries(availableModules.map(({ code }) => [code, messages(`modules.items.${code}.name`)])), descriptions: Object.fromEntries(availableModules.map(({ code }) => [code, messages(`modules.items.${code}.description`)])) }} modules={availableModules} /></PageShell>
}
