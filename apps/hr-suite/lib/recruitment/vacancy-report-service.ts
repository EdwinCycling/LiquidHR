import type { Database } from '@scope/db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { AuthContext } from '@/lib/auth/permissions'
import { recruitmentGuidSchema } from './domain'
import { recruitmentDatabaseError, RecruitmentError } from './errors'

type SupabaseServerClient = SupabaseClient<Database>

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}, 'RECRUITMENT_REPORT_DATE_INVALID')

export const vacancyReportQuerySchema = z.object({
  periodFrom: dateOnlySchema.optional(),
  periodTo: dateOnlySchema.optional(),
  status: z.enum(['all', 'active', 'rejected', 'hired']).default('all'),
  stageId: recruitmentGuidSchema.optional(),
  source: z.enum(['all', 'MANUAL', 'PUBLIC']).default('all'),
}).strict().superRefine((value, context) => {
  if (value.periodFrom && value.periodTo && value.periodTo < value.periodFrom) {
    context.addIssue({ code: 'custom', path: ['periodTo'], message: 'RECRUITMENT_REPORT_PERIOD_INVALID' })
  }
})

export type VacancyReportQuery = z.infer<typeof vacancyReportQuerySchema>
export type VacancyReportSearchParams = Record<string, string | string[] | undefined>

export type VacancyReportApplicationInput = {
  readonly activeStageId: string | null
  readonly terminalOutcome: 'AFGEWEZEN' | 'AANGENOMEN' | null
  readonly source: 'MANUAL' | 'PUBLIC'
  readonly createdAt: string
  readonly terminalAt: string | null
  readonly anonymizedAt: string | null
}

export type VacancyReportStage = {
  readonly id: string
  readonly name: string
  readonly sortOrder: number
}

type VacancyReportVacancy = {
  readonly id: string
  readonly title: string
  readonly status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED'
}

export type VacancyReportStatusRow = {
  readonly key: string
  readonly kind: 'STAGE' | 'OUTCOME' | 'UNASSIGNED'
  readonly label: string | null
  readonly count: number
}

export type VacancyReport = {
  readonly vacancy: VacancyReportVacancy
  readonly query: {
    readonly periodFrom: string
    readonly periodTo: string
    readonly status: VacancyReportQuery['status']
    readonly stageId: string
    readonly source: VacancyReportQuery['source']
  }
  readonly stageOptions: readonly VacancyReportStage[]
  readonly metrics: {
    readonly totalApplications: number
    readonly activeApplications: number
    readonly hiredApplications: number
    readonly rejectedApplications: number
    readonly conversionRate: number | null
  }
  readonly statusBreakdown: readonly VacancyReportStatusRow[]
  readonly sourceBreakdown: readonly { readonly source: 'MANUAL' | 'PUBLIC'; readonly count: number }[]
}

const vacancyRowSchema = z.object({
  id: recruitmentGuidSchema,
  title: z.string(),
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED']),
})

const stageRowSchema = z.object({ id: recruitmentGuidSchema, name: z.string(), sort_order: z.number().int() })
const applicationRowSchema = z.object({
  active_stage_id: recruitmentGuidSchema.nullable(),
  terminal_outcome: z.enum(['AFGEWEZEN', 'AANGENOMEN']).nullable(),
  source: z.enum(['MANUAL', 'PUBLIC']),
  created_at: z.string(),
  terminal_at: z.string().nullable(),
  anonymized_at: z.string().nullable(),
})

function entries(params: VacancyReportSearchParams): Record<string, string> {
  return Object.fromEntries(Object.entries(params).flatMap(([key, value]) => {
    if (typeof value === 'string') return [[key, value] as const]
    if (Array.isArray(value) && typeof value[0] === 'string') return [[key, value[0]] as const]
    return []
  }))
}

