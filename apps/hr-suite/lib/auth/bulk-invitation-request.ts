import { z } from 'zod'
import { invitationRequestSchema } from '@/lib/auth/invitation-request'

export const bulkInvitationRequestSchema = z.object({
  items: z.array(invitationRequestSchema).min(1).max(100),
}).strict()

export type BulkInvitationRequest = z.infer<typeof bulkInvitationRequestSchema>
