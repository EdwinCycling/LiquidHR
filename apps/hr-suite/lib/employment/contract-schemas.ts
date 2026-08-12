import { z } from 'zod'
import { databaseUuid } from '@/lib/validation/database-uuid'
import { isBlockingProbationValidation, validateProbation } from './probation-rules'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const employmentContractMutationSchema = z.object({
  workerType: z.enum(['EMPLOYEE', 'STUDENT_INTERN', 'TEMPORARY_AGENCY', 'EXTERNAL_NO_PAYROLL']),
  flexPhaseId: databaseUuid.nullish(),
  laborConditionSetId: databaseUuid,
  durationType: z.enum(['INDEFINITE', 'DEFINITE', 'TEMPORARY_NO_END']),
  startsOn: dateOnly,
  endsOn: dateOnly.nullish(),
  probationApplies: z.boolean(),
  probationEndsOn: dateOnly.nullish(),
  caoAllowsTwoMonths: z.boolean().optional(),
}).strict().superRefine((value, context) => {
  if (value.workerType === 'TEMPORARY_AGENCY' && !value.flexPhaseId) {
    context.addIssue({ code: 'custom', path: ['flexPhaseId'], message: 'FLEX_PHASE_REQUIRED' })
  }
  if (value.workerType !== 'TEMPORARY_AGENCY' && value.flexPhaseId) {
    context.addIssue({ code: 'custom', path: ['flexPhaseId'], message: 'FLEX_PHASE_NOT_ALLOWED' })
  }
  if (value.durationType !== 'DEFINITE' && value.endsOn) {
    context.addIssue({ code: 'custom', path: ['endsOn'], message: 'CONTRACT_END_DATE_NOT_ALLOWED' })
  }
  if (value.durationType === 'DEFINITE' && (!value.endsOn || value.endsOn < value.startsOn)) {
    context.addIssue({ code: 'custom', path: ['endsOn'], message: 'CONTRACT_END_DATE_REQUIRED' })
  }
  if (value.probationApplies && (!value.probationEndsOn || value.probationEndsOn < value.startsOn)) {
    context.addIssue({ code: 'custom', path: ['probationEndsOn'], message: 'PROBATION_DATE_INVALID' })
  }
  // De route valideert de CAO-afwijking na het ophalen van de gekozen regeling.
  const probationError = validateProbation({ ...value, caoAllowsTwoMonths: value.caoAllowsTwoMonths === true })
  if (isBlockingProbationValidation(probationError)) {
    context.addIssue({ code: 'custom', path: ['probationEndsOn'], message: probationError })
  }
})

export type EmploymentContractMutationInput = z.infer<typeof employmentContractMutationSchema>

export function isEmploymentContractStartDateValid(
  startsOn: string,
  employmentStartsOn: string,
  isFirstContract: boolean,
): boolean {
  if (!startsOn || !employmentStartsOn || startsOn < employmentStartsOn) return false
  return !isFirstContract || startsOn === employmentStartsOn
}

export function isEmploymentContractEffectiveDateValid(
  effectiveOn: string,
  startsOn: string,
  endsOn: string | null,
): boolean {
  return Boolean(effectiveOn && startsOn && effectiveOn >= startsOn && (!endsOn || effectiveOn <= endsOn))
}
