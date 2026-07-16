import { z } from 'zod'

export const invitationRequestSchema = z.object({
  email: z.string().trim().email().max(254),
  emailKind: z.enum(['PRIVATE', 'BUSINESS']),
  purpose: z.enum(['PREBOARDING_EMPLOYEE', 'BUSINESS_USER']),
  employeeId: z.uuid().nullable().optional(),
  administrationId: z.uuid().nullable().optional(),
  managementRoleId: z.uuid(),
  scopeType: z.enum(['TENANT', 'ADMINISTRATION']),
}).strict()

export type InvitationRequest = z.infer<typeof invitationRequestSchema>
