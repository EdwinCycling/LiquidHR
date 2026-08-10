import { redirect } from 'next/navigation'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { CertifiedRecipePanel } from '@/components/process-automation/certified-recipe-panel'
import { StudioWorkspace, type StudioLabels } from '@/components/process-automation/studio-workspace'
import { AuthorizationError, requireAnyPermission, requirePermission } from '@/lib/auth/permissions'
import {
  getStudioDefinition,
  listStudioCatalog,
  studioDefinitionIdSchema,
} from '@/lib/process-automation/studio-service'
import { fieldTypeValues } from '@/lib/process-automation/definition-schemas'
import type { FieldType } from '@/lib/process-automation/definition-schemas'
import type { FormFieldGroup } from '@/lib/process-automation/form-field-catalog'
import {
  formBindingCatalog,
  formBindingKindValues,
  type FormBindingKind,
} from '@/lib/process-automation/form-binding-catalog'
import { listCertifiedRecipes } from '@/lib/process-automation/recipe-service'
import { getTranslator } from '@/lib/i18n/server'

async function can(permission: string): Promise<boolean> {
  try {
    await requirePermission(permission)
    return true
  } catch (error) {
    if (error instanceof AuthorizationError) return false
    throw error
  }
}

export default async function ProcessAutomationSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ definition?: string; tab?: string }>
}) {
  try {
    await requireAnyPermission(['process-definition:read', 'form-definition:read'])
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }

  const [{ definition: requestedDefinition, tab: requestedTab }, messages, messagesNl, messagesEn, catalog, recipes, canWrite, canPublish] = await Promise.all([
    searchParams,
    getTranslator('processAutomation'),
    getTranslator('processAutomation', 'nl'),
    getTranslator('processAutomation', 'en'),
    listStudioCatalog(),
    listCertifiedRecipes(),
    can('process-definition:write'),
    can('process-definition:publish'),
  ])

  const initialTab = requestedTab === 'forms' ? 'forms' : 'processes'
  const requestedId = studioDefinitionIdSchema.safeParse(requestedDefinition)
  const selectedId = requestedId.success && catalog.some((item) => item.id === requestedId.data)
    ? requestedId.data
    : catalog[0]?.id
  const initialSelection = selectedId ? await getStudioDefinition(selectedId) : null
  const fieldTypeLabels = fieldTypeValues.reduce<Record<FieldType, string>>((result, fieldType) => {
    result[fieldType] = messages(`studio.fieldTypeLabels.${fieldType}`)
    return result
  }, {} as Record<FieldType, string>)
  const fieldTypeLabelsNl = fieldTypeValues.reduce<Record<FieldType, string>>((result, fieldType) => {
    result[fieldType] = messagesNl(`studio.fieldTypeLabels.${fieldType}`)
    return result
  }, {} as Record<FieldType, string>)
  const fieldTypeLabelsEn = fieldTypeValues.reduce<Record<FieldType, string>>((result, fieldType) => {
    result[fieldType] = messagesEn(`studio.fieldTypeLabels.${fieldType}`)
    return result
  }, {} as Record<FieldType, string>)
  const fieldTypeGroups: Record<FormFieldGroup, string> = {
    INPUT: messages('studio.fieldTypeGroups.INPUT'),
    CHOICE: messages('studio.fieldTypeGroups.CHOICE'),
    REFERENCE: messages('studio.fieldTypeGroups.REFERENCE'),
  }
  const bindingKindLabels = formBindingKindValues.reduce<Record<FormBindingKind, string>>((result, bindingKind) => {
    result[bindingKind] = messages(`studio.bindingKindLabels.${bindingKind}`)
    return result
  }, {} as Record<FormBindingKind, string>)
  const bindingKindDescriptions = formBindingKindValues.reduce<Record<FormBindingKind, string>>((result, bindingKind) => {
    result[bindingKind] = messages(`studio.bindingKindDescriptions.${bindingKind}`)
    return result
  }, {} as Record<FormBindingKind, string>)
  const bindingEntryLabels = formBindingCatalog.reduce<Record<string, string>>((result, entry) => {
    result[entry.id] = messages(`studio.bindingEntryLabels.${entry.id}`)
    return result
  }, {})
  const bindingEntryDescriptions = formBindingCatalog.reduce<Record<string, string>>((result, entry) => {
    result[entry.id] = messages(`studio.bindingEntryDescriptions.${entry.id}`)
    return result
  }, {})

  const labels: StudioLabels = {
    title: messages('studio.title'),
    description: messages('studio.description'),
    processCatalog: messages('studio.processCatalog'),
    formCatalog: messages('studio.formCatalog'),
    search: messages('studio.search'),
    status: messages('studio.status'),
    allStatuses: messages('studio.allStatuses'),
    draft: messages('studio.draft'),
    published: messages('studio.published'),
    retired: messages('studio.retired'),
    newProcess: messages('studio.newProcess'),
    clone: messages('studio.clone'),
    noDefinitions: messages('studio.noDefinitions'),
    noValue: messages('studio.noValue'),
    chooseDefinition: messages('studio.chooseDefinition'),
    processStudio: messages('studio.processStudio'),
    formStudio: messages('studio.formStudio'),
    stepList: messages('studio.stepList'),
    steps: messages('studio.steps'),
    step: messages('studio.step'),
    stepType: messages('studio.stepType'),
    participant: messages('studio.participant'),
    titleNl: messages('studio.titleNl'),
    titleEn: messages('studio.titleEn'),
    descriptionNl: messages('studio.descriptionNl'),
    descriptionEn: messages('studio.descriptionEn'),
    fieldLibrary: messages('studio.fieldLibrary'),
    addField: messages('studio.addField'),
    fields: messages('studio.fields'),
    accessMatrix: messages('studio.accessMatrix'),
    hidden: messages('studio.hidden'),
    read: messages('studio.read'),
    writeOptional: messages('studio.writeOptional'),
    writeRequired: messages('studio.writeRequired'),
    preview: messages('studio.preview'),
    previewParticipant: messages('studio.previewParticipant'),
    desktop: messages('studio.desktop'),
    mobile: messages('studio.mobile'),
    syntheticData: messages('studio.syntheticData'),
    saved: messages('studio.saved'),
    saving: messages('studio.saving'),
    saveError: messages('studio.saveError'),
    revisionConflict: messages('studio.revisionConflict'),
    startEditing: messages('studio.startEditing'),
    readOnly: messages('studio.readOnly'),
    publish: messages('studio.publish'),
    publishConfirmation: messages('studio.publishConfirmation'),
    changelog: messages('studio.changelog'),
    changelogPlaceholder: messages('studio.changelogPlaceholder'),
    cancel: messages('studio.cancel'),
    confirmPublish: messages('studio.confirmPublish'),
    retire: messages('studio.retire'),
    retireReason: messages('studio.retireReason'),
    confirmRetire: messages('studio.confirmRetire'),
    versionDiff: messages('studio.versionDiff'),
    noChanges: messages('studio.noChanges'),
    compilerFeedback: messages('studio.compilerFeedback'),
    path: messages('studio.path'),
    processTrial: messages('studio.processTrial'),
    trialDate: messages('studio.trialDate'),
    runTrial: messages('studio.runTrial'),
    trialNoWrites: messages('studio.trialNoWrites'),
    trialPath: messages('studio.trialPath'),
    trialParticipants: messages('studio.trialParticipants'),
    trialOutput: messages('studio.trialOutput'),
    success: messages('studio.success'),
    warning: messages('studio.warning'),
    blocking: messages('studio.blocking'),
    compilerBlocked: messages('studio.compilerBlocked'),
    selected: messages('studio.selected'),
    formSection: messages('studio.formSection'),
    noFields: messages('studio.noFields'),
    fieldKey: messages('studio.fieldKey'),
    fieldType: messages('studio.fieldType'),
    fieldTypeLabels,
    fieldTypeLabelsNl,
    fieldTypeLabelsEn,
    fieldTypeGroups,
    bindingKindLabels,
    bindingKindDescriptions,
    bindingEntryLabels,
    bindingEntryDescriptions,
    fieldLabel: messages('studio.fieldLabel'),
    fieldHelp: messages('studio.fieldHelp'),
    fieldHelpNl: messages('studio.fieldHelpNl'),
    fieldHelpEn: messages('studio.fieldHelpEn'),
    fieldProperties: messages('studio.fieldProperties'),
    fieldKeyHelp: messages('studio.fieldKeyHelp'),
    fieldBinding: messages('studio.fieldBinding'),
    bindingKind: messages('studio.bindingKind'),
    bindingRegistryKey: messages('studio.bindingRegistryKey'),
    bindingFormulaKey: messages('studio.bindingFormulaKey'),
    bindingSelectionHelp: messages('studio.bindingSelectionHelp'),
    bindingUnknown: messages('studio.bindingUnknown'),
    fieldOptions: messages('studio.fieldOptions'),
    optionValue: messages('studio.optionValue'),
    optionLabelNl: messages('studio.optionLabelNl'),
    optionLabelEn: messages('studio.optionLabelEn'),
    addOption: messages('studio.addOption'),
    removeOption: messages('studio.removeOption'),
    noOptions: messages('studio.noOptions'),
    version: messages('studio.version'),
    formsCount: messages('studio.formsCount'),
    overview: messages('studio.overview'),
    overviewDescription: messages('studio.overviewDescription'),
    totalDefinitions: messages('studio.totalDefinitions'),
    productionDefinitions: messages('studio.productionDefinitions'),
    draftDefinitions: messages('studio.draftDefinitions'),
    retiredDefinitions: messages('studio.retiredDefinitions'),
    productionHelp: messages('studio.productionHelp'),
    catalogDescription: messages('studio.catalogDescription'),
    selectedDefinition: messages('studio.selectedDefinition'),
    studioNavigation: messages('studio.studioNavigation'),
    newWizardTitle: messages('studio.newWizardTitle'),
    newWizardDescription: messages('studio.newWizardDescription'),
    wizardBasics: messages('studio.wizardBasics'),
    wizardStartingPoint: messages('studio.wizardStartingPoint'),
    wizardReview: messages('studio.wizardReview'),
    processName: messages('studio.processName'),
    processNamePlaceholder: messages('studio.processNamePlaceholder'),
    processKey: messages('studio.processKey'),
    processKeyHelp: messages('studio.processKeyHelp'),
    blankProcess: messages('studio.blankProcess'),
    blankProcessDescription: messages('studio.blankProcessDescription'),
    certifiedRecipe: messages('studio.certifiedRecipe'),
    certifiedRecipeDescription: messages('studio.certifiedRecipeDescription'),
    continue: messages('studio.continue'),
    back: messages('studio.back'),
    createDraft: messages('studio.createDraft'),
    creationSummary: messages('studio.creationSummary'),
    language: messages('studio.language'),
    viewport: messages('studio.viewport'),
    dutch: messages('studio.dutch'),
    english: messages('studio.english'),
    candidates: messages('studio.candidates'),
    sla: messages('studio.sla'),
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-5 py-8 lg:px-10">
      <AdminSettingsPageHeader
        backLabel={messages('studio.backToSettings')}
        eyebrow={messages('studio.eyebrow')}
        subtitle={messages('studio.description')}
        title={messages('studio.title')}
      />
      <CertifiedRecipePanel
        canWrite={canWrite}
        labels={{
          eyebrow: messages('p9.catalogEyebrow'),
          title: messages('p9.catalogTitle'),
          description: messages('p9.catalogDescription'),
          activate: messages('p9.activate'),
          activated: messages('p9.activated'),
          activationFailed: messages('p9.activationFailed'),
        }}
        recipes={recipes}
      />
      <StudioWorkspace
        canPublish={canPublish}
        canWrite={canWrite}
        initialCatalog={catalog}
        initialSelection={initialSelection}
        initialTab={initialTab}
        labels={labels}
        key={`${selectedId ?? 'none'}:${initialTab}`}
      />
    </div>
  )
}
