import { requireAnyPermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { supabaseJourneyTemplateRepository } from './template-repository'
import { createJourneyTemplateService } from './template-service'

export { calculateJourneyDate, resolveJourneyRole, type JourneyRoleResolution, type JourneyTemplateDraft } from './domain'
export { JourneyTemplateServiceError, type JourneyTemplateCatalogItem, type JourneyTemplateDetail } from './template-service'

export const journeyTemplates = createJourneyTemplateService({
  repository: supabaseJourneyTemplateRepository,
  authorize: (permissions) => requireAnyPermission([...permissions]),
  requireModule: requireTenantModule,
})

export const publishJourneyTemplate = journeyTemplates.publishJourneyTemplate
