import { z } from 'zod'

export const employeeNoteCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000),
}).strict()

export const employeeNoteUpdateSchema = employeeNoteCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'EMPLOYEE_NOTE_UPDATE_REQUIRED',
)

export type EmployeeNoteCreateInput = z.infer<typeof employeeNoteCreateSchema>
export type EmployeeNoteUpdateInput = z.infer<typeof employeeNoteUpdateSchema>
