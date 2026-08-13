import { z } from 'zod'

export const recruitmentGuidSchema = z.guid()
export const terminalOutcomeSchema = z.enum(['AFGEWEZEN', 'AANGENOMEN'])
export const assessmentStatusSchema = z.enum(['DRAFT', 'SUBMITTED', 'CORRECTED'])

export const applicationStateSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ACTIVE'), stageId: recruitmentGuidSchema, version: z.number().int().positive() }).strict(),
  z.object({ kind: z.literal('TERMINAL'), outcome: terminalOutcomeSchema, version: z.number().int().positive() }).strict(),
])

export type ApplicationState = z.infer<typeof applicationStateSchema>
export type TerminalOutcome = z.infer<typeof terminalOutcomeSchema>
export type AssessmentStatus = z.infer<typeof assessmentStatusSchema>

export const RECRUITMENT_PERMISSIONS = [
  'recruitment-vacancy:read',
  'recruitment-vacancy:write',
  'recruitment-vacancy:publish',
  'recruitment-candidate:read',
  'recruitment-candidate:write',
  'recruitment-assessment:read',
  'recruitment-assessment:write',
  'recruitment-settings:manage',
  'recruitment-participation:read',
  'recruitment-participation:write',
] as const

export type RecruitmentPermission = typeof RECRUITMENT_PERMISSIONS[number]
export type ParticipationStatus = 'ASSIGNED' | 'ACTIVE' | 'REVOKED'
export type ParticipationCapability = 'APPLICATION_READ' | 'DOCUMENT_READ' | 'INTERVIEW_READ' | 'ASSESSMENT_READ' | 'ASSESSMENT_WRITE'

export interface RecruitmentActorContext {
  readonly userId: string
  readonly employeeId: string | null
  readonly tenantId: string
  readonly hrGroupId: string
  readonly permissions: readonly string[]
}

export interface ParticipantProjection {
  readonly employeeId: string
  readonly status: ParticipationStatus
  readonly capabilities: readonly ParticipationCapability[]
}

export interface ApplicationProjection {
  readonly id: string
  readonly tenantId: string
  readonly hrGroupId: string
  readonly state: ApplicationState
  readonly participations: readonly ParticipantProjection[]
}

export interface TerminalTransitionInput {
  readonly applicationId: string
  readonly outcome: TerminalOutcome
  readonly reason: string
  readonly expectedVersion: number
  readonly idempotencyKey: string
}

export interface HireConversionInput {
  readonly applicationId: string
  readonly administrationId: string
  readonly employeeChoice: 'EXISTING' | 'NEW' | 'REHIRE'
  readonly employeeId: string | null
  readonly employmentId: string | null
  readonly expectedVersion: number
  readonly idempotencyKey: string
}

export interface AssessmentRevision {
  readonly assessmentId: string
  readonly revision: number
  readonly status: AssessmentStatus
  readonly correctedFromAssessmentId: string | null
  readonly correctionReason: string | null
}

export interface PublicVacancyProjection {
  readonly publicationId: string
  readonly slug: string
  readonly title: string
  readonly location: string | null
  readonly content: Readonly<Record<string, unknown>>
}

export interface PublicApplicationInput {
  readonly publicationId: string
  readonly slug: string
  readonly firstName: string
  readonly lastName: string
  readonly privateEmail: string
  readonly phone: string | null
  readonly motivation: string | null
  readonly answers: readonly { readonly questionId: string; readonly value: unknown }[]
  readonly challengeToken: string
  readonly honeypot: string
  readonly renderedAt: string
  readonly idempotencyKey: string
}

export function transitionApplication(
  current: ApplicationState,
  input: { readonly stageId: string; readonly expectedVersion: number },
): Extract<ApplicationState, { kind: 'ACTIVE' }> {
  if (current.version !== input.expectedVersion) throw new Error('RECRUITMENT_VERSION_CONFLICT')
  if (current.kind === 'TERMINAL') throw new Error('RECRUITMENT_APPLICATION_TERMINAL')
  return { kind: 'ACTIVE', stageId: recruitmentGuidSchema.parse(input.stageId), version: current.version + 1 }
}

export function reopenApplication(
  current: ApplicationState,
  input: { readonly stageId: string; readonly expectedVersion: number },
): { readonly state: Extract<ApplicationState, { kind: 'ACTIVE' }>; readonly restoreParticipantAccess: false } {
  if (current.version !== input.expectedVersion) throw new Error('RECRUITMENT_VERSION_CONFLICT')
  if (current.kind !== 'TERMINAL') throw new Error('RECRUITMENT_APPLICATION_NOT_TERMINAL')
  return {
    state: { kind: 'ACTIVE', stageId: recruitmentGuidSchema.parse(input.stageId), version: current.version + 1 },
    restoreParticipantAccess: false,
  }
}

export function createCandidateDuplicateSignal(email: string): { readonly normalizedEmail: string; readonly requiresHumanDecision: true } {
  return { normalizedEmail: z.email().parse(email.trim().toLowerCase()), requiresHumanDecision: true }
}

export function calculateRetentionDueAt(terminalAt: string, retentionDays: number): string {
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) throw new Error('RECRUITMENT_RETENTION_INVALID')
  const date = new Date(terminalAt)
  if (Number.isNaN(date.valueOf())) throw new Error('RECRUITMENT_TERMINAL_DATE_INVALID')
  date.setUTCDate(date.getUTCDate() + retentionDays)
  return date.toISOString()
}

export function canReviewerSeePeerScores(status: AssessmentStatus): boolean {
  return status !== 'DRAFT'
}
