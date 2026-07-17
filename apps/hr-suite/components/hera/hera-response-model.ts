import { z } from 'zod'

const evidenceSchema = z.object({
  source: z.literal('LIQUID_HR'),
  data: z.unknown(),
  scope: z.object({
    population: z.string(),
    visibleCount: z.number().int().nonnegative(),
  }).strict(),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.string(),
  }).strict()),
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  uncertainties: z.array(z.string()),
}).strict()

const metadataSchema = z.object({ evidence: evidenceSchema }).passthrough()

export type HeRaEvidence = z.infer<typeof evidenceSchema>

export function evidenceFromMessageMetadata(metadata: unknown): HeRaEvidence | null {
  const parsed = metadataSchema.safeParse(metadata)
  return parsed.success ? parsed.data.evidence : null
}
