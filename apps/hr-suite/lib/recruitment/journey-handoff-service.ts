import type { JourneyActivateInput, JourneyPreviewInput } from '@/lib/journeys/runtime-service'
import { RecruitmentError } from './errors'

export interface RecruitmentJourneyRuntime {
  preview(input: JourneyPreviewInput): Promise<unknown>
  activate(input: JourneyActivateInput): Promise<{ readonly id: string; readonly version: number; readonly idempotentReplay: boolean }>
}

export function createRecruitmentJourneyHandoffService(runtime: RecruitmentJourneyRuntime) {
  return {
    async preview(input: JourneyPreviewInput & { readonly linkedEmployeeId: string | null }) {
      if (!input.linkedEmployeeId || input.targetEmployeeId !== input.linkedEmployeeId) throw new RecruitmentError('RECRUITMENT_JOURNEY_EMPLOYEE_LINK_REQUIRED', 409)
      return runtime.preview(input)
    },
    async activate(input: JourneyActivateInput & { readonly linkedEmployeeId: string | null }) {
      if (!input.linkedEmployeeId || input.targetEmployeeId !== input.linkedEmployeeId) throw new RecruitmentError('RECRUITMENT_JOURNEY_EMPLOYEE_LINK_REQUIRED', 409)
      return runtime.activate(input)
    },
  }
}
