import { redirect } from 'next/navigation'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { CertifiedRecipePanel } from '@/components/process-automation/certified-recipe-panel'
import { StudioWorkspace, type StudioLabels } from '@/components/process-automation/studio-workspace'
import type { ProcessFlowEditorLabels } from '@/components/process-automation/process-flow-editor'
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
import { getLocale, getTranslator } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

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

  const [{ definition: requestedDefinition, tab: requestedTab }, locale, messages, messagesNl, messagesEn, catalog, recipes, canWrite, canPublish] = await Promise.all([
    searchParams,
    getLocale(),
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

  const flowEditor: ProcessFlowEditorLabels = {
    language: locale,
    stepList: messages('studio.flowEditor.stepList'),
    stepLibrary: messages('studio.flowEditor.stepLibrary'),
    stepName: messages('studio.flowEditor.stepName'),
    stepType: messages('studio.flowEditor.stepType'),
    stepTypeLabels: {
      FORM: messages('studio.flowEditor.stepTypes.FORM'),
      DECISION: messages('studio.flowEditor.stepTypes.DECISION'),
      END: messages('studio.flowEditor.stepTypes.END'),
    },
    stepTypeLabelsNl: {
      FORM: messagesNl('studio.flowEditor.stepTypes.FORM'),
      DECISION: messagesNl('studio.flowEditor.stepTypes.DECISION'),
      END: messagesNl('studio.flowEditor.stepTypes.END'),
    },
    stepTypeLabelsEn: {
      FORM: messagesEn('studio.flowEditor.stepTypes.FORM'),
      DECISION: messagesEn('studio.flowEditor.stepTypes.DECISION'),
      END: messagesEn('studio.flowEditor.stepTypes.END'),
    },
    responsible: messages('studio.flowEditor.responsible'),
    responsibleMissing: messages('studio.flowEditor.responsibleMissing'),
    addResponsible: messages('studio.flowEditor.addResponsible'),
    roleLabels: {
      employee: messages('studio.flowEditor.roles.employee'),
      manager: messages('studio.flowEditor.roles.manager'),
      'hr-team': messages('studio.flowEditor.roles.hrTeam'),
    },
    roleLabelsNl: {
      employee: messagesNl('studio.flowEditor.roles.employee'),
      manager: messagesNl('studio.flowEditor.roles.manager'),
      'hr-team': messagesNl('studio.flowEditor.roles.hrTeam'),
    },
    roleLabelsEn: {
      employee: messagesEn('studio.flowEditor.roles.employee'),
      manager: messagesEn('studio.flowEditor.roles.manager'),
      'hr-team': messagesEn('studio.flowEditor.roles.hrTeam'),
    },
    roleDescriptions: {
      employee: messages('studio.flowEditor.roleDescriptions.employee'),
      manager: messages('studio.flowEditor.roleDescriptions.manager'),
      'hr-team': messages('studio.flowEditor.roleDescriptions.hrTeam'),
    },
    form: messages('studio.flowEditor.form'),
    noForms: messages('studio.flowEditor.noForms'),
    noFormsHelp: messages('studio.flowEditor.noFormsHelp'),
    addStep: messages('studio.flowEditor.addStep'),
    moveStepUp: messages('studio.flowEditor.moveStepUp'),
    moveStepDown: messages('studio.flowEditor.moveStepDown'),
    removeStep: messages('studio.flowEditor.removeStep'),
    removeStepTitle: messages('studio.flowEditor.removeStepTitle'),
    removeStepDescription: messages('studio.flowEditor.removeStepDescription'),
    confirmRemoveStep: messages('studio.flowEditor.confirmRemoveStep'),
    cancelRemoveStep: messages('studio.flowEditor.cancelRemoveStep'),
    selectStep: messages('studio.flowEditor.selectStep'),
    addStepHelp: messages('studio.flowEditor.addStepHelp'),
    emptyFlow: messages('studio.flowEditor.emptyFlow'),
    emptyFlowHelp: messages('studio.flowEditor.emptyFlowHelp'),
    selectedStep: messages('studio.flowEditor.selectedStep'),
    properties: messages('studio.flowEditor.properties'),
    steps: messages('studio.flowEditor.steps'),
    stepLabel: messages('studio.flowEditor.stepLabel'),
    routeTitle: messages('studio.flowEditor.routeTitle'),
    addRoute: messages('studio.flowEditor.addRoute'),
    addRouteHelp: messages('studio.flowEditor.addRouteHelp'),
    routeAction: messages('studio.flowEditor.routeAction'),
    routeDestination: messages('studio.flowEditor.routeDestination'),
    routeLabel: messages('studio.flowEditor.routeLabel'),
    removeRoute: messages('studio.flowEditor.removeRoute'),
    noRoutes: messages('studio.flowEditor.noRoutes'),
    noDestination: messages('studio.flowEditor.noDestination'),
    advanced: messages('studio.advanced'),
    technicalKey: messages('studio.flowEditor.technicalKey'),
    terminalOutcome: messages('studio.flowEditor.terminalOutcome'),
    terminalOutcomes: {
      COMPLETED: messages('studio.flowEditor.terminalOutcomes.COMPLETED'),
      REJECTED: messages('studio.flowEditor.terminalOutcomes.REJECTED'),
      CANCELLED: messages('studio.flowEditor.terminalOutcomes.CANCELLED'),
    },
    terminalOutcomesNl: {
      COMPLETED: messagesNl('studio.flowEditor.terminalOutcomes.COMPLETED'),
      REJECTED: messagesNl('studio.flowEditor.terminalOutcomes.REJECTED'),
      CANCELLED: messagesNl('studio.flowEditor.terminalOutcomes.CANCELLED'),
    },
    terminalOutcomesEn: {
      COMPLETED: messagesEn('studio.flowEditor.terminalOutcomes.COMPLETED'),
      REJECTED: messagesEn('studio.flowEditor.terminalOutcomes.REJECTED'),
      CANCELLED: messagesEn('studio.flowEditor.terminalOutcomes.CANCELLED'),
    },
    actionLabels: {
      SUBMIT: messages('studio.flowEditor.actions.SUBMIT'),
      APPROVE: messages('studio.flowEditor.actions.APPROVE'),
      REJECT: messages('studio.flowEditor.actions.REJECT'),
      REQUEST_CHANGES: messages('studio.flowEditor.actions.REQUEST_CHANGES'),
      ACKNOWLEDGE: messages('studio.flowEditor.actions.ACKNOWLEDGE'),
      COMPLETE: messages('studio.flowEditor.actions.COMPLETE'),
      CANCEL: messages('studio.flowEditor.actions.CANCEL'),
    },
    actionLabelsNl: {
      SUBMIT: messagesNl('studio.flowEditor.actions.SUBMIT'),
      APPROVE: messagesNl('studio.flowEditor.actions.APPROVE'),
      REJECT: messagesNl('studio.flowEditor.actions.REJECT'),
      REQUEST_CHANGES: messagesNl('studio.flowEditor.actions.REQUEST_CHANGES'),
      ACKNOWLEDGE: messagesNl('studio.flowEditor.actions.ACKNOWLEDGE'),
      COMPLETE: messagesNl('studio.flowEditor.actions.COMPLETE'),
      CANCEL: messagesNl('studio.flowEditor.actions.CANCEL'),
    },
    actionLabelsEn: {
      SUBMIT: messagesEn('studio.flowEditor.actions.SUBMIT'),
      APPROVE: messagesEn('studio.flowEditor.actions.APPROVE'),
      REJECT: messagesEn('studio.flowEditor.actions.REJECT'),
      REQUEST_CHANGES: messagesEn('studio.flowEditor.actions.REQUEST_CHANGES'),
      ACKNOWLEDGE: messagesEn('studio.flowEditor.actions.ACKNOWLEDGE'),
      COMPLETE: messagesEn('studio.flowEditor.actions.COMPLETE'),
      CANCEL: messagesEn('studio.flowEditor.actions.CANCEL'),
    },
    connectionLabel: messages('studio.flowEditor.connectionLabel'),
    stepNeedsAttention: messages('studio.flowEditor.stepNeedsAttention'),
    stepIssueCount: messages('studio.flowEditor.stepIssueCount'),
    conditionalRoute: messages('studio.flowEditor.conditionalRoute'),
    conditionIfTrue: messages('studio.flowEditor.conditionEditor.whenTrue'),
    conditionOtherwise: messages('studio.flowEditor.conditionEditor.otherwise'),
    conditionEditor: {
      title: messages('studio.flowEditor.conditionEditor.title'),
      add: messages('studio.flowEditor.conditionEditor.add'),
      edit: messages('studio.flowEditor.conditionEditor.edit'),
      remove: messages('studio.flowEditor.conditionEditor.remove'),
      field: messages('studio.flowEditor.conditionEditor.field'),
      operator: messages('studio.flowEditor.conditionEditor.operator'),
      value: messages('studio.flowEditor.conditionEditor.value'),
      whenTrue: messages('studio.flowEditor.conditionEditor.whenTrue'),
      otherwise: messages('studio.flowEditor.conditionEditor.otherwise'),
      save: messages('studio.flowEditor.conditionEditor.save'),
      cancel: messages('studio.flowEditor.conditionEditor.cancel'),
      invalidValue: messages('studio.flowEditor.conditionEditor.invalidValue'),
      invalidDestination: messages('studio.flowEditor.conditionEditor.invalidDestination'),
      missingField: messages('studio.flowEditor.conditionEditor.missingField'),
      missingDestination: messages('studio.flowEditor.conditionEditor.missingDestination'),
      pairInvalid: messages('studio.flowEditor.conditionEditor.pairInvalid'),
      yes: messages('studio.flowEditor.conditionEditor.yes'),
      no: messages('studio.flowEditor.conditionEditor.no'),
      operatorLabels: {
        equals: messages('studio.flowEditor.conditionEditor.operators.equals'),
        notEquals: messages('studio.flowEditor.conditionEditor.operators.notEquals'),
        greaterThan: messages('studio.flowEditor.conditionEditor.operators.greaterThan'),
        lessThan: messages('studio.flowEditor.conditionEditor.operators.lessThan'),
        isEmpty: messages('studio.flowEditor.conditionEditor.operators.isEmpty'),
        isNotEmpty: messages('studio.flowEditor.conditionEditor.operators.isNotEmpty'),
      },
    },
    formCreationFollowUp: messages('studio.flowEditor.formCreationFollowUp'),
    startStep: messages('studio.flowEditor.startStep'),
    noSelection: messages('studio.flowEditor.noSelection'),
    unsupportedTypeHelp: messages('studio.flowEditor.unsupportedTypeHelp'),
  }

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
    formEditor: {
      addSection: messages('studio.addSection'),
      addForm: messages('studio.addForm'),
      formTitle: messages('studio.formTitle'),
      newFormTitleNl: messages('studio.newFormTitleNl'),
      newFormTitleEn: messages('studio.newFormTitleEn'),
      addFieldNeedsRole: messages('studio.addFieldNeedsRole'),
      emptySection: messages('studio.emptySection'),
      sectionTitle: messages('studio.sectionTitle'),
      sectionDefaultNl: messages('studio.sectionDefaultNl'),
      sectionDefaultEn: messages('studio.sectionDefaultEn'),
      moveUp: messages('studio.moveUp'),
      moveDown: messages('studio.moveDown'),
      duplicateField: messages('studio.duplicateField'),
      removeField: messages('studio.removeField'),
      removeFieldTitle: messages('studio.removeFieldTitle'),
      removeFieldDescription: messages('studio.removeFieldDescription'),
      confirmRemoveField: messages('studio.confirmRemoveField'),
      cancelRemoveField: messages('studio.cancelRemoveField'),
      newFieldNl: messages('studio.newFieldNl'),
      newFieldEn: messages('studio.newFieldEn'),
      copySuffix: messages('studio.copySuffix'),
      stepLinks: messages('studio.stepLinks'),
      noFormSteps: messages('studio.noFormSteps'),
      openProcessStudio: messages('studio.openProcessStudio'),
      previewStep: messages('studio.previewStep'),
      noLinkedForm: messages('studio.noLinkedForm'),
      fieldRules: messages('studio.fieldRules'),
    },
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
    trialConditionValues: messages('studio.trialConditionValues'),
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
    processDescriptionPlaceholder: messages('studio.processDescriptionPlaceholder'),
    blankStart: messages('studio.blankStart'),
    trainingRequestExample: messages('studio.trainingRequestExample'),
    trainingRequestExampleDescription: messages('studio.trainingRequestExampleDescription'),
    exampleNoDomainWrites: messages('studio.exampleNoDomainWrites'),
    automaticKey: messages('studio.automaticKey'),
    advanced: messages('studio.advanced'),
    compilerIssueMessages: {
      START_STEP_UNKNOWN: messages('studio.compilerIssues.START_STEP_UNKNOWN'),
      MISSING_END_STEP: messages('studio.compilerIssues.MISSING_END_STEP'),
      STEP_WITHOUT_EXIT: messages('studio.compilerIssues.STEP_WITHOUT_EXIT'),
      STEP_PARTICIPANT_REQUIRED: messages('studio.compilerIssues.STEP_PARTICIPANT_REQUIRED'),
      STEP_PARTICIPANT_UNKNOWN: messages('studio.compilerIssues.STEP_PARTICIPANT_UNKNOWN'),
      STEP_FORM_REQUIRED: messages('studio.compilerIssues.STEP_FORM_REQUIRED'),
      STEP_FORM_UNKNOWN: messages('studio.compilerIssues.STEP_FORM_UNKNOWN'),
      FORM_WITHOUT_FIELDS: messages('studio.compilerIssues.FORM_WITHOUT_FIELDS'),
      TRANSITION_SOURCE_UNKNOWN: messages('studio.compilerIssues.TRANSITION_SOURCE_UNKNOWN'),
      TRANSITION_TARGET_UNKNOWN: messages('studio.compilerIssues.TRANSITION_TARGET_UNKNOWN'),
      TRANSITION_ACTION_NOT_ALLOWED: messages('studio.compilerIssues.TRANSITION_ACTION_NOT_ALLOWED'),
      UNREACHABLE_STEP: messages('studio.compilerIssues.UNREACHABLE_STEP'),
      END_STEP_OUTCOME_REQUIRED: messages('studio.compilerIssues.END_STEP_OUTCOME_REQUIRED'),
      END_STEP_INVALID: messages('studio.compilerIssues.END_STEP_INVALID'),
      STEP_ACTION_INVALID: messages('studio.compilerIssues.STEP_ACTION_INVALID'),
      RECOVERY_TRANSITION_INVALID: messages('studio.compilerIssues.RECOVERY_TRANSITION_INVALID'),
    },
    flowEditor,
    continue: messages('studio.continue'),
    back: messages('studio.back'),
    createDraft: messages('studio.createDraft'),
    creationSummary: messages('studio.creationSummary'),
    discardChangesTitle: messages('studio.discardChangesTitle'),
    discardChangesDescription: messages('studio.discardChangesDescription'),
    discardChanges: messages('studio.discardChanges'),
    keepEditing: messages('studio.keepEditing'),
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
          adapterDetails: messages('p9.adapterDetails'),
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
