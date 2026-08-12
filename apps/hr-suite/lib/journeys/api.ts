import { NextResponse } from 'next/server'
import { z } from 'zod'
import { journeyTemplateDraftSchema } from './domain'
import { JourneyTemplateServiceError } from './template-service'

export const journeyIdSchema = z.string().uuid()
export const createJourneyTemplateSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9_-]{0,79}$/),
  draft: journeyTemplateDraftSchema,
}).strict()
export const saveJourneyTemplateSchema = z.object({ expectedRevision: z.number().int().positive(), draft: journeyTemplateDraftSchema }).strict()
export const publishJourneyTemplateSchema = z.object({ expectedRevision: z.number().int().positive() }).strict()

export function journeyHttpError(error: unknown): NextResponse {
  if (error instanceof JourneyTemplateServiceError) return NextResponse.json({ error: error.code, issues: error.issues }, { status: error.status })
  return NextResponse.json({ error: 'JOURNEY_TEMPLATE_OPERATION_FAILED' }, { status: 500 })
}
