import { z } from 'zod'
import { normalizeBsn } from '@/lib/security/bsn-fingerprint'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const employmentRequestShape = {
  employmentNumber: z.string().trim().min(1).max(40),
  employmentType: z.enum(['EMPLOYEE', 'INTERN', 'APPRENTICE', 'CONTRACTOR']).default('EMPLOYEE'),
  contractType: z.enum(['INDEFINITE', 'DEFINITE', 'ON_CALL', 'TEMPORARY_AGENCY', 'EXTERNAL']),
  startsOn: dateOnly,
  endsOn: dateOnly.nullish(),
  probationEndsOn: dateOnly.nullish(),
  seniorityDate: dateOnly,
  originalHireDate: dateOnly,
  isPrimary: z.boolean().default(false),
  reasonStarted: z.string().trim().max(500).nullish(),
  contractDocumentUrl: z.url().max(2_000).nullish(),
}

type EmploymentDateFields = {
  startsOn: string
  endsOn?: string | null
  probationEndsOn?: string | null
  seniorityDate: string
  originalHireDate: string
}

function validateEmploymentDates(
  value: EmploymentDateFields,
  context: z.core.$RefinementCtx<EmploymentDateFields>,
): void {
    if (value.endsOn && value.endsOn < value.startsOn) {
      context.addIssue({ code: 'custom', path: ['endsOn'], message: 'EMPLOYMENT_DATE_RANGE_INVALID' })
    }
    if (value.probationEndsOn && value.probationEndsOn < value.startsOn) {
      context.addIssue({ code: 'custom', path: ['probationEndsOn'], message: 'PROBATION_DATE_INVALID' })
    }
    if (value.seniorityDate > value.startsOn || value.originalHireDate > value.startsOn) {
      context.addIssue({ code: 'custom', path: ['startsOn'], message: 'HIRE_HISTORY_DATE_INVALID' })
    }
}

export const createEmploymentRequestSchema = z
  .object(employmentRequestShape)
  .strict()
  .superRefine(validateEmploymentDates)

export const createEmploymentSchema = z
  .object({ employeeId: z.string().uuid(), ...employmentRequestShape })
  .strict()
  .superRefine(validateEmploymentDates)

export const identityMatchSchema = z
  .object({
    bsn: z.string().max(20).optional(),
    birthDate: dateOnly.optional(),
    birthName: z.string().trim().min(1).max(120).optional(),
    initials: z.string().trim().max(20).optional(),
    privateEmail: z.email().max(254).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.bsn) {
      try {
        normalizeBsn(value.bsn)
      } catch {
        context.addIssue({ code: 'custom', path: ['bsn'], message: 'BSN_INVALID' })
      }
      return
    }
    if (!value.birthDate || !value.birthName) {
      context.addIssue({ code: 'custom', message: 'IDENTITY_SIGNALS_REQUIRED' })
    }
  })

export const terminationSchema = z
  .object({
    lastWorkingDay: dateOnly,
    internalReasonId: z.string().uuid(),
    statutoryReasonId: z.string().uuid(),
    initiator: z.enum(['EMPLOYER', 'EMPLOYEE', 'MUTUAL', 'BY_LAW', 'OTHER']),
    explanation: z.string().trim().max(2_000).nullish(),
  })
  .strict()

export type CreateEmploymentInput = z.infer<typeof createEmploymentSchema>
export type IdentityMatchInput = z.infer<typeof identityMatchSchema>
export type TerminationInput = z.infer<typeof terminationSchema>
