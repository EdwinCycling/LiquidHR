import { z } from 'zod'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const jobGroupCreateSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).nullish(),
}).strict()

export const jobCreateSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  jobGroupId: z.string().uuid(),
  description: z.string().trim().max(1000).nullish(),
  validFrom: dateOnly,
  validUntil: dateOnly.nullish(),
}).strict().refine((value) => !value.validUntil || value.validUntil > value.validFrom, { path: ['validUntil'], message: 'INVALID_PERIOD' })

const salaryStepSchema = z.object({
  stepCode: z.string().trim().min(1).max(40),
  stepName: z.string().trim().min(1).max(120),
  sequenceNumber: z.number().int().min(0).max(999),
  fulltimeAmount: z.number().nonnegative(),
  hourlyAmount: z.number().nonnegative().nullish(),
  stepKind: z.enum(['REGULAR', 'START', 'MAXIMUM', 'SPECIAL']),
}).strict()

export const salaryScaleCreateSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).nullish(),
}).strict()

export const salaryRevisionSchema = z.object({
  scaleId: z.string().uuid(),
  validFrom: dateOnly,
  validUntil: dateOnly.nullish(),
  description: z.string().trim().max(1000).nullish(),
  steps: z.array(salaryStepSchema).min(1).max(100),
}).strict().superRefine((value, context) => {
  if (value.validUntil && value.validUntil <= value.validFrom) context.addIssue({ code: 'custom', path: ['validUntil'], message: 'INVALID_PERIOD' })
  const codes = value.steps.map((step) => step.stepCode.toLocaleUpperCase('nl-NL'))
  const sequences = value.steps.map((step) => step.sequenceNumber)
  if (new Set(codes).size !== codes.length) context.addIssue({ code: 'custom', path: ['steps'], message: 'DUPLICATE_STEP_CODE' })
  if (new Set(sequences).size !== sequences.length) context.addIssue({ code: 'custom', path: ['steps'], message: 'DUPLICATE_SEQUENCE_NUMBER' })
})

export type JobGroupCreateInput = z.infer<typeof jobGroupCreateSchema>
export type JobCreateInput = z.infer<typeof jobCreateSchema>
export type SalaryScaleCreateInput = z.infer<typeof salaryScaleCreateSchema>
export type SalaryRevisionInput = z.infer<typeof salaryRevisionSchema>
