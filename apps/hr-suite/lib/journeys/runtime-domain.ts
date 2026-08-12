import { calculateJourneyDate, type JourneyTemplateDraft } from './domain'

export interface JourneyActivationTemplate extends JourneyTemplateDraft {
  readonly templateId: string
  readonly templateVersionId: string
  readonly templateVersionNumber: number
}

export type JourneyParticipantSource = 'TARGET_EMPLOYEE' | 'DIRECT_MANAGER' | 'DEPARTMENT_MANAGER' | 'SPECIFIC_EMPLOYEE' | 'MANUAL'

export interface ResolvedJourneyEmployee {
  readonly employeeId: string
  readonly name: string
  readonly source: JourneyParticipantSource
}

export type JourneyActivationResolution =
  | { readonly roleKey: string; readonly status: 'RESOLVED'; readonly employees: readonly ResolvedJourneyEmployee[] }
  | { readonly roleKey: string; readonly status: 'MISSING'; readonly blocking: boolean; readonly employees: readonly [] }
  | { readonly roleKey: string; readonly status: 'AMBIGUOUS'; readonly employees: readonly []; readonly candidateEmployeeIds: readonly string[] }

export interface JourneyActivationIssues {
  readonly blocking: readonly string[]
  readonly warnings: readonly string[]
}

export function validateJourneyActivation(
  roles: JourneyActivationTemplate['roles'],
  resolutions: readonly JourneyActivationResolution[],
): JourneyActivationIssues {
  const resolutionByRole = new Map(resolutions.map((resolution) => [resolution.roleKey, resolution]))
  const blocking: string[] = []
  const warnings: string[] = []
  for (const role of roles) {
    const resolution = resolutionByRole.get(role.key)
    if (!resolution || resolution.status === 'MISSING') {
      if (role.required) blocking.push(`JOURNEY_REQUIRED_PARTICIPANT_MISSING:${role.key}`)
      else warnings.push(`JOURNEY_OPTIONAL_PARTICIPANT_MISSING:${role.key}`)
      continue
    }
    if (resolution.status === 'AMBIGUOUS') {
      blocking.push(`JOURNEY_PARTICIPANT_AMBIGUOUS:${role.key}`)
      continue
    }
    if (role.cardinality === 'ONE' && resolution.employees.length !== 1) blocking.push(`JOURNEY_PARTICIPANT_CARDINALITY_INVALID:${role.key}`)
    if (role.cardinality === 'MANY' && resolution.employees.length === 0 && role.required) blocking.push(`JOURNEY_REQUIRED_PARTICIPANT_MISSING:${role.key}`)
  }
  return { blocking, warnings }
}

export interface JourneyActivationPreviewInput {
  readonly template: JourneyActivationTemplate
  readonly targetEmployeeId: string
  readonly targetEmployeeName: string
  readonly employmentId: string | null
  readonly anchorDate: string
  readonly resolutions: readonly JourneyActivationResolution[]
}

export function buildJourneyActivationPreview(input: JourneyActivationPreviewInput) {
  const issues = validateJourneyActivation(input.template.roles, input.resolutions)
  const roleNameByKey = new Map(input.template.roles.map((role) => [role.key, role.name]))
  return {
    templateId: input.template.templateId,
    templateVersionId: input.template.templateVersionId,
    templateVersionNumber: input.template.templateVersionNumber,
    templateName: input.template.name,
    targetEmployeeId: input.targetEmployeeId,
    targetEmployeeName: input.targetEmployeeName,
    employmentId: input.employmentId,
    anchorDate: input.anchorDate,
    phases: input.template.phases.map((phase) => ({ ...phase })),
    moments: input.template.moments.map((moment) => ({
      ...moment,
      scheduledOn: calculateJourneyDate(input.anchorDate, moment.dateOffsetDays),
      availableOn: calculateJourneyDate(input.anchorDate, moment.availabilityOffsetDays),
    })),
    topics: input.template.topics.map((topic) => ({ ...topic, audienceRoleKeys: [...topic.audienceRoleKeys] })),
    participants: input.resolutions.map((resolution) => ({
      ...resolution,
      roleName: roleNameByKey.get(resolution.roleKey) ?? { nl: resolution.roleKey, en: resolution.roleKey },
      employees: [...resolution.employees],
    })),
    blockingIssues: issues.blocking,
    warnings: issues.warnings,
    canActivate: issues.blocking.length === 0,
  }
}

export type JourneyActivationPreview = ReturnType<typeof buildJourneyActivationPreview>

export type JourneyAttention = 'PLANNED' | 'UPCOMING' | 'ATTENTION' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'

export function deriveJourneyAttention(input: {
  readonly status: 'PLANNED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'
  readonly nextMomentOn: string | null
  readonly overdueRequiredTopics: number
  readonly today: string
}): JourneyAttention {
  if (input.status === 'PLANNED' || input.status === 'PAUSED' || input.status === 'COMPLETED' || input.status === 'CANCELLED') return input.status
  if (input.overdueRequiredTopics > 0) return 'ATTENTION'
  if (input.nextMomentOn !== null && input.nextMomentOn >= input.today) return 'UPCOMING'
  return 'ATTENTION'
}
