import type { AuthContext } from '@/lib/auth/permissions'
import type { ToggleableModuleCode } from '@/lib/modules/module-catalog'
import { buildJourneyActivationPreview, type JourneyActivationResolution, type JourneyActivationTemplate } from './runtime-domain'

export interface JourneyStartOptions {
  readonly templates: readonly { id: string; versionId: string; versionNumber: number; name: { nl: string; en: string }; journeyType: string }[]
  readonly employees: readonly { id: string; name: string; employeeNumber: string }[]
  readonly employments: readonly { id: string; employeeId: string; employmentNumber: string; startsOn: string; endsOn: string | null; isPrimary: boolean }[]
}

export interface JourneyRuntimeListItem {
  readonly id: string
  readonly templateName: { nl: string; en: string }
  readonly templateVersionNumber: number
  readonly targetEmployeeId: string
  readonly targetEmployeeName: string
  readonly targetEmployeeNumber: string
  readonly anchorDate: string
  readonly status: 'PLANNED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'
  readonly version: number
  readonly nextMomentOn: string | null
  readonly nextMomentName: { nl: string; en: string } | null
  readonly overdueRequiredTopics: number
  readonly progress: { readonly completed: number; readonly total: number }
  readonly participantNames: readonly string[]
}

export interface JourneyRuntimeDetail extends JourneyRuntimeListItem {
  readonly employmentId: string | null
  readonly phases: readonly { id: string; key: string; name: { nl: string; en: string }; sortOrder: number }[]
  readonly participants: readonly { id: string; roleKey: string; roleName: { nl: string; en: string }; employeeId: string; employeeName: string; source: string; status: string; resolutionNote: string | null }[]
  readonly moments: readonly { id: string; phaseId: string; key: string; name: { nl: string; en: string }; scheduledOn: string; availableOn: string; sortOrder: number }[]
  readonly topics: readonly { id: string; momentId: string; key: string; title: { nl: string; en: string }; topicType: string; isRequired: boolean; status: string; ownerRoleKey: string; ownerNames: readonly string[] }[]
  readonly changes: readonly { id: string; previousParticipantId: string; replacementParticipantId: string; reason: string; changedAt: string }[]
}

export interface JourneyPreviewInput {
  readonly templateVersionId: string
  readonly targetEmployeeId: string
  readonly employmentId: string | null
  readonly anchorDate: string
  readonly manualParticipants: Readonly<Record<string, readonly string[]>>
}

export interface JourneyActivateInput extends JourneyPreviewInput {
  readonly idempotencyKey: string
}

export interface JourneyRuntimeRepository {
  listStartOptions(tenantId: string, hrGroupId: string): Promise<JourneyStartOptions>
  getActivationTemplate(tenantId: string, hrGroupId: string, templateVersionId: string): Promise<JourneyActivationTemplate | null>
  resolveParticipants(input: { tenantId: string; hrGroupId: string; template: JourneyActivationTemplate; targetEmployeeId: string; employmentId: string | null; anchorDate: string; manualParticipants: Readonly<Record<string, readonly string[]>> }): Promise<{ targetEmployeeName: string; resolutions: readonly JourneyActivationResolution[] }>
  activate(input: { tenantId: string; hrGroupId: string; templateVersionId: string; targetEmployeeId: string; employmentId: string | null; anchorDate: string; idempotencyKey: string; participants: readonly { roleKey: string; employeeId: string; source: string; resolutionNote: string | null }[] }): Promise<{ id: string; version: number; idempotentReplay: boolean }>
  list(tenantId: string, hrGroupId: string): Promise<readonly JourneyRuntimeListItem[]>
  get(tenantId: string, hrGroupId: string, journeyId: string): Promise<JourneyRuntimeDetail | null>
  transition(journeyId: string, expectedVersion: number, action: 'PAUSE' | 'RESUME' | 'CANCEL' | 'COMPLETE'): Promise<{ id: string; status: string; version: number }>
  replaceParticipant(journeyId: string, participantId: string, replacementEmployeeId: string, expectedVersion: number, reason: string): Promise<{ id: string; participantId: string; version: number }>
}

