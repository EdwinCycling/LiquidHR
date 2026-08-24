import { requireAnyPermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { supabaseJourneyTemplateRepository } from './template-repository'
import { createJourneyTemplateService } from './template-service'
import { supabaseJourneyRuntimeRepository } from './runtime-repository'
import { createJourneyRuntimeService } from './runtime-service'

export { calculateJourneyDate, resolveJourneyRole, type JourneyRoleResolution, type JourneyTemplateDraft } from './domain'
export { JourneyTemplateServiceError, type JourneyTemplateCatalogItem, type JourneyTemplateDetail } from './template-service'
export { JourneyRuntimeServiceError, type JourneyRuntimeDetail, type JourneyRuntimeListItem, type JourneyStartOptions } from './runtime-service'
export {
  getEmployeeJourneyProjections,
  getJourneyProjection,
  listJourneyProjections,
  listJourneyProjectionsForContext,
  recordJourneyTopicOutcome,
  JourneyProjectionServiceError,
} from './projection-service'
export {
  journeyProgressPercent,
  localizedValue,
  type JourneyProjection,
  type JourneyProjectionList,
  type JourneyProjectionNextAction,
  type JourneyProjectionTopic,
  type JourneyTopicOutcomeResult,
} from './projection-domain'
export {
  createJourneyParticipantService,
  findJourneyParticipantAssignment,
  getJourneyParticipantDetail,
  listJourneyParticipantAssignments,
  recordJourneyParticipantProgress,
  type JourneyParticipantAssignment,
  type JourneyParticipantProgressInput,
  type JourneyParticipantServiceDependencies,
} from './participant-service'

export const journeyTemplates = createJourneyTemplateService({
  repository: supabaseJourneyTemplateRepository,
  authorize: (permissions) => requireAnyPermission([...permissions]),
  requireModule: requireTenantModule,
})

export const publishJourneyTemplate = journeyTemplates.publishJourneyTemplate

export const journeyRuntime = createJourneyRuntimeService({
  repository: supabaseJourneyRuntimeRepository,
  authorize: (permissions) => requireAnyPermission([...permissions]),
  requireModule: requireTenantModule,
})
