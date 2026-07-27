import { z } from 'zod'

const evidenceFields = {
  evidenceRequired: z.coerce.boolean().default(false),
  evidenceCategory: z.string().trim().max(120).nullable().optional(),
}

export const absenceTaskTemplateCreateSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/).transform((value) => value.toUpperCase()),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).nullable().optional(),
  dueAfterEffectiveDays: z.coerce.number().int().min(1).max(3650),
  ...evidenceFields,
}).strict().superRefine((value, context) => {
  if (value.evidenceRequired && !value.evidenceCategory) context.addIssue({ code: 'custom', path: ['evidenceCategory'], message: 'EVIDENCE_CATEGORY_REQUIRED' })
})

export const absenceTaskTemplateUpdateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  dueAfterEffectiveDays: z.coerce.number().int().min(1).max(3650).optional(),
  ...evidenceFields,
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 1)

export type AbsenceTaskTemplateCreateInput = z.infer<typeof absenceTaskTemplateCreateSchema>
export type AbsenceTaskTemplateUpdateInput = z.infer<typeof absenceTaskTemplateUpdateSchema>
