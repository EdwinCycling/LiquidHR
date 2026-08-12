import { z } from 'zod'

const localizedTextSchema = z.record(z.string(), z.string())

const journeyTopicSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  title: localizedTextSchema,
  body: localizedTextSchema,
  topicType: z.enum(['INFORMATION', 'ACTION', 'CHECK_IN', 'DOCUMENT']),
  isRequired: z.boolean(),
  status: z.enum(['PENDING', 'COMPLETED', 'SKIPPED']),
  actionUrl: z.string().nullable(),
  ownerRoleKey: z.string(),
}).strict()

const journeyMomentSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: localizedTextSchema,
  scheduledOn: z.string(),
  availableOn: z.string(),
  sortOrder: z.number().int(),
  topics: z.array(journeyTopicSchema),
}).strict()

const journeyPhaseSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: localizedTextSchema,
  sortOrder: z.number().int(),
  moments: z.array(journeyMomentSchema),
}).strict()

const journeyNextActionSchema = journeyTopicSchema.extend({
  momentId: z.string().uuid(),
  momentName: localizedTextSchema,
  scheduledOn: z.string(),
  availableOn: z.string(),
  availability: z.enum(['UPCOMING', 'AVAILABLE']),
}).strict()

const journeyParticipantSchema = z.object({
  roleKey: z.string(),
  roleName: localizedTextSchema,
  employeeName: z.string().nullable(),
  status: z.enum(['ASSIGNED', 'ACTIVE']),
}).strict()

export const journeyProjectionSchema = z.object({
  id: z.string().uuid(),
  templateName: localizedTextSchema,
  status: z.enum(['PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']),
  anchorDate: z.string(),
  targetEmployeeName: z.string().nullable(),
  relationship: z.enum(['HR', 'SELF', 'PARTICIPANT']),
  progress: z.object({ completed: z.number().int().nonnegative(), total: z.number().int().nonnegative() }).strict(),
  nextAction: journeyNextActionSchema.nullable(),
  participants: z.array(journeyParticipantSchema),
  phases: z.array(journeyPhaseSchema),
}).strict()

export const journeyProjectionListSchema = z.array(journeyProjectionSchema)
export const journeyTopicOutcomeResultSchema = z.object({
  topicId: z.string().uuid(),
  status: z.enum(['PENDING', 'COMPLETED', 'SKIPPED']),
  outcomeId: z.string().uuid().nullable(),
  idempotentReplay: z.boolean(),
}).strict()

export type JourneyProjection = z.infer<typeof journeyProjectionSchema>
export type JourneyProjectionList = z.infer<typeof journeyProjectionListSchema>
export type JourneyProjectionTopic = z.infer<typeof journeyTopicSchema>
export type JourneyProjectionNextAction = z.infer<typeof journeyNextActionSchema>
export type JourneyTopicOutcomeResult = z.infer<typeof journeyTopicOutcomeResultSchema>

export type JourneyTopicOutcome = 'COMPLETE' | 'SKIP' | 'CHECK_IN'

export function localizedValue(value: Record<string, string>, locale: string): string {
  return value[locale] ?? value.nl ?? value.en ?? Object.values(value)[0] ?? ''
}

export function journeyProgressPercent(progress: JourneyProjection['progress']): number {
  if (progress.total === 0) return 0
  return Math.min(100, Math.round((progress.completed / progress.total) * 100))
}
