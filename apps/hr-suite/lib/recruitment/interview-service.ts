import { z } from 'zod'
import { recruitmentGuidSchema } from './domain'
import { setItemTypeSchema } from './set-service'

export const interviewInputSchema = z.object({
  applicationId: recruitmentGuidSchema,
  title: z.string().trim().min(1).max(180),
  scheduledAt: z.iso.datetime().nullable(),
  setId: recruitmentGuidSchema.nullable(),
  participants: z.array(recruitmentGuidSchema).min(1).max(20),
}).strict()

interface SnapshotItem {
  readonly itemType: z.infer<typeof setItemTypeSchema>
  readonly title: string
  readonly content: Record<string, unknown>
}

export function buildInterviewSnapshots(items: readonly SnapshotItem[]): {
  readonly preparation: readonly SnapshotItem[]
  readonly questions: readonly SnapshotItem[]
  readonly criteria: readonly SnapshotItem[]
} {
  return {
    preparation: items.filter((item) => item.itemType === 'PREPARATION'),
    questions: items.filter((item) => item.itemType === 'INTERVIEW_QUESTION'),
    criteria: items.filter((item) => item.itemType === 'CRITERION'),
  }
}
