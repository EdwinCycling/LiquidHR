import type { Database } from '@scope/db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { AuthContext } from '@/lib/auth/permissions'
import { getRecruitmentAnalytics } from './guided-service'
import { listRecruitmentVacancies, type VacancySummary } from './vacancy-service'

type SupabaseServerClient = SupabaseClient<Database>

const nonNegativeInteger = z.number().int().min(0)

const recruitmentOverviewAnalyticsSchema = z.object({
  global: z.object({
    openVacancies: nonNegativeInteger,
    activeApplications: nonNegativeInteger,
    newApplications: nonNegativeInteger,
  }).strict(),
  byVacancy: z.array(z.object({
    vacancyId: z.string().min(1),
    totalApplications: nonNegativeInteger,
    newApplications: nonNegativeInteger,
    rejected: nonNegativeInteger,
    hired: nonNegativeInteger,
  }).strict()),
}).strict()

export type RecruitmentOverviewAnalytics = z.infer<typeof recruitmentOverviewAnalyticsSchema>

export interface RecruitmentOverviewData {
  readonly vacancies: readonly VacancySummary[]
  readonly analytics: RecruitmentOverviewAnalytics | null
  readonly analyticsError: boolean
}

export function parseRecruitmentOverviewAnalytics(value: unknown): RecruitmentOverviewAnalytics {
  return recruitmentOverviewAnalyticsSchema.parse(value)
}

export function getRecruitmentOverviewCapabilities(permissions: readonly string[]) {
  return {
    canCreateVacancy: permissions.includes('recruitment-vacancy:write'),
    canManageSettings: permissions.includes('recruitment-settings:manage'),
    canReadCandidates: permissions.includes('recruitment-candidate:read'),
    canReadAssigned: permissions.includes('recruitment-participation:read'),
  }
}

export async function getRecruitmentOverview(
  context: Pick<AuthContext, 'tenantId' | 'hrGroupId' | 'permissions'>,
  supabase: SupabaseServerClient,
): Promise<RecruitmentOverviewData> {
  const analyticsPromise = context.permissions.includes('recruitment-candidate:read')
    ? getRecruitmentAnalytics(context, supabase).then(parseRecruitmentOverviewAnalytics)
    : Promise.resolve<RecruitmentOverviewAnalytics | null>(null)
  const [vacanciesResult, analyticsResult] = await Promise.allSettled([
    listRecruitmentVacancies(context, supabase),
    analyticsPromise,
  ])

  if (vacanciesResult.status === 'rejected') throw vacanciesResult.reason

  return {
    vacancies: vacanciesResult.value,
    analytics: analyticsResult.status === 'fulfilled' ? analyticsResult.value : null,
    analyticsError: analyticsResult.status === 'rejected',
  }
}
