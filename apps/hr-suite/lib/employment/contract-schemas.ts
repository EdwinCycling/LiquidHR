import { z } from 'zod'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const employmentContractMutationSchema = z.object({
  workerType: z.enum(['EMPLOYEE', 'STUDENT_INTERN', 'TEMPORARY_AGENCY', 'EXTERNAL_NO_PAYROLL']),
  flexPhaseId: z.string().uuid().nullish(),
  laborConditionSetId: z.string().uuid(),
  durationType: z.enum(['INDEFINITE', 'DEFINITE']),
  startsOn: dateOnly,
  endsOn: dateOnly.nullish(),
  probationApplies: z.boolean(),
  probationEndsOn: dateOnly.nullish(),
}).strict().superRefine((value, context) => {
  if (value.workerType === 'TEMPORARY_AGENCY' && !value.flexPhaseId) {
    context.addIssue({ code: 'custom', path: ['flexPhaseId'], message: 'FLEX_PHASE_REQUIRED' })
  }
  if (value.workerType !== 'TEMPORARY_AGENCY' && value.flexPhaseId) {
    context.addIssue({ code: 'custom', path: ['flexPhaseId'], message: 'FLEX_PHASE_NOT_ALLOWED' })
  }
  if (value.durationType === 'INDEFINITE' && value.endsOn) {
    context.addIssue({ code: 'custom', path: ['endsOn'], message: 'CONTRACT_END_DATE_NOT_ALLOWED' })
  }
  if (value.durationType === 'DEFINITE' && (!value.endsOn || value.endsOn < value.startsOn)) {
    context.addIssue({ code: 'custom', path: ['endsOn'], message: 'CONTRACT_END_DATE_REQUIRED' })
  }
  if (value.probationApplies && (!value.probationEndsOn || value.probationEndsOn < value.startsOn)) {
    context.addIssue({ code: 'custom', path: ['probationEndsOn'], message: 'PROBATION_DATE_INVALID' })
  }
  if (!value.probationApplies && value.probationEndsOn) {
    context.addIssue({ code: 'custom', path: ['probationEndsOn'], message: 'PROBATION_DATE_NOT_ALLOWED' })
  }
})

export type EmploymentContractMutationInput = z.infer<typeof employmentContractMutationSchema>
