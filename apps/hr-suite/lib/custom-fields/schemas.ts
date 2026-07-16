import { z } from 'zod'

const accessSchema = z.enum(['HIDDEN', 'READ', 'WRITE'])
const fieldTypeSchema = z.enum([
  'TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'AUTO_INCREMENT',
])
const optionSchema = z.object({
  value: z.string().trim().min(1).max(120),
  labelNl: z.string().trim().min(1).max(120),
  labelEn: z.string().trim().min(1).max(120),
  sortOrder: z.number().int().min(0).max(10000).default(0),
})

export const customFieldDefinitionSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,62}$/),
  labelNl: z.string().trim().min(1).max(120),
  labelEn: z.string().trim().min(1).max(120),
  descriptionNl: z.string().trim().max(500).nullable().optional(),
  descriptionEn: z.string().trim().max(500).nullable().optional(),
  fieldType: fieldTypeSchema,
  isRequired: z.boolean().default(false),
  hrAccess: accessSchema.default('WRITE'),
  managerAccess: accessSchema.default('HIDDEN'),
  employeeSelfAccess: accessSchema.default('HIDDEN'),
  sortOrder: z.number().int().min(0).max(10000).default(0),
  options: z.array(optionSchema).max(250).default([]),
}).superRefine((value, context) => {
  const needsOptions = value.fieldType === 'SELECT' || value.fieldType === 'MULTI_SELECT'
  if (needsOptions && value.options.length === 0) {
    context.addIssue({ code: 'custom', path: ['options'], message: 'SELECT_OPTIONS_REQUIRED' })
  }
  if (!needsOptions && value.options.length > 0) {
    context.addIssue({ code: 'custom', path: ['options'], message: 'SELECT_OPTIONS_NOT_ALLOWED' })
  }
})

export const customFieldDefinitionUpdateSchema = z.object({
  labelNl: z.string().trim().min(1).max(120).optional(),
  labelEn: z.string().trim().min(1).max(120).optional(),
  descriptionNl: z.string().trim().max(500).nullable().optional(),
  descriptionEn: z.string().trim().max(500).nullable().optional(),
  isRequired: z.boolean().optional(),
  hrAccess: accessSchema.optional(),
  managerAccess: accessSchema.optional(),
  employeeSelfAccess: accessSchema.optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0)

export const customFieldValuesSchema = z.record(z.string().regex(/^[a-z][a-z0-9_]{1,62}$/), z.json())

export type CustomFieldDefinitionInput = z.infer<typeof customFieldDefinitionSchema>
export type CustomFieldDefinitionUpdateInput = z.infer<typeof customFieldDefinitionUpdateSchema>
export type CustomFieldValuesInput = z.infer<typeof customFieldValuesSchema>
