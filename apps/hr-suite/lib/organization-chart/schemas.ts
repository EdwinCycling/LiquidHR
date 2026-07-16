import { z } from 'zod'

const optionalTrimmed = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().max(160).optional(),
)

export const organizationChartQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  q: optionalTrimmed,
  department: z.string().uuid().optional(),
  role: optionalTrimmed,
  field: z.string().uuid().optional(),
  value: optionalTrimmed,
}).strict().superRefine((value, context) => {
  if ((value.field && !value.value) || (!value.field && value.value)) {
    context.addIssue({ code: 'custom', path: ['field'], message: 'CUSTOM_FIELD_FILTER_INCOMPLETE' })
  }
})

export type OrganizationChartQuery = z.infer<typeof organizationChartQuerySchema>
