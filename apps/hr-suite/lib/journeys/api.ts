import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { ModuleError } from '@/lib/modules/module-service'
import { databaseUuid } from '@/lib/validation/database-uuid'
import { journeyTemplateDraftSchema } from './domain'
import { JourneyTemplateServiceError } from './template-service'
import { JourneyRuntimeServiceError } from './runtime-service'

export const journeyIdSchema = databaseUuid
export const createJourneyTemplateSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9_-]{0,79}$/),
  draft: journeyTemplateDraftSchema,
}).strict()
export const saveJourneyTemplateSchema = z.object({ expectedRevision: z.number().int().positive(), draft: journeyTemplateDraftSchema }).strict()
export const publishJourneyTemplateSchema = z.object({ expectedRevision: z.number().int().positive() }).strict()
const manualParticipantsSchema = z.record(z.string().min(1), z.array(databaseUuid).max(25))
export const journeyPreviewSchema = z.object({
  templateVersionId: databaseUuid, targetEmployeeId: databaseUuid, employmentId: databaseUuid.nullable(),
  anchorDate: z.iso.date(), manualParticipants: manualParticipantsSchema.default({}),
}).strict()
export const journeyActivateSchema = journeyPreviewSchema.extend({ idempotencyKey: z.string().trim().min(8).max(160) }).strict()
export const journeyTransitionSchema = z.object({ expectedVersion: z.number().int().positive(), action: z.enum(['PAUSE', 'RESUME', 'CANCEL', 'COMPLETE']) }).strict()
export const journeyParticipantReplacementSchema = z.object({ replacementEmployeeId: databaseUuid, expectedVersion: z.number().int().positive(), reason: z.string().trim().min(1).max(500) }).strict()

export function journeyHttpError(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof ModuleError) return NextResponse.json({ error: error.code }, { status: error.status })
  if (error instanceof JourneyRuntimeServiceError) return NextResponse.json({ error: error.code, issues: error.issues }, { status: error.status })
  if (error instanceof JourneyTemplateServiceError) return NextResponse.json({ error: error.code, issues: error.issues }, { status: error.status })
  return NextResponse.json({ error: 'JOURNEY_TEMPLATE_OPERATION_FAILED' }, { status: 500 })
}
