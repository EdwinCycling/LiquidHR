import 'server-only'

import { getSystemComponentCatalog, findSystemComponentCatalogEntryByKey } from './component-catalog'
import { createComponentDraftRepository } from './component-draft-repository'
import { createComponentDraftService, toDraftCatalogEntry } from './component-draft-service'
import { requireComponentLibraryAccess } from './component-library-access'

function draftService() {
  return createComponentDraftService({
    repository: createComponentDraftRepository(),
    catalog: { getSystemComponentByKey: findSystemComponentCatalogEntryByKey },
  })
}

export async function getComponentLibrary() {
  const access = await requireComponentLibraryAccess()
  const drafts = await draftService().list(access.scope, access.administration.id)
  return {
    components: [...getSystemComponentCatalog(), ...drafts.map(toDraftCatalogEntry)],
    canCopy: access.canCopy,
  }
}

export async function copySystemComponent(catalogKey: string) {
  const access = await requireComponentLibraryAccess(true)
  return draftService().forkSystemComponent(access.scope, access.administration.id, access.actorUserId, catalogKey)
}
