import { z } from 'zod'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const companyLocationMutationSchema = z.object({
  placementId: z.string().uuid().nullish(),
  effectiveOn: dateOnly,
  locationId: z.string().uuid(),
}).strict()

export type CompanyLocationMutationInput = z.infer<typeof companyLocationMutationSchema>
