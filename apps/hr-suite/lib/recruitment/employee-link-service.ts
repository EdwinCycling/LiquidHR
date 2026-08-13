import { z } from 'zod'
import { RecruitmentError } from './errors'

export const recruitmentEmployeeMatchInputSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(160),
  privateEmail: z.email().max(254).nullable(),
  phone: z.string().trim().max(40).nullable(),
}).strict()

export const hireChoiceSchema = z.object({
  choice: z.enum(['EXISTING', 'NEW', 'REHIRE']),
  employeeId: z.guid().nullable(),
}).strict()

export type HireChoice = z.infer<typeof hireChoiceSchema>

export function requireHumanHireChoice(input: HireChoice): HireChoice {
  if (input.choice !== 'NEW' && !input.employeeId) throw new RecruitmentError('RECRUITMENT_EMPLOYEE_CHOICE_REQUIRED', 409)
  return input
}

export function buildMinimalEmployeeTransfer(input: { readonly firstName: string; readonly middleName?: string | null; readonly lastName: string; readonly privateEmail: string | null; readonly phone: string | null } & Record<string, unknown>): {
  readonly firstName: string
  readonly middleName?: string | null
  readonly lastName: string
  readonly privateEmail: string | null
  readonly phone: string | null
} {
  return {
    firstName: input.firstName,
    ...(input.middleName !== undefined ? { middleName: input.middleName } : {}),
    lastName: input.lastName,
    privateEmail: input.privateEmail,
    phone: input.phone,
  }
}

export interface RecruitmentEmployeeMatch {
  readonly employeeId: string
  readonly employeeNumber: string
  readonly displayName: string
  readonly matchedSignals: readonly ('NAME' | 'PRIVATE_EMAIL' | 'PHONE')[]
}

export interface RecruitmentEmployeeLinkRepository {
  findCandidates(input: z.infer<typeof recruitmentEmployeeMatchInputSchema>): Promise<readonly RecruitmentEmployeeMatch[]>
}

export function createRecruitmentEmployeeLinkService(dependencies: {
  readonly repository: RecruitmentEmployeeLinkRepository
  readonly authorizeEmployeeMatch: () => Promise<void>
}) {
  return {
    async candidates(input: z.infer<typeof recruitmentEmployeeMatchInputSchema>) {
      await dependencies.authorizeEmployeeMatch()
      const parsed = recruitmentEmployeeMatchInputSchema.parse(input)
      const candidates = await dependencies.repository.findCandidates(parsed)
      return { candidates, requiresHumanDecision: true as const }
    },
    requireExplicitChoice(employeeId: string | null) {
      if (!employeeId) throw new RecruitmentError('RECRUITMENT_EMPLOYEE_CHOICE_REQUIRED', 409)
      return employeeId
    },
  }
}
