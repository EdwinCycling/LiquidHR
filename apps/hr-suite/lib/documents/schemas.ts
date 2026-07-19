import { z } from 'zod'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const audienceType = z.enum(['EMPLOYEE', 'MANAGEMENT_ROLE', 'DEPARTMENT_BRANCH'])
const reminderAudienceType = z.enum(['EMPLOYEE', 'MANAGEMENT_ROLE'])
const target = z.object({ type: audienceType, targetId: z.string().uuid() }).strict()
const reminderTarget = z.object({ type: reminderAudienceType, targetId: z.string().uuid() }).strict()

export const documentMetadataSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullish(),
  tags: z.array(z.string().trim().min(1).max(50)).max(30).transform((tags) => [...new Set(tags.map((tag) => tag.toLocaleLowerCase('nl-NL')))]),
  categoryId: z.string().uuid(),
  expiresOn: dateOnly.nullish(),
  audiences: z.array(target).min(1, 'DOCUMENT_AUDIENCE_REQUIRED').max(100).transform((items) => [...new Map(items.map((item) => [`${item.type}:${item.targetId}`, item])).values()]),
  reminder: z.object({
    remindAt: z.string().datetime({ offset: true }),
    targets: z.array(reminderTarget).min(1, 'DOCUMENT_REMINDER_TARGET_REQUIRED').max(100),
  }).strict().nullable(),
}).strict().superRefine((value, context) => {
  if (value.reminder && !value.expiresOn) context.addIssue({ code: 'custom', path: ['expiresOn'], message: 'DOCUMENT_EXPIRY_REQUIRED' })
})

export const documentDeleteSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict()
export type DocumentMetadataInput = z.infer<typeof documentMetadataSchema>
export type DocumentDeleteInput = z.infer<typeof documentDeleteSchema>
