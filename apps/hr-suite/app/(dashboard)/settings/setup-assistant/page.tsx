import { redirect } from 'next/navigation'
import { SetupAssistantSettingsForm } from '@/components/setup-assistant/setup-assistant-settings-form'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { AuthorizationError } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { getSetupAssistantState } from '@/lib/setup-assistant/service'

export default async function SetupAssistantSettingsPage() {
  let state: Awaited<ReturnType<typeof getSetupAssistantState>>
  try {
    state = await getSetupAssistantState()
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }

  const [settings, setupMessages] = await Promise.all([getTranslator('settings'), getTranslator('setupAssistant')])
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-10">
      <AdminSettingsPageHeader
        backLabel={settings('admin.backToOverview')}
        eyebrow={settings('admin.eyebrow')}
        subtitle={setupMessages('settingsDescription')}
        title={setupMessages('title')}
      />
      <SetupAssistantSettingsForm
        canWrite={state.canWrite}
        initialEnabled={state.isEnabled}
        labels={{
          title: setupMessages('settingsEnabled'),
          description: setupMessages('settingsDescription'),
          enabled: setupMessages('settingsEnabled'),
          enabledDescription: setupMessages('settingsEnabledDescription'),
          saving: setupMessages('saving'),
          saved: setupMessages('saved'),
          saveFailed: setupMessages('saveFailed'),
          readOnly: setupMessages('readOnly'),
        }}
      />
    </div>
  )
}
