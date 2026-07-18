import { redirect } from 'next/navigation'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { ModuleSettingsForm } from '@/components/settings/module-settings-form'
import { getTranslator } from '@/lib/i18n/server'
import { listTenantModules } from '@/lib/modules/module-service'

export default async function ModulesSettingsPage() {
  try { await requirePermission('modules:read') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const [modules, messages, common] = await Promise.all([listTenantModules(), getTranslator('settings'), getTranslator('common')])
  const codes = ['HERA', 'DOCUMENTS', 'REMINDERS', 'LEAVE', 'ABSENCE', 'ASSETS', 'WORKFLOWS', 'TRAINING']
  return <div className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-10"><header className="mb-8"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{messages('admin.title')}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{messages('modules.title')}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{messages('modules.subtitle')}</p></header><ModuleSettingsForm labels={{ save: common('save'), saving: messages('saving'), saved: messages('modules.saved'), failed: messages('modules.failed'), comingSoon: messages('modules.comingSoon'), names: Object.fromEntries(codes.map((code) => [code, messages(`modules.items.${code}.name`)])), descriptions: Object.fromEntries(codes.map((code) => [code, messages(`modules.items.${code}.description`)])) }} modules={modules} /></div>
}
