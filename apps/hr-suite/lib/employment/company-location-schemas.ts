import { z } from 'zod'
import { databaseUuid } from '@/lib/validation/database-uuid'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const companyLocationMutationSchema = z.object({
  placementId: databaseUuid.nullish(),
  effectiveOn: dateOnly,
  locationId: databaseUuid,
}).strict()

export type CompanyLocationMutationInput = z.infer<typeof companyLocationMutationSchema>
