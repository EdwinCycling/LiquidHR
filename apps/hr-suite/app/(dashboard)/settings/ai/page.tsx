import { redirect } from 'next/navigation'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { AiSettingsForm } from '@/components/settings/ai-settings-form'
import { PageShell } from '@/components/layout/page-shell'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { getAiAdminSettings, settingsInputFromGroup } from '@/lib/ai/settings-service'
import { AI_SETTINGS_CAPABILITY_CODES, AI_SETTINGS_ROLE_CODES, type AiSettingsCapabilityCode, type AiSettingsRoleCode } from '@/lib/ai/settings-contracts'

export default async function AiSettingsPage() {
  try {
    await requirePermission('ai:manage')
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }

  const [settings, t] = await Promise.all([getAiAdminSettings(), getTranslator('settings')])
  const roleLabels = AI_SETTINGS_ROLE_CODES.reduce<Record<AiSettingsRoleCode, string>>((result, role) => {
    result[role] = t(`aiSettings.roles.${role}`)
    return result
  }, {} as Record<AiSettingsRoleCode, string>)
  const capabilityLabels = AI_SETTINGS_CAPABILITY_CODES.reduce<Record<AiSettingsCapabilityCode, string>>((result, capability) => {
    result[capability] = t(`aiSettings.capabilities.${capability}`)
    return result
  }, {} as Record<AiSettingsCapabilityCode, string>)
  return (
    <PageShell className="py-8 lg:py-10">
      <AdminSettingsPageHeader
        backLabel={t('admin.backToOverview')}
        eyebrow={t('admin.sections.platform')}
        subtitle={t('aiSettings.subtitle')}
        title={t('aiSettings.title')}
      />
      <AiSettingsForm
        initial={settingsInputFromGroup(settings)}
        labels={{
          generalTitle: t('aiSettings.generalTitle'),
          generalDescription: t('aiSettings.generalDescription'),
          aiEnabled: t('aiSettings.aiEnabled'),
          aiEnabledDescription: t('aiSettings.aiEnabledDescription'),
          voiceEnabled: t('aiSettings.voiceEnabled'),
          voiceEnabledDescription: t('aiSettings.voiceEnabledDescription'),
          contextsTitle: t('aiSettings.contextsTitle'),
          contextsDescription: t('aiSettings.contextsDescription'),
          employeeAiEnabled: t('aiSettings.employeeAiEnabled'),
          employeeAiEnabledDescription: t('aiSettings.employeeAiEnabledDescription'),
          teamAiEnabled: t('aiSettings.teamAiEnabled'),
          teamAiEnabledDescription: t('aiSettings.teamAiEnabledDescription'),
          rolesTitle: t('aiSettings.rolesTitle'),
          rolesDescription: t('aiSettings.rolesDescription'),
          roleAi: t('aiSettings.roleAi'),
          roleVoice: t('aiSettings.roleVoice'),
          capabilitiesTitle: t('aiSettings.capabilitiesTitle'),
          capabilitiesDescription: t('aiSettings.capabilitiesDescription'),
          qualityTitle: t('aiSettings.qualityTitle'),
          qualityDescription: t('aiSettings.qualityDescription'),
          qualityProfile: t('aiSettings.qualityProfile'),
          qualityEfficient: t('aiSettings.qualityEfficient'),
          qualityBalanced: t('aiSettings.qualityBalanced'),
          qualityInDepth: t('aiSettings.qualityInDepth'),
          style: t('aiSettings.style'),
          styleNeutral: t('aiSettings.styleNeutral'),
          styleBusiness: t('aiSettings.styleBusiness'),
          styleCoaching: t('aiSettings.styleCoaching'),
          answerLength: t('aiSettings.answerLength'),
          answerShort: t('aiSettings.answerShort'),
          answerNormal: t('aiSettings.answerNormal'),
          answerDetailed: t('aiSettings.answerDetailed'),
          voice: t('aiSettings.voice'),
          voiceAlloy: t('aiSettings.voiceAlloy'),
          voiceAsh: t('aiSettings.voiceAsh'),
          voiceBallad: t('aiSettings.voiceBallad'),
          voiceCoral: t('aiSettings.voiceCoral'),
          voiceEcho: t('aiSettings.voiceEcho'),
          voiceSage: t('aiSettings.voiceSage'),
          voiceShimmer: t('aiSettings.voiceShimmer'),
          voiceVerse: t('aiSettings.voiceVerse'),
          maxVoiceSessionSeconds: t('aiSettings.maxVoiceSessionSeconds'),
          maxVoiceSessionSecondsDescription: t('aiSettings.maxVoiceSessionSecondsDescription'),
          summaryTitle: t('aiSettings.summaryTitle'),
          summaryDescription: t('aiSettings.summaryDescription'),
          endSummaryEnabled: t('aiSettings.endSummaryEnabled'),
          employeeNoteSaveEnabled: t('aiSettings.employeeNoteSaveEnabled'),
          teamLogbookSaveEnabled: t('aiSettings.teamLogbookSaveEnabled'),
          privacyTitle: t('aiSettings.privacyTitle'),
          privacyDescription: t('aiSettings.privacyDescription'),
          save: t('aiSettings.save'),
          cancel: t('aiSettings.cancel'),
          saving: t('aiSettings.saving'),
          saved: t('aiSettings.saved'),
          failed: t('aiSettings.failed'),
          invalid: t('aiSettings.invalid'),
          roles: roleLabels,
          capabilities: capabilityLabels,
        }}
      />
    </PageShell>
  )
}
