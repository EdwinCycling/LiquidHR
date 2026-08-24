import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import type { Database } from '@scope/db'
import type { AuthContext } from '@/lib/auth/permissions'
import { getRecruitmentApplication, type ApplicationDetail } from './application-service'
import { recruitmentGuidSchema } from './domain'

export const applicantDetailRouteParamsSchema = z.object({
  vacancyId: recruitmentGuidSchema,
  applicantId: recruitmentGuidSchema,
}).strict()

export type ApplicantDetailRouteParams = z.infer<typeof applicantDetailRouteParamsSchema>

export function applicantBelongsToVacancy(application: Pick<ApplicationDetail, 'vacancyId'>, vacancyId: string): boolean {
  return application.vacancyId === vacancyId
}

export async function getRecruitmentApplicantDetail(
  context: Pick<AuthContext, 'tenantId' | 'hrGroupId'>,
  params: ApplicantDetailRouteParams,
  supabase: SupabaseClient<Database>,
): Promise<ApplicationDetail | null> {
  const application = await getRecruitmentApplication(context, params.applicantId, supabase)
  return application && applicantBelongsToVacancy(application, params.vacancyId) ? application : null
}
