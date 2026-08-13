import { z } from 'zod'
import { recruitmentGuidSchema, terminalOutcomeSchema } from './domain'

const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum)

export const terminalTransitionSchema = z.object({
  applicationId: recruitmentGuidSchema,
  outcome: terminalOutcomeSchema,
  reason: boundedText(2_000),
  expectedVersion: z.number().int().positive(),
  idempotencyKey: boundedText(160),
}).strict()

export const hireConversionSchema = z.object({
  applicationId: recruitmentGuidSchema,
  administrationId: recruitmentGuidSchema,
  employeeChoice: z.enum(['EXISTING', 'NEW', 'REHIRE']),
  employeeId: recruitmentGuidSchema.nullable(),
  employmentId: recruitmentGuidSchema.nullable(),
  expectedVersion: z.number().int().positive(),
  idempotencyKey: boundedText(160),
}).strict().superRefine((value, context) => {
  if (value.employeeChoice !== 'NEW' && value.employeeId === null) {
    context.addIssue({ code: 'custom', path: ['employeeId'], message: 'RECRUITMENT_EMPLOYEE_CHOICE_REQUIRED' })
  }
})

export const publicApplicationSchema = z.object({
  publicationId: recruitmentGuidSchema,
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180),
  firstName: boundedText(120),
  lastName: boundedText(160),
  privateEmail: z.email().max(254),
  phone: z.string().trim().max(40).nullable(),
  motivation: z.string().trim().max(10_000).nullable(),
  answers: z.array(z.object({ questionId: recruitmentGuidSchema, value: z.unknown() }).strict()).max(100),
  challengeToken: boundedText(4_000),
  honeypot: z.string().max(0),
  renderedAt: z.iso.datetime(),
  idempotencyKey: boundedText(160),
}).strict()

export type TerminalTransitionPayload = z.infer<typeof terminalTransitionSchema>
export type HireConversionPayload = z.infer<typeof hireConversionSchema>
export type PublicApplicationPayload = z.infer<typeof publicApplicationSchema>
