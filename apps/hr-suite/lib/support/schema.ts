import { z } from 'zod'

const supportAdministrationSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  isActive: z.boolean(),
})

const supportEmployeeSchema = z.object({
  id: z.string().uuid(),
  employeeNumber: z.string(),
  firstName: z.string(),
  lastName: z.string(),
})

export const supportReadModelSchema = z.object({
  sessionId: z.string().uuid(),
  operator: z.object({
    displayName: z.string(),
    role: z.enum(['OWNER', 'OPERATOR']),
  }),
  expiresAt: z.string(),
  tenant: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    administrationMode: z.enum(['SEPARATE', 'COMBINED']),
  }),
  summary: z.object({
    administrationCount: z.number().int().nonnegative(),
    employeeCount: z.number().int().nonnegative(),
    activeEmploymentCount: z.number().int().nonnegative(),
  }),
  administrations: z.array(supportAdministrationSchema),
  employees: z.array(supportEmployeeSchema),
  employeeListTruncated: z.boolean(),
})

export type SupportReadModel = z.infer<typeof supportReadModelSchema>
