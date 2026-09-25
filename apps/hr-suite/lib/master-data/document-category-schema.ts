import { z } from 'zod'

const categoryFields = {
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  requiresSalaryPermission: z.boolean().optional(),
}

export const createDocumentCategorySchema = z.object({
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{1,39}$/),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).nullable().optional(),
  requiresSalaryPermission: z.boolean().default(false),
}).strict()

export const updateDocumentCategorySchema = z.object({
  ...categoryFields,
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.values(value).some((field) => field !== undefined), { message: 'MASTER_DATA_INPUT_INVALID' })

export type CreateDocumentCategory = z.infer<typeof createDocumentCategorySchema>
export type UpdateDocumentCategory = z.infer<typeof updateDocumentCategorySchema>
