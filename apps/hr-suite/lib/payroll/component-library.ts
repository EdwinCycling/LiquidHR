import 'server-only'

import {
  getSystemComponentCatalog,
  getSystemRulePackages,
  findSystemComponentCatalogEntryByKey,
  getSystemRulePackageByCompositionId,
} from './component-catalog'
import { createComponentDraftRepository } from './component-draft-repository'
import {
  ComponentDraftServiceError,
  createComponentDraftService,
  toDraftCatalogEntry,
  type ComponentDraftEditorInput,
  type PreparedComponentDraft,
} from './component-draft-service'
import { requireComponentLibraryAccess } from './component-library-access'
import { parseComponentEditorPayload, type ComponentEditorPayload } from './component-editor-contract'
import { validatePreparedComponentDraft } from './component-editor-engine'

function draftService() {
  return createComponentDraftService({
    repository: createComponentDraftRepository(),
    catalog: {
      getSystemComponentByKey: findSystemComponentCatalogEntryByKey,
      getSystemRulePackageByCompositionId,
    },
  })
}

function toServiceInput(parsed: ReturnType<typeof parseComponentEditorPayload> & { readonly success: true }): {
  readonly input: ComponentDraftEditorInput
  readonly previewInputs: ComponentEditorPayload['previewInputs']
} {
  const { previewInputs, ...input } = parsed.data
  return { input, previewInputs }
}

async function prepareEditor(payload: unknown): Promise<{
  readonly prepared: PreparedComponentDraft
  readonly previewInputs: ComponentEditorPayload['previewInputs']
}> {
  const access = await requireComponentLibraryAccess(true)
  const parsed = parseComponentEditorPayload(payload)
  if (!parsed.success) throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_INPUT_INVALID')
  const { input, previewInputs } = toServiceInput(parsed)
  const service = draftService()
  const prepared = input.draftId
    ? await service.prepareVersion(access.scope, access.administration.id, input)
    : await service.prepareCustomerCustom(access.scope, access.administration.id, input)
  return { prepared, previewInputs }
}

export async function getComponentLibrary() {
  const access = await requireComponentLibraryAccess()
  const drafts = await draftService().list(access.scope, access.administration.id)
  return {
    components: [...getSystemComponentCatalog(), ...drafts.map(toDraftCatalogEntry)],
    canCopy: access.canCopy,
    packageOptions: getSystemRulePackages().map((rulePackage) => ({
      compositionId: rulePackage.compositionId,
      packageId: rulePackage.metadata?.packageId ?? rulePackage.compositionId,
      version: rulePackage.metadata?.version ?? '',
    })),
  }
}

export async function copySystemComponent(catalogKey: string) {
  const access = await requireComponentLibraryAccess(true)
  return draftService().forkSystemComponent(access.scope, access.administration.id, access.actorUserId, catalogKey)
}

export async function validateComponentDraft(payload: unknown) {
  const { prepared, previewInputs } = await prepareEditor(payload)
  return validatePreparedComponentDraft(prepared, previewInputs)
}

export async function previewComponentDraft(payload: unknown) {
  const { prepared, previewInputs } = await prepareEditor(payload)
  return validatePreparedComponentDraft(prepared, previewInputs)
}

export async function saveComponentDraft(payload: unknown) {
  const access = await requireComponentLibraryAccess(true)
  const parsed = parseComponentEditorPayload(payload)
  if (!parsed.success) {
    return { ok: false as const, issues: parsed.issues.map((issue) => issue.code) }
  }
  const { input, previewInputs } = toServiceInput(parsed)
  const service = draftService()
  try {
    const prepared = input.draftId
      ? await service.prepareVersion(access.scope, access.administration.id, input)
      : await service.prepareCustomerCustom(access.scope, access.administration.id, input)
    const validation = validatePreparedComponentDraft(prepared, previewInputs)
    if (!validation.valid) return { ok: false as const, issues: validation.issues }

    const saved = input.draftId
      ? await service.saveVersion(access.scope, access.administration.id, access.actorUserId, input)
      : await service.createCustomerCustom(access.scope, access.administration.id, access.actorUserId, input)
    return { ok: true as const, draftId: saved.id, version: saved.component_version }
  } catch (error) {
    if (error instanceof ComponentDraftServiceError) return { ok: false as const, issues: [error.code] }
    return { ok: false as const, issues: ['PAYROLL_COMPONENT_DRAFT_SAVE_FAILED'] }
  }
}
