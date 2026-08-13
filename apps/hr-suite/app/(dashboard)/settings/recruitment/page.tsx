import { notFound, redirect } from 'next/navigation'
import { AuthorizationError, getRequestAuthorizationContext, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { ModuleError, requireTenantModule } from '@/lib/modules/module-service'
import { getRecruitmentSettings, listGuidedLibrary, listGuidedSets, listRecruitmentPipelineStages } from '@/lib/recruitment/guided-service'
import { GuidedSettingsManager } from '@/components/recruitment/guided-settings-manager'

export default async function RecruitmentSettingsPage() {
  try {
    await requireTenantModule('RECRUITMENT')
    await requirePermission('recruitment-settings:manage')
  } catch (error) {
    if (error instanceof ModuleError && error.status === 404) notFound()
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }

  const [{ context, supabase }, t] = await Promise.all([getRequestAuthorizationContext(), getTranslator('recruitment')])
  const [library, sets, settings, pipeline] = await Promise.all([
    listGuidedLibrary(context, supabase),
    listGuidedSets(context, supabase),
    getRecruitmentSettings(context, supabase),
    listRecruitmentPipelineStages(context, supabase),
  ])

  return (
    <GuidedSettingsManager
      initial={{ library, sets, settings, pipeline }}
      labels={{
        eyebrow: t('guided.eyebrow'),
        title: t('guided.title'),
        description: t('guided.description'),
        library: t('guided.library'),
        sets: t('guided.sets'),
        pipeline: t('guided.pipeline'),
        privacy: t('guided.privacy'),
        analytics: t('guided.analytics'),
        search: t('guided.search'),
        allTypes: t('guided.allTypes'),
        system: t('guided.system'),
        hrGroup: t('guided.hrGroup'),
        active: t('guided.active'),
        inactive: t('guided.inactive'),
        enabled: t('guided.enabled'),
        disabled: t('guided.disabled'),
        applicationQuestion: t('guided.applicationQuestion'),
        interviewQuestion: t('guided.interviewQuestion'),
        criterion: t('guided.criterion'),
        preparation: t('guided.preparation'),
        retentionDays: t('guided.retentionDays'),
        retentionHelp: t('guided.retentionHelp'),
        longRetentionWarning: t('guided.longRetentionWarning'),
        saveSettings: t('guided.saveSettings'),
        saved: t('guided.saved'),
        saveFailed: t('guided.saveFailed'),
        version: t('guided.version'),
        noItems: t('guided.noItems'),
        noSets: t('guided.noSets'),
        noStages: t('guided.noStages'),
        addItem: t('guided.addItem'),
        editItem: t('guided.editItem'),
        stableCode: t('guided.stableCode'),
        titleLabel: t('guided.titleLabel'),
        contentPrompt: t('guided.contentPrompt'),
        type: t('guided.type'),
        createItem: t('guided.createItem'),
        updateItem: t('guided.updateItem'),
        cancel: t('guided.cancel'),
        addSet: t('guided.addSet'),
        setName: t('guided.setName'),
        setDescription: t('guided.setDescription'),
        selectItems: t('guided.selectItems'),
        createSet: t('guided.createSet'),
        updateSet: t('guided.updateSet'),
        setSaved: t('guided.setSaved'),
        itemSaved: t('guided.itemSaved'),
        addStage: t('guided.addStage'),
        stageCode: t('guided.stageCode'),
        stageName: t('guided.stageName'),
        stageSaved: t('guided.stageSaved'),
      }}
    />
  )
}
