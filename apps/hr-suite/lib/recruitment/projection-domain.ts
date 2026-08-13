import { z } from 'zod'

export const participantApplicationProjectionSchema = z.object({
  applicationId: z.guid(),
  vacancyTitle: z.string(),
  candidate: z.object({ firstName: z.string(), lastName: z.string() }).strict(),
  stage: z.object({ id: z.guid(), name: z.string() }).strict(),
  interview: z.object({ id: z.guid(), title: z.string(), scheduledAt: z.iso.datetime().nullable() }).strict().nullable(),
  capabilities: z.array(z.enum(['APPLICATION_READ', 'DOCUMENT_READ', 'INTERVIEW_READ', 'ASSESSMENT_READ', 'ASSESSMENT_WRITE'])),
  version: z.number().int().positive(),
}).strict()

export type ParticipantApplicationProjection = z.infer<typeof participantApplicationProjectionSchema>
