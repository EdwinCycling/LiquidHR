import { z } from 'zod'

export const employeeInvitationRequestSchema = z.object({
  employeeId: z.uuid(),
}).strict()

export const employeeBulkInvitationRequestSchema = z.object({
  employeeIds: z.array(z.uuid()).min(1).max(100),
}).strict()

export type EmployeeInvitationRequest = z.infer<typeof employeeInvitationRequestSchema>
export type EmployeeBulkInvitationRequest = z.infer<typeof employeeBulkInvitationRequestSchema>