export function parseVacancyReportQuery(params: VacancyReportSearchParams): VacancyReportQuery {
  const parsed = vacancyReportQuerySchema.safeParse(entries(params))
  if (!parsed.success) throw new RecruitmentError('RECRUITMENT_REPORT_INPUT_INVALID', 400)
  return parsed.data
}

export function defaultVacancyReportQuery(): VacancyReportQuery {
  return vacancyReportQuerySchema.parse({})
}

function startBoundary(value: string): string {
  return `${value}T00:00:00.000Z`
}

function endBoundary(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString()
}

function withinPeriod(createdAt: string, query: VacancyReportQuery): boolean {
  const timestamp = new Date(createdAt).valueOf()
  if (Number.isNaN(timestamp)) return false
  if (query.periodFrom && timestamp < new Date(startBoundary(query.periodFrom)).valueOf()) return false
  if (query.periodTo && timestamp >= new Date(endBoundary(query.periodTo)).valueOf()) return false
  return true
}

function matchesStatus(application: VacancyReportApplicationInput, query: VacancyReportQuery): boolean {
  if (query.status === 'active') return application.terminalOutcome === null
  if (query.status === 'rejected') return application.terminalOutcome === 'AFGEWEZEN'
  if (query.status === 'hired') return application.terminalOutcome === 'AANGENOMEN'
  return true
}

function filteredApplications(applications: readonly VacancyReportApplicationInput[], query: VacancyReportQuery): VacancyReportApplicationInput[] {
  return applications.filter((application) => application.anonymizedAt === null
    && withinPeriod(application.createdAt, query)
    && matchesStatus(application, query)
    && (query.stageId === undefined || application.activeStageId === query.stageId)
    && (query.source === 'all' || application.source === query.source))
}

export function buildRecruitmentVacancyReport(input: {
  readonly vacancy: VacancyReportVacancy
  readonly stages: readonly VacancyReportStage[]
  readonly applications: readonly VacancyReportApplicationInput[]
  readonly query: VacancyReportQuery
}): VacancyReport {
  const applications = filteredApplications(input.applications, input.query)
  const stageById = new Map(input.stages.map((stage) => [stage.id, stage]))
  const statuses = new Map<string, VacancyReportStatusRow>()
  const sources = new Map<'MANUAL' | 'PUBLIC', number>()

  for (const application of applications) {
    const sourceCount = sources.get(application.source) ?? 0
    sources.set(application.source, sourceCount + 1)

    // A terminal outcome is authoritative, even if an old active stage remains on the row.
    if (application.terminalOutcome) {
      const key = application.terminalOutcome
      const current = statuses.get(key)
      statuses.set(key, { key, kind: 'OUTCOME', label: null, count: (current?.count ?? 0) + 1 })
      continue
    }

    const stage = application.activeStageId ? stageById.get(application.activeStageId) : undefined
    const key = stage?.id ?? 'UNASSIGNED'
    const current = statuses.get(key)
    statuses.set(key, { key, kind: stage ? 'STAGE' : 'UNASSIGNED', label: stage?.name ?? null, count: (current?.count ?? 0) + 1 })
  }

  const activeApplications = applications.filter((application) => application.terminalOutcome === null).length
  const hiredApplications = applications.filter((application) => application.terminalOutcome === 'AANGENOMEN').length
  const rejectedApplications = applications.filter((application) => application.terminalOutcome === 'AFGEWEZEN').length
  const conversionRate = applications.length === 0 ? null : Math.round((hiredApplications / applications.length) * 1_000) / 10
  const stageOrder = new Map(input.stages.map((stage, index) => [stage.id, index]))
  const statusBreakdown = [...statuses.values()].sort((left, right) => {
    const leftOrder = left.kind === 'STAGE' ? stageOrder.get(left.key) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER
    const rightOrder = right.kind === 'STAGE' ? stageOrder.get(right.key) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    return left.key.localeCompare(right.key)
  })

  return {
    vacancy: input.vacancy,
    query: {
      periodFrom: input.query.periodFrom ?? '',
      periodTo: input.query.periodTo ?? '',
      status: input.query.status,
      stageId: input.query.stageId ?? 'all',
      source: input.query.source,
    },
    stageOptions: [...input.stages].sort((left, right) => left.sortOrder - right.sortOrder),
    metrics: { totalApplications: applications.length, activeApplications, hiredApplications, rejectedApplications, conversionRate },
    statusBreakdown,
    sourceBreakdown: [...sources.entries()].map(([source, count]) => ({ source, count })).sort((left, right) => left.source.localeCompare(right.source)),
  }
}