export class JourneyRuntimeServiceError extends Error {
  constructor(readonly code: string, readonly status: number, readonly issues: readonly string[] = []) {
    super(code)
    this.name = 'JourneyRuntimeServiceError'
  }
}

export interface JourneyRuntimeServiceDependencies {
  readonly repository: JourneyRuntimeRepository
  readonly authorize: (permissions: readonly string[]) => Promise<AuthContext>
  readonly requireModule: (moduleCode: ToggleableModuleCode) => Promise<void>
}

function groupId(context: AuthContext): string {
  if (!context.hrGroupId) throw new JourneyRuntimeServiceError('JOURNEY_HR_GROUP_REQUIRED', 409)
  return context.hrGroupId
}

export function createJourneyRuntimeService(dependencies: JourneyRuntimeServiceDependencies) {
  async function contextFor(permissions: readonly string[]) {
    const context = await dependencies.authorize(permissions)
    await dependencies.requireModule('JOURNEYS')
    groupId(context)
    return context
  }

  async function previewWithContext(context: AuthContext, input: JourneyPreviewInput) {
    const template = await dependencies.repository.getActivationTemplate(context.tenantId, groupId(context), input.templateVersionId)
    if (!template) throw new JourneyRuntimeServiceError('JOURNEY_TEMPLATE_VERSION_NOT_PUBLISHED', 404)
    const resolved = await dependencies.repository.resolveParticipants({ tenantId: context.tenantId, hrGroupId: groupId(context), template, ...input })
    return buildJourneyActivationPreview({ template, targetEmployeeId: input.targetEmployeeId, targetEmployeeName: resolved.targetEmployeeName, employmentId: input.employmentId, anchorDate: input.anchorDate, resolutions: resolved.resolutions })
  }

  return {
    async startOptions() {
      const context = await contextFor(['journey:write'])
      return dependencies.repository.listStartOptions(context.tenantId, groupId(context))
    },
    async preview(input: JourneyPreviewInput) {
      const context = await contextFor(['journey:write'])
      return previewWithContext(context, input)
    },
    async activate(input: JourneyActivateInput) {
      const context = await contextFor(['journey:write'])
      const preview = await previewWithContext(context, input)
      if (!preview.canActivate) throw new JourneyRuntimeServiceError('JOURNEY_ACTIVATION_BLOCKED', 422, preview.blockingIssues)
      const participants = preview.participants.flatMap((resolution) => resolution.status === 'RESOLVED'
        ? resolution.employees.map((employee) => ({ roleKey: resolution.roleKey, employeeId: employee.employeeId, source: employee.source, resolutionNote: employee.source === 'MANUAL' ? 'Handmatig bevestigd door HR' : null }))
        : [])
      return dependencies.repository.activate({ tenantId: context.tenantId, hrGroupId: groupId(context), templateVersionId: input.templateVersionId, targetEmployeeId: input.targetEmployeeId, employmentId: input.employmentId, anchorDate: input.anchorDate, idempotencyKey: input.idempotencyKey, participants })
    },
    async list() {
      const context = await contextFor(['journey:read'])
      return dependencies.repository.list(context.tenantId, groupId(context))
    },
    async get(journeyId: string) {
      const context = await contextFor(['journey:read'])
      const detail = await dependencies.repository.get(context.tenantId, groupId(context), journeyId)
      if (!detail) throw new JourneyRuntimeServiceError('JOURNEY_NOT_FOUND', 404)
      return detail
    },
    async transition(journeyId: string, expectedVersion: number, action: 'PAUSE' | 'RESUME' | 'CANCEL' | 'COMPLETE') {
      await contextFor(['journey:write'])
      return dependencies.repository.transition(journeyId, expectedVersion, action)
    },
    async replaceParticipant(journeyId: string, participantId: string, replacementEmployeeId: string, expectedVersion: number, reason: string) {
      await contextFor(['journey:write'])
      if (reason.trim().length === 0) throw new JourneyRuntimeServiceError('JOURNEY_REPLACEMENT_REASON_REQUIRED', 400)
      return dependencies.repository.replaceParticipant(journeyId, participantId, replacementEmployeeId, expectedVersion, reason.trim())
    },
  }
}

export type JourneyRuntimeService = ReturnType<typeof createJourneyRuntimeService>