export async function getRecruitmentVacancyReport(
  context: Pick<AuthContext, 'tenantId' | 'hrGroupId'>,
  vacancyId: string,
  query: VacancyReportQuery,
  supabase: SupabaseServerClient,
): Promise<VacancyReport> {
  if (!context.hrGroupId) throw new RecruitmentError('RECRUITMENT_HR_GROUP_REQUIRED', 403)
  const parsedVacancyId = recruitmentGuidSchema.safeParse(vacancyId)
  if (!parsedVacancyId.success) throw new RecruitmentError('RECRUITMENT_VACANCY_NOT_FOUND', 404)

  const vacancyResult = await supabase.from('recruitment_vacancies')
    .select('id,title,status')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', context.hrGroupId)
    .eq('id', parsedVacancyId.data)
    .maybeSingle()
  if (vacancyResult.error) throw recruitmentDatabaseError(vacancyResult.error)
  if (!vacancyResult.data) throw new RecruitmentError('RECRUITMENT_VACANCY_NOT_FOUND', 404)

  let applicationQuery = supabase.from('recruitment_applications')
    .select('active_stage_id,terminal_outcome,source,created_at,terminal_at,anonymized_at')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', context.hrGroupId)
    .eq('vacancy_id', parsedVacancyId.data)
    .is('anonymized_at', null)
    .order('created_at', { ascending: false })
    .limit(5_000)
  if (query.periodFrom) applicationQuery = applicationQuery.gte('created_at', startBoundary(query.periodFrom))
  if (query.periodTo) applicationQuery = applicationQuery.lt('created_at', endBoundary(query.periodTo))
  if (query.status === 'active') applicationQuery = applicationQuery.is('terminal_outcome', null)
  if (query.status === 'rejected') applicationQuery = applicationQuery.eq('terminal_outcome', 'AFGEWEZEN')
  if (query.status === 'hired') applicationQuery = applicationQuery.eq('terminal_outcome', 'AANGENOMEN')
  if (query.stageId) applicationQuery = applicationQuery.eq('active_stage_id', query.stageId)
  if (query.source !== 'all') applicationQuery = applicationQuery.eq('source', query.source)

  const [applicationsResult, stagesResult] = await Promise.all([
    applicationQuery,
    supabase.from('recruitment_pipeline_stages')
      .select('id,name,sort_order')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId)
      .order('sort_order')
      .limit(100),
  ])
  if (applicationsResult.error) throw recruitmentDatabaseError(applicationsResult.error)
  if (stagesResult.error) throw recruitmentDatabaseError(stagesResult.error)

  const vacancy = vacancyRowSchema.parse(vacancyResult.data)
  return buildRecruitmentVacancyReport({
    vacancy,
    query,
    stages: stagesResult.data.map((row) => {
      const stage = stageRowSchema.parse(row)
      return { id: stage.id, name: stage.name, sortOrder: stage.sort_order }
    }),
    applications: applicationsResult.data.map((row) => {
      const application = applicationRowSchema.parse(row)
      return {
        activeStageId: application.active_stage_id,
        terminalOutcome: application.terminal_outcome,
        source: application.source,
        createdAt: application.created_at,
        terminalAt: application.terminal_at,
        anonymizedAt: application.anonymized_at,
      }
    }),
  })
}
